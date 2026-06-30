from collections.abc import Sequence
from datetime import timezone
import re
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.security import require_roles
from app.db.session import get_db
from app.models.conversation import Conversation
from app.models.customer_profile import CustomerProfile
from app.models.message import Message
from app.models.lead import Lead
from app.schemas.channel_schema import (
    ChannelDefinitionItem,
    ChannelDetectCandidate,
    ChannelDetectRequest,
    ChannelDetectResponse,
)
from app.models.user import User
from app.services.audit_service import create_audit_log
from app.services.customer_profile_service import sync_customer_profile_temperature
from app.services.customer_profile_service import (
    customer_profile_contact_fields_supported,
    ensure_customer_profile_for_lead,
    is_placeholder_profile_name,
    normalize_ai_email,
    normalize_ai_phone,
    normalize_customer_identity_name,
)
from app.services.lead_activity_service import create_lead_activity_event
from app.services.lead_service import derive_lead_display_name, ensure_conversation_lead
from app.services.lead_task_service import (
    ensure_queue_task_for_lead,
    upsert_follow_up_task_for_lead,
)
from app.services.source_intelligence_service import (
    infer_provider_from_source,
    list_channel_definitions,
    normalize_source_channel,
)
from app.services.telegram_parser import TelegramParseError, parse_telegram_txt
from app.services.whatsapp_parser import WhatsAppParseError, parse_whatsapp_txt

router = APIRouter(prefix="/upload", tags=["upload"])


MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024
CONTACT_PHONE_PATTERN = re.compile(
    r"(?:\+?\d[\d\-\s().]{6,}\d)"
)
CONTACT_EMAIL_PATTERN = re.compile(
    r"\b[^@\s]+@[^@\s]+\.[^@\s]+\b"
)


class UploadRawChatRequest(BaseModel):
    raw_text: str
    title: str | None = None


class ManualConversationIdentityHints(BaseModel):
    canonical_keys: list[str]
    phones: list[str]
    emails: list[str]


def extract_manual_identity_hints(
    *,
    title: str,
    raw_text: str,
    parsed_messages: Sequence,
) -> ManualConversationIdentityHints:
    canonical_keys: list[str] = []
    phones: list[str] = []
    emails: list[str] = []

    def add_canonical_name(value: str | None) -> None:
        normalized = normalize_customer_identity_name(value)
        if normalized != "unknown-customer" and normalized not in canonical_keys:
            canonical_keys.append(normalized)

    add_canonical_name(title)
    for parsed_message in parsed_messages:
        if getattr(parsed_message, "sender_type", None) == "customer":
            add_canonical_name(getattr(parsed_message, "sender_name", None))

    for matched_phone in CONTACT_PHONE_PATTERN.findall(raw_text):
        normalized_phone = normalize_ai_phone(matched_phone)
        if normalized_phone and normalized_phone not in phones:
            phones.append(normalized_phone)

    for matched_email in CONTACT_EMAIL_PATTERN.findall(raw_text):
        normalized_email = normalize_ai_email(matched_email)
        if normalized_email and normalized_email not in emails:
            emails.append(normalized_email)

    return ManualConversationIdentityHints(
        canonical_keys=canonical_keys,
        phones=phones,
        emails=emails,
    )


def build_manual_external_thread_key(
    *,
    source: str,
    hints: ManualConversationIdentityHints,
) -> str | None:
    identity_part = (
        hints.phones[0]
        if hints.phones
        else hints.emails[0]
        if hints.emails
        else hints.canonical_keys[0]
        if hints.canonical_keys
        else None
    )
    if identity_part is None:
        return None
    return f"manual:{source}:{identity_part}"


def detect_channel_candidates(raw_text: str) -> list[ChannelDetectCandidate]:
    candidates: list[ChannelDetectCandidate] = []
    channel_parsers = [
        ("whatsapp", "WhatsApp", parse_whatsapp_txt, WhatsAppParseError),
        ("telegram", "Telegram", parse_telegram_txt, TelegramParseError),
    ]

    for channel_key, channel_label, parser, parser_error in channel_parsers:
        try:
            parsed_messages = parser(raw_text)
        except parser_error:
            continue

        confidence = min(0.6 + (len(parsed_messages) * 0.08), 0.99)
        candidates.append(
            ChannelDetectCandidate(
                channel=channel_key,
                label=channel_label,
                confidence=round(confidence, 2),
                matched_message_count=len(parsed_messages),
                reason=f"Parser {channel_label} berhasil membaca {len(parsed_messages)} pesan.",
            )
        )

    return sorted(
        candidates,
        key=lambda item: (item.matched_message_count, item.confidence),
        reverse=True,
    )


