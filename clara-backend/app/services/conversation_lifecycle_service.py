from datetime import datetime, timedelta, timezone

from app.core.config import settings
from app.models.conversation import Conversation


def ensure_aware_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def get_conversation_activity_timestamp(conversation: Conversation) -> datetime:
    return (
        ensure_aware_utc(conversation.last_message_at)
        or ensure_aware_utc(conversation.started_at)
        or ensure_aware_utc(conversation.created_at)
        or datetime.now(timezone.utc)
    )


def is_conversation_auto_archived(
    conversation: Conversation,
    *,
    now: datetime | None = None,
) -> bool:
    archive_days = max(settings.conversation_auto_archive_days, 0)
    if archive_days <= 0:
        return False

    now_utc = ensure_aware_utc(now) or datetime.now(timezone.utc)
    last_activity_at = get_conversation_activity_timestamp(conversation)
    archive_after = timedelta(days=archive_days)
    return (now_utc - last_activity_at) >= archive_after

