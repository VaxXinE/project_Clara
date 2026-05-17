from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session, selectinload

from app.models.conversation import Conversation
from app.models.lead import Lead
from app.models.lead_deal import LeadDeal
from app.models.lead_task import LeadTask
from app.models.user import User
from app.schemas.lead_schema import (
    LeadDealItem,
    LeadDealUpsertRequest,
    LeadDetail,
    LeadListItem,
    LeadUpdateRequest,
)
from app.services.access_control_service import can_access_all_conversations
from app.services.lead_task_service import (
    list_tasks_for_lead,
    upsert_follow_up_task_for_lead,
    validate_assignee_for_lead,
)

VALID_LEAD_STAGES = {
    "new_lead",
    "qualification",
    "education",
    "objection",
    "negotiation",
    "closing",
    "won",
    "lost",
    "unknown",
}
VALID_TEMPERATURES = {"cold", "warm", "hot", "unknown"}
VALID_DEAL_STATUSES = {"open", "won", "lost"}


def derive_lead_display_name(
    *,
    conversation: Conversation,
    preferred_name: str | None = None,
) -> str:
    if preferred_name and preferred_name.strip():
        return preferred_name.strip()

    customer_messages = [
        message
        for message in conversation.messages
        if message.sender_type == "customer" and message.sender_name.strip()
    ]
    if customer_messages:
        return customer_messages[0].sender_name.strip()

    return conversation.title.strip()


def ensure_conversation_lead(
    db: Session,
    *,
    conversation: Conversation,
    preferred_name: str | None = None,
) -> Lead:
    if conversation.lead_id is not None:
        lead = db.get(Lead, conversation.lead_id)
        if lead is not None:
            return lead

    lead = Lead(
        organization_id=conversation.organization_id,
        assigned_user_id=conversation.sales_user_id,
        display_name=derive_lead_display_name(
            conversation=conversation,
            preferred_name=preferred_name,
        ),
        source=conversation.source,
        current_stage=conversation.current_stage,
        lead_temperature=conversation.lead_temperature,
        last_contact_at=conversation.last_message_at,
    )
    db.add(lead)
    db.flush()

    conversation.lead_id = lead.id
    db.add(conversation)
    db.flush()

    return lead


def sync_lead_from_conversation(
    db: Session,
    *,
    conversation: Conversation,
    customer_summary: str | None = None,
    next_follow_up_at: datetime | None = None,
) -> Lead:
    lead = ensure_conversation_lead(db=db, conversation=conversation)
    lead.organization_id = conversation.organization_id
    lead.assigned_user_id = conversation.sales_user_id
    lead.display_name = derive_lead_display_name(conversation=conversation)
    lead.source = conversation.source
    lead.current_stage = conversation.current_stage
    lead.lead_temperature = conversation.lead_temperature
    lead.last_contact_at = conversation.last_message_at
    if customer_summary:
        lead.summary = customer_summary
    if next_follow_up_at is not None:
        lead.next_follow_up_at = next_follow_up_at

    db.add(lead)
    db.flush()
    if next_follow_up_at is not None:
        upsert_follow_up_task_for_lead(db=db, lead=lead)
    return lead


def build_lead_list_item(lead: Lead) -> LeadListItem:
    ordered_conversations = sorted(
        lead.conversations,
        key=lambda conversation: (
            conversation.last_message_at or conversation.created_at,
            conversation.created_at,
        ),
        reverse=True,
    )
    latest_conversation = ordered_conversations[0] if ordered_conversations else None

    return LeadListItem(
        id=lead.id,
        organization_id=lead.organization_id,
        assigned_user_id=lead.assigned_user_id,
        assigned_user_name=lead.assigned_user.name if lead.assigned_user else None,
        display_name=lead.display_name,
        source=lead.source,
        current_stage=lead.current_stage,
        lead_temperature=lead.lead_temperature,
        summary=lead.summary,
        notes=lead.notes,
        last_contact_at=lead.last_contact_at,
        next_follow_up_at=lead.next_follow_up_at,
        created_at=lead.created_at,
        updated_at=lead.updated_at,
        conversation_count=len(lead.conversations),
        latest_conversation_id=latest_conversation.id if latest_conversation else None,
    )


def build_lead_deal_item(deal: LeadDeal) -> LeadDealItem:
    return LeadDealItem(
        id=deal.id,
        lead_id=deal.lead_id,
        organization_id=deal.organization_id,
        owner_user_id=deal.owner_user_id,
        owner_user_name=deal.owner_user.name if deal.owner_user else None,
        status=deal.status,
        currency=deal.currency,
        expected_value=float(deal.expected_value),
        deposit_amount=float(deal.deposit_amount),
        expected_close_date=deal.expected_close_date,
        closed_at=deal.closed_at,
        notes=deal.notes,
        created_at=deal.created_at,
        updated_at=deal.updated_at,
    )


def build_lead_detail(lead: Lead) -> LeadDetail:
    list_item = build_lead_list_item(lead)
    return LeadDetail(
        **list_item.model_dump(),
        conversation_ids=[
            conversation.id
            for conversation in sorted(
                lead.conversations,
                key=lambda item: item.created_at,
            )
        ],
        deal=build_lead_deal_item(lead.deal) if lead.deal else None,
        tasks=list_tasks_for_lead(lead),
    )


