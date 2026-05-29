from __future__ import annotations

import re
from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import inspect as sqlalchemy_inspect, select
from sqlalchemy.orm import Session, load_only, selectinload

from app.models.conversation import Conversation
from app.models.customer_profile import CustomerProfile
from app.models.lead import Lead
from app.models.user import User
from app.services.access_control_service import get_accessible_sales_user_ids
from app.services.role_service import is_superadmin_like
from app.services.source_intelligence_service import build_source_label, normalize_source_channel

ALLOWED_CUSTOMER_PROFILE_STATUSES = {"active", "inactive"}
CUSTOMER_PROFILE_CONTACT_FIELD_NAMES = {"phone", "email", "address", "status"}
CUSTOMER_PROFILE_SCHEMA_MISMATCH_DETAIL = (
    "Schema database customer_profiles belum memuat kolom contact fields terbaru. "
    "Jalankan migration Alembic terbaru untuk customer profile."
)
_CUSTOMER_PROFILE_COLUMN_CACHE: dict[str, set[str]] = {}


def _get_customer_profile_column_names(db: Session) -> set[str]:
    bind = db.get_bind()
    engine = getattr(bind, "engine", bind)
    cache_key = str(engine.url)
    cached = _CUSTOMER_PROFILE_COLUMN_CACHE.get(cache_key)
    if cached is not None:
        return cached

    inspector = sqlalchemy_inspect(bind)
    columns = {
        column["name"]
        for column in inspector.get_columns("customer_profiles")
    }
    _CUSTOMER_PROFILE_COLUMN_CACHE[cache_key] = columns
    return columns


def customer_profile_contact_fields_supported(db: Session) -> bool:
    return CUSTOMER_PROFILE_CONTACT_FIELD_NAMES.issubset(
        _get_customer_profile_column_names(db),
    )


def customer_profile_load_only_columns(db: Session) -> list:
    column_names = _get_customer_profile_column_names(db)
    columns = [
        CustomerProfile.id,
        CustomerProfile.organization_id,
        CustomerProfile.assigned_user_id,
        CustomerProfile.display_name,
        CustomerProfile.canonical_key,
        CustomerProfile.last_contact_at,
        CustomerProfile.created_at,
        CustomerProfile.updated_at,
    ]
    optional_columns = {
        "phone": CustomerProfile.phone,
        "email": CustomerProfile.email,
        "address": CustomerProfile.address,
        "status": CustomerProfile.status,
        "identity_confidence": CustomerProfile.identity_confidence,
        "match_strategy": CustomerProfile.match_strategy,
        "merge_notes": CustomerProfile.merge_notes,
        "merged_into_profile_id": CustomerProfile.merged_into_profile_id,
    }
    for name, column in optional_columns.items():
        if name in column_names:
            columns.append(column)
    return columns


def _get_loaded_profile_value(
    profile: CustomerProfile,
    field_name: str,
    default: object = None,
):
    return sqlalchemy_inspect(profile).dict.get(field_name, default)


def _get_profile_phone(profile: CustomerProfile) -> str | None:
    value = _get_loaded_profile_value(profile, "phone")
    return value if isinstance(value, str) else None


def _get_profile_email(profile: CustomerProfile) -> str | None:
    value = _get_loaded_profile_value(profile, "email")
    return value if isinstance(value, str) else None


def _get_profile_address(profile: CustomerProfile) -> str | None:
    value = _get_loaded_profile_value(profile, "address")
    return value if isinstance(value, str) else None


def _get_profile_status(profile: CustomerProfile) -> str:
    value = _get_loaded_profile_value(profile, "status")
    return value if isinstance(value, str) and value.strip() else "active"


def _get_profile_identity_confidence(profile: CustomerProfile) -> float:
    value = _get_loaded_profile_value(profile, "identity_confidence")
    return float(value) if isinstance(value, (int, float)) else 0.92


def _get_profile_match_strategy(profile: CustomerProfile) -> str:
    value = _get_loaded_profile_value(profile, "match_strategy")
    return value if isinstance(value, str) and value.strip() else "name_exact"