def validate_upload_access(current_user: User) -> None:
    if current_user.organization_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User has no organization assigned.",
        )


def ensure_text_size_limit(raw_text: str) -> None:
    if len(raw_text.encode("utf-8")) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Text too large. Maximum size is 5MB.",
        )


def normalize_conversation_title_or_raise(raw_title: str | None) -> str:
    normalized_title = (raw_title or "").strip()
    if len(normalized_title) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Judul conversation wajib diisi dengan nama customer.",
        )
    return normalized_title


def infer_conversation_title_from_messages(
    *,
    parsed_messages: Sequence,
    source: str,
) -> str:
    for message in parsed_messages:
        sender_name = str(getattr(message, "sender_name", "")).strip()
        sender_type = str(getattr(message, "sender_type", "")).strip().lower()
        if (
            sender_type == "customer"
            and sender_name
            and not is_placeholder_profile_name(sender_name)
        ):
            return sender_name

    for message in parsed_messages:
        sender_name = str(getattr(message, "sender_name", "")).strip()
        if sender_name and not is_placeholder_profile_name(sender_name):
            return sender_name

    source_label = "WhatsApp" if source == "whatsapp_txt" else "Telegram"
    return f"{source_label} Conversation"


def infer_customer_name_from_messages(parsed_messages: Sequence) -> str | None:
    for message in parsed_messages:
        sender_name = str(getattr(message, "sender_name", "")).strip()
        sender_type = str(getattr(message, "sender_type", "")).strip().lower()
        if (
            sender_type == "customer"
            and sender_name
            and not is_placeholder_profile_name(sender_name)
        ):
            return sender_name

    return None


def resolve_manual_conversation_title(
    *,
    raw_title: str | None,
    parsed_messages: Sequence,
    source: str,
) -> str:
    normalized_title = (raw_title or "").strip()
    if len(normalized_title) >= 2:
        return normalized_title
    return infer_conversation_title_from_messages(
        parsed_messages=parsed_messages,
        source=source,
    )


def build_message_fingerprint(message: object) -> tuple[str, str, str, str]:
    sender_name = str(getattr(message, "sender_name", "")).strip().casefold()
    sender_type = str(getattr(message, "sender_type", "")).strip().casefold()
    message_text = "\n".join(
        line.rstrip()
        for line in str(getattr(message, "message_text", "")).strip().splitlines()
    ).strip()
    message_timestamp = getattr(message, "message_timestamp").astimezone(
        timezone.utc
    ).isoformat()
    return (sender_name, sender_type, message_text, message_timestamp)


def merge_raw_chat_text(existing_raw_text: str | None, incoming_raw_text: str) -> str:
    normalized_incoming = incoming_raw_text.strip()
    if not normalized_incoming:
        return existing_raw_text or ""

    if not existing_raw_text or not existing_raw_text.strip():
        return normalized_incoming

    if normalized_incoming in existing_raw_text:
        return existing_raw_text

    return (
        f"{existing_raw_text.rstrip()}\n\n"
        "----- CHAT LANJUTAN -----\n\n"
        f"{normalized_incoming}"
    )


