from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session, load_only, selectinload

from app.models.conversation import Conversation
from app.models.customer_profile import CustomerProfile
from app.models.lead import Lead
from app.models.lead_activity_event import LeadActivityEvent
from app.models.lead_deal import LeadDeal
from app.models.lead_discipline_log import LeadDisciplineLog
from app.models.lead_task import LeadTask
from app.models.user import User
from app.schemas.lead_schema import (
    CustomerProfileSummaryItem,
    LeadActivityEventItem,
    LeadDealItem,
    LeadDealUpsertRequest,
    LeadDetail,
    LeadDisciplineSummaryItem,
    LeadListItem,
    LeadUpdateRequest,
)
from app.services.lead_activity_service import (
    create_lead_activity_event,
    list_lead_activity_events,
)
from app.services.customer_profile_service import (
    is_placeholder_profile_name,
    customer_profile_contact_fields_supported,
    customer_profile_load_only_columns,
    build_customer_profile_summary,
    ensure_customer_profile_for_lead,
    sync_customer_profile_temperature,
)
from app.services.lead_discipline_service import (
    build_lead_discipline_summary,
    list_lead_discipline_logs,
)
from app.services.access_control_service import (
    apply_sales_user_scope_filter,
    can_access_all_conversations,
    get_accessible_sales_user_ids,
)
from app.services.lead_task_service import (
    list_tasks_for_lead,
    upsert_follow_up_task_for_lead,
    validate_assignee_for_lead,
)
from app.services.business_segmentation_service import (
    matches_account_category,
    normalize_account_category,
)
from app.services.source_intelligence_service import (
    build_source_label,
    matches_source_channel,
    normalize_source_channel,
)
from app.services.role_service import is_superadmin_like

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


def clear_follow_up_for_closed_lead(
    db: Session,
    *,
    lead: Lead,
    actor_user_id: UUID | None,
    reason_title: str,
    reason_description: str,
) -> bool:
    if lead.current_stage not in {"won", "lost"} and (
        lead.deal is None or lead.deal.status not in {"won", "lost"}
    ):
        return False

    if lead.next_follow_up_at is None:
        return False

    previous_follow_up_at = lead.next_follow_up_at
    lead.next_follow_up_at = None
    create_lead_activity_event(
        db=db,
        lead=lead,
        event_type="follow_up_updated",
        title=reason_title,
        description=reason_description,
        actor_user_id=actor_user_id,
        from_value=previous_follow_up_at.isoformat(),
        to_value=None,
    )
    return True


def derive_lead_display_name(
    *,
    conversation: Conversation,
    preferred_name: str | None = None,
) -> str:
    if preferred_name and preferred_name.strip() and not is_placeholder_profile_name(preferred_name):
        return preferred_name.strip()

    customer_messages = [
        message
        for message in conversation.messages
        if message.sender_type == "customer"
        and message.sender_name.strip()
        and not is_placeholder_profile_name(message.sender_name)
    ]
    if customer_messages:
        return customer_messages[0].sender_name.strip()

    if conversation.title.strip():
        return conversation.title.strip()

    if preferred_name and preferred_name.strip():
        return preferred_name.strip()

    return "Unknown Customer"


def ensure_conversation_lead(
    db: Session,
    *,
    conversation: Conversation,
    preferred_name: str | None = None,
    account_category: str | None = None,
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
        account_category=normalize_account_category(account_category),
        current_stage=conversation.current_stage,
        lead_temperature=conversation.lead_temperature,
        last_contact_at=conversation.last_message_at,
    )
    db.add(lead)
    db.flush()

    conversation.lead_id = lead.id
    db.add(conversation)
    db.flush()
    create_lead_activity_event(
        db=db,
        lead=lead,
        event_type="lead_created",
        title="Lead baru dibuat",
        description="Lead otomatis dibuat saat conversation pertama kali dihubungkan.",
        actor_user_id=conversation.sales_user_id,
        to_value=lead.display_name,
    )
    if customer_profile_contact_fields_supported(db):
        ensure_customer_profile_for_lead(
            db=db,
            lead=lead,
            preferred_name=lead.display_name,
        )

    return lead


