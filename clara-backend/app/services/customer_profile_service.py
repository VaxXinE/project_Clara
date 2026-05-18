from __future__ import annotations

import re
from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.conversation import Conversation
from app.models.customer_profile import CustomerProfile
from app.models.lead import Lead
from app.models.user import User
from app.services.access_control_service import can_access_all_conversations
from app.services.source_intelligence_service import build_source_label, normalize_source_channel


def ensure_aware_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def normalize_customer_identity_name(name: str | None) -> str:
    if name is None:
        return "unknown-customer"

    normalized = re.sub(r"[^a-z0-9]+", " ", name.strip().lower())
    normalized = " ".join(part for part in normalized.split() if part)
    return normalized or "unknown-customer"


def resolve_customer_profile_name(
    *,
    lead: Lead | None = None,
    conversation: Conversation | None = None,
    preferred_name: str | None = None,
) -> str:
    if preferred_name and preferred_name.strip():
        return preferred_name.strip()

    if lead is not None and lead.display_name.strip():
        return lead.display_name.strip()

    if conversation is not None:
        customer_messages = [
            message
            for message in conversation.messages
            if message.sender_type == "customer" and message.sender_name.strip()
        ]
        if customer_messages:
            return customer_messages[0].sender_name.strip()
        if conversation.title.strip():
            return conversation.title.strip()

    return "Unknown Customer"


def ensure_customer_profile_for_lead(
    db: Session,
    *,
    lead: Lead,
    preferred_name: str | None = None,
) -> CustomerProfile:
    display_name = resolve_customer_profile_name(lead=lead, preferred_name=preferred_name)
    canonical_key = normalize_customer_identity_name(display_name)

    existing_profile = db.scalars(
        select(CustomerProfile).where(
            CustomerProfile.organization_id == lead.organization_id,
            CustomerProfile.canonical_key == canonical_key,
        )
    ).first()

    if existing_profile is None:
        existing_profile = CustomerProfile(
            organization_id=lead.organization_id,
            assigned_user_id=lead.assigned_user_id,
            display_name=display_name,
            canonical_key=canonical_key,
            last_contact_at=lead.last_contact_at,
        )
        db.add(existing_profile)
        db.flush()
    else:
        existing_profile.assigned_user_id = lead.assigned_user_id
        lead_last_contact = ensure_aware_utc(lead.last_contact_at)
        profile_last_contact = ensure_aware_utc(existing_profile.last_contact_at)
        if lead_last_contact and (
            profile_last_contact is None
            or lead_last_contact > profile_last_contact
        ):
            existing_profile.last_contact_at = lead_last_contact
        if len(display_name.strip()) > len(existing_profile.display_name.strip()):
            existing_profile.display_name = display_name
        db.add(existing_profile)
        db.flush()

    lead.customer_profile_id = existing_profile.id
    db.add(lead)
    db.flush()
    return existing_profile


def build_customer_profile_summary(
    profile: CustomerProfile,
    *,
    visible_leads: list[Lead] | None = None,
) -> dict:
    leads = visible_leads if visible_leads is not None else list(profile.leads)
    ordered_leads = sorted(
        leads,
        key=lambda lead: (
            lead.last_contact_at or lead.created_at,
            lead.created_at,
        ),
        reverse=True,
    )
    source_channels = sorted({normalize_source_channel(lead.source) for lead in leads})
    source_labels = sorted({build_source_label(lead.source) for lead in leads})

    related_leads = [
        {
            "id": lead.id,
            "display_name": lead.display_name,
            "source_channel": normalize_source_channel(lead.source),
            "source_label": build_source_label(lead.source),
            "current_stage": lead.current_stage,
            "lead_temperature": lead.lead_temperature,
            "last_contact_at": lead.last_contact_at,
            "latest_conversation_id": (
                max(
                    lead.conversations,
                    key=lambda conversation: (
                        conversation.last_message_at or conversation.created_at,
                        conversation.created_at,
                    ),
                ).id
                if lead.conversations
                else None
            ),
        }
        for lead in ordered_leads
    ]

    conversation_count = sum(len(lead.conversations) for lead in leads)
    return {
        "id": profile.id,
        "organization_id": profile.organization_id,
        "assigned_user_id": profile.assigned_user_id,
        "assigned_user_name": profile.assigned_user.name if profile.assigned_user else None,
        "display_name": profile.display_name,
        "canonical_key": profile.canonical_key,
        "lead_count": len(leads),
        "conversation_count": conversation_count,
        "source_channels": source_channels,
        "source_labels": source_labels,
        "last_contact_at": profile.last_contact_at,
        "created_at": profile.created_at,
        "updated_at": profile.updated_at,
        "related_leads": related_leads,
    }


def get_customer_profile_model_for_user(
    db: Session,
    *,
    customer_profile_id: UUID,
    current_user: User,
) -> CustomerProfile:
    profile = db.scalars(
        select(CustomerProfile)
        .where(CustomerProfile.id == customer_profile_id)
        .options(
            selectinload(CustomerProfile.assigned_user),
            selectinload(CustomerProfile.leads)
            .selectinload(Lead.conversations),
        )
    ).first()

    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer profile not found.",
        )

    if current_user.organization_id is None or profile.organization_id != current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer profile not found.",
        )

    if not can_access_all_conversations(current_user):
        accessible_leads = [lead for lead in profile.leads if lead.assigned_user_id == current_user.id]
        if not accessible_leads:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Customer profile not found.",
            )

    return profile


def get_customer_profile_for_user(
    db: Session,
    *,
    customer_profile_id: UUID,
    current_user: User,
) -> dict:
    profile = get_customer_profile_model_for_user(
        db=db,
        customer_profile_id=customer_profile_id,
        current_user=current_user,
    )
    visible_leads = (
        list(profile.leads)
        if can_access_all_conversations(current_user)
        else [lead for lead in profile.leads if lead.assigned_user_id == current_user.id]
    )
    return build_customer_profile_summary(profile, visible_leads=visible_leads)
