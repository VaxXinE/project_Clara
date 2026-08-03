import json
import re
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session
from app.core.security import require_roles
from app.core.config import settings
from app.models.user import User
from app.db.session import get_db
from app.schemas.dashboard_schema import (
    ChatReviewCenterResponse,
    ChatReviewCaseItem,
    ChatReviewCaseSuggestionResponse,
    ChatReviewCaseUpsertRequest,
    ChatReviewNoteCreateRequest,
    ChatReviewerCandidateItem,
    KpiAlertHistoryResponse,
    KpiAlertResolveRequest,
    KpiCommandCenterResponse,
    KpiSnapshotHistoryResponse,
    MarketingExecutionItem,
    MarketingExecutionItemCreateRequest,
    MarketingExecutionItemUpdateRequest,
    ManagerInsightsResponse,
    MarketingInsightSnapshotResponse,
    MarketingInsightsPreview,
    OpsDatabaseOverviewResponse,
    OpsNotificationItem,
    OpsNotificationResolveRequest,
    OpsNotificationResponse,
    PerformanceActionCreateRequest,
    PerformanceActionItem,
    PerformanceActionListResponse,
    PerformanceSnapshotGenerationResponse,
    PerformanceActionUpdateRequest,
    PersistedKpiAlertRecord,
    SalesApprovalQueueResponse,
    SalesConversationDetail,
    SalesInboxItem,
    SalesPerformanceDetailResponse,
    SalesPerformanceHistoryResponse,
    SalesWorklistResponse,
    TeamPerformanceHistoryResponse,
    WeeklyReviewSummaryResponse,
)
from app.schemas.channel_schema import ChannelOverviewResponse
from app.services.audit_service import create_audit_log
from app.services.access_control_service import (
    get_accessible_sales_user_ids,
    get_accessible_team_ids,
)
from app.services.chat_review_service import (
    ChatReviewError,
    add_chat_review_note,
    build_chat_review_case_suggestion,
    get_reviewable_conversation_or_raise,
    list_chat_reviewer_candidates,
    upsert_chat_review_case,
)
from app.services.dashboard_service import (
    acknowledge_ops_notification,
    escalate_ops_notification,
    acknowledge_kpi_alert,
    create_marketing_execution_item,
    get_channel_overview,
    get_kpi_command_center,
    get_marketing_insights_preview,
    get_manager_insights,
    build_weekly_review_csv,
    get_ops_database_overview,
    get_sales_chat_review_center,
    list_ops_notifications,
    reopen_ops_notification,
    get_sales_approval_queue,
    get_sales_conversation_detail,
    get_sales_inbox,
    get_sales_performance_detail,
    get_sales_performance_history,
    get_team_performance_history,
    ensure_weekly_performance_snapshots,
    get_sales_worklist,
    list_kpi_alert_records,
    list_kpi_snapshots,
    list_marketing_execution_items,
    refresh_kpi_command_center,
    ignore_ops_notification,
    resolve_ops_notification,
    reopen_kpi_alert,
    resolve_kpi_alert,
    update_marketing_execution_item,
)
from app.services.performance_action_service import (
    create_performance_action,
    list_performance_actions,
    update_performance_action_status,
)
from app.services.marketing_snapshot_service import (
    generate_marketing_snapshot,
    list_marketing_snapshots,
)
from app.services.role_service import normalize_role

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

GLOBAL_EXTENSION_BUILD_KEY = "global"
EXTENSION_BUILD_SUFFIXES = {".zip", ".crx"}
EXTENSION_BUILD_MAX_SIZE_BYTES = 50 * 1024 * 1024
EXTENSION_FILENAME_SANITIZER = re.compile(r"[^a-zA-Z0-9._-]+")


def get_extension_distribution_dir() -> Path:
    return Path(settings.extension_distribution_dir).resolve()


def get_extension_manifest_path() -> Path:
    return get_extension_distribution_dir() / "manifest.json"


