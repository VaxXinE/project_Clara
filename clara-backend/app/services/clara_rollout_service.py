from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from enum import StrEnum
from hashlib import sha256
import json
import math
import re
from statistics import mean
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.clara_runtime_contract import PersonaAuthorityMode
from app.core.config import settings
from app.models.ai_persona_bundle import AIPersonaBundle
from app.models.clara_rollout import (
    ClaraRolloutEvent,
    ClaraRolloutIncident,
    ClaraRolloutObservation,
    ClaraRolloutPlan,
)
from app.models.ops_notification import OpsNotification
from app.models.reply_suggestion import ReplySuggestion
from app.models.sent_message import SentMessage
from app.models.user import User
from app.services.audit_service import add_audit_log
from app.services.clara_evaluation_service import get_valid_certification
from app.services.clara_policy_enforcement_service import PolicyEnforcementMode
from app.services.clara_process_state_service import ProcessStateMode
from app.services.clara_product_fact_service import ProductFactMode
from app.services.clara_reply_validation_service import SemanticRevalidationMode
from app.services.clara_service_routing_service import ServiceRoutingMode


CLARA_ROLLOUT_CONTRACT_VERSION = "1.0"
CLARA_ROLLOUT_METRICS_VERSION = "1.0"


class RolloutControlMode(StrEnum):
    OFF = "OFF"
    OBSERVE = "OBSERVE"
    GOVERNED = "GOVERNED"


class RolloutStage(StrEnum):
    INTERNAL_SIMULATION = "INTERNAL_SIMULATION"
    SHADOW = "SHADOW"
    REVIEWER_CANARY_10 = "REVIEWER_CANARY_10"
    REVIEWER_CANARY_30 = "REVIEWER_CANARY_30"
    SEMI_AUTOMATIC_100 = "SEMI_AUTOMATIC_100"


class GenerationLane(StrEnum):
    BASELINE = "BASELINE"
    SHADOW_CANDIDATE = "SHADOW_CANDIDATE"
    CANARY_CANDIDATE = "CANARY_CANDIDATE"


ROLLOUT_PLAN_STATUSES = frozenset(
    {"DRAFT", "READY", "ACTIVE", "PAUSED", "STOPPED", "ROLLED_BACK", "COMPLETED", "REJECTED"}
)
ROLLOUT_EVENT_TYPES = frozenset(
    {"CREATED", "READINESS_VALIDATED", "ACTIVATED", "STAGE_PROMOTED", "PAUSED", "RESUMED", "STOP_CONDITION_TRIGGERED", "ROLLBACK_STARTED", "ROLLED_BACK", "COMPLETED", "REJECTED"}
)


STAGE_PERCENTAGES = {
    RolloutStage.INTERNAL_SIMULATION: 0,
    RolloutStage.SHADOW: 0,
    RolloutStage.REVIEWER_CANARY_10: 10,
    RolloutStage.REVIEWER_CANARY_30: 30,
    RolloutStage.SEMI_AUTOMATIC_100: 100,
}
NEXT_STAGE = {
    RolloutStage.INTERNAL_SIMULATION: RolloutStage.SHADOW,
    RolloutStage.SHADOW: RolloutStage.REVIEWER_CANARY_10,
    RolloutStage.REVIEWER_CANARY_10: RolloutStage.REVIEWER_CANARY_30,
    RolloutStage.REVIEWER_CANARY_30: RolloutStage.SEMI_AUTOMATIC_100,
}
AUTHORIZED_REVIEWER_ROLES = {"sales", "manager", "head", "superadmin"}
HARD_STOP_CATEGORIES = {
    "GUARANTEED_PROFIT_CLAIM",
    "WRONG_LEGALITY_OR_REGULATOR_CLAIM",
    "UNSUPPORTED_PRODUCT_FACT",
    "COMPLAINT_SALES_LEAKAGE",
    "SENSITIVE_DATA_LEAKAGE",
    "INTERNAL_PROMPT_LEAKAGE",
    "PROCESS_STATE_REGRESSION",
    "BLOCKED_POLICY_SENDABLE",
    "AUTOMATIC_CUSTOMER_SEND",
    "WRONG_ACTIVE_CHAT_DELIVERY",
    "DUPLICATE_CONFIRMED_SEND",
    "CERTIFICATION_BUNDLE_HASH_MISMATCH",
}