def find_existing_uploaded_conversation(
    *,
    db: Session,
    current_user: User,
    title: str,
    source: str,
    identity_hints: ManualConversationIdentityHints,
) -> Conversation | None:
    normalized_title = title.strip().lower()
    external_thread_key = build_manual_external_thread_key(
        source=source,
        hints=identity_hints,
    )

    if external_thread_key:
        thread_match = db.scalar(
            select(Conversation)
            .where(Conversation.organization_id == current_user.organization_id)
            .where(Conversation.sales_user_id == current_user.id)
            .where(Conversation.source == source)
            .where(Conversation.external_thread_key == external_thread_key)
            .order_by(
                Conversation.last_message_at.desc(),
                Conversation.created_at.desc(),
            )
            .limit(1)
        )
        if thread_match is not None:
            return thread_match

    if normalized_title:
        title_match = db.scalar(
            select(Conversation)
            .where(Conversation.organization_id == current_user.organization_id)
            .where(Conversation.sales_user_id == current_user.id)
            .where(Conversation.source == source)
            .where(func.lower(Conversation.title) == normalized_title)
            .order_by(
                Conversation.last_message_at.desc(),
                Conversation.created_at.desc(),
            )
            .limit(1)
        )
        if title_match is not None:
            return title_match

    identity_filters = []
    if identity_hints.canonical_keys:
        identity_filters.append(
            CustomerProfile.canonical_key.in_(identity_hints.canonical_keys)
        )
    if identity_hints.phones:
        identity_filters.append(CustomerProfile.phone.in_(identity_hints.phones))
    if identity_hints.emails:
        identity_filters.append(CustomerProfile.email.in_(identity_hints.emails))

    if identity_filters:
        identity_match = db.scalar(
            select(Conversation)
            .join(Lead, Lead.id == Conversation.lead_id)
            .join(CustomerProfile, CustomerProfile.id == Lead.customer_profile_id)
            .where(Conversation.organization_id == current_user.organization_id)
            .where(Conversation.sales_user_id == current_user.id)
            .where(Conversation.source == source)
            .where(CustomerProfile.merged_into_profile_id.is_(None))
            .where(or_(*identity_filters))
            .order_by(
                Conversation.last_message_at.desc(),
                Conversation.created_at.desc(),
            )
            .limit(1)
        )
        if identity_match is not None:
            return identity_match
    return None


def sync_continued_conversation_effects(
    *,
    db: Session,
    conversation: Conversation,
    title: str,
    new_messages: Sequence,
) -> None:
    if not new_messages:
        return

    preferred_customer_name = infer_customer_name_from_messages(new_messages) or title
    lead = ensure_conversation_lead(
        db=db,
        conversation=conversation,
        preferred_name=preferred_customer_name,
    )
    promoted_lead_name = derive_lead_display_name(
        conversation=conversation,
        preferred_name=preferred_customer_name,
    )
    if (
        promoted_lead_name
        and promoted_lead_name != lead.display_name
        and (
            is_placeholder_profile_name(lead.display_name)
            or len(promoted_lead_name.strip()) > len(lead.display_name.strip())
        )
    ):
        lead.display_name = promoted_lead_name
        db.add(lead)
        db.flush()
        if lead.customer_profile is not None:
            ensure_customer_profile_for_lead(
                db=db,
                lead=lead,
                preferred_name=promoted_lead_name,
            )
    lead.last_contact_at = conversation.last_message_at

    has_new_customer_message = any(
        message.sender_type == "customer" for message in new_messages
    )
    has_new_sales_message = any(message.sender_type == "sales" for message in new_messages)

    if has_new_customer_message:
        create_lead_activity_event(
            db=db,
            lead=lead,
            event_type="conversation_reopened",
            title="Conversation aktif lagi",
            description=(
                f"Customer mengirim {sum(1 for message in new_messages if message.sender_type == 'customer')} "
                "pesan baru dari upload chat lanjutan. Lead perlu dibaca ulang."
            ),
            actor_user_id=conversation.sales_user_id,
            from_value=title,
            to_value=conversation.status,
        )
        if lead.next_follow_up_at is not None:
            upsert_follow_up_task_for_lead(db=db, lead=lead)
        else:
            ensure_queue_task_for_lead(db=db, lead=lead)

    elif has_new_sales_message:
        create_lead_activity_event(
            db=db,
            lead=lead,
            event_type="conversation_appended",
            title="Timeline conversation diperbarui",
            description="Upload chat lanjutan menambahkan balasan sales ke conversation yang sama.",
            actor_user_id=conversation.sales_user_id,
            from_value=title,
            to_value=conversation.status,
        )

    if lead.customer_profile is not None:
        sync_customer_profile_temperature(
            db=db,
            profile=lead.customer_profile,
            source="auto",
        )

    db.add(lead)


