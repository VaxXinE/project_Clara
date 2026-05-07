from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.conversation import Conversation
from app.models.message import Message
from app.services.whatsapp_parser import WhatsAppParseError, parse_whatsapp_txt

router = APIRouter(prefix="/upload", tags=["upload"])


MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024


@router.post("/whatsapp-txt", status_code=status.HTTP_201_CREATED)
async def upload_whatsapp_txt(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> dict[str, UUID | int | str]:
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

    started_at = parsed_messages[0].message_timestamp
    last_message_at = parsed_messages[-1].message_timestamp

    title = f"WhatsApp Chat {started_at.date().isoformat()}"

    conversation = Conversation(
        title=title,
        source="whatsapp_txt",
        status="uploaded",
        raw_filename=file.filename,
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

    db.commit()
    db.refresh(conversation)

    return {
        "conversation_id": conversation.id,
        "message_count": len(parsed_messages),
        "status": "uploaded",
    }