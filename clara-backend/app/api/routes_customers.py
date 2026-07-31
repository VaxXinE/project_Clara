from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.db.session import get_db
from app.models.user import User
from app.models.customer_process_state import CustomerProcessState
from app.models.customer_process_state_event import CustomerProcessStateEvent
from app.models.customer_profile import CustomerProfile
from app.schemas.lead_schema import (
    CustomerProfileMergeRequest,
    CustomerProfileListItem,
    CustomerProfileSummaryItem,
    CustomerProfileUpdateRequest,
)
from app.services.audit_service import create_audit_log
from app.services.customer_profile_service import (
    get_customer_profile_for_user,
    get_customer_profile_model_for_user,
    list_customer_profiles_for_user,
    merge_customer_profiles,
    update_customer_profile_for_user,
)
from app.schemas.process_state_schema import (
    CustomerProcessStateItem,
    ProcessStateEventItem,
    ProcessStateTransitionRequest,
    ProcessStateTransitionResponse,
    ReconciliationRequiredItem,
)
from app.services.clara_process_state_service import (
    TransitionDecision,
    apply_manual_process_state_transition,
    get_or_create_process_state,
    get_process_state_history,
    has_unresolved_merge_reconciliation,
    parse_process_state,
)

router = APIRouter(prefix="/customers", tags=["customers"])


def _build_process_state_item(
    state: CustomerProcessState,
    *,
    reconciliation_required: bool = False,
) -> CustomerProcessStateItem:
    return CustomerProcessStateItem(
        customer_profile_id=state.customer_profile_id,
        current_state=state.current_state,
        state_rank=state.state_rank,
        confidence_score=state.confidence_score,
        source_type=state.source_type,
        source_trust_level=state.source_trust_level,
        version=state.version,
        manual_lock=state.manual_lock,
        last_confirmed_at=state.last_confirmed_at,
        last_transition_at=state.last_transition_at,
        reconciliation_required=reconciliation_required,
    )


@router.get("", response_model=list[CustomerProfileListItem])
def list_customer_profiles(
    q: str | None = Query(default=None),
    status_value: str | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("sales", "manager", "head", "superadmin")),
) -> list[CustomerProfileListItem]:
    return [
        CustomerProfileListItem(**item)
        for item in list_customer_profiles_for_user(
            db=db,
            current_user=current_user,
            query=q,
            status_value=status_value,
        )
    ]


@router.get(
    "/process-state/reconciliation-required",
    response_model=list[ReconciliationRequiredItem],
)
def list_process_state_reconciliation_required(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("manager", "head", "superadmin")),
) -> list[ReconciliationRequiredItem]:
    statement = (
        select(CustomerProcessStateEvent, CustomerProfile)
        .join(CustomerProfile, CustomerProfile.id == CustomerProcessStateEvent.customer_profile_id)
        .where(
            CustomerProcessStateEvent.decision
            == TransitionDecision.MERGE_RECONCILIATION_REQUIRED.value,
            CustomerProfile.merged_into_profile_id.is_(None),
        )
        .order_by(CustomerProcessStateEvent.created_at.desc())
    )
    if current_user.organization_id is not None:
        statement = statement.where(
            CustomerProcessStateEvent.organization_id == current_user.organization_id
        )
    items: list[ReconciliationRequiredItem] = []
    seen_profiles: set[UUID] = set()
    for event, profile in db.execute(statement).all():
        if profile.id in seen_profiles:
            continue
        seen_profiles.add(profile.id)
        if not has_unresolved_merge_reconciliation(db, profile.id):
            continue
        items.append(ReconciliationRequiredItem(
            customer_profile_id=profile.id,
            customer_display_name=profile.display_name,
            current_state=event.applied_state,
            event_id=event.id,
            reason_codes=event.reason_codes,
            created_at=event.created_at,
        ))
    return items


@router.get("/{customer_profile_id}", response_model=CustomerProfileSummaryItem)
def get_customer_profile(
    customer_profile_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("sales", "manager", "head", "superadmin")),
) -> CustomerProfileSummaryItem:
    return CustomerProfileSummaryItem(
        **get_customer_profile_for_user(
            db=db,
            customer_profile_id=customer_profile_id,
            current_user=current_user,
        )
    )


