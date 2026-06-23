from collections import Counter
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.db.session import get_db
from app.models.audit_log import AuditLog
from app.models.user import User
from app.schemas.audit_log_schema import (
    AuditLogResponse,
    ReplySuggestionHealthSummaryResponse,
    ReplySuggestionHealthTopFailure,
)

router = APIRouter(prefix="/audit-logs", tags=["audit-logs"])


@router.get("", response_model=list[AuditLogResponse])
def list_audit_logs(
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("superadmin")),
):
    if current_user.organization_id is None:
        return []

    statement = select(AuditLog).where(
        AuditLog.organization_id == str(current_user.organization_id)
    )
    statement = statement.order_by(desc(AuditLog.created_at)).limit(limit)

    return list(db.scalars(statement).all())


@router.get(
    "/reply-suggestions/health",
    response_model=ReplySuggestionHealthSummaryResponse,
)
def get_reply_suggestion_health_summary(
    window_hours: int = Query(default=24, ge=1, le=168),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("head", "superadmin")),
):
    if current_user.organization_id is None:
        return ReplySuggestionHealthSummaryResponse(
            organization_id=None,
            window_hours=window_hours,
            generated_total=0,
            generated_success=0,
            generated_failed=0,
            extension_generated_total=0,
            extension_generated_success=0,
            extension_generated_failed=0,
            cached_hits=0,
            duplicate_snapshot_hits=0,
            send_success=0,
            send_failed=0,
            latest_success_at=None,
            latest_failure_at=None,
            top_failures=[],
        )

    window_started_at = datetime.now(timezone.utc) - timedelta(hours=window_hours)
    statement = (
        select(AuditLog)
        .where(AuditLog.organization_id == str(current_user.organization_id))
        .where(AuditLog.created_at >= window_started_at)
        .where(
            AuditLog.action.in_(
                [
                    "reply_suggestion.generate",
                    "reply_suggestion.generate_failed",
                    "extension.whatsapp.reply_suggestions_generate",
                    "extension.whatsapp.reply_suggestions_generate_failed",
                    "extension.whatsapp.reply_suggestion_send",
                    "extension.whatsapp.reply_suggestion_send_failed",
                ]
            )
        )
        .order_by(desc(AuditLog.created_at))
    )

    logs = list(db.scalars(statement).all())
    failure_counter: Counter[str] = Counter()
    latest_success_at: datetime | None = None
    latest_failure_at: datetime | None = None

    generated_success = 0
    generated_failed = 0
    extension_generated_success = 0
    extension_generated_failed = 0
    cached_hits = 0
    duplicate_snapshot_hits = 0
    send_success = 0
    send_failed = 0

    success_actions = {
        "reply_suggestion.generate",
        "extension.whatsapp.reply_suggestions_generate",
        "extension.whatsapp.reply_suggestion_send",
    }
    failure_actions = {
        "reply_suggestion.generate_failed",
        "extension.whatsapp.reply_suggestions_generate_failed",
        "extension.whatsapp.reply_suggestion_send_failed",
    }

    for log in logs:
        metadata = log.metadata_json or {}
        if log.action == "reply_suggestion.generate":
            generated_success += 1
        elif log.action == "reply_suggestion.generate_failed":
            generated_failed += 1
        elif log.action == "extension.whatsapp.reply_suggestions_generate":
            extension_generated_success += 1
            if metadata.get("cached") is True:
                cached_hits += 1
            if metadata.get("duplicate") is True:
                duplicate_snapshot_hits += 1
        elif log.action == "extension.whatsapp.reply_suggestions_generate_failed":
            extension_generated_failed += 1
        elif log.action == "extension.whatsapp.reply_suggestion_send":
            send_success += 1
        elif log.action == "extension.whatsapp.reply_suggestion_send_failed":
            send_failed += 1

        if log.action in success_actions and latest_success_at is None:
            latest_success_at = log.created_at

        if log.action in failure_actions:
            failure_counter[log.action] += 1
            if latest_failure_at is None:
                latest_failure_at = log.created_at

    return ReplySuggestionHealthSummaryResponse(
        organization_id=str(current_user.organization_id),
        window_hours=window_hours,
        generated_total=generated_success + generated_failed,
        generated_success=generated_success,
        generated_failed=generated_failed,
        extension_generated_total=(
            extension_generated_success + extension_generated_failed
        ),
        extension_generated_success=extension_generated_success,
        extension_generated_failed=extension_generated_failed,
        cached_hits=cached_hits,
        duplicate_snapshot_hits=duplicate_snapshot_hits,
        send_success=send_success,
        send_failed=send_failed,
        latest_success_at=latest_success_at,
        latest_failure_at=latest_failure_at,
        top_failures=[
            ReplySuggestionHealthTopFailure(action=action, count=count)
            for action, count in failure_counter.most_common(5)
        ],
    )