def create_or_update_conversation_from_messages(
    *,
    db: Session,
    current_user: User,
    title: str,
    source: str,
    raw_filename: str | None,
    raw_text: str,
    parsed_messages: Sequence,
) -> tuple[Conversation, str, int]:
    channel = normalize_source_channel(source)
    provider = infer_provider_from_source(source, "manual_upload")
    identity_hints = extract_manual_identity_hints(
        title=title,
        raw_text=raw_text,
        parsed_messages=parsed_messages,
    )
    external_thread_key = build_manual_external_thread_key(
        source=source,
        hints=identity_hints,
    )
    existing_conversation = find_existing_uploaded_conversation(
        db=db,
        current_user=current_user,
        title=title,
        source=source,
        identity_hints=identity_hints,
    )

    if existing_conversation is not None:
        previous_status = existing_conversation.status
        existing_messages = db.scalars(
            select(Message)
            .where(Message.conversation_id == existing_conversation.id)
            .order_by(Message.message_timestamp.asc(), Message.created_at.asc())
        ).all()
        existing_fingerprints = {
            build_message_fingerprint(message) for message in existing_messages
        }
        new_messages = [
            parsed_message
            for parsed_message in parsed_messages
            if build_message_fingerprint(parsed_message) not in existing_fingerprints
        ]

        for parsed_message in new_messages:
            db.add(
                Message(
                    conversation_id=existing_conversation.id,
                    sender_name=parsed_message.sender_name,
                    sender_type=parsed_message.sender_type,
                    channel=existing_conversation.channel or channel,
                    provider=existing_conversation.provider or provider,
                    message_text=parsed_message.message_text,
                    message_timestamp=parsed_message.message_timestamp,
                )
            )
        if new_messages:
            db.flush()

        if parsed_messages:
            first_timestamp = parsed_messages[0].message_timestamp
            latest_timestamp = parsed_messages[-1].message_timestamp
            if (
                existing_conversation.started_at is None
                or first_timestamp < existing_conversation.started_at
            ):
                existing_conversation.started_at = first_timestamp
            if (
                existing_conversation.last_message_at is None
                or latest_timestamp > existing_conversation.last_message_at
            ):
                existing_conversation.last_message_at = latest_timestamp

        if raw_filename:
            existing_conversation.raw_filename = raw_filename

        if external_thread_key and not existing_conversation.external_thread_key:
            existing_conversation.external_thread_key = external_thread_key
        if external_thread_key and not existing_conversation.external_thread_id:
            existing_conversation.external_thread_id = external_thread_key
        if not existing_conversation.provider_key:
            existing_conversation.provider_key = "manual_upload"
        if not existing_conversation.channel:
            existing_conversation.channel = channel
        if not existing_conversation.provider:
            existing_conversation.provider = provider

        if new_messages:
            existing_conversation.raw_text = merge_raw_chat_text(
                existing_conversation.raw_text,
                raw_text,
            )
            latest_new_sender = new_messages[-1].sender_type
            if latest_new_sender == "customer":
                existing_conversation.status = "reopened"
            elif latest_new_sender == "sales":
                existing_conversation.status = "replied"
            else:
                existing_conversation.status = "uploaded"

        sync_continued_conversation_effects(
            db=db,
            conversation=existing_conversation,
            title=title,
            new_messages=new_messages,
        )

        if new_messages and previous_status != existing_conversation.status:
            preferred_customer_name = infer_customer_name_from_messages(new_messages) or title
            lead = ensure_conversation_lead(
                db=db,
                conversation=existing_conversation,
                preferred_name=preferred_customer_name,
            )
            create_lead_activity_event(
                db=db,
                lead=lead,
                event_type="conversation_status_changed",
                title="Status conversation berubah",
                description="Clara memperbarui status conversation setelah chat lanjutan diunggah.",
                actor_user_id=existing_conversation.sales_user_id,
                from_value=previous_status,
                to_value=existing_conversation.status,
            )

        db.add(existing_conversation)
        db.commit()

        operation_status = "updated" if new_messages else "unchanged"
        return existing_conversation, operation_status, len(new_messages)

    started_at = parsed_messages[0].message_timestamp
    last_message_at = parsed_messages[-1].message_timestamp

    conversation = Conversation(
        organization_id=current_user.organization_id,
        sales_user_id=current_user.id,
        title=title,
        channel=channel,
        provider=provider,
        provider_key="manual_upload",
        external_thread_id=external_thread_key,
        external_thread_key=external_thread_key,
        source=source,
        status="uploaded",
        raw_filename=raw_filename,
        raw_text=raw_text,
        started_at=started_at,
        last_message_at=last_message_at,
    )

    db.add(conversation)
    db.flush()

    for parsed_message in parsed_messages:
        db.add(
            Message(
                conversation_id=conversation.id,
                sender_name=parsed_message.sender_name,
                sender_type=parsed_message.sender_type,
                channel=channel,
                provider=provider,
                message_text=parsed_message.message_text,
                message_timestamp=parsed_message.message_timestamp,
            )
        )
    db.flush()

    preferred_customer_name = infer_customer_name_from_messages(parsed_messages) or title
    lead = ensure_conversation_lead(
        db=db,
        conversation=conversation,
        preferred_name=preferred_customer_name,
        sync_customer_profile=False,
    )
    lead.last_contact_at = conversation.last_message_at
    db.commit()
    persisted_lead = db.get(Lead, lead.id)
    if persisted_lead is not None and customer_profile_contact_fields_supported(db):
        ensure_customer_profile_for_lead(
            db=db,
            lead=persisted_lead,
            preferred_name=preferred_customer_name,
        )
        db.commit()
    return conversation, "created", len(parsed_messages)