@router.get(
    "/{customer_profile_id}/process-state",
    response_model=CustomerProcessStateItem,
)
def get_customer_process_state(
    customer_profile_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("sales", "manager", "head", "superadmin")),
) -> CustomerProcessStateItem:
    profile = get_customer_profile_model_for_user(
        db=db,
        customer_profile_id=customer_profile_id,
        current_user=current_user,
    )
    state = get_or_create_process_state(db, profile)
    reconciliation_required = has_unresolved_merge_reconciliation(db, profile.id)
    db.commit()
    return _build_process_state_item(
        state,
        reconciliation_required=reconciliation_required,
    )


@router.get(
    "/{customer_profile_id}/process-state/history",
    response_model=list[ProcessStateEventItem],
)
def get_customer_process_state_history(
    customer_profile_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("sales", "manager", "head", "superadmin")),
) -> list[ProcessStateEventItem]:
    get_customer_profile_model_for_user(
        db=db,
        customer_profile_id=customer_profile_id,
        current_user=current_user,
    )
    return [
        ProcessStateEventItem.model_validate(event, from_attributes=True)
        for event in get_process_state_history(db, customer_profile_id)
    ]


@router.post(
    "/{customer_profile_id}/process-state/transitions",
    response_model=ProcessStateTransitionResponse,
)
def transition_customer_process_state(
    customer_profile_id: UUID,
    payload: ProcessStateTransitionRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("sales", "manager", "head", "superadmin")),
) -> ProcessStateTransitionResponse:
    profile = get_customer_profile_model_for_user(
        db=db,
        customer_profile_id=customer_profile_id,
        current_user=current_user,
    )
    try:
        decision = apply_manual_process_state_transition(
            db,
            profile=profile,
            proposed_state=parse_process_state(payload.proposed_state),
            expected_version=payload.expected_version,
            reason_code=payload.reason_code,
            actor=current_user,
        )
    except PermissionError as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    db.commit()
    state = get_or_create_process_state(db, profile)
    create_audit_log(
        db=db,
        action="customer_process_state.transition",
        resource_type="customer_process_state",
        resource_id=str(state.id),
        current_user=current_user,
        request=request,
        metadata={
            "previous_state": decision.previous_state.value,
            "applied_state": decision.applied_state.value,
            "decision": decision.decision.value,
            "state_version": decision.state_version,
            "reason_code": payload.reason_code,
        },
    )
    return ProcessStateTransitionResponse(
        current=_build_process_state_item(state),
        decision=decision.decision.value,
        reason_codes=list(decision.reason_codes),
        decision_hash=decision.decision_hash,
    )


@router.patch("/{customer_profile_id}", response_model=CustomerProfileSummaryItem)
def update_customer_profile(
    customer_profile_id: UUID,
    payload: CustomerProfileUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("sales", "manager", "head", "superadmin")),
) -> CustomerProfileSummaryItem:
    profile = update_customer_profile_for_user(
        db=db,
        customer_profile_id=customer_profile_id,
        display_name=payload.display_name,
        phone=payload.phone,
        email=payload.email,
        address=payload.address,
        status_value=payload.status,
        account_category=payload.account_category,
        temperature=payload.temperature,
        current_user=current_user,
    )
    create_audit_log(
        db=db,
        action="customer_profile.update",
        resource_type="customer_profile",
        resource_id=str(customer_profile_id),
        current_user=current_user,
        request=request,
        metadata={
            "status": payload.status,
            "account_category": payload.account_category,
            "temperature": payload.temperature,
            "has_phone": bool(payload.phone),
            "has_email": bool(payload.email),
            "has_address": bool(payload.address),
        },
    )
    return CustomerProfileSummaryItem(**profile)


@router.post("/merge", response_model=CustomerProfileSummaryItem)
def merge_customer_profile_endpoint(
    payload: CustomerProfileMergeRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("head", "superadmin")),
) -> CustomerProfileSummaryItem:
    try:
        profile = merge_customer_profiles(
            db=db,
            source_profile_id=payload.source_profile_id,
            target_profile_id=payload.target_profile_id,
            merge_notes=payload.merge_notes,
            current_user=current_user,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        ) from error

    create_audit_log(
        db=db,
        action="customer_profile.merge",
        resource_type="customer_profile",
        resource_id=str(payload.target_profile_id),
        current_user=current_user,
        request=request,
        metadata={
            "source_profile_id": str(payload.source_profile_id),
            "target_profile_id": str(payload.target_profile_id),
            "has_merge_notes": bool(payload.merge_notes),
        },
    )
    return CustomerProfileSummaryItem(**profile)
