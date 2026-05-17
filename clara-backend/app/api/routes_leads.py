from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.db.session import get_db
from app.models.user import User
from app.schemas.lead_schema import LeadDetail, LeadListItem, LeadUpdateRequest
from app.services.lead_service import (
    get_lead_for_user,
    get_leads_for_user,
    update_lead_for_user,
)

router = APIRouter(prefix="/leads", tags=["leads"])


@router.get("", response_model=list[LeadListItem])
def list_leads(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("marketing", "admin")),
) -> list[LeadListItem]:
    return get_leads_for_user(db=db, current_user=current_user)


@router.get("/{lead_id}", response_model=LeadDetail)
def get_lead(
    lead_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("marketing", "admin")),
) -> LeadDetail:
    return get_lead_for_user(db=db, lead_id=lead_id, current_user=current_user)


@router.patch("/{lead_id}", response_model=LeadDetail)
def update_lead(
    lead_id: UUID,
    payload: LeadUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("marketing", "admin")),
) -> LeadDetail:
    return update_lead_for_user(
        db=db,
        lead_id=lead_id,
        payload=payload,
        current_user=current_user,
    )
