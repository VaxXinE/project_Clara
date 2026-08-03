from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import require_roles
from app.db.session import get_db
from app.models.clara_rollout import ClaraRolloutIncident
from app.models.user import User
from app.schemas.clara_rollout_schema import (
    IncidentResolutionRequest,
    PromoteRequest,
    QualityLabelRequest,
    RolloutPlanCreateRequest,
    VersionedRequest,
)
from app.services.clara_rollout_service import (
    CLARA_ROLLOUT_CONTRACT_VERSION,
    METRIC_DEFINITIONS,
    ClaraRolloutError,
    RolloutStage,
    acknowledge_incident,
    activate_internal,
    calculate_metrics,
    create_plan,
    get_plan,
    list_plans,
    normalize_rollout_control_mode,
    pause_plan,
    promote_stage,
    record_quality_label,
    resolve_incident,
    resolve_rollout_decision,
    resume_plan,
    rollback_plan,
    stop_plan,
    validate_readiness,
)


router = APIRouter(prefix="/clara-rollouts", tags=["clara-rollouts"])


def _error(exc: ClaraRolloutError):
    return HTTPException(status_code=409, detail=str(exc))


def _serialize(plan):
    return {
        "id": plan.id,
        "organization_id": plan.organization_id,
        "name": plan.name,
        "variant": plan.variant,
        "status": plan.status,
        "current_stage": plan.current_stage,
        "candidate_bundle_id": plan.candidate_bundle_id,
        "candidate_bundle_hash": plan.candidate_bundle_hash,
        "certification_run_id": plan.certification_run_id,
        "certification_report_hash": plan.certification_report_hash,
        "baseline_profile": plan.baseline_profile,
        "candidate_profile": plan.candidate_profile,
        "cohort_percentage": plan.cohort_percentage,
        "shadow_sample_percentage": plan.shadow_sample_percentage,
        "daily_shadow_limit": plan.daily_shadow_limit,
        "promotion_thresholds": plan.promotion_thresholds,
        "required_sample_size": plan.required_sample_size,
        "observation_count": len(plan.observations),
        "open_critical_incident_count": sum(item.severity == "CRITICAL" and item.status != "RESOLVED" for item in plan.incidents),
        "version": plan.version,
        "created_at": plan.created_at,
        "activated_at": plan.activated_at,
        "paused_at": plan.paused_at,
        "completed_at": plan.completed_at,
        "rollout_contract_version": CLARA_ROLLOUT_CONTRACT_VERSION,
        "control_mode": normalize_rollout_control_mode(settings.clara_rollout_control_mode).value,
        "manual_send_required": True,
    }


def _organization_id(user: User):
    if user.organization_id is None:
        raise HTTPException(status_code=409, detail="Organization scope is required.")
    return user.organization_id


@router.get("")
def plans(db: Session = Depends(get_db), current_user: User = Depends(require_roles("head", "superadmin"))):
    return [_serialize(item) for item in list_plans(db, _organization_id(current_user))]


@router.get("/cohort/current")
def current_cohort(db: Session = Depends(get_db), current_user: User = Depends(require_roles("sales", "manager", "head", "superadmin"))):
    decision = resolve_rollout_decision(db, organization_id=_organization_id(current_user), user=current_user)
    return decision.debug_metadata()


@router.get("/{plan_id}")
def plan(plan_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(require_roles("head", "superadmin"))):
    try:
        return _serialize(get_plan(db, plan_id, _organization_id(current_user)))
    except ClaraRolloutError as exc:
        raise _error(exc) from exc


@router.post("", status_code=status.HTTP_201_CREATED)
def create(payload: RolloutPlanCreateRequest, db: Session = Depends(get_db), current_user: User = Depends(require_roles("head", "superadmin"))):
    try:
        return _serialize(create_plan(db, organization_id=_organization_id(current_user), name=payload.name, bundle_id=payload.candidate_bundle_id, candidate_profile=payload.candidate_profile, cohort_seed=payload.cohort_seed, shadow_sample_percentage=payload.shadow_sample_percentage, daily_shadow_limit=payload.daily_shadow_limit, promotion_thresholds=payload.promotion_thresholds, required_sample_size=payload.required_sample_size, current_user=current_user))
    except ClaraRolloutError as exc:
        raise _error(exc) from exc


@router.post("/{plan_id}/readiness")
def readiness(plan_id: UUID, payload: VersionedRequest, db: Session = Depends(get_db), current_user: User = Depends(require_roles("head", "superadmin"))):
    try:
        return _serialize(validate_readiness(db, plan_id=plan_id, expected_version=payload.expected_version, current_user=current_user))
    except ClaraRolloutError as exc:
        raise _error(exc) from exc


@router.post("/{plan_id}/activate-internal")
def activate(plan_id: UUID, payload: VersionedRequest, db: Session = Depends(get_db), current_user: User = Depends(require_roles("head", "superadmin"))):
    try:
        return _serialize(activate_internal(db, plan_id=plan_id, expected_version=payload.expected_version, current_user=current_user))
    except ClaraRolloutError as exc:
        raise _error(exc) from exc