def sync_lead_from_conversation(
    db: Session,
    *,
    conversation: Conversation,
    customer_summary: str | None = None,
    next_follow_up_at: datetime | None = None,
    account_category: str | None = None,
) -> Lead:
    lead = ensure_conversation_lead(db=db, conversation=conversation)
    lead.organization_id = conversation.organization_id
    lead.assigned_user_id = conversation.sales_user_id
    lead.display_name = derive_lead_display_name(conversation=conversation)
    lead.source = conversation.source
    if account_category is not None:
        next_account_category = normalize_account_category(account_category)
        if next_account_category != lead.account_category:
            create_lead_activity_event(
                db=db,
                lead=lead,
                event_type="account_category_changed",
                title="Segmentasi bisnis lead diperbarui",
                description="Kategori mini atau reguler diperbarui dari sumber integrasi terbaru.",
                actor_user_id=conversation.sales_user_id,
                from_value=lead.account_category,
                to_value=next_account_category,
            )
            lead.account_category = next_account_category
    if conversation.current_stage != lead.current_stage:
        create_lead_activity_event(
            db=db,
            lead=lead,
            event_type="stage_changed",
            title="Stage lead diperbarui dari analisis",
            description="Clara menyelaraskan stage lead dari hasil percakapan terbaru.",
            actor_user_id=conversation.sales_user_id,
            from_value=lead.current_stage,
            to_value=conversation.current_stage,
        )
    lead.current_stage = conversation.current_stage
    if conversation.lead_temperature != lead.lead_temperature:
        create_lead_activity_event(
            db=db,
            lead=lead,
            event_type="temperature_changed",
            title="Temperatur lead diperbarui dari analisis",
            description="Clara menyelaraskan temperatur lead dari hasil percakapan terbaru.",
            actor_user_id=conversation.sales_user_id,
            from_value=lead.lead_temperature,
            to_value=conversation.lead_temperature,
        )
    lead.lead_temperature = conversation.lead_temperature
    lead.last_contact_at = conversation.last_message_at
    if customer_summary:
        if customer_summary != lead.summary:
            create_lead_activity_event(
                db=db,
                lead=lead,
                event_type="summary_updated",
                title="Ringkasan lead diperbarui dari analisis",
                description="Summary lead disegarkan dari hasil analisis AI terbaru.",
                actor_user_id=conversation.sales_user_id,
                from_value=lead.summary,
                to_value=customer_summary,
            )
        lead.summary = customer_summary
    if next_follow_up_at is not None:
        if next_follow_up_at != lead.next_follow_up_at:
            create_lead_activity_event(
                db=db,
                lead=lead,
                event_type="follow_up_updated",
                title="Jadwal follow-up diperbarui dari analisis",
                description="AI menyarankan follow-up date baru untuk lead ini.",
                actor_user_id=conversation.sales_user_id,
                from_value=lead.next_follow_up_at.isoformat() if lead.next_follow_up_at else None,
                to_value=next_follow_up_at.isoformat(),
            )
        lead.next_follow_up_at = next_follow_up_at

    db.add(lead)
    db.flush()
    if customer_profile_contact_fields_supported(db):
        profile = ensure_customer_profile_for_lead(
            db=db,
            lead=lead,
            preferred_name=lead.display_name,
        )
        sync_customer_profile_temperature(db=db, profile=profile)
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
    discipline_summary = build_lead_discipline_summary(lead)
    deal_status = lead.deal.status if lead.deal else None
    needs_deal_sync = (
        lead.current_stage in {"won", "lost"} and deal_status != lead.current_stage
    )

    return LeadListItem(
        id=lead.id,
        organization_id=lead.organization_id,
        assigned_user_id=lead.assigned_user_id,
        assigned_user_name=lead.assigned_user.name if lead.assigned_user else None,
        customer_profile_id=lead.customer_profile_id,
        customer_profile_name=lead.customer_profile.display_name if lead.customer_profile else None,
        display_name=lead.display_name,
        source=lead.source,
        source_channel=normalize_source_channel(lead.source),
        source_label=build_source_label(lead.source),
        account_category=lead.account_category,
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
        deal_status=deal_status,
        discipline_compliance_status=discipline_summary.compliance_status,
        needs_deal_sync=needs_deal_sync,
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


def build_lead_detail(db: Session, lead: Lead) -> LeadDetail:
    return build_lead_detail_for_user(db=db, lead=lead, current_user=None)


def build_lead_detail_for_user(
    db: Session,
    *,
    lead: Lead,
    current_user: User | None,
) -> LeadDetail:
    list_item = build_lead_list_item(lead)
    visible_customer_leads = None
    if lead.customer_profile and current_user is not None:
        accessible_user_ids = get_accessible_sales_user_ids(
            db=db,
            current_user=current_user,
        )
        if accessible_user_ids is not None:
            visible_customer_leads = [
                related_lead
                for related_lead in lead.customer_profile.leads
                if related_lead.assigned_user_id in accessible_user_ids
            ]
    return LeadDetail(
        **list_item.model_dump(),
        conversation_ids=[
            conversation.id
            for conversation in sorted(
                lead.conversations,
                key=lambda item: item.created_at,
            )
        ],
        customer_profile=(
            CustomerProfileSummaryItem(
                **build_customer_profile_summary(
                    lead.customer_profile,
                    visible_leads=visible_customer_leads,
                )
            )
            if lead.customer_profile
            else None
        ),
        deal=build_lead_deal_item(lead.deal) if lead.deal else None,
        tasks=list_tasks_for_lead(lead),
        timeline=list_lead_activity_events(db=db, lead_id=lead.id),
        discipline_summary=LeadDisciplineSummaryItem(
            **build_lead_discipline_summary(lead).model_dump()
        ),
        discipline_logs=list_lead_discipline_logs(lead=lead),
    )


def get_lead_model_for_user(
    db: Session,
    *,
    lead_id: UUID,
    current_user: User,
) -> Lead:
    customer_profile_loader = selectinload(Lead.customer_profile).options(
        load_only(*customer_profile_load_only_columns(db)),
        selectinload(CustomerProfile.assigned_user),
        selectinload(CustomerProfile.leads).selectinload(Lead.conversations),
    )
    statement = (
        select(Lead)
        .where(Lead.id == lead_id)
        .options(
            selectinload(Lead.conversations),
            selectinload(Lead.assigned_user),
            customer_profile_loader,
            selectinload(Lead.tasks).selectinload(LeadTask.assigned_user),
            selectinload(Lead.deal).selectinload(LeadDeal.owner_user),
            selectinload(Lead.activity_events).selectinload(LeadActivityEvent.actor_user),
            selectinload(Lead.discipline_logs).selectinload(LeadDisciplineLog.actor_user),
        )
    )
    lead = db.scalars(statement).first()

    if lead is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found.",
        )

    if (
        not is_superadmin_like(current_user.role)
        and (
            current_user.organization_id is None
            or lead.organization_id != current_user.organization_id
        )
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found.",
        )

    accessible_user_ids = get_accessible_sales_user_ids(
        db=db,
        current_user=current_user,
    )
    if accessible_user_ids is not None and lead.assigned_user_id not in accessible_user_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found.",
        )

    return lead


