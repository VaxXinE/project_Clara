from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
import re
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import delete, desc, select
from sqlalchemy.orm import Session

from app.models.conversation import Conversation
from app.models.message import Message
from app.models.user import User
from app.schemas.extension_schema import (
    WhatsAppExtensionChatSnapshot,
    WhatsAppExtensionSnapshotSyncResponse,
)
from app.services.whatsapp_parser import JAKARTA_TZ, parse_whatsapp_datetime


EXTENSION_SOURCE = "whatsapp_extension"
TIME_ONLY_PATTERN = re.compile(
    r"^(?P<hour>\d{1,2})[:.](?P<minute>\d{2})(?:\s?(?P<meridiem>AM|PM|am|pm))?$"
)
FULL_LABEL_TIME_FIRST_PATTERN = re.compile(
    r"^(?P<time>\d{1,2}:\d{2}(?::\d{2})?\s?(?:AM|PM|am|pm)),\s*(?P<date>\d{1,2}/\d{1,2}/\d{2,4})$"
)
FULL_LABEL_DATE_FIRST_PATTERN = re.compile(
    r"^(?P<date>\d{1,2}/\d{1,2}/\d{2,4}),\s*(?P<time>\d{1,2}[.:]\d{2}(?:[.:]\d{2})?)$"
)


class ExtensionSnapshotError(RuntimeError):
    pass


@dataclass(frozen=True)
class NormalizedSnapshotMessage:
    author: str
    sender_type: str
    text: str
    timestamp: datetime
    timestamp_label: str


def build_snapshot_signature(
    chat_title: str,
    chat_subtitle: str,
    messages: list[NormalizedSnapshotMessage],
) -> str:
    message_lines = [
        f"[{message.timestamp_label}] {message.author}: {message.text.strip()}"
        for message in messages
    ]
    return "\n".join(
        [
            f"title={chat_title.strip()}",
            f"subtitle={chat_subtitle.strip()}",
            *message_lines,
        ]
    ).strip()