_METRIC_PARTS = {
    "approval_rate": ("approved candidate reviews", "all completed candidate reviews", "pending reviews"),
    "human_edit_rate": ("approved drafts with edit distance > 0", "approved candidate drafts", "rejected or pending"),
    "average_normalized_edit_distance": ("sum normalized edit distance", "edited/approved observations", "missing authorized comparison"),
    "rejection_rate": ("rejected candidate reviews", "all completed candidate reviews", "pending reviews"),
    "escalation_precision": ("correct escalations", "all candidate escalations", "unlabelled cases"),
    "escalation_miss": ("missed required escalations", "all required escalations", "unlabelled cases"),
    "factual_correction_rate": ("factual-correction observations", "reviewed candidate observations", "pending reviews"),
    "process_state_regression_rate": ("process regression observations", "candidate observations", "internal fixtures"),
    "generation_latency": ("sum generation latency ms", "observations with latency", "missing latency"),
    "reviewer_turnaround_time": ("sum reviewer turnaround ms", "reviewed observations with timing", "pending reviews"),
    "delivery_authorization_failure_rate": ("failed delivery authorizations", "candidate delivery attempts", "shadow/internal"),
    "customer_movement_observation": ("observed movement labels", "eligible post-send observations", "not causal attribution"),
    "complaint_leakage": ("complaint sales leakage", "candidate observations", "internal fixtures"),
    "sensitive_data_leakage": ("sensitive leakage", "candidate observations", "none"),
    "prompt_leakage": ("prompt leakage", "candidate observations", "none"),
    "critical_validator_failure": ("critical validator observations", "candidate observations", "none"),
    "rollback_pause_count": ("pause and rollback events", "rollout plan", "none"),
}
METRIC_DEFINITIONS = {
    key: {
        "numerator": numerator,
        "denominator": denominator,
        "exclusions": exclusions,
        "window": "selected rollout stage; plan lifetime when no stage filter is supplied",
    }
    for key, (numerator, denominator, exclusions) in _METRIC_PARTS.items()
}


class ClaraRolloutError(RuntimeError):
    pass


_SENSITIVE_NOTE = re.compile(
    r"(?:\+62\d{8,}|[\w.+-]+@[\w.-]+\.[a-z]{2,}|\b\d{12,16}\b|password|otp|token|api.?key)",
    re.IGNORECASE,
)


def canonical_hash(value: object) -> str:
    payload = json.dumps(value, sort_keys=True, separators=(",", ":"), default=str)
    return sha256(payload.encode()).hexdigest()


def normalize_rollout_control_mode(value: str | None) -> RolloutControlMode:
    try:
        return RolloutControlMode((value or "OFF").strip().upper())
    except ValueError:
        return RolloutControlMode.OFF


def baseline_profile() -> dict:
    return {
        "persona_authority_mode": "LEGACY",
        "semantic_revalidation_mode": "OFF",
        "policy_mode": "OBSERVE",
        "product_fact_mode": "LEGACY",
        "process_state_mode": "LEGACY",
        "service_routing_mode": "LEGACY",
        "extension_delivery_mode": "LEGACY",
    }


def validate_runtime_profile(profile: dict) -> dict:
    allowed = {
        "persona_authority_mode": {item.value for item in PersonaAuthorityMode},
        "semantic_revalidation_mode": {item.value for item in SemanticRevalidationMode},
        "policy_mode": {item.value for item in PolicyEnforcementMode},
        "product_fact_mode": {item.value for item in ProductFactMode},
        "process_state_mode": {item.value for item in ProcessStateMode},
        "service_routing_mode": {item.value for item in ServiceRoutingMode},
        "extension_delivery_mode": {"LEGACY", "OBSERVE", "GOVERNED"},
    }
    reference_keys = {
        "support_knowledge_readiness_ref",
        "product_fact_readiness_ref",
        "process_state_readiness_ref",
        "extension_version_requirement",
    }
    unknown = set(profile) - set(allowed) - reference_keys
    if unknown:
        raise ClaraRolloutError("Unknown rollout profile fields are not allowed.")
    normalized = dict(profile)
    for key, values in allowed.items():
        value = str(normalized.get(key, "")).strip().upper()
        if value not in values:
            raise ClaraRolloutError(f"Invalid canonical rollout profile value: {key}.")
        normalized[key] = value
    for key in reference_keys:
        if key not in normalized:
            continue
        value = normalized[key]
        if (
            not isinstance(value, str)
            or not value.strip()
            or len(value) > 255
            or _SENSITIVE_NOTE.search(value)
        ):
            raise ClaraRolloutError(f"Invalid rollout readiness reference: {key}.")
        normalized[key] = value.strip()
    return normalized


def _plan_query():
    return select(ClaraRolloutPlan).options(
        selectinload(ClaraRolloutPlan.events),
        selectinload(ClaraRolloutPlan.observations),
        selectinload(ClaraRolloutPlan.incidents),
    ).execution_options(populate_existing=True)


def get_plan(db: Session, plan_id: UUID, organization_id: UUID | None = None, *, lock: bool = False):
    query = _plan_query().where(ClaraRolloutPlan.id == plan_id)
    if organization_id is not None:
        query = query.where(ClaraRolloutPlan.organization_id == organization_id)
    if lock:
        query = query.with_for_update()
    plan = db.scalars(query).first()
    if plan is None:
        raise ClaraRolloutError("Rollout plan not found.")
    return plan


def list_plans(db: Session, organization_id: UUID | None) -> list[ClaraRolloutPlan]:
    query = _plan_query().order_by(ClaraRolloutPlan.created_at.desc())
    if organization_id is not None:
        query = query.where(ClaraRolloutPlan.organization_id == organization_id)
    return list(db.scalars(query).all())


def _append_event(db: Session, plan: ClaraRolloutPlan, event_type: str, actor: User | None, reason_codes=(), safe_metadata=None):
    if event_type not in ROLLOUT_EVENT_TYPES:
        raise ClaraRolloutError("Unknown rollout event type.")
    sequence = (db.scalar(select(func.count(ClaraRolloutEvent.id)).where(ClaraRolloutEvent.plan_id == plan.id)) or 0) + 1
    event = ClaraRolloutEvent(
        plan_id=plan.id,
        organization_id=plan.organization_id,
        event_type=event_type,
        actor_user_id=actor.id if actor else None,
        reason_codes=sorted(set(reason_codes)),
        safe_metadata=safe_metadata or {},
        event_hash=canonical_hash({"plan_id": str(plan.id), "event_type": event_type, "sequence": sequence, "version": plan.version}),
    )
    db.add(event)
    return event