def read_extension_manifest() -> dict[str, dict[str, object]]:
    manifest_path = get_extension_manifest_path()
    if not manifest_path.exists():
        return {}

    try:
        payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}

    if not isinstance(payload, dict):
        return {}

    return {
        str(role): metadata
        for role, metadata in payload.items()
        if isinstance(role, str) and isinstance(metadata, dict)
    }


def write_extension_manifest(manifest: dict[str, dict[str, object]]) -> None:
    extension_dir = get_extension_distribution_dir()
    extension_dir.mkdir(parents=True, exist_ok=True)
    get_extension_manifest_path().write_text(
        json.dumps(manifest, indent=2, sort_keys=True),
        encoding="utf-8",
    )


def build_extension_build_item(current_user: User) -> dict[str, object]:
    metadata = read_extension_manifest().get(GLOBAL_EXTENSION_BUILD_KEY, {})
    can_manage = normalize_role(current_user.role) == "superadmin"

    return {
        "role": "all",
        "available": bool(metadata),
        "version": metadata.get("version"),
        "file_name": metadata.get("file_name"),
        "size_bytes": metadata.get("size_bytes"),
        "uploaded_at": metadata.get("uploaded_at"),
        "uploaded_by_email": metadata.get("uploaded_by_email"),
        "can_download": bool(metadata),
        "can_manage": can_manage,
    }


def get_extension_build_or_raise() -> dict[str, object]:
    metadata = read_extension_manifest().get(GLOBAL_EXTENSION_BUILD_KEY)
    if not metadata:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Package extension global belum diupload.",
        )

    return metadata


@router.get("/channels", response_model=ChannelOverviewResponse)
def channel_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("sales", "manager", "head", "superadmin")),
):
    return get_channel_overview(db=db, current_user=current_user)


@router.get("/sales/inbox", response_model=list[SalesInboxItem])
def sales_inbox(
    source_channel: str | None = Query(default=None),
    archive_scope: str = Query(default="active"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("sales", "manager", "head", "superadmin")),
):
    return get_sales_inbox(
        db=db,
        current_user=current_user,
        source_channel=source_channel,
        archive_scope=archive_scope,
    )


@router.get("/sales/worklist", response_model=SalesWorklistResponse)
def sales_worklist(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("sales", "manager", "head", "superadmin")),
):
    return get_sales_worklist(db=db, current_user=current_user)


@router.get("/manager-insights", response_model=ManagerInsightsResponse)
def manager_insights(
    account_category: str | None = Query(default=None),
    range: str = Query(default="7d"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("manager", "head", "superadmin")),
):
    return get_manager_insights(
        db=db,
        current_user=current_user,
        account_category=account_category,
        range_label=range,
    )


@router.get("/manager-insights/weekly-review", response_model=WeeklyReviewSummaryResponse)
def manager_weekly_review(
    account_category: str | None = Query(default=None),
    format: str = Query(default="json"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("manager", "head", "superadmin")),
):
    if format not in {"json", "csv"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Format weekly review tidak valid.",
        )
    insights = get_manager_insights(
        db=db,
        current_user=current_user,
        account_category=account_category,
        range_label="7d",
    )
    review = insights.weekly_review
    if review is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Weekly review belum tersedia.",
        )
    if format == "csv":
        csv_payload = build_weekly_review_csv(review)
        filename = f"clara-weekly-review-{review.review_end.isoformat()}.csv"
        return Response(
            content=csv_payload,
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    return review


@router.get(
    "/performance-actions",
    response_model=PerformanceActionListResponse,
)
def dashboard_performance_actions(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("sales", "manager", "head", "superadmin")),
):
    return list_performance_actions(db=db, current_user=current_user)


@router.post(
    "/performance-actions",
    response_model=PerformanceActionItem,
    status_code=status.HTTP_201_CREATED,
)
def dashboard_create_performance_action(
    payload: PerformanceActionCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("manager", "head", "superadmin")),
):
    return create_performance_action(
        db=db,
        payload=payload,
        current_user=current_user,
    )