def get_lead_model_for_user(
    db: Session,
    *,
    lead_id: UUID,
    current_user: User,
) -> Lead:
    statement = (
        select(Lead)
        .where(Lead.id == lead_id)
        .options(
            selectinload(Lead.conversations),
            selectinload(Lead.assigned_user),
            selectinload(Lead.tasks).selectinload(LeadTask.assigned_user),
            selectinload(Lead.deal).selectinload(LeadDeal.owner_user),
        )
    )
    lead = db.scalars(statement).first()

    if lead is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found.",
        )

    if current_user.organization_id is None or lead.organization_id != current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found.",
        )

    if not can_access_all_conversations(current_user) and lead.assigned_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found.",
        )

    return lead


def get_leads_for_user(db: Session, *, current_user: User) -> list[LeadListItem]:
    if current_user.organization_id is None:
        return []

    statement = (
        select(Lead)
        .where(Lead.organization_id == current_user.organization_id)
        .options(
            selectinload(Lead.conversations),
            selectinload(Lead.assigned_user),
        )
        .order_by(desc(Lead.last_contact_at), desc(Lead.created_at))
    )

    if not can_access_all_conversations(current_user):
        statement = statement.where(Lead.assigned_user_id == current_user.id)

    leads = list(db.scalars(statement).all())
    return [build_lead_list_item(lead) for lead in leads]


def get_lead_for_user(
    db: Session,
    *,
    lead_id: UUID,
    current_user: User,
) -> LeadDetail:
    lead = get_lead_model_for_user(
        db=db,
        lead_id=lead_id,
        current_user=current_user,
    )
    return build_lead_detail(lead)


def update_lead_for_user(
    db: Session,
    *,
    lead_id: UUID,
    payload: LeadUpdateRequest,
    current_user: User,
) -> LeadDetail:
    lead = get_lead_model_for_user(
        db=db,
        lead_id=lead_id,
        current_user=current_user,
    )

    if payload.current_stage is not None:
        if payload.current_stage not in VALID_LEAD_STAGES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid lead stage.",
            )
        lead.current_stage = payload.current_stage

    if payload.lead_temperature is not None:
        if payload.lead_temperature not in VALID_TEMPERATURES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid lead temperature.",
            )
        lead.lead_temperature = payload.lead_temperature

    if payload.summary is not None:
        lead.summary = payload.summary.strip() or None

    if payload.notes is not None:
        lead.notes = payload.notes.strip() or None

    if "next_follow_up_at" in payload.model_fields_set:
        lead.next_follow_up_at = payload.next_follow_up_at

    if "assigned_user_id" in payload.model_fields_set:
        if not can_access_all_conversations(current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admin can reassign leads.",
            )

        assignee = validate_assignee_for_lead(
            db=db,
            lead=lead,
            assignee_id=payload.assigned_user_id,
        )
        lead.assigned_user_id = assignee.id if assignee else None

    for conversation in lead.conversations:
        if payload.current_stage is not None:
            conversation.current_stage = lead.current_stage
        if payload.lead_temperature is not None:
            conversation.lead_temperature = lead.lead_temperature
        if "assigned_user_id" in payload.model_fields_set:
            conversation.sales_user_id = lead.assigned_user_id
        db.add(conversation)

    if "assigned_user_id" in payload.model_fields_set and lead.deal is not None:
        lead.deal.owner_user_id = lead.assigned_user_id
        db.add(lead.deal)

    db.add(lead)
    if (
        "next_follow_up_at" in payload.model_fields_set
        or "assigned_user_id" in payload.model_fields_set
    ):
        upsert_follow_up_task_for_lead(db=db, lead=lead)
    db.commit()
    db.refresh(lead)

    return build_lead_detail(lead)


def get_lead_deal_for_user(
    db: Session,
    *,
    lead_id: UUID,
    current_user: User,
) -> LeadDealItem | None:
    lead = get_lead_model_for_user(db=db, lead_id=lead_id, current_user=current_user)
    if lead.deal is None:
        return None
    return build_lead_deal_item(lead.deal)


def upsert_lead_deal_for_user(
    db: Session,
    *,
    lead_id: UUID,
    payload: LeadDealUpsertRequest,
    current_user: User,
) -> LeadDealItem:
    lead = get_lead_model_for_user(db=db, lead_id=lead_id, current_user=current_user)

    if payload.status is not None and payload.status not in VALID_DEAL_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid deal status.",
        )

    if payload.expected_value is not None and payload.expected_value < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Expected value cannot be negative.",
        )

    if payload.deposit_amount is not None and payload.deposit_amount < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Deposit amount cannot be negative.",
        )

    deal = lead.deal
    if deal is None:
        deal = LeadDeal(
            lead_id=lead.id,
            organization_id=lead.organization_id,
            owner_user_id=lead.assigned_user_id,
        )

    deal.organization_id = lead.organization_id
    deal.owner_user_id = lead.assigned_user_id

    if payload.status is not None:
        deal.status = payload.status
    if payload.currency is not None:
        currency = payload.currency.strip().upper()
        if not currency:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Currency cannot be empty.",
            )
        deal.currency = currency
    if payload.expected_value is not None:
        deal.expected_value = payload.expected_value
    if payload.deposit_amount is not None:
        deal.deposit_amount = payload.deposit_amount
    if "expected_close_date" in payload.model_fields_set:
        deal.expected_close_date = payload.expected_close_date
    if "closed_at" in payload.model_fields_set:
        deal.closed_at = payload.closed_at
    if payload.notes is not None:
        deal.notes = payload.notes.strip() or None

    if deal.status == "won" and deal.closed_at is None:
        deal.closed_at = datetime.now(timezone.utc)
    if deal.status == "open":
        deal.closed_at = None

    db.add(deal)
    db.commit()
    db.refresh(deal)
    return build_lead_deal_item(deal)