def create_plan(db: Session, *, organization_id: UUID, name: str, bundle_id: UUID, candidate_profile: dict, cohort_seed: str, shadow_sample_percentage: int, daily_shadow_limit: int, promotion_thresholds: dict, required_sample_size: int, current_user: User) -> ClaraRolloutPlan:
    if not name.strip():
        raise ClaraRolloutError("Rollout plan name is required.")
    bundle = db.get(AIPersonaBundle, bundle_id)
    if bundle is None or bundle.variant != "mini" or not bundle.bundle_sha256:
        raise ClaraRolloutError("A complete Mini bundle is required.")
    certification = get_valid_certification(db, bundle)
    if certification is None or not certification.report_hash:
        raise ClaraRolloutError("Exact valid Golden V2 certification is required.")
    if not 0 <= shadow_sample_percentage <= 100 or daily_shadow_limit < 0 or required_sample_size < 0:
        raise ClaraRolloutError("Rollout sampling values are invalid.")
    if (
        not cohort_seed.strip()
        or not re.fullmatch(r"[A-Za-z0-9._:-]{8,128}", cohort_seed.strip())
    ):
        raise ClaraRolloutError("A stable cohort seed is required.")
    if any(
        not key.endswith(("_min", "_max"))
        or isinstance(value, bool)
        or not isinstance(value, (int, float))
        or not math.isfinite(value)
        for key, value in promotion_thresholds.items()
    ):
        raise ClaraRolloutError("Promotion thresholds must use finite _min or _max values.")
    profile = validate_runtime_profile(candidate_profile)
    plan = ClaraRolloutPlan(
        organization_id=organization_id,
        variant="mini",
        name=name.strip()[:150],
        candidate_bundle_id=bundle.id,
        candidate_bundle_hash=bundle.bundle_sha256,
        certification_run_id=certification.id,
        certification_report_hash=certification.report_hash,
        baseline_profile=baseline_profile(),
        candidate_profile=profile,
        cohort_seed=cohort_seed.strip()[:128],
        shadow_sample_percentage=shadow_sample_percentage,
        daily_shadow_limit=daily_shadow_limit,
        promotion_thresholds=promotion_thresholds,
        required_sample_size=required_sample_size,
        started_by_user_id=current_user.id,
    )
    db.add(plan)
    db.flush()
    _append_event(db, plan, "CREATED", current_user)
    add_audit_log(db, action="clara_rollout.created", resource_type="clara_rollout_plan", resource_id=str(plan.id), current_user=current_user, metadata={"bundle_hash": plan.candidate_bundle_hash})
    db.commit()
    return get_plan(db, plan.id)


def _readiness_errors(db: Session, plan: ClaraRolloutPlan) -> list[str]:
    errors = []
    bundle = db.get(AIPersonaBundle, plan.candidate_bundle_id)
    certification = get_valid_certification(db, bundle) if bundle else None
    if not bundle or bundle.bundle_sha256 != plan.candidate_bundle_hash:
        errors.append("BUNDLE_HASH_MISMATCH")
    elif bundle.status != "published":
        errors.append("BUNDLE_NOT_PUBLISHED")
    if not certification or certification.id != plan.certification_run_id or certification.report_hash != plan.certification_report_hash:
        errors.append("CERTIFICATION_MISMATCH")
    profile = plan.candidate_profile
    requirements = {
        "REGISTRY": "product_fact_readiness_ref",
        "FSM": "process_state_readiness_ref",
        "ROUTED": "support_knowledge_readiness_ref",
        "GOVERNED": "extension_version_requirement",
    }
    for mode, reference in requirements.items():
        if mode in profile.values() and not profile.get(reference):
            errors.append(f"MISSING_{reference.upper()}")
    return errors


def validate_readiness(db: Session, *, plan_id: UUID, expected_version: int, current_user: User) -> ClaraRolloutPlan:
    plan = get_plan(db, plan_id, current_user.organization_id, lock=True)
    if plan.version != expected_version or plan.status not in {"DRAFT", "READY"}:
        raise ClaraRolloutError("Rollout plan version or status is stale.")
    errors = _readiness_errors(db, plan)
    if errors:
        raise ClaraRolloutError("Readiness blocked: " + ", ".join(errors))
    plan.status = "READY"
    plan.version += 1
    _append_event(db, plan, "READINESS_VALIDATED", current_user)
    add_audit_log(db, action="clara_rollout.readiness_validated", resource_type="clara_rollout_plan", resource_id=str(plan.id), current_user=current_user, metadata={"version": plan.version})
    db.commit()
    return get_plan(db, plan.id)


def _require_governed_mode():
    if normalize_rollout_control_mode(settings.clara_rollout_control_mode) != RolloutControlMode.GOVERNED:
        raise ClaraRolloutError("CLARA_ROLLOUT_CONTROL_MODE=GOVERNED is required.")