def _get_profile_merge_notes(profile: CustomerProfile) -> str | None:
    value = _get_loaded_profile_value(profile, "merge_notes")
    return value if isinstance(value, str) else None


def _get_profile_merged_into_profile_id(profile: CustomerProfile) -> UUID | None:
    value = _get_loaded_profile_value(profile, "merged_into_profile_id")
    return value if isinstance(value, UUID) else None


def _require_customer_profile_contact_fields(db: Session) -> None:
    if customer_profile_contact_fields_supported(db):
        return

    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=CUSTOMER_PROFILE_SCHEMA_MISMATCH_DETAIL,
    )


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
    normalized = re.sub(r"\b(customer|cust|buyer|lead|prospect|client|calon)\b", " ", normalized)
    normalized = " ".join(part for part in normalized.split() if part)
    return normalized or "unknown-customer"


def normalize_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


def compute_identity_metadata(
    *,
    display_name: str,
    canonical_key: str,
) -> tuple[float, str]:
    if canonical_key == "unknown-customer":
        return 0.35, "fallback_unknown"

    token_count = len(canonical_key.split())
    if token_count >= 2 and display_name.strip() != canonical_key:
        return 0.9, "name_normalized"
    if token_count == 1:
        return 0.74, "single_token_name"
    return 0.92, "name_exact"


def calculate_profile_match_score(
    source_profile: CustomerProfile,
    candidate_profile: CustomerProfile,
) -> tuple[float, str]:
    source_tokens = set(source_profile.canonical_key.split())
    candidate_tokens = set(candidate_profile.canonical_key.split())
    if not source_tokens or not candidate_tokens:
        return 0.0, "Tidak ada token identitas yang cukup."

    overlap = source_tokens & candidate_tokens
    union = source_tokens | candidate_tokens
    overlap_ratio = len(overlap) / max(len(union), 1)

    score = overlap_ratio
    reasons: list[str] = []
    if overlap:
        reasons.append(f"Overlap token: {', '.join(sorted(overlap))}.")
    if source_profile.assigned_user_id and source_profile.assigned_user_id == candidate_profile.assigned_user_id:
        score += 0.15
        reasons.append("PIC yang sama.")
    if source_profile.display_name.lower() == candidate_profile.display_name.lower():
        score += 0.2
        reasons.append("Nama display identik.")

    score = min(round(score, 2), 0.99)
    return score, " ".join(reasons) if reasons else "Kecocokan dasar dari canonical key."


def build_merge_candidates(
    profile: CustomerProfile,
    *,
    visible_profiles: list[CustomerProfile],
) -> list[dict]:
    candidates: list[dict] = []
    for candidate in visible_profiles:
        if candidate.id == profile.id or _get_profile_merged_into_profile_id(candidate) is not None:
            continue

        match_score, overlap_reason = calculate_profile_match_score(profile, candidate)
        if match_score < 0.45:
            continue

        candidate_leads = list(candidate.leads)
        candidates.append(
            {
                "id": candidate.id,
                "display_name": candidate.display_name,
                "canonical_key": candidate.canonical_key,
                "identity_confidence": _get_profile_identity_confidence(candidate),
                "match_strategy": _get_profile_match_strategy(candidate),
                "match_score": match_score,
                "overlap_reason": overlap_reason,
                "lead_count": len(candidate_leads),
                "conversation_count": sum(len(lead.conversations) for lead in candidate_leads),
                "source_labels": sorted({build_source_label(lead.source) for lead in candidate_leads}),
                "last_contact_at": candidate.last_contact_at,
            }
        )

    return sorted(candidates, key=lambda item: item["match_score"], reverse=True)[:5]


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
    identity_confidence, match_strategy = compute_identity_metadata(
        display_name=display_name,
        canonical_key=canonical_key,
    )

    existing_profile = db.scalars(
        select(CustomerProfile)
        .where(
            CustomerProfile.organization_id == lead.organization_id,
            CustomerProfile.canonical_key == canonical_key,
            CustomerProfile.merged_into_profile_id.is_(None),
        )
        .options(load_only(*customer_profile_load_only_columns(db)))
    ).first()

    if existing_profile is None:
        existing_profile = CustomerProfile(
            organization_id=lead.organization_id,
            assigned_user_id=lead.assigned_user_id,
            display_name=display_name,
            status="active",
            canonical_key=canonical_key,
            identity_confidence=identity_confidence,
            match_strategy=match_strategy,
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
        existing_profile.identity_confidence = max(existing_profile.identity_confidence, identity_confidence)
        existing_profile.match_strategy = match_strategy
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
    merge_candidates: list[dict] | None = None,
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
        "phone": _get_profile_phone(profile),
        "email": _get_profile_email(profile),
        "address": _get_profile_address(profile),
        "status": _get_profile_status(profile),
        "canonical_key": profile.canonical_key,
        "identity_confidence": _get_profile_identity_confidence(profile),
        "match_strategy": _get_profile_match_strategy(profile),
        "merge_notes": _get_profile_merge_notes(profile),
        "merged_into_profile_id": _get_profile_merged_into_profile_id(profile),
        "lead_count": len(leads),
        "conversation_count": conversation_count,
        "source_channels": source_channels,
        "source_labels": source_labels,
        "last_contact_at": profile.last_contact_at,
        "created_at": profile.created_at,
        "updated_at": profile.updated_at,
        "merge_candidates": merge_candidates or [],
        "related_leads": related_leads,
    }


