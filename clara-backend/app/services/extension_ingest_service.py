from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import hashlib
import re
from uuid import UUID

from sqlalchemy import desc, select
from sqlalchemy.orm import Session, selectinload

from app.models.ai_extraction import AIExtraction
from app.models.approval_log import ApprovalLog
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.reply_suggestion import ReplySuggestion
from app.models.sent_message import SentMessage
from app.models.user import User
from app.schemas.extension_schema import (
    ExtensionReplySuggestionsResponse,
    ExtensionSendReplyResponse,
    ExtensionSnapshotSyncResponse,
    WhatsAppExtensionChatSnapshot,
    WhatsAppExtensionReplySuggestionItem,
)
from app.services.ai_extraction_service import analyze_conversation
from app.services.lead_service import ensure_conversation_lead
from app.services.reply_suggestion_service import create_reply_suggestion
from app.services.whatsapp_parser import JAKARTA_TZ, parse_whatsapp_datetime


EXTENSION_PROVIDER = "extension"
DEFAULT_EXTENSION_CHANNEL = "whatsapp"
EXTENSION_CHAT_SOURCE_BY_CHANNEL = {
    "whatsapp": "whatsapp_extension",
    "instagram": "instagram_extension",
    "tiktok": "tiktok_extension",
}
EXTENSION_MESSAGE_KEY_PREFIX_BY_CHANNEL = {
    "whatsapp": "waext",
    "instagram": "igext",
    "tiktok": "tkext",
}
EXTENSION_SEND_MODE_BY_CHANNEL = {
    "whatsapp": "whatsapp_extension",
    "instagram": "instagram_extension",
    "tiktok": "tiktok_extension",
}
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
    external_message_id: str
    author: str
    sender_type: str
    text: str
    reply_context_text: str | None
    reply_context_sender_name: str | None
    reply_context_sender_type: str | None
    timestamp: datetime
    timestamp_label: str


@dataclass(frozen=True)
class ReplyContextMatch:
    text: str
    sender_name: str
    sender_type: str


@dataclass(frozen=True)
class ExtensionChannelContext:
    channel: str
    provider: str
    source: str
    message_key_prefix: str
    send_mode: str


SYNTHETIC_SALES_MATCH_WINDOW = timedelta(minutes=10)
REPLY_CONTEXT_MIN_LENGTH = 18


def get_extension_channel_context(
    channel: str = DEFAULT_EXTENSION_CHANNEL,
    provider: str = EXTENSION_PROVIDER,
) -> ExtensionChannelContext:
    normalized_channel = (channel or DEFAULT_EXTENSION_CHANNEL).strip().lower()
    normalized_provider = (provider or EXTENSION_PROVIDER).strip().lower()

    source = EXTENSION_CHAT_SOURCE_BY_CHANNEL.get(normalized_channel)
    message_key_prefix = EXTENSION_MESSAGE_KEY_PREFIX_BY_CHANNEL.get(normalized_channel)
    send_mode = EXTENSION_SEND_MODE_BY_CHANNEL.get(normalized_channel)

    if not source or not message_key_prefix or not send_mode:
        raise ExtensionSnapshotError(f"Unsupported extension channel: {channel}")

    return ExtensionChannelContext(
        channel=normalized_channel,
        provider=normalized_provider,
        source=source,
        message_key_prefix=message_key_prefix,
        send_mode=send_mode,
    )


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

        current_sender_type = "sales" if message.direction == "outgoing" else "customer"
        explicit_reply_context = None
        if message.reply_context_text and message.reply_context_text.strip():
            explicit_reply_context = ReplyContextMatch(
                text=message.reply_context_text.strip(),
                sender_name=(message.reply_context_sender_name or "").strip()
                or (
                    snapshot.chat_title
                    if message.reply_context_sender_type == "incoming"
                    else "Anda"
                ),
                sender_type=(
                    "customer"
                    if message.reply_context_sender_type == "incoming"
                    else "sales"
                    if message.reply_context_sender_type == "outgoing"
                    else "unknown"
                ),
            )

        body_text, inferred_reply_context = split_reply_context_from_snapshot_text(
            raw_text=message.text,
            sender_type=current_sender_type,
            previous_messages=normalized_messages,
        )
        reply_context = explicit_reply_context or inferred_reply_context

        normalized_messages.append(
            NormalizedSnapshotMessage(
                external_message_id=message.id.strip(),
                author=message.author.strip(),
                sender_type=current_sender_type,
                text=body_text,
                reply_context_text=reply_context.text if reply_context else None,
                reply_context_sender_name=(
                    reply_context.sender_name if reply_context else None
                ),
                reply_context_sender_type=(
                    reply_context.sender_type if reply_context else None
                ),
                timestamp=timestamp,
                timestamp_label=message.timestamp_label.strip(),
            )
        )

    return dedupe_normalized_snapshot_messages(normalized_messages)


