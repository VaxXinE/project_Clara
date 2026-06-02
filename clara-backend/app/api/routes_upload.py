from collections.abc import Sequence
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.security import require_roles
from app.db.session import get_db
from app.models.conversation import Conversation
from app.models.message import Message
from app.schemas.channel_schema import (
    ChannelDefinitionItem,
    ChannelDetectCandidate,
    ChannelDetectRequest,
    ChannelDetectResponse,
)
from app.models.user import User
from app.services.audit_service import create_audit_log
from app.services.lead_service import ensure_conversation_lead
from app.services.source_intelligence_service import list_channel_definitions
from app.services.telegram_parser import TelegramParseError, parse_telegram_txt
from app.services.whatsapp_parser import WhatsAppParseError, parse_whatsapp_txt

router = APIRouter(prefix="/upload", tags=["upload"])


MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024


class UploadRawChatRequest(BaseModel):
    raw_text: str
    title: str


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


def create_conversation_from_messages(
    *,
    db: Session,
    current_user: User,
    title: str,
    source: str,
    raw_filename: str | None,
    raw_text: str,
    parsed_messages: Sequence,
) -> Conversation:
    started_at = parsed_messages[0].message_timestamp
    last_message_at = parsed_messages[-1].message_timestamp

    conversation = Conversation(
        organization_id=current_user.organization_id,
        sales_user_id=current_user.id,
        title=title,
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
                message_text=parsed_message.message_text,
                message_timestamp=parsed_message.message_timestamp,
            )
        )

    customer_messages = [
        message for message in parsed_messages if message.sender_type == "customer"
    ]
    ensure_conversation_lead(
        db=db,
        conversation=conversation,
        preferred_name=title,
    )
    db.commit()
    db.refresh(conversation)
    return conversation


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
    title: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("sales", "manager", "head", "superadmin")),
) -> dict[str, UUID | int | str]:
    validate_upload_access(current_user)
    normalized_title = normalize_conversation_title_or_raise(title)

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

    conversation = create_conversation_from_messages(
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
            "filename": file.filename,
            "message_count": len(parsed_messages),
        },
    )

    return {
        "conversation_id": conversation.id,
        "message_count": len(parsed_messages),
        "status": "uploaded",
    }


@router.post("/telegram-txt", status_code=status.HTTP_201_CREATED)
async def upload_telegram_txt(
    request: Request,
    title: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("sales", "manager", "head", "superadmin")),
) -> dict[str, UUID | int | str]:
    validate_upload_access(current_user)
    normalized_title = normalize_conversation_title_or_raise(title)

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

    conversation = create_conversation_from_messages(
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
            "filename": file.filename,
            "message_count": len(parsed_messages),
        },
    )

    return {
        "conversation_id": conversation.id,
        "message_count": len(parsed_messages),
        "status": "uploaded",
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
    normalized_title = normalize_conversation_title_or_raise(payload.title)
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

    conversation = create_conversation_from_messages(
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
        metadata={"message_count": len(parsed_messages), "mode": "paste"},
    )

    return {
        "conversation_id": conversation.id,
        "message_count": len(parsed_messages),
        "status": "uploaded",
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
    normalized_title = normalize_conversation_title_or_raise(payload.title)
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

    conversation = create_conversation_from_messages(
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
        metadata={"message_count": len(parsed_messages), "mode": "paste"},
    )

    return {
        "conversation_id": conversation.id,
        "message_count": len(parsed_messages),
        "status": "uploaded",
    }