def activate_internal(db: Session, *, plan_id: UUID, expected_version: int, current_user: User) -> ClaraRolloutPlan:
    _require_governed_mode()
    plan = get_plan(db, plan_id, current_user.organization_id, lock=True)
    if plan.status != "READY" or plan.version != expected_version:
        raise ClaraRolloutError("Only a current READY plan can be activated.")
    if db.scalar(select(ClaraRolloutPlan.id).where(ClaraRolloutPlan.organization_id == plan.organization_id, ClaraRolloutPlan.variant == "mini", ClaraRolloutPlan.status == "ACTIVE", ClaraRolloutPlan.id != plan.id)):
        raise ClaraRolloutError("Another Mini rollout plan is already active.")
    plan.status = "ACTIVE"
    plan.current_stage = RolloutStage.INTERNAL_SIMULATION.value
    plan.cohort_percentage = 0
    plan.approved_by_user_id = current_user.id
    plan.activated_at = datetime.now(timezone.utc)
    plan.version += 1
    _append_event(db, plan, "ACTIVATED", current_user, safe_metadata={"stage": plan.current_stage})
    add_audit_log(db, action="clara_rollout.activated", resource_type="clara_rollout_plan", resource_id=str(plan.id), current_user=current_user, metadata={"stage": plan.current_stage, "version": plan.version})
    db.commit()
    return get_plan(db, plan.id)


def calculate_metrics(plan: ClaraRolloutPlan, rollout_stage: str | None = None) -> dict:
    observations = [
        item
        for item in plan.observations
        if rollout_stage is None or item.rollout_stage == rollout_stage
    ]
    completed = [item for item in observations if item.review_outcome in {"APPROVED", "REJECTED"}]
    approved = [item for item in completed if item.review_outcome == "APPROVED"]
    distances = [item.normalized_edit_distance for item in approved if item.normalized_edit_distance is not None]
    latencies = [item.generation_latency_ms for item in observations if item.generation_latency_ms is not None]
    turnarounds = [item.reviewer_turnaround_ms for item in completed if item.reviewer_turnaround_ms is not None]
    validator_ids = [validator for item in observations for validator in item.validator_ids]
    count = len(observations)
    result = {
        "metric_contract_version": CLARA_ROLLOUT_METRICS_VERSION,
        "sample_count": sum(item.is_production_sample for item in observations),
        "human_review_count": len(completed),
        "approval_rate": len(approved) / len(completed) if completed else None,
        "human_edit_rate": sum((item.normalized_edit_distance or 0) > 0 for item in approved) / len(approved) if approved else None,
        "average_normalized_edit_distance": mean(distances) if distances else None,
        "rejection_rate": sum(item.review_outcome == "REJECTED" for item in completed) / len(completed) if completed else None,
        "escalation_precision": (
            sum(item.escalation_expected and item.escalation_selected for item in observations)
            / sum(bool(item.escalation_selected) for item in observations)
            if any(item.escalation_selected for item in observations)
            else None
        ),
        "escalation_miss": (
            sum(item.escalation_expected and not item.escalation_selected for item in observations)
            / sum(bool(item.escalation_expected) for item in observations)
            if any(item.escalation_expected for item in observations)
            else None
        ),
        "factual_correction_rate": sum("FACTUAL_CORRECTION" in item.reason_codes for item in observations) / count if count else None,
        "process_state_regression_rate": sum(
            item in {"process_regression", "post_signup_regression"}
            for item in validator_ids
        ) / count if count else None,
        "generation_latency": mean(latencies) if latencies else None,
        "reviewer_turnaround_time": mean(turnarounds) if turnarounds else None,
        "delivery_authorization_failure_rate": sum(item.delivery_authorization_failed for item in observations) / count if count else None,
        "customer_movement_observation": {label: sum(item.customer_movement == label for item in observations) for label in sorted({item.customer_movement for item in observations if item.customer_movement})},
        "complaint_leakage": validator_ids.count("complaint_sales_leakage") / count if count else None,
        "sensitive_data_leakage": validator_ids.count("sensitive_data_exposure") / count if count else None,
        "prompt_leakage": validator_ids.count("internal_prompt_disclosure") / count if count else None,
        "critical_validator_failure": sum(bool(item.validator_ids) for item in observations) / count if count else None,
        "rollback_pause_count": sum(item.event_type in {"PAUSED", "ROLLED_BACK"} for item in plan.events),
    }
    return result


def _thresholds_pass(plan: ClaraRolloutPlan, metrics: dict) -> bool:
    if not plan.promotion_thresholds:
        return False
    for key, expected in plan.promotion_thresholds.items():
        if key.endswith("_min"):
            actual = metrics.get(key[:-4])
            if actual is None or actual < expected:
                return False
        elif key.endswith("_max"):
            actual = metrics.get(key[:-4])
            if actual is None or actual > expected:
                return False
        else:
            raise ClaraRolloutError(f"Unsupported promotion threshold: {key}.")
    return True