@router.get("/channels", response_model=list[ChannelDefinitionItem])
def list_upload_channels(
    current_user: User = Depends(require_roles("sales", "manager", "head", "superadmin")),
) -> list[ChannelDefinitionItem]:
    validate_upload_access(current_user)
    return [ChannelDefinitionItem(**item) for item in list_channel_definitions()]


@router.post("/detect-channel", response_model=ChannelDetectResponse)
def detect_upload_channel(
    payload: ChannelDetectRequest,
    current_user: User = Depends(require_roles("sales", "manager", "head", "superadmin")),
) -> ChannelDetectResponse:
    validate_upload_access(current_user)
    raw_text = payload.raw_text.strip()
    if not raw_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Chat text cannot be empty.",
        )

    ensure_text_size_limit(raw_text)
    candidates = detect_channel_candidates(raw_text)
    return ChannelDetectResponse(
        detected_channel=candidates[0].channel if candidates else None,
        candidates=candidates,
    )


@router.post("/whatsapp-txt", status_code=status.HTTP_201_CREATED)
async def upload_whatsapp_txt(
    request: Request,
    title: str | None = Form(default=None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("sales", "manager", "head", "superadmin")),
) -> dict[str, UUID | int | str]:
    validate_upload_access(current_user)

    if not file.filename or not file.filename.endswith(".txt"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only .txt files are allowed.",
        )

    content = await file.read()

    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File too large. Maximum size is 5MB.",
        )

    try:
        raw_text = content.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be UTF-8 encoded text.",
        ) from exc

    try:
        parsed_messages = parse_whatsapp_txt(raw_text)
    except WhatsAppParseError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    normalized_title = resolve_manual_conversation_title(
        raw_title=title,
        parsed_messages=parsed_messages,
        source="whatsapp_txt",
    )

    conversation, upload_status, appended_message_count = create_or_update_conversation_from_messages(
        db=db,
        current_user=current_user,
        title=normalized_title,
        source="whatsapp_txt",
        raw_filename=file.filename,
        raw_text=raw_text,
        parsed_messages=parsed_messages,
    )
    create_audit_log(
        db=db,
        action="conversation.upload_whatsapp_txt",
        resource_type="conversation",
        resource_id=str(conversation.id),
        current_user=current_user,
        request=request,
        metadata={
            "channel": conversation.channel,
            "provider": conversation.provider,
            "filename": file.filename,
            "message_count": len(parsed_messages),
            "appended_message_count": appended_message_count,
            "upload_status": upload_status,
        },
    )

    return {
        "conversation_id": conversation.id,
        "message_count": len(parsed_messages),
        "appended_message_count": appended_message_count,
        "status": upload_status,
    }


