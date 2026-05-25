from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.db.session import get_db
from app.models.user import User
from app.schemas.lead_schema import (
    LeadDealItem,
    LeadDealUpsertRequest,
    LeadActivityEventItem,
    LeadDetail,
    LeadDisciplineLogCreateRequest,
    LeadDisciplineLogItem,
    LeadDisciplineSuggestionResponse,
    LeadDisciplineLogUpdateRequest,
    LeadListItem,
    LeadQueueActionRequest,
    LeadTaskCreateRequest,
    LeadTaskEventItem,
    LeadTaskItem,
    LeadTaskUpdateRequest,
    LeadUpdateRequest,
)
from app.services.lead_service import (
    get_lead_model_for_user,
    get_lead_deal_for_user,
    get_lead_for_user,
    get_leads_for_user,
    get_lead_timeline_for_user,
    upsert_lead_deal_for_user,
    update_lead_for_user,
)
from app.services.lead_discipline_service import (
    build_discipline_log_suggestion,
    create_discipline_log,
    list_lead_discipline_logs_for_user,
    update_discipline_log,
)
from app.services.lead_task_service import (
    create_lead_task_for_user,
    execute_queue_action_for_user,
    get_lead_task_events_for_user,
    get_lead_tasks_for_user,
    update_lead_task_for_user,
)

router = APIRouter(prefix="/leads", tags=["leads"])


@router.get("", response_model=list[LeadListItem])
def list_leads(
    source_channel: str | None = Query(default=None),
    account_category: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("sales", "manager", "head", "superadmin")),
) -> list[LeadListItem]:
    return get_leads_for_user(
        db=db,
        current_user=current_user,
        source_channel=source_channel,
        account_category=account_category,
    )


@router.get("/{lead_id}", response_model=LeadDetail)
def get_lead(
    lead_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("sales", "manager", "head", "superadmin")),
) -> LeadDetail:
    return get_lead_for_user(db=db, lead_id=lead_id, current_user=current_user)


@router.patch("/{lead_id}", response_model=LeadDetail)
def update_lead(
    lead_id: UUID,
    payload: LeadUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("sales", "manager", "head", "superadmin")),
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
    current_user: User = Depends(require_roles("sales", "manager", "head", "superadmin")),
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
    current_user: User = Depends(require_roles("sales", "manager", "head", "superadmin")),
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
    current_user: User = Depends(require_roles("sales", "manager", "head", "superadmin")),
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
    current_user: User = Depends(require_roles("sales", "manager", "head", "superadmin")),
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
    current_user: User = Depends(require_roles("sales", "manager", "head", "superadmin")),
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
    current_user: User = Depends(require_roles("sales", "manager", "head", "superadmin")),
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
    current_user: User = Depends(require_roles("sales", "manager", "head", "superadmin")),
) -> list[LeadTaskEventItem]:
    return get_lead_task_events_for_user(
        db=db,
        lead_id=lead_id,
        task_id=task_id,
        current_user=current_user,
    )


@router.post("/{lead_id}/queue-action", response_model=LeadTaskItem)
def execute_queue_action(
    lead_id: UUID,
    payload: LeadQueueActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("sales", "manager", "head", "superadmin")),
) -> LeadTaskItem:
    return execute_queue_action_for_user(
        db=db,
        lead_id=lead_id,
        payload=payload,
        current_user=current_user,
    )


@router.get("/{lead_id}/discipline-logs", response_model=list[LeadDisciplineLogItem])
def list_discipline_logs(
    lead_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("sales", "manager", "head", "superadmin")),
) -> list[LeadDisciplineLogItem]:
    lead = get_lead_model_for_user(db=db, lead_id=lead_id, current_user=current_user)
    return list_lead_discipline_logs_for_user(db=db, lead=lead)


@router.get("/{lead_id}/discipline-log-suggestion", response_model=LeadDisciplineSuggestionResponse)
def get_discipline_log_suggestion(
    lead_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("sales", "manager", "head", "superadmin")),
) -> LeadDisciplineSuggestionResponse:
    lead = get_lead_model_for_user(db=db, lead_id=lead_id, current_user=current_user)
    return build_discipline_log_suggestion(lead)


@router.post("/{lead_id}/discipline-logs", response_model=LeadDisciplineLogItem, status_code=201)
def create_discipline_log_endpoint(
    lead_id: UUID,
    payload: LeadDisciplineLogCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("sales", "manager", "head", "superadmin")),
) -> LeadDisciplineLogItem:
    lead = get_lead_model_for_user(db=db, lead_id=lead_id, current_user=current_user)
    return create_discipline_log(
        db=db,
        lead=lead,
        payload=payload,
        current_user=current_user,
    )


@router.patch("/{lead_id}/discipline-logs/{log_id}", response_model=LeadDisciplineLogItem)
def update_discipline_log_endpoint(
    lead_id: UUID,
    log_id: UUID,
    payload: LeadDisciplineLogUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("sales", "manager", "head", "superadmin")),
) -> LeadDisciplineLogItem:
    lead = get_lead_model_for_user(db=db, lead_id=lead_id, current_user=current_user)
    return update_discipline_log(
        db=db,
        lead=lead,
        log_id=log_id,
        payload=payload,
        current_user=current_user,
    )