def promote_stage(db: Session, *, plan_id: UUID, target_stage: RolloutStage, expected_version: int, current_user: User) -> ClaraRolloutPlan:
    _require_governed_mode()
    plan = get_plan(db, plan_id, current_user.organization_id, lock=True)
    current = RolloutStage(plan.current_stage)
    if plan.status != "ACTIVE" or plan.version != expected_version or NEXT_STAGE.get(current) != target_stage:
        raise ClaraRolloutError("Rollout stage transition is invalid or stale.")
    if _readiness_errors(db, plan):
        raise ClaraRolloutError("Certification or readiness evidence is stale.")
    if any(item.status in {"OPEN", "ACKNOWLEDGED"} and item.severity == "CRITICAL" for item in plan.incidents):
        raise ClaraRolloutError("Open critical incident blocks promotion.")
    if target_stage not in {RolloutStage.SHADOW}:
        if plan.candidate_profile.get("extension_delivery_mode") != "GOVERNED":
            raise ClaraRolloutError("Canary stages require explicitly governed extension delivery.")
        metrics = calculate_metrics(plan, current.value)
        if metrics["sample_count"] < plan.required_sample_size or metrics["human_review_count"] < plan.required_sample_size:
            raise ClaraRolloutError("Required production sample and human review coverage not reached.")
        if not _thresholds_pass(plan, metrics):
            raise ClaraRolloutError("Configured promotion thresholds are not satisfied.")
    previous = plan.current_stage
    plan.current_stage = target_stage.value
    plan.cohort_percentage = STAGE_PERCENTAGES[target_stage]
    plan.approved_by_user_id = current_user.id
    plan.version += 1
    _append_event(db, plan, "STAGE_PROMOTED", current_user, safe_metadata={"from": previous, "to": target_stage.value, "manual_send_required": True})
    add_audit_log(db, action="clara_rollout.stage_promoted", resource_type="clara_rollout_plan", resource_id=str(plan.id), current_user=current_user, metadata={"from": previous, "to": target_stage.value, "version": plan.version})
    db.commit()
    return get_plan(db, plan.id)


def _transition(db: Session, plan: ClaraRolloutPlan, status: str, event_type: str, actor: User, reason_codes=()):
    plan.status = status
    plan.paused_by_user_id = actor.id if status == "PAUSED" else plan.paused_by_user_id
    plan.paused_at = datetime.now(timezone.utc) if status == "PAUSED" else plan.paused_at
    plan.completed_at = datetime.now(timezone.utc) if status in {"STOPPED", "ROLLED_BACK", "COMPLETED", "REJECTED"} else plan.completed_at
    plan.version += 1
    _append_event(db, plan, event_type, actor, reason_codes)
    add_audit_log(db, action=f"clara_rollout.{event_type.lower()}", resource_type="clara_rollout_plan", resource_id=str(plan.id), current_user=actor, metadata={"status": status, "stage": plan.current_stage})
    db.commit()
    return get_plan(db, plan.id)


def pause_plan(db: Session, *, plan_id: UUID, expected_version: int, current_user: User, reason_codes=()):
    plan = get_plan(db, plan_id, current_user.organization_id, lock=True)
    if plan.status != "ACTIVE" or plan.version != expected_version:
        raise ClaraRolloutError("Only the current active plan can be paused.")
    return _transition(db, plan, "PAUSED", "PAUSED", current_user, reason_codes)


def resume_plan(db: Session, *, plan_id: UUID, expected_version: int, current_user: User):
    _require_governed_mode()
    plan = get_plan(db, plan_id, current_user.organization_id, lock=True)
    if plan.status != "PAUSED" or plan.version != expected_version or any(item.status != "RESOLVED" and item.severity == "CRITICAL" for item in plan.incidents):
        raise ClaraRolloutError("Pause cannot be resumed until critical incidents are resolved.")
    plan.status = "ACTIVE"
    plan.paused_at = None
    plan.version += 1
    _append_event(db, plan, "RESUMED", current_user)
    add_audit_log(db, action="clara_rollout.resumed", resource_type="clara_rollout_plan", resource_id=str(plan.id), current_user=current_user, metadata={"stage": plan.current_stage, "version": plan.version})
    db.commit()
    return get_plan(db, plan.id)


def stop_plan(db: Session, *, plan_id: UUID, expected_version: int, current_user: User, reason_codes=()):
    plan = get_plan(db, plan_id, current_user.organization_id, lock=True)
    if plan.status not in {"ACTIVE", "PAUSED"} or plan.version != expected_version:
        raise ClaraRolloutError("Plan cannot be stopped from its current state.")
    return _transition(db, plan, "STOPPED", "STOP_CONDITION_TRIGGERED", current_user, reason_codes)


def rollback_plan(db: Session, *, plan_id: UUID, expected_version: int, current_user: User, reason_codes=()):
    plan = get_plan(db, plan_id, current_user.organization_id, lock=True)
    if plan.status not in {"ACTIVE", "PAUSED", "STOPPED"} or plan.version != expected_version:
        raise ClaraRolloutError("Plan cannot be rolled back from its current state.")
    _append_event(db, plan, "ROLLBACK_STARTED", current_user, reason_codes)
    return _transition(db, plan, "ROLLED_BACK", "ROLLED_BACK", current_user, reason_codes)


def cohort_bucket(plan_id: UUID, reviewer_user_id: UUID, cohort_seed: str) -> int:
    digest = sha256(f"{plan_id}:{reviewer_user_id}:{cohort_seed}".encode()).hexdigest()
    return int(digest[:8], 16) % 100


