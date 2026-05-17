from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.db.session import get_db
from app.models.user import User
from app.schemas.lead_schema import (
    LeadDealItem,
    LeadDealUpsertRequest,
    LeadActivityEventItem,
    LeadDetail,
    LeadListItem,
    LeadTaskCreateRequest,
    LeadTaskEventItem,
    LeadTaskItem,
    LeadTaskUpdateRequest,
    LeadUpdateRequest,
)
from app.services.lead_service import (
    get_lead_deal_for_user,
    get_lead_for_user,
    get_leads_for_user,
    get_lead_timeline_for_user,
    upsert_lead_deal_for_user,
    update_lead_for_user,
)
from app.services.lead_task_service import (
    create_lead_task_for_user,
    get_lead_task_events_for_user,
    get_lead_tasks_for_user,
    update_lead_task_for_user,
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


@router.get("/{lead_id}/timeline", response_model=list[LeadActivityEventItem])
def get_lead_timeline(
    lead_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("marketing", "admin")),
) -> list[LeadActivityEventItem]:
    return get_lead_timeline_for_user(
        db=db,
        lead_id=lead_id,
        current_user=current_user,
    )


@router.get("/{lead_id}/deal", response_model=LeadDealItem | None)
def get_lead_deal(
    lead_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("marketing", "admin")),
) -> LeadDealItem | None:
    return get_lead_deal_for_user(
        db=db,
        lead_id=lead_id,
        current_user=current_user,
    )


@router.put("/{lead_id}/deal", response_model=LeadDealItem)
def upsert_lead_deal(
    lead_id: UUID,
    payload: LeadDealUpsertRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("marketing", "admin")),
) -> LeadDealItem:
    return upsert_lead_deal_for_user(
        db=db,
        lead_id=lead_id,
        payload=payload,
        current_user=current_user,
    )


@router.get("/{lead_id}/tasks", response_model=list[LeadTaskItem])
def list_lead_tasks(
    lead_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("marketing", "admin")),
) -> list[LeadTaskItem]:
    return get_lead_tasks_for_user(
        db=db,
        lead_id=lead_id,
        current_user=current_user,
    )


@router.post("/{lead_id}/tasks", response_model=LeadTaskItem, status_code=201)
def create_lead_task(
    lead_id: UUID,
    payload: LeadTaskCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("marketing", "admin")),
) -> LeadTaskItem:
    return create_lead_task_for_user(
        db=db,
        lead_id=lead_id,
        payload=payload,
        current_user=current_user,
    )


@router.patch("/{lead_id}/tasks/{task_id}", response_model=LeadTaskItem)
def update_lead_task(
    lead_id: UUID,
    task_id: UUID,
    payload: LeadTaskUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("marketing", "admin")),
) -> LeadTaskItem:
    return update_lead_task_for_user(
        db=db,
        lead_id=lead_id,
        task_id=task_id,
        payload=payload,
        current_user=current_user,
    )


@router.get("/{lead_id}/tasks/{task_id}/events", response_model=list[LeadTaskEventItem])
def list_lead_task_events(
    lead_id: UUID,
    task_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("marketing", "admin")),
) -> list[LeadTaskEventItem]:
    return get_lead_task_events_for_user(
        db=db,
        lead_id=lead_id,
        task_id=task_id,
        current_user=current_user,
    )
