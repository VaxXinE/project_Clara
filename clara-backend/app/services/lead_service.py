from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session, selectinload

from app.models.conversation import Conversation
from app.models.lead import Lead
from app.models.user import User
from app.schemas.lead_schema import LeadDetail, LeadListItem, LeadUpdateRequest
from app.services.access_control_service import can_access_all_conversations

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
    )


def get_leads_for_user(db: Session, *, current_user: User) -> list[LeadListItem]:
    if current_user.organization_id is None:
        return []

    statement = (
        select(Lead)
        .where(Lead.organization_id == current_user.organization_id)
        .options(selectinload(Lead.conversations))
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
    statement = (
        select(Lead)
        .where(Lead.id == lead_id)
        .options(selectinload(Lead.conversations))
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

    return build_lead_detail(lead)


def update_lead_for_user(
    db: Session,
    *,
    lead_id: UUID,
    payload: LeadUpdateRequest,
    current_user: User,
) -> LeadDetail:
    statement = (
        select(Lead)
        .where(Lead.id == lead_id)
        .options(selectinload(Lead.conversations))
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

    if payload.next_follow_up_at is not None:
        lead.next_follow_up_at = payload.next_follow_up_at

    for conversation in lead.conversations:
        conversation.current_stage = lead.current_stage
        conversation.lead_temperature = lead.lead_temperature
        db.add(conversation)

    db.add(lead)
    db.commit()
    db.refresh(lead)

    return build_lead_detail(lead)