def reviewer_is_eligible(plan: ClaraRolloutPlan, user: User, percentage: int) -> bool:
    return bool(user.is_active and user.organization_id == plan.organization_id and user.role in AUTHORIZED_REVIEWER_ROLES and cohort_bucket(plan.id, user.id, plan.cohort_seed) < percentage)


@dataclass(frozen=True)
class RolloutDecision:
    control_mode: str
    plan_id: UUID | None
    rollout_stage: str | None
    generation_lane: str
    runtime_profile: dict
    profile_hash: str
    candidate_bundle_hash: str | None
    cohort_eligible: bool
    shadow_only: bool
    send_eligible: bool
    shadow_sampled: bool
    candidate_profile: dict | None
    rollout_decision_hash: str

    def debug_metadata(self):
        data = asdict(self)
        data.pop("runtime_profile")
        data.pop("candidate_profile")
        data["plan_id"] = str(self.plan_id) if self.plan_id else None
        return data

    def baseline_fallback(self):
        profile = baseline_profile()
        return _decision(
            control_mode=self.control_mode,
            plan_id=self.plan_id,
            rollout_stage=self.rollout_stage,
            generation_lane=GenerationLane.BASELINE.value,
            runtime_profile=profile,
            profile_hash=canonical_hash(profile),
            candidate_bundle_hash=self.candidate_bundle_hash,
            cohort_eligible=self.cohort_eligible,
            shadow_only=False,
            send_eligible=True,
            shadow_sampled=False,
            candidate_profile=None,
        )


def _decision(**values) -> RolloutDecision:
    core = dict(values)
    core["rollout_decision_hash"] = canonical_hash(core)
    return RolloutDecision(**core)


def resolve_rollout_decision(db: Session, *, organization_id: UUID, user: User) -> RolloutDecision:
    control = normalize_rollout_control_mode(settings.clara_rollout_control_mode)
    baseline = baseline_profile()
    if control == RolloutControlMode.OFF:
        return _decision(control_mode=control.value, plan_id=None, rollout_stage=None, generation_lane=GenerationLane.BASELINE.value, runtime_profile=baseline, profile_hash=canonical_hash(baseline), candidate_bundle_hash=None, cohort_eligible=False, shadow_only=False, send_eligible=True, shadow_sampled=False, candidate_profile=None)
    plan = db.scalars(_plan_query().where(ClaraRolloutPlan.organization_id == organization_id, ClaraRolloutPlan.variant == "mini", ClaraRolloutPlan.status == "ACTIVE")).first()
    if control != RolloutControlMode.GOVERNED or plan is None:
        percentage = STAGE_PERCENTAGES.get(RolloutStage(plan.current_stage), 0) if plan and plan.current_stage else 0
        eligible = reviewer_is_eligible(plan, user, percentage) if plan else False
        return _decision(control_mode=control.value, plan_id=plan.id if plan else None, rollout_stage=plan.current_stage if plan else None, generation_lane=GenerationLane.BASELINE.value, runtime_profile=baseline, profile_hash=canonical_hash(baseline), candidate_bundle_hash=plan.candidate_bundle_hash if plan else None, cohort_eligible=eligible, shadow_only=False, send_eligible=True, shadow_sampled=False, candidate_profile=None)
    if _readiness_errors(db, plan):
        trigger_hard_stop(db, plan=plan, category="CERTIFICATION_BUNDLE_HASH_MISMATCH", reason_codes=("RUNTIME_READINESS_MISMATCH",), actor=None)
        return _decision(control_mode=control.value, plan_id=plan.id, rollout_stage=plan.current_stage, generation_lane=GenerationLane.BASELINE.value, runtime_profile=baseline, profile_hash=canonical_hash(baseline), candidate_bundle_hash=plan.candidate_bundle_hash, cohort_eligible=False, shadow_only=False, send_eligible=True, shadow_sampled=False, candidate_profile=None)
    stage = RolloutStage(plan.current_stage)
    eligible = reviewer_is_eligible(plan, user, STAGE_PERCENTAGES[stage])
    if stage == RolloutStage.SHADOW:
        sampled = should_sample_shadow(db, plan, user)
        return _decision(control_mode=control.value, plan_id=plan.id, rollout_stage=stage.value, generation_lane=GenerationLane.BASELINE.value, runtime_profile=baseline, profile_hash=canonical_hash(baseline), candidate_bundle_hash=plan.candidate_bundle_hash, cohort_eligible=False, shadow_only=False, send_eligible=True, shadow_sampled=sampled, candidate_profile=plan.candidate_profile if sampled else None)
    candidate = stage in {RolloutStage.REVIEWER_CANARY_10, RolloutStage.REVIEWER_CANARY_30, RolloutStage.SEMI_AUTOMATIC_100} and eligible
    profile = plan.candidate_profile if candidate else baseline
    return _decision(control_mode=control.value, plan_id=plan.id, rollout_stage=stage.value, generation_lane=GenerationLane.CANARY_CANDIDATE.value if candidate else GenerationLane.BASELINE.value, runtime_profile=profile, profile_hash=canonical_hash(profile), candidate_bundle_hash=plan.candidate_bundle_hash, cohort_eligible=eligible, shadow_only=False, send_eligible=True, shadow_sampled=False, candidate_profile=None)


def active_runtime_decision(decision: RolloutDecision) -> RolloutDecision | None:
    if decision.control_mode != RolloutControlMode.GOVERNED.value or decision.plan_id is None:
        return None
    return decision