def build_customer_profile_list_item(
    profile: CustomerProfile,
    *,
    visible_leads: list[Lead] | None = None,
) -> dict:
    leads = visible_leads if visible_leads is not None else list(profile.leads)
    conversation_count = sum(len(lead.conversations) for lead in leads)
    active_lead_count = sum(
        1 for lead in leads if lead.current_stage not in {"won", "lost", "archived"}
    )
    hot_lead_count = sum(1 for lead in leads if lead.lead_temperature == "hot")

    return {
        "id": profile.id,
        "assigned_user_id": profile.assigned_user_id,
        "assigned_user_name": profile.assigned_user.name if profile.assigned_user else None,
        "display_name": profile.display_name,
        "phone": _get_profile_phone(profile),
        "email": _get_profile_email(profile),
        "status": _get_profile_status(profile),
        "lead_count": len(leads),
        "active_lead_count": active_lead_count,
        "conversation_count": conversation_count,
        "hot_lead_count": hot_lead_count,
        "source_labels": sorted({build_source_label(lead.source) for lead in leads}),
        "last_contact_at": profile.last_contact_at,
        "identity_confidence": _get_profile_identity_confidence(profile),
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
            load_only(*customer_profile_load_only_columns(db)),
            selectinload(CustomerProfile.assigned_user),
            selectinload(CustomerProfile.leads).selectinload(Lead.conversations),
        )
    ).first()

    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer profile not found.",
        )

    if (
        not is_superadmin_like(current_user.role)
        and (
            current_user.organization_id is None
            or profile.organization_id != current_user.organization_id
        )
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer profile not found.",
        )

    accessible_user_ids = get_accessible_sales_user_ids(
        db=db,
        current_user=current_user,
    )
    if accessible_user_ids is not None:
        accessible_leads = [
            lead for lead in profile.leads if lead.assigned_user_id in accessible_user_ids
        ]
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
    if _get_profile_merged_into_profile_id(profile) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Customer profile sudah digabung ke profil lain.",
        )
    accessible_user_ids = get_accessible_sales_user_ids(
        db=db,
        current_user=current_user,
    )
    visible_leads = (
        list(profile.leads)
        if accessible_user_ids is None
        else [
            lead
            for lead in profile.leads
            if lead.assigned_user_id in accessible_user_ids
        ]
    )
    visible_profiles = db.scalars(
        select(CustomerProfile)
        .where(
            CustomerProfile.organization_id == profile.organization_id,
        )
        .options(load_only(*customer_profile_load_only_columns(db)))
        .options(selectinload(CustomerProfile.leads).selectinload(Lead.conversations))
    ).all()
    if accessible_user_ids is not None:
        visible_profiles = [
            candidate
            for candidate in visible_profiles
            if any(lead.assigned_user_id in accessible_user_ids for lead in candidate.leads)
        ]
    merge_candidates = build_merge_candidates(profile, visible_profiles=visible_profiles)
    return build_customer_profile_summary(
        profile,
        visible_leads=visible_leads,
        merge_candidates=merge_candidates,
    )