def get_leads_for_user(
    db: Session,
    *,
    current_user: User,
    source_channel: str | None = None,
    account_category: str | None = None,
) -> list[LeadListItem]:
    customer_profile_loader = selectinload(Lead.customer_profile).options(
        load_only(*customer_profile_load_only_columns(db)),
    )
    if current_user.organization_id is None and not is_superadmin_like(current_user.role):
        return []

    statement = select(Lead).options(
        selectinload(Lead.conversations),
        selectinload(Lead.assigned_user),
        customer_profile_loader,
    )
    if not is_superadmin_like(current_user.role):
        statement = statement.where(Lead.organization_id == current_user.organization_id)
    statement = statement.order_by(desc(Lead.created_at), desc(Lead.updated_at))

    statement = apply_sales_user_scope_filter(
        statement,
        db=db,
        current_user=current_user,
        sales_user_id_column=Lead.assigned_user_id,
    )

    leads = [
        lead
        for lead in db.scalars(statement).all()
        if matches_source_channel(lead.source, source_channel)
        and matches_account_category(lead.account_category, account_category)
    ]
    backfilled = False
    can_backfill_customer_profiles = customer_profile_contact_fields_supported(db)
    for lead in leads:
        if can_backfill_customer_profiles and lead.customer_profile_id is None:
            ensure_customer_profile_for_lead(db=db, lead=lead, preferred_name=lead.display_name)
            backfilled = True
    if backfilled:
        db.commit()
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
    if (
        customer_profile_contact_fields_supported(db)
        and lead.customer_profile_id is None
    ):
        ensure_customer_profile_for_lead(db=db, lead=lead, preferred_name=lead.display_name)
        db.commit()
        db.refresh(lead)
    return build_lead_detail_for_user(db=db, lead=lead, current_user=current_user)