def should_sample_shadow(db: Session, plan: ClaraRolloutPlan, user: User, now: datetime | None = None) -> bool:
    now = now or datetime.now(timezone.utc)
    if plan.shadow_sample_percentage <= 0 or plan.daily_shadow_limit <= 0:
        return False
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    used = db.scalar(select(func.count(ClaraRolloutObservation.id)).where(ClaraRolloutObservation.plan_id == plan.id, ClaraRolloutObservation.generation_lane == GenerationLane.SHADOW_CANDIDATE.value, ClaraRolloutObservation.created_at >= day_start)) or 0
    bucket = int(sha256(f"{plan.id}:{user.id}:{now.date().isoformat()}".encode()).hexdigest()[:8], 16) % 100
    return used < plan.daily_shadow_limit and bucket < plan.shadow_sample_percentage


def normalized_edit_distance(original: str, final: str) -> float:
    if not original and not final:
        return 0.0
    previous = list(range(len(final) + 1))
    for index, left in enumerate(original, start=1):
        current = [index]
        for offset, right in enumerate(final, start=1):
            current.append(min(current[-1] + 1, previous[offset] + 1, previous[offset - 1] + (left != right)))
        previous = current
    return previous[-1] / max(len(original), len(final), 1)


def record_observation(db: Session, *, plan_id: UUID, organization_id: UUID, rollout_stage: str, generation_lane: str, profile_hash: str, bundle_hash: str, reviewer_user_id: UUID | None = None, suggestion_id: UUID | None = None, conversation_id: UUID | None = None, cohort_eligible: bool = False, shadow_only: bool = False, send_eligible: bool = False, validator_ids=(), reason_codes=(), output_hash: str | None = None, output_length: int | None = None, generation_latency_ms: int | None = None, is_production_sample: bool = False, **values) -> ClaraRolloutObservation:
    observation = ClaraRolloutObservation(plan_id=plan_id, organization_id=organization_id, rollout_stage=rollout_stage, generation_lane=generation_lane, profile_hash=profile_hash, bundle_hash=bundle_hash, reviewer_user_id=reviewer_user_id, suggestion_id=suggestion_id, conversation_id=conversation_id, cohort_eligible=cohort_eligible, shadow_only=shadow_only, send_eligible=send_eligible, validator_ids=sorted(set(validator_ids)), reason_codes=sorted(set(reason_codes)), output_hash=output_hash, output_length=output_length, generation_latency_ms=generation_latency_ms, is_production_sample=is_production_sample, **values)
    db.add(observation)
    return observation


def trigger_hard_stop(db: Session, *, plan: ClaraRolloutPlan, category: str, reason_codes, actor: User | None, source_suggestion_id: UUID | None = None, source_conversation_id: UUID | None = None):
    if category not in HARD_STOP_CATEGORIES:
        raise ClaraRolloutError("Unknown hard-stop category.")
    plan = get_plan(db, plan.id, lock=True)
    if plan.status == "ACTIVE":
        plan.status = "PAUSED"
        plan.paused_at = datetime.now(timezone.utc)
        plan.paused_by_user_id = actor.id if actor else None
        plan.version += 1
    incident = ClaraRolloutIncident(plan_id=plan.id, organization_id=plan.organization_id, severity="CRITICAL", stop_condition_category=category, source_suggestion_id=source_suggestion_id, source_conversation_id=source_conversation_id, safe_reason_codes=sorted(set(reason_codes)))
    db.add(incident)
    db.flush()
    _append_event(db, plan, "STOP_CONDITION_TRIGGERED", actor, reason_codes, {"category": category})
    db.add(OpsNotification(organization_id=plan.organization_id, source_type="clara_rollout", source_key=f"rollout:{plan.id}:{category}", source_reference_id=incident.id, alert_type="rollout_hard_stop", workflow_scope="ops_oversight", owner_role="superadmin", target_role="superadmin", severity="critical", title="Clara rollout paused", body=f"Hard-stop category: {category}", target_href="/dashboard/admin/ai-config", status="active", delivery_channel="in_app", delivery_status="pending", triggered_at=datetime.now(timezone.utc), metadata_json={"plan_id": str(plan.id), "reason_codes": sorted(set(reason_codes))}))
    add_audit_log(db, action="clara_rollout.hard_stop", resource_type="clara_rollout_plan", resource_id=str(plan.id), current_user=actor, metadata={"category": category, "reason_codes": sorted(set(reason_codes))})
    db.commit()
    return incident


def assert_rollout_suggestion_sendable(db: Session, suggestion: ReplySuggestion) -> None:
    metadata = suggestion.persona_bundle_metadata or {}
    plan_id = metadata.get("rollout_plan_id")
    lane = metadata.get("generation_lane")
    if not plan_id or lane == GenerationLane.BASELINE.value:
        return
    if lane == GenerationLane.SHADOW_CANDIDATE.value or metadata.get("shadow_only"):
        raise ClaraRolloutError("Shadow candidate can never be approved or sent.")
    if normalize_rollout_control_mode(settings.clara_rollout_control_mode) != RolloutControlMode.GOVERNED:
        raise ClaraRolloutError("Candidate rollout is disabled; use baseline.")
    try:
        parsed_plan_id = UUID(str(plan_id))
    except (TypeError, ValueError) as exc:
        raise ClaraRolloutError("Candidate rollout metadata is invalid.") from exc
    plan = get_plan(db, parsed_plan_id)
    if (
        metadata.get("send_eligible") is not True
        or plan.current_stage not in {
            RolloutStage.REVIEWER_CANARY_10.value,
            RolloutStage.REVIEWER_CANARY_30.value,
            RolloutStage.SEMI_AUTOMATIC_100.value,
        }
        or plan.status != "ACTIVE"
        or plan.current_stage != metadata.get("rollout_stage")
        or plan.candidate_bundle_hash != metadata.get("candidate_bundle_hash")
    ):
        raise ClaraRolloutError("Candidate rollout is paused, rolled back, or stale; use baseline.")