@router.post("/{plan_id}/activate-shadow")
def activate_shadow(plan_id: UUID, payload: VersionedRequest, db: Session = Depends(get_db), current_user: User = Depends(require_roles("head", "superadmin"))):
    try:
        return _serialize(promote_stage(db, plan_id=plan_id, target_stage=RolloutStage.SHADOW, expected_version=payload.expected_version, current_user=current_user))
    except ClaraRolloutError as exc:
        raise _error(exc) from exc


@router.post("/{plan_id}/promote")
def promote(plan_id: UUID, payload: PromoteRequest, db: Session = Depends(get_db), current_user: User = Depends(require_roles("head", "superadmin"))):
    try:
        return _serialize(promote_stage(db, plan_id=plan_id, target_stage=RolloutStage(payload.target_stage), expected_version=payload.expected_version, current_user=current_user))
    except ClaraRolloutError as exc:
        raise _error(exc) from exc


def _transition(action, plan_id, payload, db, current_user):
    try:
        return _serialize(action(db, plan_id=plan_id, expected_version=payload.expected_version, current_user=current_user, reason_codes=payload.reason_codes))
    except ClaraRolloutError as exc:
        raise _error(exc) from exc


@router.post("/{plan_id}/pause")
def pause(plan_id: UUID, payload: VersionedRequest, db: Session = Depends(get_db), current_user: User = Depends(require_roles("head", "superadmin"))):
    return _transition(pause_plan, plan_id, payload, db, current_user)


@router.post("/{plan_id}/stop")
def stop(plan_id: UUID, payload: VersionedRequest, db: Session = Depends(get_db), current_user: User = Depends(require_roles("head", "superadmin"))):
    return _transition(stop_plan, plan_id, payload, db, current_user)


@router.post("/{plan_id}/rollback")
def rollback(plan_id: UUID, payload: VersionedRequest, db: Session = Depends(get_db), current_user: User = Depends(require_roles("head", "superadmin"))):
    return _transition(rollback_plan, plan_id, payload, db, current_user)


@router.post("/{plan_id}/resume")
def resume(plan_id: UUID, payload: VersionedRequest, db: Session = Depends(get_db), current_user: User = Depends(require_roles("head", "superadmin"))):
    try:
        return _serialize(resume_plan(db, plan_id=plan_id, expected_version=payload.expected_version, current_user=current_user))
    except ClaraRolloutError as exc:
        raise _error(exc) from exc


@router.get("/{plan_id}/metrics")
def metrics(plan_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(require_roles("head", "superadmin"))):
    try:
        return {"values": calculate_metrics(get_plan(db, plan_id, _organization_id(current_user))), "definitions": METRIC_DEFINITIONS}
    except ClaraRolloutError as exc:
        raise _error(exc) from exc


@router.get("/{plan_id}/incidents")
def incidents(plan_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(require_roles("head", "superadmin"))):
    try:
        plan = get_plan(db, plan_id, _organization_id(current_user))
        return [{"id": item.id, "severity": item.severity, "category": item.stop_condition_category, "reason_codes": item.safe_reason_codes, "status": item.status, "created_at": item.created_at} for item in plan.incidents]
    except ClaraRolloutError as exc:
        raise _error(exc) from exc


@router.post("/incidents/{incident_id}/acknowledge")
def acknowledge(incident_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(require_roles("head", "superadmin"))):
    incident = db.scalar(select(ClaraRolloutIncident).where(ClaraRolloutIncident.id == incident_id, ClaraRolloutIncident.organization_id == _organization_id(current_user)))
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found.")
    return {"id": acknowledge_incident(db, incident=incident, current_user=current_user).id, "status": "ACKNOWLEDGED"}


@router.post("/incidents/{incident_id}/resolve")
def resolve(incident_id: UUID, payload: IncidentResolutionRequest, db: Session = Depends(get_db), current_user: User = Depends(require_roles("head", "superadmin"))):
    incident = db.scalar(select(ClaraRolloutIncident).where(ClaraRolloutIncident.id == incident_id, ClaraRolloutIncident.organization_id == _organization_id(current_user)))
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found.")
    return {"id": resolve_incident(db, incident=incident, resolution_note=payload.resolution_note, current_user=current_user).id, "status": "RESOLVED"}


@router.post("/observations/{observation_id}/quality-label")
def quality_label(observation_id: UUID, payload: QualityLabelRequest, db: Session = Depends(get_db), current_user: User = Depends(require_roles("sales", "manager", "head", "superadmin"))):
    try:
        item = record_quality_label(db, observation_id=observation_id, outcome=payload.outcome, reason_codes=payload.reason_codes, escalation_expected=payload.escalation_expected, escalation_selected=payload.escalation_selected, customer_movement=payload.customer_movement, current_user=current_user)
        return {"id": item.id, "review_outcome": item.review_outcome, "normalized_edit_distance": item.normalized_edit_distance}
    except ClaraRolloutError as exc:
        raise _error(exc) from exc