@router.patch(
    "/performance-actions/{action_id}",
    response_model=PerformanceActionItem,
)
def dashboard_update_performance_action(
    action_id: UUID,
    payload: PerformanceActionUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("manager", "head", "superadmin")),
):
    return update_performance_action_status(
        db=db,
        action_id=action_id,
        payload=payload,
        current_user=current_user,
    )


@router.post(
    "/performance-snapshots/generate",
    response_model=PerformanceSnapshotGenerationResponse,
)
def dashboard_generate_performance_snapshots(
    weeks: int = Query(default=4, ge=2, le=8),
    organization_id: UUID | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("manager", "head", "superadmin")),
):
    target_organization_id = current_user.organization_id
    if normalize_role(current_user.role) == "superadmin":
        target_organization_id = organization_id

    if target_organization_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Organization scope is required.",
        )

    sales_user_ids = get_accessible_sales_user_ids(
        db=db,
        current_user=current_user,
    )
    team_ids = get_accessible_team_ids(
        db=db,
        current_user=current_user,
    )

    return ensure_weekly_performance_snapshots(
        db=db,
        organization_id=target_organization_id,
        sales_user_ids=sales_user_ids,
        team_ids=team_ids,
        weeks=weeks,
    )


@router.get(
    "/manager-insights/sales/{sales_user_id}",
    response_model=SalesPerformanceDetailResponse,
)
def manager_sales_performance_detail(
    sales_user_id: UUID,
    range: str = Query(default="7d"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("manager", "head", "superadmin")),
):
    try:
        return get_sales_performance_detail(
            db=db,
            sales_user_id=sales_user_id,
            current_user=current_user,
            range_label=range,
        )
    except PermissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.get(
    "/manager-insights/sales/{sales_user_id}/history",
    response_model=SalesPerformanceHistoryResponse,
)
def manager_sales_performance_history(
    sales_user_id: UUID,
    weeks: int = Query(default=4, ge=2, le=8),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("manager", "head", "superadmin")),
):
    try:
        return get_sales_performance_history(
            db=db,
            sales_user_id=sales_user_id,
            current_user=current_user,
            weeks=weeks,
        )
    except PermissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.get(
    "/manager-insights/teams/{team_id}/history",
    response_model=TeamPerformanceHistoryResponse,
)
def manager_team_performance_history(
    team_id: UUID,
    weeks: int = Query(default=4, ge=2, le=8),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("manager", "head", "superadmin")),
):
    try:
        return get_team_performance_history(
            db=db,
            team_id=team_id,
            current_user=current_user,
            weeks=weeks,
        )
    except PermissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.get("/sales/approval-queue", response_model=SalesApprovalQueueResponse)
def sales_approval_queue(
    risk_level: str | None = Query(default=None),
    action_mode: str | None = Query(default=None),
    age_bucket: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("sales", "manager", "head", "superadmin")),
):
    return get_sales_approval_queue(
        db=db,
        current_user=current_user,
        risk_level=risk_level,
        action_mode=action_mode,
        age_bucket=age_bucket,
    )


@router.get("/sales/chat-review-center", response_model=ChatReviewCenterResponse)
def sales_chat_review_center(
    review_bucket: str | None = Query(default=None),
    risk_level: str | None = Query(default=None),
    age_bucket: str | None = Query(default=None),
    source_channel: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("sales", "manager", "head", "superadmin")),
):
    return get_sales_chat_review_center(
        db=db,
        current_user=current_user,
        review_bucket=review_bucket,
        risk_level=risk_level,
        age_bucket=age_bucket,
        source_channel=source_channel,
    )


@router.get(
    "/sales/reviewer-candidates",
    response_model=list[ChatReviewerCandidateItem],
)
def sales_reviewer_candidates(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("manager", "head", "superadmin")),
):
    return list_chat_reviewer_candidates(db=db, current_user=current_user)


