from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.dashboard_schema import (
    MarketingInsightsPreview,
    SalesConversationDetail,
    SalesInboxItem,
)
from app.services.dashboard_service import (
    get_marketing_insights_preview,
    get_sales_conversation_detail,
    get_sales_inbox,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/sales/inbox", response_model=list[SalesInboxItem])
def sales_inbox(
    db: Session = Depends(get_db),
):
    return get_sales_inbox(db=db)


@router.get(
    "/sales/conversations/{conversation_id}",
    response_model=SalesConversationDetail,
)
def sales_conversation_detail(
    conversation_id: UUID,
    db: Session = Depends(get_db),
):
    detail = get_sales_conversation_detail(
        db=db,
        conversation_id=conversation_id,
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
):
    return get_marketing_insights_preview(db=db)