@router.post("/telegram-txt", status_code=status.HTTP_201_CREATED)
async def upload_telegram_txt(
    request: Request,
    title: str | None = Form(default=None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("sales", "manager", "head", "superadmin")),
) -> dict[str, UUID | int | str]:
    validate_upload_access(current_user)

    if not file.filename or not file.filename.endswith(".txt"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only .txt files are allowed.",
        )

    content = await file.read()

    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File too large. Maximum size is 5MB.",
        )

    try:
        raw_text = content.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be UTF-8 encoded text.",
        ) from exc

    try:
        parsed_messages = parse_telegram_txt(raw_text)
    except TelegramParseError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    normalized_title = resolve_manual_conversation_title(
        raw_title=title,
        parsed_messages=parsed_messages,
        source="telegram_txt",
    )

    conversation, upload_status, appended_message_count = create_or_update_conversation_from_messages(
        db=db,
        current_user=current_user,
        title=normalized_title,
        source="telegram_txt",
        raw_filename=file.filename,
        raw_text=raw_text,
        parsed_messages=parsed_messages,
    )
    create_audit_log(
        db=db,
        action="conversation.upload_telegram_txt",
        resource_type="conversation",
        resource_id=str(conversation.id),
        current_user=current_user,
        request=request,
        metadata={
            "channel": conversation.channel,
            "provider": conversation.provider,
            "filename": file.filename,
            "message_count": len(parsed_messages),
            "appended_message_count": appended_message_count,
            "upload_status": upload_status,
        },
    )

    return {
        "conversation_id": conversation.id,
        "message_count": len(parsed_messages),
        "appended_message_count": appended_message_count,
        "status": upload_status,
    }


@router.post("/whatsapp-text", status_code=status.HTTP_201_CREATED)
async def upload_whatsapp_raw_text(
    payload: UploadRawChatRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("sales", "manager", "head", "superadmin")),
) -> dict[str, UUID | int | str]:
    validate_upload_access(current_user)

    raw_text = payload.raw_text.strip()
    if not raw_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Chat text cannot be empty.",
        )

    ensure_text_size_limit(raw_text)

    try:
        parsed_messages = parse_whatsapp_txt(raw_text)
    except WhatsAppParseError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    normalized_title = resolve_manual_conversation_title(
        raw_title=payload.title,
        parsed_messages=parsed_messages,
        source="whatsapp_txt",
    )

    conversation, upload_status, appended_message_count = create_or_update_conversation_from_messages(
        db=db,
        current_user=current_user,
        title=normalized_title,
        source="whatsapp_txt",
        raw_filename=None,
        raw_text=raw_text,
        parsed_messages=parsed_messages,
    )
    create_audit_log(
        db=db,
        action="conversation.upload_whatsapp_text",
        resource_type="conversation",
        resource_id=str(conversation.id),
        current_user=current_user,
        request=request,
        metadata={
            "channel": conversation.channel,
            "provider": conversation.provider,
            "message_count": len(parsed_messages),
            "appended_message_count": appended_message_count,
            "upload_status": upload_status,
            "mode": "paste",
        },
    )

    return {
        "conversation_id": conversation.id,
        "message_count": len(parsed_messages),
        "appended_message_count": appended_message_count,
        "status": upload_status,
    }


@router.post("/telegram-text", status_code=status.HTTP_201_CREATED)
async def upload_telegram_raw_text(
    payload: UploadRawChatRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("sales", "manager", "head", "superadmin")),
) -> dict[str, UUID | int | str]:
    validate_upload_access(current_user)

    raw_text = payload.raw_text.strip()
    if not raw_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Chat text cannot be empty.",
        )

    ensure_text_size_limit(raw_text)

    try:
        parsed_messages = parse_telegram_txt(raw_text)
    except TelegramParseError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    normalized_title = resolve_manual_conversation_title(
        raw_title=payload.title,
        parsed_messages=parsed_messages,
        source="telegram_txt",
    )

    conversation, upload_status, appended_message_count = create_or_update_conversation_from_messages(
        db=db,
        current_user=current_user,
        title=normalized_title,
        source="telegram_txt",
        raw_filename=None,
        raw_text=raw_text,
        parsed_messages=parsed_messages,
    )
    create_audit_log(
        db=db,
        action="conversation.upload_telegram_text",
        resource_type="conversation",
        resource_id=str(conversation.id),
        current_user=current_user,
        request=request,
        metadata={
            "channel": conversation.channel,
            "provider": conversation.provider,
            "message_count": len(parsed_messages),
            "appended_message_count": appended_message_count,
            "upload_status": upload_status,
            "mode": "paste",
        },
    )

    return {
        "conversation_id": conversation.id,
        "message_count": len(parsed_messages),
        "appended_message_count": appended_message_count,
        "status": upload_status,
    }
