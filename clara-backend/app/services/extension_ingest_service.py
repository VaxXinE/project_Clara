from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
import re
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import delete, desc, select
from sqlalchemy.orm import Session

from app.models.ai_extraction import AIExtraction
from app.models.approval_log import ApprovalLog
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.reply_suggestion import ReplySuggestion
from app.models.sent_message import SentMessage
from app.models.user import User
from app.schemas.extension_schema import (
    WhatsAppExtensionChatSnapshot,
    WhatsAppExtensionReplySuggestionItem,
    WhatsAppExtensionSendReplyResponse,
    WhatsAppExtensionReplySuggestionsResponse,
    WhatsAppExtensionSnapshotSyncResponse,
)
from app.services.ai_extraction_service import analyze_conversation
from app.services.reply_suggestion_service import create_reply_suggestion
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


def get_latest_ai_extraction_for_conversation(
    db: Session,
    *,
    conversation_id: UUID,
) -> AIExtraction | None:
    statement = (
        select(AIExtraction)
        .where(AIExtraction.conversation_id == conversation_id)
        .order_by(desc(AIExtraction.created_at))
    )
    return db.scalars(statement).first()


def get_latest_reply_suggestion_for_conversation(
    db: Session,
    *,
    conversation_id: UUID,
) -> ReplySuggestion | None:
    statement = (
        select(ReplySuggestion)
        .where(ReplySuggestion.conversation_id == conversation_id)
        .order_by(desc(ReplySuggestion.created_at))
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


def build_extension_reply_suggestions_response(
    *,
    snapshot_result: WhatsAppExtensionSnapshotSyncResponse,
    extraction: AIExtraction,
    suggestion: ReplySuggestion,
    cached: bool,
) -> WhatsAppExtensionReplySuggestionsResponse:
    suggestion_details = [
        WhatsAppExtensionReplySuggestionItem(
            tone=str(item.get("tone", "")),
            text=str(item.get("text", "")),
            reasoning=str(item.get("reasoning", "")),
        )
        for item in suggestion.suggested_replies
        if isinstance(item, dict)
        and str(item.get("text", "")).strip()
    ]

    if not suggestion_details:
        raise ExtensionSnapshotError("Reply suggestion output is empty.")

    return WhatsAppExtensionReplySuggestionsResponse(
        status=snapshot_result.status,
        duplicate=snapshot_result.duplicate,
        cached=cached,
        conversation_id=snapshot_result.conversation_id,
        reply_suggestion_id=suggestion.id,
        message_count=snapshot_result.message_count,
        suggestions=[item.text for item in suggestion_details[:3]],
        suggestion_details=suggestion_details[:3],
        risk_level=suggestion.risk_level,
        action_mode=suggestion.action_mode,
        next_best_action=extraction.next_best_action,
        customer_summary=extraction.customer_summary,
    )


def generate_extension_reply_suggestions(
    db: Session,
    *,
    current_user: User,
    snapshot: WhatsAppExtensionChatSnapshot | None,
) -> WhatsAppExtensionReplySuggestionsResponse:
    snapshot_result = sync_whatsapp_extension_snapshot(
        db=db,
        current_user=current_user,
        snapshot=snapshot,
    )

    if snapshot_result.conversation_id is None:
        raise ExtensionSnapshotError(
            "Snapshot chat kosong. Buka percakapan WhatsApp yang aktif dulu."
        )

    latest_extraction = get_latest_ai_extraction_for_conversation(
        db=db,
        conversation_id=snapshot_result.conversation_id,
    )
    latest_suggestion = get_latest_reply_suggestion_for_conversation(
        db=db,
        conversation_id=snapshot_result.conversation_id,
    )

    if (
        snapshot_result.duplicate
        and latest_extraction is not None
        and latest_suggestion is not None
        and latest_suggestion.ai_extraction_id == latest_extraction.id
    ):
        return build_extension_reply_suggestions_response(
            snapshot_result=snapshot_result,
            extraction=latest_extraction,
            suggestion=latest_suggestion,
            cached=True,
        )

    extraction = analyze_conversation(
        db=db,
        conversation_id=snapshot_result.conversation_id,
    )
    suggestion = create_reply_suggestion(
        db=db,
        conversation_id=snapshot_result.conversation_id,
    )

    return build_extension_reply_suggestions_response(
        snapshot_result=snapshot_result,
        extraction=extraction,
        suggestion=suggestion,
        cached=False,
    )


def confirm_extension_reply_sent(
    db: Session,
    *,
    reply_suggestion_id: UUID,
    selected_reply_text: str,
    final_reply_text: str,
    sent_by_name: str,
) -> WhatsAppExtensionSendReplyResponse:
    suggestion = db.get(ReplySuggestion, reply_suggestion_id)

    if suggestion is None:
        raise ExtensionSnapshotError("Reply suggestion not found.")

    if suggestion.approval_status == "rejected":
        raise ExtensionSnapshotError("Rejected reply suggestion cannot be sent.")

    existing_sent_message = db.scalars(
        select(SentMessage).where(SentMessage.reply_suggestion_id == suggestion.id)
    ).first()

    if existing_sent_message is not None:
        return WhatsAppExtensionSendReplyResponse(
            status="already_sent",
            conversation_id=suggestion.conversation_id,
            reply_suggestion_id=suggestion.id,
            sent_message_id=existing_sent_message.id,
            approval_status=suggestion.approval_status,
            auto_approved=False,
            already_sent=True,
        )

    normalized_selected = selected_reply_text.strip()
    normalized_final = final_reply_text.strip()

    if not normalized_selected or not normalized_final:
        raise ExtensionSnapshotError("Reply text cannot be empty.")

    auto_approved = False

    if suggestion.approval_status == "pending":
        suggestion.selected_reply_text = normalized_selected
        suggestion.final_reply_text = normalized_final
        suggestion.approval_status = "approved"
        suggestion.updated_at = datetime.utcnow()

        db.add(
            ApprovalLog(
                reply_suggestion_id=suggestion.id,
                reviewer_name=sent_by_name,
                action="approved_via_extension_send",
                before_text=normalized_selected,
                after_text=normalized_final,
                reason=None,
            )
        )
        auto_approved = True
    elif suggestion.approval_status == "approved":
        if not suggestion.selected_reply_text:
            suggestion.selected_reply_text = normalized_selected
        if not suggestion.final_reply_text:
            suggestion.final_reply_text = normalized_final
        suggestion.updated_at = datetime.utcnow()

    if not suggestion.final_reply_text:
        raise ExtensionSnapshotError("Approved reply has no final reply text.")

    conversation = db.get(Conversation, suggestion.conversation_id)

    if conversation is None:
        raise ExtensionSnapshotError("Conversation not found.")

    latest_extraction = get_latest_ai_extraction_for_conversation(
        db=db,
        conversation_id=conversation.id,
    )

    conversation.status = "replied"

    if latest_extraction is not None:
        conversation.current_stage = latest_extraction.pipeline_stage
        conversation.lead_temperature = latest_extraction.lead_temperature

    sent_message = SentMessage(
        conversation_id=conversation.id,
        reply_suggestion_id=suggestion.id,
        send_mode="whatsapp_extension",
        message_text=suggestion.final_reply_text,
        sent_by_name=sent_by_name,
        external_message_id=None,
    )

    db.add(sent_message)
    db.commit()
    db.refresh(sent_message)
    db.refresh(suggestion)

    return WhatsAppExtensionSendReplyResponse(
        status="sent",
        conversation_id=conversation.id,
        reply_suggestion_id=suggestion.id,
        sent_message_id=sent_message.id,
        approval_status=suggestion.approval_status,
        auto_approved=auto_approved,
        already_sent=False,
    )