@router.get(
    "/sales/conversations/{conversation_id}/review-case-suggestion",
    response_model=ChatReviewCaseSuggestionResponse,
)
def get_chat_review_case_suggestion_endpoint(
    conversation_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("manager", "head", "superadmin")),
):
    try:
        conversation = get_reviewable_conversation_or_raise(
            db=db,
            conversation_id=conversation_id,
            current_user=current_user,
        )
    except ChatReviewError as error:
        detail = str(error)
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
                if "tidak ditemukan" in detail.lower()
                else status.HTTP_400_BAD_REQUEST
            ),
            detail=detail,
        ) from error

    return build_chat_review_case_suggestion(conversation)


@router.put(
    "/sales/conversations/{conversation_id}/review-case",
    response_model=ChatReviewCaseItem,
)
def upsert_chat_review_case_endpoint(
    conversation_id: UUID,
    payload: ChatReviewCaseUpsertRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("manager", "head", "superadmin")),
):
    try:
        conversation = get_reviewable_conversation_or_raise(
            db=db,
            conversation_id=conversation_id,
            current_user=current_user,
        )
        review_case = upsert_chat_review_case(
            db=db,
            conversation=conversation,
            payload=payload,
            current_user=current_user,
        )
    except ChatReviewError as error:
        detail = str(error)
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
                if "tidak ditemukan" in detail.lower()
                else status.HTTP_400_BAD_REQUEST
            ),
            detail=detail,
        ) from error

    create_audit_log(
        db=db,
        action="chat_review_case.upsert",
        resource_type="chat_review_case",
        resource_id=str(review_case.id),
        current_user=current_user,
        request=request,
        metadata={
            "conversation_id": str(conversation_id),
            "status": review_case.status,
            "review_label": review_case.review_label,
            "reviewer_user_id": (
                str(review_case.reviewer_user_id)
                if review_case.reviewer_user_id is not None
                else None
            ),
        },
    )
    return review_case


@router.post(
    "/sales/review-cases/{review_case_id}/notes",
    response_model=ChatReviewCaseItem,
)
def add_chat_review_note_endpoint(
    review_case_id: UUID,
    payload: ChatReviewNoteCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("manager", "head", "superadmin")),
):
    try:
        review_case = add_chat_review_note(
            db=db,
            review_case_id=review_case_id,
            payload=payload,
            current_user=current_user,
        )
    except ChatReviewError as error:
        detail = str(error)
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
                if "tidak ditemukan" in detail.lower()
                else status.HTTP_400_BAD_REQUEST
            ),
            detail=detail,
        ) from error

    create_audit_log(
        db=db,
        action="chat_review_case.note.create",
        resource_type="chat_review_case",
        resource_id=str(review_case.id),
        current_user=current_user,
        request=request,
        metadata={
            "note_count": len(review_case.notes),
            "status": review_case.status,
        },
    )
    return review_case


@router.get("/notifications", response_model=OpsNotificationResponse)
def list_ops_notifications_endpoint(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("sales", "manager", "head", "superadmin")),
):
    return list_ops_notifications(db=db, current_user=current_user)