def get_lead_timeline_for_user(
    db: Session,
    *,
    lead_id: UUID,
    current_user: User,
) -> list[LeadActivityEventItem]:
    lead = get_lead_model_for_user(
        db=db,
        lead_id=lead_id,
        current_user=current_user,
    )
    return list_lead_activity_events(db=db, lead_id=lead.id)


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
        if payload.current_stage != lead.current_stage:
            create_lead_activity_event(
                db=db,
                lead=lead,
                event_type="stage_changed",
                title="Stage lead diperbarui",
                description="Tahap pipeline lead diubah dari CRM.",
                actor_user_id=current_user.id,
                from_value=lead.current_stage,
                to_value=payload.current_stage,
            )
            lead.current_stage = payload.current_stage

    if payload.account_category is not None:
        next_account_category = normalize_account_category(payload.account_category)
        if next_account_category != lead.account_category:
            create_lead_activity_event(
                db=db,
                lead=lead,
                event_type="account_category_changed",
                title="Segmentasi bisnis diperbarui",
                description="Kategori mini atau reguler diubah dari CRM.",
                actor_user_id=current_user.id,
                from_value=lead.account_category,
                to_value=next_account_category,
            )
            lead.account_category = next_account_category

    if payload.lead_temperature is not None:
        if payload.lead_temperature not in VALID_TEMPERATURES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid lead temperature.",
            )
        if payload.lead_temperature != lead.lead_temperature:
            create_lead_activity_event(
                db=db,
                lead=lead,
                event_type="temperature_changed",
                title="Temperatur lead diperbarui",
                description="Klasifikasi cold/warm/hot lead berubah.",
                actor_user_id=current_user.id,
                from_value=lead.lead_temperature,
                to_value=payload.lead_temperature,
            )
            lead.lead_temperature = payload.lead_temperature

    if payload.summary is not None:
        next_summary = payload.summary.strip() or None
        if next_summary != lead.summary:
            create_lead_activity_event(
                db=db,
                lead=lead,
                event_type="summary_updated",
                title="Ringkasan lead diperbarui",
                description="Summary lead diedit dari halaman detail.",
                actor_user_id=current_user.id,
                from_value=lead.summary,
                to_value=next_summary,
            )
            lead.summary = next_summary

    if payload.notes is not None:
        next_notes = payload.notes.strip() or None
        if next_notes != lead.notes:
            create_lead_activity_event(
                db=db,
                lead=lead,
                event_type="notes_updated",
                title="Catatan internal diperbarui",
                description="Internal notes lead diubah dari CRM.",
                actor_user_id=current_user.id,
                from_value=lead.notes,
                to_value=next_notes,
            )
            lead.notes = next_notes

    if "next_follow_up_at" in payload.model_fields_set:
        if payload.next_follow_up_at != lead.next_follow_up_at:
            create_lead_activity_event(
                db=db,
                lead=lead,
                event_type="follow_up_updated",
                title="Jadwal follow-up diperbarui",
                description="Tanggal follow-up berikutnya diubah.",
                actor_user_id=current_user.id,
                from_value=lead.next_follow_up_at.isoformat() if lead.next_follow_up_at else None,
                to_value=payload.next_follow_up_at.isoformat() if payload.next_follow_up_at else None,
            )
            lead.next_follow_up_at = payload.next_follow_up_at

    if "assigned_user_id" in payload.model_fields_set:
        if not can_access_all_conversations(current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only head can reassign leads.",
            )

        assignee = validate_assignee_for_lead(
            db=db,
            lead=lead,
            assignee_id=payload.assigned_user_id,
        )
        next_assignee_id = assignee.id if assignee else None
        if next_assignee_id != lead.assigned_user_id:
            create_lead_activity_event(
                db=db,
                lead=lead,
                event_type="assignee_changed",
                title="PIC lead diperbarui",
                description="Lead dipindahkan ke user lain.",
                actor_user_id=current_user.id,
                from_value=str(lead.assigned_user_id) if lead.assigned_user_id else None,
                to_value=str(next_assignee_id) if next_assignee_id else None,
            )
            lead.assigned_user_id = next_assignee_id

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
    cleared_follow_up_for_closed_lead = clear_follow_up_for_closed_lead(
        db=db,
        lead=lead,
        actor_user_id=current_user.id,
        reason_title="Jadwal follow-up dibersihkan",
        reason_description="Lead sudah ditandai won atau lost sehingga jadwal follow-up lama dibersihkan otomatis.",
    )
    if (
        "next_follow_up_at" in payload.model_fields_set
        or "assigned_user_id" in payload.model_fields_set
        or cleared_follow_up_for_closed_lead
    ):
        upsert_follow_up_task_for_lead(db=db, lead=lead)
    db.commit()
    db.refresh(lead)

    return build_lead_detail_for_user(db=db, lead=lead, current_user=current_user)


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
        create_lead_activity_event(
            db=db,
            lead=lead,
            event_type="deal_created",
            title="Deal metrics dibuat",
            description="Layer KPI bisnis untuk lead ini mulai diisi.",
            actor_user_id=current_user.id,
        )

    deal.organization_id = lead.organization_id
    deal.owner_user_id = lead.assigned_user_id
    current_status = deal.status or "open"
    current_expected_value = float(deal.expected_value or 0)
    current_deposit_amount = float(deal.deposit_amount or 0)

    if payload.status is not None:
        if payload.status != current_status:
            create_lead_activity_event(
                db=db,
                lead=lead,
                event_type="deal_status_changed",
                title="Status deal diperbarui",
                description="Status deal lead berubah.",
                actor_user_id=current_user.id,
                from_value=current_status,
                to_value=payload.status,
            )
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
        if float(payload.expected_value) != current_expected_value:
            create_lead_activity_event(
                db=db,
                lead=lead,
                event_type="deal_value_updated",
                title="Nilai pipeline diperbarui",
                description="Expected value deal diubah.",
                actor_user_id=current_user.id,
                from_value=str(current_expected_value),
                to_value=str(payload.expected_value),
            )
        deal.expected_value = payload.expected_value
    if payload.deposit_amount is not None:
        if float(payload.deposit_amount) != current_deposit_amount:
            create_lead_activity_event(
                db=db,
                lead=lead,
                event_type="deposit_updated",
                title="Nilai deposit diperbarui",
                description="Deposit amount lead diubah.",
                actor_user_id=current_user.id,
                from_value=str(current_deposit_amount),
                to_value=str(payload.deposit_amount),
            )
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

    cleared_follow_up_for_closed_lead = clear_follow_up_for_closed_lead(
        db=db,
        lead=lead,
        actor_user_id=current_user.id,
        reason_title="Jadwal follow-up dibersihkan",
        reason_description="Deal sudah ditandai won atau lost sehingga jadwal follow-up lama dibersihkan otomatis.",
    )

    db.add(deal)
    db.add(lead)
    if cleared_follow_up_for_closed_lead:
        upsert_follow_up_task_for_lead(db=db, lead=lead)
    db.commit()
    db.refresh(deal)
    return build_lead_deal_item(deal)
