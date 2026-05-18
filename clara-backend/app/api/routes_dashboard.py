from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.core.security import require_roles
from app.models.user import User
from app.db.session import get_db
from app.schemas.dashboard_schema import (
    KpiAlertHistoryResponse,
    KpiAlertResolveRequest,
    KpiCommandCenterResponse,
    KpiSnapshotHistoryResponse,
    MarketingExecutionItem,
    MarketingExecutionItemCreateRequest,
    MarketingExecutionItemUpdateRequest,
    MarketingInsightSnapshotResponse,
    MarketingInsightsPreview,
    OpsDatabaseOverviewResponse,
    OpsNotificationItem,
    OpsNotificationResponse,
    PersistedKpiAlertRecord,
    SalesApprovalQueueResponse,
    SalesConversationDetail,
    SalesInboxItem,
    SalesWorklistResponse,
)
from app.services.audit_service import create_audit_log
from app.services.dashboard_service import (
    acknowledge_ops_notification,
    acknowledge_kpi_alert,
    create_marketing_execution_item,
    get_kpi_command_center,
    get_marketing_insights_preview,
    get_ops_database_overview,
    list_ops_notifications,
    get_sales_approval_queue,
    get_sales_conversation_detail,
    get_sales_inbox,
    get_sales_worklist,
    list_kpi_alert_records,
    list_kpi_snapshots,
    list_marketing_execution_items,
    refresh_kpi_command_center,
    reopen_kpi_alert,
    resolve_kpi_alert,
    update_marketing_execution_item,
)
from app.services.marketing_snapshot_service import (
    generate_marketing_snapshot,
    list_marketing_snapshots,
)
from fastapi import Request

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/sales/inbox", response_model=list[SalesInboxItem])
def sales_inbox(
    source_channel: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("marketing", "admin")),
):
    return get_sales_inbox(
        db=db,
        current_user=current_user,
        source_channel=source_channel,
    )


@router.get("/sales/worklist", response_model=SalesWorklistResponse)
def sales_worklist(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("marketing", "admin")),
):
    return get_sales_worklist(db=db, current_user=current_user)


@router.get("/sales/approval-queue", response_model=SalesApprovalQueueResponse)
def sales_approval_queue(
    risk_level: str | None = Query(default=None),
    action_mode: str | None = Query(default=None),
    age_bucket: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("marketing", "admin")),
):
    return get_sales_approval_queue(
        db=db,
        current_user=current_user,
        risk_level=risk_level,
        action_mode=action_mode,
        age_bucket=age_bucket,
    )


@router.get("/notifications", response_model=OpsNotificationResponse)
def list_ops_notifications_endpoint(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("marketing", "admin")),
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
    current_user: User = Depends(require_roles("marketing", "admin")),
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


@router.get(
    "/sales/conversations/{conversation_id}",
    response_model=SalesConversationDetail,
)
def sales_conversation_detail(
    conversation_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("marketing", "admin")),
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
    current_user: User = Depends(require_roles("admin")),
):
    return get_marketing_insights_preview(db=db, current_user=current_user)


@router.get("/marketing/execution-items", response_model=list[MarketingExecutionItem])
def list_marketing_execution_items_endpoint(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
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
    current_user: User = Depends(require_roles("admin")),
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
    current_user: User = Depends(require_roles("admin")),
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
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    return get_kpi_command_center(
        db=db,
        current_user=current_user,
        source_channel=source_channel,
    )


@router.post("/kpi/command-center/refresh", response_model=KpiCommandCenterResponse)
def refresh_kpi_command_center_endpoint(
    request: Request,
    source_channel: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    response = refresh_kpi_command_center(
        db=db,
        current_user=current_user,
        source_channel=source_channel,
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
    current_user: User = Depends(require_roles("admin")),
):
    return list_kpi_alert_records(db=db, current_user=current_user)


@router.patch("/kpi/alerts/{alert_id}/acknowledge", response_model=PersistedKpiAlertRecord)
def acknowledge_kpi_alert_endpoint(
    alert_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
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
    current_user: User = Depends(require_roles("admin")),
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
    current_user: User = Depends(require_roles("admin")),
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
    current_user: User = Depends(require_roles("admin")),
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
    current_user: User = Depends(require_roles("admin")),
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
    current_user: User = Depends(require_roles("admin")),
):
    return list_marketing_snapshots(db=db, current_user=current_user)


@router.get("/admin/ops-overview", response_model=OpsDatabaseOverviewResponse)
def admin_ops_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    return get_ops_database_overview(db=db, current_user=current_user)