@router.patch(
    "/notifications/{notification_id}/acknowledge",
    response_model=OpsNotificationItem,
)
def acknowledge_ops_notification_endpoint(
    notification_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("sales", "manager", "head", "superadmin")),
):
    try:
        notification = acknowledge_ops_notification(
            db=db,
            notification_id=notification_id,
            current_user=current_user,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error

    create_audit_log(
        db=db,
        action="ops_notification.acknowledge",
        resource_type="ops_notification",
        resource_id=str(notification.id),
        current_user=current_user,
        request=request,
        metadata={"status": notification.status, "source_type": notification.source_type},
    )
    return notification


@router.patch(
    "/notifications/{notification_id}/resolve",
    response_model=OpsNotificationItem,
)
def resolve_ops_notification_endpoint(
    notification_id: UUID,
    payload: OpsNotificationResolveRequest | None,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("sales", "manager", "head", "superadmin")),
):
    try:
        notification = resolve_ops_notification(
            db=db,
            notification_id=notification_id,
            payload=payload,
            current_user=current_user,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error

    create_audit_log(
        db=db,
        action="ops_notification.resolve",
        resource_type="ops_notification",
        resource_id=str(notification.id),
        current_user=current_user,
        request=request,
        metadata={"status": notification.status, "escalation_level": notification.escalation_level},
    )
    return notification


@router.patch(
    "/notifications/{notification_id}/ignore",
    response_model=OpsNotificationItem,
)
def ignore_ops_notification_endpoint(
    notification_id: UUID,
    payload: OpsNotificationResolveRequest | None,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("manager", "head", "superadmin")),
):
    try:
        notification = ignore_ops_notification(
            db=db,
            notification_id=notification_id,
            payload=payload,
            current_user=current_user,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error

    create_audit_log(
        db=db,
        action="ops_notification.ignore",
        resource_type="ops_notification",
        resource_id=str(notification.id),
        current_user=current_user,
        request=request,
        metadata={"status": notification.status, "source_type": notification.source_type},
    )
    return notification


@router.patch(
    "/notifications/{notification_id}/reopen",
    response_model=OpsNotificationItem,
)
def reopen_ops_notification_endpoint(
    notification_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("sales", "manager", "head", "superadmin")),
):
    try:
        notification = reopen_ops_notification(
            db=db,
            notification_id=notification_id,
            current_user=current_user,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error

    create_audit_log(
        db=db,
        action="ops_notification.reopen",
        resource_type="ops_notification",
        resource_id=str(notification.id),
        current_user=current_user,
        request=request,
        metadata={"status": notification.status},
    )
    return notification


@router.patch(
    "/notifications/{notification_id}/escalate",
    response_model=OpsNotificationItem,
)
def escalate_ops_notification_endpoint(
    notification_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("head", "superadmin")),
):
    try:
        notification = escalate_ops_notification(
            db=db,
            notification_id=notification_id,
            current_user=current_user,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error

    create_audit_log(
        db=db,
        action="ops_notification.escalate",
        resource_type="ops_notification",
        resource_id=str(notification.id),
        current_user=current_user,
        request=request,
        metadata={"escalation_level": notification.escalation_level},
    )
    return notification


@router.get(
    "/sales/conversations/{conversation_id}",
    response_model=SalesConversationDetail,
)
def sales_conversation_detail(
    conversation_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("sales", "manager", "head", "superadmin")),
):
    detail = get_sales_conversation_detail(
        db=db,
        conversation_id=conversation_id,
        current_user=current_user,
    )

    if detail is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found.",
        )

    return detail


@router.get("/marketing/insights-preview", response_model=MarketingInsightsPreview)
def marketing_insights_preview(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("head", "superadmin")),
):
    return get_marketing_insights_preview(db=db, current_user=current_user)


@router.get("/marketing/execution-items", response_model=list[MarketingExecutionItem])
def list_marketing_execution_items_endpoint(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("head", "superadmin")),
):
    return list_marketing_execution_items(db=db, current_user=current_user)


@router.post(
    "/marketing/execution-items",
    response_model=MarketingExecutionItem,
    status_code=status.HTTP_201_CREATED,
)
def create_marketing_execution_item_endpoint(
    payload: MarketingExecutionItemCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("head", "superadmin")),
):
    try:
        item = create_marketing_execution_item(
            db=db,
            payload=payload,
            current_user=current_user,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        ) from error

    create_audit_log(
        db=db,
        action="marketing_execution_item.create",
        resource_type="marketing_execution_item",
        resource_id=str(item.id),
        current_user=current_user,
        request=request,
        metadata={"item_type": item.item_type, "status": item.status},
    )
    return item


@router.patch(
    "/marketing/execution-items/{item_id}",
    response_model=MarketingExecutionItem,
)
def update_marketing_execution_item_endpoint(
    item_id: UUID,
    payload: MarketingExecutionItemUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("head", "superadmin")),
):
    try:
        item = update_marketing_execution_item(
            db=db,
            item_id=item_id,
            payload=payload,
            current_user=current_user,
        )
    except ValueError as error:
        detail = str(error)
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
                if "not found" in detail.lower()
                else status.HTTP_400_BAD_REQUEST
            ),
            detail=detail,
        ) from error

    create_audit_log(
        db=db,
        action="marketing_execution_item.update",
        resource_type="marketing_execution_item",
        resource_id=str(item.id),
        current_user=current_user,
        request=request,
        metadata={"item_type": item.item_type, "status": item.status},
    )
    return item