def parse_captured_at(captured_at: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(captured_at.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ExtensionSnapshotError("Invalid capturedAt timestamp.") from exc

    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=JAKARTA_TZ)

    return parsed.astimezone(JAKARTA_TZ)


def parse_snapshot_message_timestamp(
    timestamp_label: str,
    captured_at: datetime,
    index: int,
    previous_timestamp: datetime | None,
) -> datetime:
    normalized_label = timestamp_label.strip()

    parsed_timestamp: datetime | None = None

    if normalized_label:
        time_first_match = FULL_LABEL_TIME_FIRST_PATTERN.match(normalized_label)
        if time_first_match:
            parsed_timestamp = parse_whatsapp_datetime(
                time_first_match.group("date"),
                time_first_match.group("time"),
            )

        date_first_match = FULL_LABEL_DATE_FIRST_PATTERN.match(normalized_label)
        if parsed_timestamp is None and date_first_match:
            parsed_timestamp = parse_whatsapp_datetime(
                date_first_match.group("date"),
                date_first_match.group("time"),
            )

        time_only_match = TIME_ONLY_PATTERN.match(normalized_label)
        if parsed_timestamp is None and time_only_match:
            hour = int(time_only_match.group("hour"))
            minute = int(time_only_match.group("minute"))
            meridiem = time_only_match.group("meridiem")

            if meridiem:
                meridiem = meridiem.upper()
                if meridiem == "PM" and hour != 12:
                    hour += 12
                if meridiem == "AM" and hour == 12:
                    hour = 0

            parsed_timestamp = captured_at.replace(
                hour=hour,
                minute=minute,
                second=0,
                microsecond=0,
            )

    if parsed_timestamp is None:
        parsed_timestamp = captured_at + timedelta(seconds=index)

    if previous_timestamp is not None and parsed_timestamp <= previous_timestamp:
        parsed_timestamp = previous_timestamp + timedelta(seconds=1)

    return parsed_timestamp


def normalize_snapshot_messages(
    snapshot: WhatsAppExtensionChatSnapshot,
) -> list[NormalizedSnapshotMessage]:
    captured_at = parse_captured_at(snapshot.captured_at)
    normalized_messages: list[NormalizedSnapshotMessage] = []
    previous_timestamp: datetime | None = None

    for index, message in enumerate(snapshot.messages):
        timestamp = parse_snapshot_message_timestamp(
            timestamp_label=message.timestamp_label,
            captured_at=captured_at,
            index=index,
            previous_timestamp=previous_timestamp,
        )
        previous_timestamp = timestamp

        normalized_messages.append(
            NormalizedSnapshotMessage(
                author=message.author.strip(),
                sender_type="sales" if message.direction == "outgoing" else "customer",
                text=message.text.strip(),
                timestamp=timestamp,
                timestamp_label=message.timestamp_label.strip(),
            )
        )

    return normalized_messages


def get_existing_extension_conversation(
    db: Session,
    *,
    current_user: User,
    chat_title: str,
) -> Conversation | None:
    statement = (
        select(Conversation)
        .where(Conversation.source == EXTENSION_SOURCE)
        .where(Conversation.sales_user_id == current_user.id)
        .where(Conversation.organization_id == current_user.organization_id)
        .where(Conversation.title == chat_title.strip())
        .order_by(desc(Conversation.created_at))
    )
    return db.scalars(statement).first()


def sync_whatsapp_extension_snapshot(
    db: Session,
    *,
    current_user: User,
    snapshot: WhatsAppExtensionChatSnapshot | None,
) -> WhatsAppExtensionSnapshotSyncResponse:
    if current_user.organization_id is None:
        raise ExtensionSnapshotError("User has no organization assigned.")

    if snapshot is None:
        return WhatsAppExtensionSnapshotSyncResponse(
            status="cleared",
            duplicate=False,
            conversation_id=None,
            message_count=0,
        )

    if not snapshot.messages:
        raise ExtensionSnapshotError("Snapshot messages cannot be empty.")

    normalized_messages = normalize_snapshot_messages(snapshot)
    transcript = build_snapshot_signature(
        chat_title=snapshot.chat_title,
        chat_subtitle=snapshot.chat_subtitle,
        messages=normalized_messages,
    )
    started_at = normalized_messages[0].timestamp
    last_message_at = normalized_messages[-1].timestamp

    conversation = get_existing_extension_conversation(
        db=db,
        current_user=current_user,
        chat_title=snapshot.chat_title,
    )

    if conversation is not None and (conversation.raw_text or "").strip() == transcript:
        return WhatsAppExtensionSnapshotSyncResponse(
            status="duplicate",
            duplicate=True,
            conversation_id=conversation.id,
            message_count=len(normalized_messages),
        )

    if conversation is None:
        conversation = Conversation(
            organization_id=current_user.organization_id,
            sales_user_id=current_user.id,
            title=snapshot.chat_title.strip(),
            source=EXTENSION_SOURCE,
            status="synced",
            raw_filename=None,
            raw_text=transcript,
            started_at=started_at,
            last_message_at=last_message_at,
        )
        db.add(conversation)
        db.flush()
        status_value = "created"
    else:
        conversation.status = "synced"
        conversation.raw_text = transcript
        conversation.started_at = started_at
        conversation.last_message_at = last_message_at
        db.add(conversation)
        db.flush()
        db.execute(delete(Message).where(Message.conversation_id == conversation.id))
        status_value = "updated"

    for message in normalized_messages:
        db.add(
            Message(
                conversation_id=conversation.id,
                sender_name=message.author,
                sender_type=message.sender_type,
                message_text=message.text,
                message_timestamp=message.timestamp,
            )
        )

    db.commit()
    db.refresh(conversation)

    return WhatsAppExtensionSnapshotSyncResponse(
        status=status_value,
        duplicate=False,
        conversation_id=conversation.id,
        message_count=len(normalized_messages),
    )