def dedupe_normalized_snapshot_messages(
    messages: list[NormalizedSnapshotMessage],
) -> list[NormalizedSnapshotMessage]:
    deduped: list[NormalizedSnapshotMessage] = []
    seen_keys: set[tuple[str, str, str, str]] = set()

    for message in messages:
        key = (
            message.sender_type,
            message.author.strip().lower(),
            message.text.strip(),
            message.timestamp_label.strip(),
        )
        if key in seen_keys:
            continue

        seen_keys.add(key)
        deduped.append(message)

    return deduped


def normalize_extension_message_text(value: str) -> str:
    return "\n".join(
        line.strip()
        for line in (value or "").splitlines()
        if line.strip()
    ).strip()


def _normalize_extension_similarity_text(value: str) -> str:
    normalized = normalize_extension_message_text(value).lower()
    normalized = re.sub(r"[^a-z0-9\s]", " ", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return normalized


def _reply_excerpt_matches_previous_message(
    excerpt: str,
    previous_message_text: str,
) -> bool:
    normalized_excerpt = _normalize_extension_similarity_text(excerpt)
    normalized_previous = _normalize_extension_similarity_text(previous_message_text)

    if (
        not normalized_excerpt
        or not normalized_previous
        or len(normalized_excerpt) < REPLY_CONTEXT_MIN_LENGTH
    ):
        return False

    if normalized_excerpt in normalized_previous:
        return True

    excerpt_tokens = [
        token for token in normalized_excerpt.split() if len(token) >= 4
    ]
    previous_tokens = {
        token for token in normalized_previous.split() if len(token) >= 4
    }

    if not excerpt_tokens or not previous_tokens:
        return False

    overlap = sum(1 for token in excerpt_tokens if token in previous_tokens)
    return overlap >= max(3, len(excerpt_tokens) // 2)


def split_reply_context_from_snapshot_text(
    *,
    raw_text: str,
    sender_type: str,
    previous_messages: list[NormalizedSnapshotMessage],
) -> tuple[str, ReplyContextMatch | None]:
    normalized_text = normalize_extension_message_text(raw_text)
    if not normalized_text:
        return "", None

    lines = [line.strip() for line in normalized_text.splitlines() if line.strip()]
    if len(lines) < 2:
        return normalized_text, None

    relevant_previous_messages = [
        message
        for message in previous_messages[-6:]
        if message.text.strip()
        and message.sender_type != sender_type
    ]
    if not relevant_previous_messages:
        return normalized_text, None

    for split_index in range(1, len(lines)):
        reply_context = "\n".join(lines[:split_index]).strip()
        body_text = "\n".join(lines[split_index:]).strip()

        if not reply_context or not body_text:
            continue

        if len(reply_context) < REPLY_CONTEXT_MIN_LENGTH:
            continue

        for previous in relevant_previous_messages:
            if _reply_excerpt_matches_previous_message(reply_context, previous.text):
                return body_text, ReplyContextMatch(
                    text=previous.text,
                    sender_name=previous.author,
                    sender_type=previous.sender_type,
                )

    return normalized_text, None


def ensure_aware_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)

    return value.astimezone(timezone.utc)


def get_existing_extension_conversation(
    db: Session,
    *,
    channel_context: ExtensionChannelContext,
    current_user: User,
    chat_title: str,
) -> Conversation | None:
    statement = (
        select(Conversation)
        .where(Conversation.source == channel_context.source)
        .where(Conversation.sales_user_id == current_user.id)
        .where(Conversation.organization_id == current_user.organization_id)
        .where(Conversation.title == chat_title.strip())
        .order_by(desc(Conversation.created_at))
    )
    return db.scalars(statement).first()


def build_extension_message_key(
    *,
    channel_context: ExtensionChannelContext,
    current_user: User,
    chat_title: str,
    snapshot_message_id: str,
) -> str:
    key_source = (
        f"{channel_context.message_key_prefix}:{current_user.organization_id}:{current_user.id}:"
        f"{chat_title.strip().lower()}:{snapshot_message_id.strip()}"
    )
    digest = hashlib.sha256(key_source.encode("utf-8")).hexdigest()
    return f"{channel_context.message_key_prefix}:{digest}"


def build_extension_thread_key(
    *,
    channel_context: ExtensionChannelContext,
    current_user: User,
    chat_title: str,
) -> str:
    key_source = (
        f"{channel_context.message_key_prefix}:thread:{current_user.organization_id}:"
        f"{current_user.id}:{chat_title.strip().lower()}"
    )
    digest = hashlib.sha256(key_source.encode("utf-8")).hexdigest()
    return f"{channel_context.message_key_prefix}:thread:{digest}"


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


def get_extension_conversation_or_raise(
    db: Session,
    *,
    channel_context: ExtensionChannelContext,
    conversation_id: UUID,
) -> Conversation:
    statement = (
        select(Conversation)
        .where(Conversation.id == conversation_id)
        .where(Conversation.source == channel_context.source)
        .options(selectinload(Conversation.messages))
    )
    conversation = db.scalars(statement).first()

    if conversation is None:
        raise ExtensionSnapshotError("Conversation extension tidak ditemukan.")

    return conversation


def sync_extension_messages(
    db: Session,
    *,
    channel_context: ExtensionChannelContext,
    conversation: Conversation,
    current_user: User,
    chat_title: str,
    normalized_messages: list[NormalizedSnapshotMessage],
) -> None:
    existing_messages = list(
        db.scalars(
            select(Message).where(Message.conversation_id == conversation.id)
        ).all()
    )
    existing_by_external_id = {
        message.external_message_id: message
        for message in existing_messages
        if message.external_message_id
    }
    for message in normalized_messages:
        external_message_id = build_extension_message_key(
            channel_context=channel_context,
            current_user=current_user,
            chat_title=chat_title,
            snapshot_message_id=message.external_message_id,
        )
        existing_message = existing_by_external_id.get(external_message_id)

        if existing_message is None:
            existing_message = find_matching_synthetic_sales_message(
                existing_messages=existing_messages,
                incoming_message=message,
            )

        if existing_message is None:
            existing_message = Message(
                conversation_id=conversation.id,
                channel=channel_context.channel,
                provider=channel_context.provider,
                external_message_id=external_message_id,
                sender_name=message.author,
                sender_type=message.sender_type,
                message_text=message.text,
                reply_context_text=message.reply_context_text,
                reply_context_sender_name=message.reply_context_sender_name,
                reply_context_sender_type=message.reply_context_sender_type,
                message_timestamp=message.timestamp,
            )
            db.add(existing_message)
            db.flush()
            existing_messages.append(existing_message)
        else:
            existing_message.channel = channel_context.channel
            existing_message.provider = channel_context.provider
            existing_message.external_message_id = external_message_id
            existing_message.sender_name = message.author
            existing_message.sender_type = message.sender_type
            existing_message.message_text = message.text
            existing_message.reply_context_text = message.reply_context_text
            existing_message.reply_context_sender_name = (
                message.reply_context_sender_name
            )
            existing_message.reply_context_sender_type = (
                message.reply_context_sender_type
            )
            existing_message.message_timestamp = message.timestamp
            db.add(existing_message)

        existing_by_external_id[external_message_id] = existing_message


def find_matching_synthetic_sales_message(
    *,
    existing_messages: list[Message],
    incoming_message: NormalizedSnapshotMessage,
) -> Message | None:
    if incoming_message.sender_type != "sales":
        return None

    normalized_text = incoming_message.text.strip()
    if not normalized_text:
        return None

    incoming_timestamp = ensure_aware_utc(incoming_message.timestamp)

    exact_text_candidates = [
        message
        for message in existing_messages
        if message.external_message_id is None
        and message.sender_type == "sales"
        and message.message_text.strip() == normalized_text
    ]

    candidates = [
        message
        for message in exact_text_candidates
        if message.message_timestamp is not None
        and abs(ensure_aware_utc(message.message_timestamp) - incoming_timestamp)
        <= SYNTHETIC_SALES_MATCH_WINDOW
    ]

    if not candidates:
        recent_fallback_candidates = [
            message
            for message in exact_text_candidates
            if abs(
                ensure_aware_utc(message.created_at) - datetime.now(timezone.utc)
            )
            <= SYNTHETIC_SALES_MATCH_WINDOW
        ]

        if len(recent_fallback_candidates) == 1:
            return recent_fallback_candidates[0]

        return None

    return min(
        candidates,
        key=lambda message: abs(
            ensure_aware_utc(message.message_timestamp) - incoming_timestamp
        ),
    )

def is_extension_cache_fresh(
    *,
    conversation: Conversation,
    extraction: AIExtraction | None,
    suggestion: ReplySuggestion | None,
) -> bool:
    if extraction is None or suggestion is None:
        return False

    if suggestion.ai_extraction_id != extraction.id:
        return False

    latest_message_created_at = max(
        (message.created_at for message in conversation.messages),
        default=None,
    )
    if latest_message_created_at is None:
        return True

    return (
        extraction.created_at >= latest_message_created_at
        and suggestion.created_at >= latest_message_created_at
    )


def sync_extension_snapshot(
    db: Session,
    *,
    channel: str = DEFAULT_EXTENSION_CHANNEL,
    provider: str = EXTENSION_PROVIDER,
    current_user: User,
    snapshot: WhatsAppExtensionChatSnapshot | None,
) -> ExtensionSnapshotSyncResponse:
    channel_context = get_extension_channel_context(channel=channel, provider=provider)

    if current_user.organization_id is None:
        raise ExtensionSnapshotError("User has no organization assigned.")

    if snapshot is None:
        return ExtensionSnapshotSyncResponse(
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
    external_thread_id = build_extension_thread_key(
        channel_context=channel_context,
        current_user=current_user,
        chat_title=snapshot.chat_title,
    )
    started_at = normalized_messages[0].timestamp
    last_message_at = normalized_messages[-1].timestamp

    conversation = get_existing_extension_conversation(
        db=db,
        channel_context=channel_context,
        current_user=current_user,
        chat_title=snapshot.chat_title,
    )

    if conversation is not None and (conversation.raw_text or "").strip() == transcript:
        return ExtensionSnapshotSyncResponse(
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
            channel=channel_context.channel,
            provider=channel_context.provider,
            provider_key=channel_context.provider,
            external_thread_id=external_thread_id,
            external_thread_key=external_thread_id,
            source=channel_context.source,
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
        conversation.channel = channel_context.channel
        conversation.provider = channel_context.provider
        conversation.external_thread_id = (
            conversation.external_thread_id or external_thread_id
        )
        conversation.external_thread_key = (
            conversation.external_thread_key or external_thread_id
        )
        conversation.status = "synced"
        conversation.raw_text = transcript
        conversation.started_at = started_at
        conversation.last_message_at = last_message_at
        db.add(conversation)
        db.flush()
        status_value = "updated"

    sync_extension_messages(
        db=db,
        channel_context=channel_context,
        conversation=conversation,
        current_user=current_user,
        chat_title=snapshot.chat_title,
        normalized_messages=normalized_messages,
    )

    db.commit()
    db.refresh(conversation)

    customer_messages = [
        message for message in normalized_messages if message.sender_type == "customer"
    ]
    with db.no_autoflush:
        ensure_conversation_lead(
            db=db,
            conversation=conversation,
            preferred_name=(
                customer_messages[0].author if customer_messages else snapshot.chat_title
            ),
        )

    db.commit()
    db.refresh(conversation)

    return ExtensionSnapshotSyncResponse(
        status=status_value,
        duplicate=False,
        conversation_id=conversation.id,
        message_count=len(normalized_messages),
    )


def sync_whatsapp_extension_snapshot(
    db: Session,
    *,
    current_user: User,
    snapshot: WhatsAppExtensionChatSnapshot | None,
) -> ExtensionSnapshotSyncResponse:
    return sync_extension_snapshot(
        db=db,
        channel="whatsapp",
        provider="extension",
        current_user=current_user,
        snapshot=snapshot,
    )


def build_extension_reply_suggestions_response(
    *,
    snapshot_result: ExtensionSnapshotSyncResponse,
    extraction: AIExtraction,
    suggestion: ReplySuggestion,
    cached: bool,
) -> ExtensionReplySuggestionsResponse:
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

    return ExtensionReplySuggestionsResponse(
        status=snapshot_result.status,
        duplicate=snapshot_result.duplicate,
        cached=cached,
        conversation_id=snapshot_result.conversation_id,
        reply_suggestion_id=suggestion.id,
        message_count=snapshot_result.message_count,
        suggestions=[item.text for item in suggestion_details[:1]],
        suggestion_details=suggestion_details[:1],
        risk_level=suggestion.risk_level or extraction.risk_level,
        action_mode=suggestion.action_mode,
        next_best_action=extraction.next_best_action,
        customer_summary=extraction.customer_summary,
    )


def generate_extension_reply_suggestions_for_channel(
    db: Session,
    *,
    channel: str = DEFAULT_EXTENSION_CHANNEL,
    provider: str = EXTENSION_PROVIDER,
    current_user: User,
    snapshot: WhatsAppExtensionChatSnapshot | None,
) -> ExtensionReplySuggestionsResponse:
    channel_context = get_extension_channel_context(channel=channel, provider=provider)

    snapshot_result = sync_extension_snapshot(
        db=db,
        channel=channel_context.channel,
        provider=channel_context.provider,
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
    conversation = get_extension_conversation_or_raise(
        db=db,
        channel_context=channel_context,
        conversation_id=snapshot_result.conversation_id,
    )

    if (
        snapshot_result.duplicate
        and is_extension_cache_fresh(
            conversation=conversation,
            extraction=latest_extraction,
            suggestion=latest_suggestion,
        )
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
        desired_count=1,
    )

    return build_extension_reply_suggestions_response(
        snapshot_result=snapshot_result,
        extraction=extraction,
        suggestion=suggestion,
        cached=False,
    )


def generate_extension_reply_suggestions(
    db: Session,
    *,
    current_user: User,
    snapshot: WhatsAppExtensionChatSnapshot | None,
) -> ExtensionReplySuggestionsResponse:
    return generate_extension_reply_suggestions_for_channel(
        db=db,
        channel="whatsapp",
        provider="extension",
        current_user=current_user,
        snapshot=snapshot,
    )


def confirm_extension_reply_sent_for_channel(
    db: Session,
    *,
    channel: str = DEFAULT_EXTENSION_CHANNEL,
    provider: str = EXTENSION_PROVIDER,
    reply_suggestion_id: UUID,
    selected_reply_text: str,
    final_reply_text: str,
    sent_by_name: str,
) -> ExtensionSendReplyResponse:
    channel_context = get_extension_channel_context(channel=channel, provider=provider)

    suggestion = db.get(ReplySuggestion, reply_suggestion_id)

    if suggestion is None:
        raise ExtensionSnapshotError("Reply suggestion not found.")

    if suggestion.approval_status == "rejected":
        raise ExtensionSnapshotError("Rejected reply suggestion cannot be sent.")

    existing_sent_message = db.scalars(
        select(SentMessage).where(SentMessage.reply_suggestion_id == suggestion.id)
    ).first()

    if existing_sent_message is not None:
        return ExtensionSendReplyResponse(
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
        suggestion.updated_at = datetime.now(timezone.utc)

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
        suggestion.updated_at = datetime.now(timezone.utc)

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
        send_mode=channel_context.send_mode,
        message_text=suggestion.final_reply_text,
        sent_by_name=sent_by_name,
        external_message_id=None,
    )

    db.add(sent_message)
    db.flush()
    latest_known_message_at = ensure_aware_utc(conversation.last_message_at)
    synthetic_message_timestamp = (
        latest_known_message_at + timedelta(seconds=1)
        if latest_known_message_at is not None
        else sent_message.sent_at
    )
    conversation.last_message_at = sent_message.sent_at
    db.add(
        Message(
            conversation_id=conversation.id,
            sender_name=sent_by_name,
            sender_type="sales",
            channel=channel_context.channel,
            provider=channel_context.provider,
            external_message_id=None,
            message_text=suggestion.final_reply_text,
            message_timestamp=synthetic_message_timestamp,
        )
    )
    db.add(conversation)
    db.commit()
    db.refresh(sent_message)
    db.refresh(suggestion)

    return ExtensionSendReplyResponse(
        status="sent",
        conversation_id=conversation.id,
        reply_suggestion_id=suggestion.id,
        sent_message_id=sent_message.id,
        approval_status=suggestion.approval_status,
        auto_approved=auto_approved,
        already_sent=False,
    )


def confirm_extension_reply_sent(
    db: Session,
    *,
    reply_suggestion_id: UUID,
    selected_reply_text: str,
    final_reply_text: str,
    sent_by_name: str,
) -> ExtensionSendReplyResponse:
    return confirm_extension_reply_sent_for_channel(
        db=db,
        channel="whatsapp",
        provider="extension",
        reply_suggestion_id=reply_suggestion_id,
        selected_reply_text=selected_reply_text,
        final_reply_text=final_reply_text,
        sent_by_name=sent_by_name,
    )