@router.get("/kpi/command-center", response_model=KpiCommandCenterResponse)
def kpi_command_center(
    source_channel: str | None = Query(default=None),
    account_category: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("head", "superadmin")),
):
    return get_kpi_command_center(
        db=db,
        current_user=current_user,
        source_channel=source_channel,
        account_category=account_category,
    )


@router.post("/kpi/command-center/refresh", response_model=KpiCommandCenterResponse)
def refresh_kpi_command_center_endpoint(
    request: Request,
    source_channel: str | None = Query(default=None),
    account_category: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("head", "superadmin")),
):
    response = refresh_kpi_command_center(
        db=db,
        current_user=current_user,
        source_channel=source_channel,
        account_category=account_category,
    )
    create_audit_log(
        db=db,
        action="kpi_command_center.refresh",
        resource_type="kpi_command_center",
        resource_id=None,
        current_user=current_user,
        request=request,
        metadata={"scope_type": response.scope_type},
    )
    return response


@router.get("/kpi/alerts", response_model=KpiAlertHistoryResponse)
def list_kpi_alerts_endpoint(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("head", "superadmin")),
):
    return list_kpi_alert_records(db=db, current_user=current_user)


@router.patch("/kpi/alerts/{alert_id}/acknowledge", response_model=PersistedKpiAlertRecord)
def acknowledge_kpi_alert_endpoint(
    alert_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("head", "superadmin")),
):
    try:
        alert = acknowledge_kpi_alert(
            db=db,
            alert_id=alert_id,
            current_user=current_user,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error

    create_audit_log(
        db=db,
        action="kpi_alert.acknowledge",
        resource_type="kpi_alert",
        resource_id=str(alert.id),
        current_user=current_user,
        request=request,
        metadata={"scope_type": alert.scope_type, "severity": alert.severity},
    )
    return alert


@router.patch("/kpi/alerts/{alert_id}/resolve", response_model=PersistedKpiAlertRecord)
def resolve_kpi_alert_endpoint(
    alert_id: UUID,
    request: Request,
    payload: KpiAlertResolveRequest | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("head", "superadmin")),
):
    try:
        alert = resolve_kpi_alert(
            db=db,
            alert_id=alert_id,
            payload=payload,
            current_user=current_user,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error

    create_audit_log(
        db=db,
        action="kpi_alert.resolve",
        resource_type="kpi_alert",
        resource_id=str(alert.id),
        current_user=current_user,
        request=request,
        metadata={
            "scope_type": alert.scope_type,
            "severity": alert.severity,
            "has_resolution_note": bool(alert.resolution_note),
        },
    )
    return alert


@router.patch("/kpi/alerts/{alert_id}/reopen", response_model=PersistedKpiAlertRecord)
def reopen_kpi_alert_endpoint(
    alert_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("head", "superadmin")),
):
    try:
        alert = reopen_kpi_alert(
            db=db,
            alert_id=alert_id,
            current_user=current_user,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error

    create_audit_log(
        db=db,
        action="kpi_alert.reopen",
        resource_type="kpi_alert",
        resource_id=str(alert.id),
        current_user=current_user,
        request=request,
        metadata={"scope_type": alert.scope_type, "severity": alert.severity},
    )
    return alert


@router.get("/kpi/snapshots", response_model=KpiSnapshotHistoryResponse)
def list_kpi_snapshots_endpoint(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("head", "superadmin")),
):
    return list_kpi_snapshots(db=db, current_user=current_user)