def list_customer_profiles_for_user(
    db: Session,
    *,
    current_user: User,
    query: str | None = None,
    status_value: str | None = None,
) -> list[dict]:
    profiles = db.scalars(
        select(CustomerProfile)
        .where(CustomerProfile.merged_into_profile_id.is_(None))
        .options(
            load_only(*customer_profile_load_only_columns(db)),
            selectinload(CustomerProfile.assigned_user),
            selectinload(CustomerProfile.leads).selectinload(Lead.conversations),
        )
    ).all()

    if not is_superadmin_like(current_user.role):
        profiles = [
            profile
            for profile in profiles
            if current_user.organization_id is not None
            and profile.organization_id == current_user.organization_id
        ]

    accessible_user_ids = get_accessible_sales_user_ids(db=db, current_user=current_user)

    normalized_query = query.strip().lower() if query and query.strip() else None
    normalized_status = status_value.strip().lower() if status_value and status_value.strip() else None

    items: list[dict] = []
    for profile in profiles:
        visible_leads = (
            list(profile.leads)
            if accessible_user_ids is None
            else [
                lead
                for lead in profile.leads
                if lead.assigned_user_id in accessible_user_ids
            ]
        )
        if not visible_leads:
            continue

        if normalized_status and _get_profile_status(profile) != normalized_status:
            continue

        if normalized_query:
            haystacks = [
                profile.display_name,
                _get_profile_phone(profile),
                _get_profile_email(profile),
                profile.assigned_user.name if profile.assigned_user else None,
                profile.canonical_key,
            ]
            if not any(
                normalized_query in value.lower()
                for value in haystacks
                if isinstance(value, str) and value.strip()
            ):
                continue

        items.append(
            build_customer_profile_list_item(
                profile,
                visible_leads=visible_leads,
            )
        )

    return sorted(
        items,
        key=lambda item: (
            item["last_contact_at"] or datetime.min.replace(tzinfo=timezone.utc),
            item["display_name"].lower(),
        ),
        reverse=True,
    )


def update_customer_profile_for_user(
    db: Session,
    *,
    customer_profile_id: UUID,
    display_name: str,
    phone: str | None,
    email: str | None,
    address: str | None,
    status_value: str,
    current_user: User,
) -> dict:
    _require_customer_profile_contact_fields(db)

    profile = get_customer_profile_model_for_user(
        db=db,
        customer_profile_id=customer_profile_id,
        current_user=current_user,
    )
    if _get_profile_merged_into_profile_id(profile) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Customer profile sudah digabung ke profil lain.",
        )

    normalized_name = display_name.strip()
    normalized_phone = normalize_optional_text(phone)
    normalized_email = normalize_optional_text(email)
    normalized_address = normalize_optional_text(address)
    normalized_status = status_value.strip().lower()

    if normalized_status not in ALLOWED_CUSTOMER_PROFILE_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Status customer profile tidak valid.",
        )

    canonical_key = normalize_customer_identity_name(normalized_name)
    identity_confidence, _ = compute_identity_metadata(
        display_name=normalized_name,
        canonical_key=canonical_key,
    )

    profile.display_name = normalized_name
    profile.phone = normalized_phone
    profile.email = normalized_email
    profile.address = normalized_address
    profile.status = normalized_status
    profile.canonical_key = canonical_key
    profile.identity_confidence = max(profile.identity_confidence, identity_confidence)
    profile.match_strategy = "manual_profile_update"

    db.add(profile)
    db.commit()
    db.refresh(profile)

    return get_customer_profile_for_user(
        db=db,
        customer_profile_id=profile.id,
        current_user=current_user,
    )