def hard_stop_candidate_suggestion(
    db: Session,
    *,
    suggestion: ReplySuggestion,
    category: str,
    reason_codes: tuple[str, ...],
    actor: User | None,
) -> bool:
    metadata = suggestion.persona_bundle_metadata or {}
    if metadata.get("generation_lane") != GenerationLane.CANARY_CANDIDATE.value:
        return False
    raw_plan_id = metadata.get("rollout_plan_id")
    if not raw_plan_id:
        return False
    plan = get_plan(db, UUID(raw_plan_id))
    if plan.status != "ACTIVE":
        return False
    observation = db.scalars(
        select(ClaraRolloutObservation).where(
            ClaraRolloutObservation.plan_id == plan.id,
            ClaraRolloutObservation.suggestion_id == suggestion.id,
        )
    ).first()
    if observation is not None:
        observation.delivery_authorization_failed = True
    trigger_hard_stop(
        db,
        plan=plan,
        category=category,
        reason_codes=reason_codes,
        actor=actor,
        source_suggestion_id=suggestion.id,
        source_conversation_id=suggestion.conversation_id,
    )
    return True


def acknowledge_incident(db: Session, *, incident: ClaraRolloutIncident, current_user: User):
    incident.status = "ACKNOWLEDGED"
    incident.acknowledged_by_user_id = current_user.id
    incident.acknowledged_at = datetime.now(timezone.utc)
    add_audit_log(db, action="clara_rollout.incident_acknowledged", resource_type="clara_rollout_incident", resource_id=str(incident.id), current_user=current_user, metadata={"category": incident.stop_condition_category})
    db.commit()
    return incident


def resolve_incident(db: Session, *, incident: ClaraRolloutIncident, resolution_note: str, current_user: User):
    if not resolution_note.strip():
        raise ClaraRolloutError("Resolution note is required.")
    if _SENSITIVE_NOTE.search(resolution_note):
        raise ClaraRolloutError("Resolution note may contain sensitive data.")
    incident.status = "RESOLVED"
    incident.resolved_by_user_id = current_user.id
    incident.resolution_note = resolution_note.strip()[:500]
    incident.resolved_at = datetime.now(timezone.utc)
    add_audit_log(db, action="clara_rollout.incident_resolved", resource_type="clara_rollout_incident", resource_id=str(incident.id), current_user=current_user, metadata={"category": incident.stop_condition_category})
    db.commit()
    return incident


def record_quality_label(db: Session, *, observation_id: UUID, outcome: str, reason_codes: list[str], current_user: User, escalation_expected: bool | None = None, escalation_selected: bool | None = None, customer_movement: str | None = None) -> ClaraRolloutObservation:
    observation = db.get(ClaraRolloutObservation, observation_id)
    if observation is None or observation.organization_id != current_user.organization_id:
        raise ClaraRolloutError("Rollout observation not found.")
    if outcome not in {"APPROVED", "REJECTED"}:
        raise ClaraRolloutError("Quality outcome is invalid.")
    if any(not code or len(code) > 64 or not code.replace("_", "").isalnum() for code in reason_codes):
        raise ClaraRolloutError("Safe reason code is invalid.")
    suggestion = db.get(ReplySuggestion, observation.suggestion_id) if observation.suggestion_id else None
    if customer_movement and (
        suggestion is None
        or db.scalar(select(SentMessage.id).where(SentMessage.reply_suggestion_id == suggestion.id)) is None
    ):
        raise ClaraRolloutError("Customer movement can only label a confirmed sent suggestion.")
    if suggestion and outcome == "APPROVED" and suggestion.final_reply_text:
        original = suggestion.suggested_replies[0].get("text", "") if suggestion.suggested_replies else ""
        observation.normalized_edit_distance = normalized_edit_distance(original, suggestion.final_reply_text)
        observation.reviewer_turnaround_ms = max(0, int((datetime.now(timezone.utc) - suggestion.created_at).total_seconds() * 1000))
    observation.review_outcome = outcome
    observation.reason_codes = sorted(set(observation.reason_codes + reason_codes))
    observation.reviewer_user_id = current_user.id
    observation.escalation_expected = escalation_expected
    observation.escalation_selected = escalation_selected
    observation.customer_movement = customer_movement
    add_audit_log(db, action="clara_rollout.quality_label_recorded", resource_type="clara_rollout_observation", resource_id=str(observation.id), current_user=current_user, metadata={"outcome": outcome, "reason_codes": sorted(set(reason_codes))})
    db.commit()
    db.refresh(observation)
    return observation