@router.post(
    "/marketing/insight-snapshots/generate",
    response_model=MarketingInsightSnapshotResponse,
    status_code=status.HTTP_201_CREATED,
)
def generate_marketing_snapshot_endpoint(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("head", "superadmin")),
):
    snapshot = generate_marketing_snapshot(db=db, current_user=current_user)
    create_audit_log(
        db=db,
        action="marketing_insight_snapshot.generate",
        resource_type="marketing_insight_snapshot",
        resource_id=str(snapshot.id),
        current_user=current_user,
        request=request,
        metadata={
            "scope_type": snapshot.scope_type,
            "period_start": str(snapshot.period_start),
            "period_end": str(snapshot.period_end),
        },
    )
    return snapshot


@router.get(
    "/marketing/insight-snapshots",
    response_model=list[MarketingInsightSnapshotResponse],
)
def list_marketing_snapshots_endpoint(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("head", "superadmin")),
):
    return list_marketing_snapshots(db=db, current_user=current_user)


@router.get("/admin/ops-overview", response_model=OpsDatabaseOverviewResponse)
def admin_ops_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("superadmin")),
):
    return get_ops_database_overview(db=db, current_user=current_user)


@router.get("/extension-builds")
def list_extension_builds(
    current_user: User = Depends(require_roles("sales", "manager", "head", "superadmin")),
):
    return build_extension_build_item(current_user)


@router.post("/extension-builds")
async def upload_extension_build(
    request: Request,
    version: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("superadmin")),
):
    normalized_version = version.strip()
    if len(normalized_version) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Versi extension wajib diisi.",
        )

    raw_file_name = Path(file.filename or "").name
    suffix = Path(raw_file_name).suffix.lower()
    if suffix not in EXTENSION_BUILD_SUFFIXES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File extension harus berekstensi .zip atau .crx.",
        )

    content = await file.read()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File extension tidak boleh kosong.",
        )

    if len(content) > EXTENSION_BUILD_MAX_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Ukuran file extension terlalu besar. Maksimum 50MB.",
        )

    safe_version = EXTENSION_FILENAME_SANITIZER.sub("-", normalized_version).strip("-") or "build"
    extension_dir = get_extension_distribution_dir()
    extension_dir.mkdir(parents=True, exist_ok=True)
    stored_file_name = f"clara-extension-{safe_version}{suffix}"
    file_path = extension_dir / stored_file_name
    file_path.write_bytes(content)

    manifest = read_extension_manifest()
    uploaded_at = datetime.now(timezone.utc).isoformat()
    manifest[GLOBAL_EXTENSION_BUILD_KEY] = {
        "role": "all",
        "version": normalized_version,
        "file_name": raw_file_name or stored_file_name,
        "stored_file_name": stored_file_name,
        "content_type": file.content_type or "application/octet-stream",
        "size_bytes": len(content),
        "uploaded_at": uploaded_at,
        "uploaded_by_email": current_user.email,
    }
    write_extension_manifest(manifest)

    create_audit_log(
        db=db,
        action="extension_build.upload",
        resource_type="extension_build",
        resource_id=GLOBAL_EXTENSION_BUILD_KEY,
        current_user=current_user,
        request=request,
        metadata={
            "role": "all",
            "version": normalized_version,
            "file_name": raw_file_name or stored_file_name,
            "size_bytes": len(content),
        },
    )

    return manifest[GLOBAL_EXTENSION_BUILD_KEY]


@router.get("/extension-builds/download")
def download_extension_build(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("sales", "manager", "head", "superadmin")),
):
    metadata = get_extension_build_or_raise()
    file_path = get_extension_distribution_dir() / str(metadata.get("stored_file_name") or "")

    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File package extension tidak ditemukan di storage.",
        )

    create_audit_log(
        db=db,
        action="extension_build.download",
        resource_type="extension_build",
        resource_id=GLOBAL_EXTENSION_BUILD_KEY,
        current_user=current_user,
        request=request,
        metadata={
            "role": "all",
            "version": metadata.get("version"),
            "file_name": metadata.get("file_name"),
        },
    )

    return FileResponse(
        file_path,
        filename=str(metadata.get("file_name") or file_path.name),
        media_type=str(metadata.get("content_type") or "application/octet-stream"),
    )