def merge_customer_profiles(
    db: Session,
    *,
    source_profile_id: UUID,
    target_profile_id: UUID,
    merge_notes: str | None,
    current_user: User,
) -> dict:
    _require_customer_profile_contact_fields(db)

    source_profile = get_customer_profile_model_for_user(
        db=db,
        customer_profile_id=source_profile_id,
        current_user=current_user,
    )
    target_profile = get_customer_profile_model_for_user(
        db=db,
        customer_profile_id=target_profile_id,
        current_user=current_user,
    )

    if source_profile.id == target_profile.id:
        raise ValueError("Source dan target customer profile tidak boleh sama.")
    if _get_profile_merged_into_profile_id(source_profile) is not None:
        raise ValueError("Source customer profile sudah pernah digabung.")
    if _get_profile_merged_into_profile_id(target_profile) is not None:
        raise ValueError("Target customer profile sudah digabung ke profil lain.")
    if source_profile.organization_id != target_profile.organization_id:
        raise ValueError("Customer profile harus berasal dari organization yang sama.")

    source_leads = list(source_profile.leads)
    target_last_contact = ensure_aware_utc(target_profile.last_contact_at)
    source_last_contact = ensure_aware_utc(source_profile.last_contact_at)
    if source_last_contact and (
        target_last_contact is None or source_last_contact > target_last_contact
    ):
        target_profile.last_contact_at = source_last_contact

    if len(source_profile.display_name.strip()) > len(target_profile.display_name.strip()):
        target_profile.display_name = source_profile.display_name
        target_profile.canonical_key = source_profile.canonical_key
    if not target_profile.phone and source_profile.phone:
        target_profile.phone = source_profile.phone
    if not target_profile.email and source_profile.email:
        target_profile.email = source_profile.email
    if not target_profile.address and source_profile.address:
        target_profile.address = source_profile.address
    if target_profile.status != "active" and source_profile.status == "active":
        target_profile.status = "active"

    target_profile.identity_confidence = max(
        target_profile.identity_confidence,
        source_profile.identity_confidence,
        0.95,
    )
    target_profile.match_strategy = "manual_merge"
    if merge_notes and merge_notes.strip():
        target_profile.merge_notes = merge_notes.strip()

    source_profile.merged_into_profile_id = target_profile.id
    source_profile.merge_notes = merge_notes.strip() if merge_notes and merge_notes.strip() else "Merged manually"
    source_profile.match_strategy = "merged_manual"

    for lead in source_leads:
        lead.customer_profile_id = target_profile.id
        db.add(lead)

    db.add(source_profile)
    db.add(target_profile)
    db.commit()
    db.expire_all()
    refreshed_target_profile = get_customer_profile_model_for_user(
        db=db,
        customer_profile_id=target_profile.id,
        current_user=current_user,
    )

    accessible_user_ids = get_accessible_sales_user_ids(
        db=db,
        current_user=current_user,
    )
    visible_leads = (
        list(refreshed_target_profile.leads)
        if accessible_user_ids is None
        else [
            lead
            for lead in refreshed_target_profile.leads
            if lead.assigned_user_id in accessible_user_ids
        ]
    )
    visible_profiles = db.scalars(
        select(CustomerProfile)
        .where(CustomerProfile.organization_id == refreshed_target_profile.organization_id)
        .options(load_only(*customer_profile_load_only_columns(db)))
        .options(selectinload(CustomerProfile.leads).selectinload(Lead.conversations))
    ).all()
    if accessible_user_ids is not None:
        visible_profiles = [
            candidate
            for candidate in visible_profiles
            if any(lead.assigned_user_id in accessible_user_ids for lead in candidate.leads)
        ]
    return build_customer_profile_summary(
        refreshed_target_profile,
        visible_leads=visible_leads,
        merge_candidates=build_merge_candidates(
            refreshed_target_profile,
            visible_profiles=visible_profiles,
        ),
    )
