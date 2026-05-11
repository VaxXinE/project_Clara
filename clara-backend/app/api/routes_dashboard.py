from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.security import require_roles
from app.models.user import User
from app.db.session import get_db
from app.schemas.dashboard_schema import (
    MarketingInsightSnapshotResponse,
    MarketingInsightsPreview,
    OpsDatabaseOverviewResponse,
    SalesConversationDetail,
    SalesInboxItem,
)
from app.services.audit_service import create_audit_log
from app.services.dashboard_service import (
    get_marketing_insights_preview,
    get_ops_database_overview,
    get_sales_conversation_detail,
    get_sales_inbox,
)
from app.services.marketing_snapshot_service import (
    generate_marketing_snapshot,
    list_marketing_snapshots,
)
from fastapi import Request

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/sales/inbox", response_model=list[SalesInboxItem])
def sales_inbox(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("marketing", "admin")),
):
    return get_sales_inbox(db=db, current_user=current_user)


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
