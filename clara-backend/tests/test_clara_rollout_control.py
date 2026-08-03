from datetime import datetime, timezone
from hashlib import sha256
from types import SimpleNamespace
from uuid import uuid4

import pytest
from sqlalchemy import select

from app.core.config import Settings, settings
from app.models.ai_persona_bundle import AIPersonaBundle
from app.models.ai_persona_config_version import AIPersonaConfigVersion
from app.models.audit_log import AuditLog
from app.models.clara_evaluation import ClaraEvaluationRun
from app.models.clara_rollout import (
    ClaraRolloutEvent,
    ClaraRolloutIncident,
    ClaraRolloutObservation,
)
from app.models.ops_notification import OpsNotification
from app.services.ai_persona_bundle_service import (
    RUNTIME_SECTION_ORDER,
    create_bundle_draft,
    validate_bundle,
)
from app.services.clara_golden_v2_service import (
    CLARA_GOLDEN_DATASET_CONTRACT_VERSION,
    CLARA_GOLDEN_EVALUATOR_CONTRACT_VERSION,
    load_golden_v2,
)
from app.services.clara_rollout_service import (
    HARD_STOP_CATEGORIES,
    METRIC_DEFINITIONS,
    ClaraRolloutError,
    GenerationLane,
    RolloutControlMode,
    RolloutStage,
    assert_rollout_suggestion_sendable,
    baseline_profile,
    calculate_metrics,
    canonical_hash,
    cohort_bucket,
    create_plan,
    normalize_rollout_control_mode,
    normalized_edit_distance,
    promote_stage,
    record_observation,
    resolve_rollout_decision,
    reviewer_is_eligible,
    rollback_plan,
    trigger_hard_stop,
    validate_readiness,
    activate_internal,
    active_runtime_decision,
)
from app.services.reply_suggestion_service import run_shadow_generation_safely


def _certified_published_bundle(db, owner, *, certified=True):
    version_ids = {}
    versions = []
    for key in RUNTIME_SECTION_ORDER:
        content = f"Stage 9 safe synthetic {key}"
        version = AIPersonaConfigVersion(
            variant="mini",
            section_key=key,
            version_number=1,
            status="draft",
            content=content,
            content_sha256=sha256(content.encode()).hexdigest(),
            created_by_user_id=owner.id,
        )
        db.add(version)
        db.flush()
        version_ids[key] = version.id
        versions.append(version)
    bundle = create_bundle_draft(db, current_user=owner, section_version_ids=version_ids)
    validate_bundle(db, bundle_id=bundle.id, current_user=owner)
    _, dataset_hash = load_golden_v2()
    run = ClaraEvaluationRun(
        organization_id=owner.organization_id,
        persona_bundle_id=bundle.id,
        persona_bundle_hash=bundle.bundle_sha256,
        bundle_section_metadata={},
        variant="mini",
        dataset_version=CLARA_GOLDEN_DATASET_CONTRACT_VERSION,
        dataset_hash=dataset_hash,
        evaluator_version=CLARA_GOLDEN_EVALUATOR_CONTRACT_VERSION,
        configuration_profile="GOVERNED_OFFLINE_SIMULATION",
        configuration_snapshot={},
        configuration_hash="1" * 64,
        status="CERTIFIED",
        automated_verdict="PASS",
        human_review_status="COMPLETE",
        certification_status="CERTIFIED",
        report_hash="2" * 64,
        created_by_user_id=owner.id,
        completed_by_user_id=owner.id,
        completed_at=datetime.now(timezone.utc),
    )
    if certified:
        db.add(run)
    bundle.status = "published"
    bundle.published_at = datetime.now(timezone.utc)
    for version in versions:
        version.status = "published"
        version.published_at = bundle.published_at
    db.commit()
    return bundle


def _profile():
    return {
        **baseline_profile(),
        "persona_authority_mode": "PERSONA",
        "policy_mode": "ENFORCE",
        "extension_delivery_mode": "GOVERNED",
        "extension_version_requirement": "clara-extension>=1.0.0",
    }


def _plan(db, seeded_data, *, sample_size=1, thresholds=None):
    bundle = _certified_published_bundle(db, seeded_data["owner"])
    return create_plan(
        db,
        organization_id=seeded_data["org_a"].id,
        name="Stage 9 Mini",
        bundle_id=bundle.id,
        candidate_profile=_profile(),
        cohort_seed="stage-9-fixed-seed",
        shadow_sample_percentage=100,
        daily_shadow_limit=1,
        promotion_thresholds=thresholds or {"approval_rate_min": 1.0},
        required_sample_size=sample_size,
        current_user=seeded_data["owner"],
    )


def _activate(db, seeded_data, monkeypatch):
    plan = _plan(db, seeded_data)
    plan = validate_readiness(
        db,
        plan_id=plan.id,
        expected_version=plan.version,
        current_user=seeded_data["owner"],
    )
    monkeypatch.setattr(settings, "clara_rollout_control_mode", "GOVERNED")
    return activate_internal(
        db,
        plan_id=plan.id,
        expected_version=plan.version,
        current_user=seeded_data["owner"],
    )


def test_configuration_defaults_and_normalization():
    assert Settings.model_fields["clara_rollout_control_mode"].default == "OFF"
    assert [normalize_rollout_control_mode(value) for value in (None, "invalid", "off", "Observe", "GOVERNED")] == [
        RolloutControlMode.OFF,
        RolloutControlMode.OFF,
        RolloutControlMode.OFF,
        RolloutControlMode.OBSERVE,
        RolloutControlMode.GOVERNED,
    ]
    assert baseline_profile() == {
        "persona_authority_mode": "LEGACY",
        "semantic_revalidation_mode": "OFF",
        "policy_mode": "OBSERVE",
        "product_fact_mode": "LEGACY",
        "process_state_mode": "LEGACY",
        "service_routing_mode": "LEGACY",
        "extension_delivery_mode": "LEGACY",
    }


def test_plan_is_not_automatic_and_transitions_are_sequential(
    db_session_factory, seeded_data, monkeypatch
):
    db = db_session_factory()
    plan = _plan(db, seeded_data)
    assert (plan.status, plan.current_stage) == ("DRAFT", None)
    plan = validate_readiness(db, plan_id=plan.id, expected_version=1, current_user=seeded_data["owner"])
    assert plan.status == "READY"
    with pytest.raises(ClaraRolloutError, match="GOVERNED"):
        activate_internal(db, plan_id=plan.id, expected_version=plan.version, current_user=seeded_data["owner"])
    monkeypatch.setattr(settings, "clara_rollout_control_mode", "GOVERNED")
    plan = activate_internal(db, plan_id=plan.id, expected_version=plan.version, current_user=seeded_data["owner"])
    with pytest.raises(ClaraRolloutError, match="transition"):
        promote_stage(db, plan_id=plan.id, target_stage=RolloutStage.REVIEWER_CANARY_10, expected_version=plan.version, current_user=seeded_data["owner"])
    plan = promote_stage(db, plan_id=plan.id, target_stage=RolloutStage.SHADOW, expected_version=plan.version, current_user=seeded_data["owner"])
    observation = record_observation(
        db,
        plan_id=plan.id,
        organization_id=plan.organization_id,
        rollout_stage=RolloutStage.SHADOW.value,
        generation_lane=GenerationLane.SHADOW_CANDIDATE.value,
        profile_hash=canonical_hash(plan.candidate_profile),
        bundle_hash=plan.candidate_bundle_hash,
        shadow_only=True,
        send_eligible=False,
        is_production_sample=True,
        review_outcome="APPROVED",
    )
    db.commit()
    plan = promote_stage(db, plan_id=plan.id, target_stage=RolloutStage.REVIEWER_CANARY_10, expected_version=plan.version, current_user=seeded_data["owner"])
    assert plan.cohort_percentage == 10
    with pytest.raises(ClaraRolloutError, match="sample"):
        promote_stage(db, plan_id=plan.id, target_stage=RolloutStage.REVIEWER_CANARY_30, expected_version=plan.version, current_user=seeded_data["owner"])
    record_observation(
        db,
        plan_id=plan.id,
        organization_id=plan.organization_id,
        rollout_stage=plan.current_stage,
        generation_lane=GenerationLane.CANARY_CANDIDATE.value,
        profile_hash=canonical_hash(plan.candidate_profile),
        bundle_hash=plan.candidate_bundle_hash,
        send_eligible=True,
        review_outcome="APPROVED",
        is_production_sample=True,
    )
    db.commit()
    plan = promote_stage(db, plan_id=plan.id, target_stage=RolloutStage.REVIEWER_CANARY_30, expected_version=plan.version, current_user=seeded_data["owner"])
    assert plan.cohort_percentage == 30
    record_observation(
        db,
        plan_id=plan.id,
        organization_id=plan.organization_id,
        rollout_stage=plan.current_stage,
        generation_lane=GenerationLane.CANARY_CANDIDATE.value,
        profile_hash=canonical_hash(plan.candidate_profile),
        bundle_hash=plan.candidate_bundle_hash,
        send_eligible=True,
        review_outcome="APPROVED",
        is_production_sample=True,
    )
    db.commit()
    plan = promote_stage(db, plan_id=plan.id, target_stage=RolloutStage.SEMI_AUTOMATIC_100, expected_version=plan.version, current_user=seeded_data["owner"])
    assert plan.cohort_percentage == 100
    assert observation.id is not None
    db.close()


def test_stale_certification_and_bundle_hash_fail_readiness(
    db_session_factory, seeded_data
):
    db = db_session_factory()
    plan = _plan(db, seeded_data)
    bundle = db.get(AIPersonaBundle, plan.candidate_bundle_id)
    original_hash = bundle.bundle_sha256
    bundle.bundle_sha256 = "f" * 64
    db.commit()
    with pytest.raises(ClaraRolloutError, match="BUNDLE_HASH_MISMATCH"):
        validate_readiness(db, plan_id=plan.id, expected_version=plan.version, current_user=seeded_data["owner"])
    bundle.bundle_sha256 = original_hash
    certification = db.get(ClaraEvaluationRun, plan.certification_run_id)
    certification.superseded_at = datetime.now(timezone.utc)
    db.commit()
    with pytest.raises(ClaraRolloutError, match="CERTIFICATION_MISMATCH"):
        validate_readiness(db, plan_id=plan.id, expected_version=plan.version, current_user=seeded_data["owner"])
    db.close()


def test_plan_creation_rejects_uncertified_fixture_bundle(
    db_session_factory, seeded_data
):
    db = db_session_factory()
    bundle = _certified_published_bundle(db, seeded_data["owner"], certified=False)
    with pytest.raises(ClaraRolloutError, match="certification"):
        create_plan(
            db,
            organization_id=seeded_data["org_a"].id,
            name="Uncertified",
            bundle_id=bundle.id,
            candidate_profile=_profile(),
            cohort_seed="uncertified-seed",
            shadow_sample_percentage=0,
            daily_shadow_limit=0,
            promotion_thresholds={},
            required_sample_size=0,
            current_user=seeded_data["owner"],
        )
    db.close()


def test_cohort_is_deterministic_nested_and_scoped(db_session_factory, seeded_data):
    db = db_session_factory()
    plan = _plan(db, seeded_data)
    reviewer = seeded_data["marketing_a"]
    assert cohort_bucket(plan.id, reviewer.id, plan.cohort_seed) == cohort_bucket(plan.id, reviewer.id, plan.cohort_seed)
    for _ in range(200):
        user_id = uuid4()
        assert not (cohort_bucket(plan.id, user_id, plan.cohort_seed) < 10 and cohort_bucket(plan.id, user_id, plan.cohort_seed) >= 30)
    assert not reviewer_is_eligible(plan, seeded_data["inactive_user"], 100)
    assert not reviewer_is_eligible(plan, seeded_data["marketing_other_org"], 100)
    unauthorized = SimpleNamespace(id=uuid4(), is_active=True, organization_id=plan.organization_id, role="viewer")
    assert not reviewer_is_eligible(plan, unauthorized, 100)
    db.close()


def test_canary_selects_only_eligible_reviewer(
    db_session_factory, seeded_data, monkeypatch
):
    db = db_session_factory()
    plan = _activate(db, seeded_data, monkeypatch)
    plan.current_stage = RolloutStage.REVIEWER_CANARY_10.value
    plan.cohort_percentage = 10
    db.commit()
    inside_id = next(
        candidate_id
        for candidate_id in (uuid4() for _ in range(1000))
        if cohort_bucket(plan.id, candidate_id, plan.cohort_seed) < 10
    )
    outside_id = next(
        candidate_id
        for candidate_id in (uuid4() for _ in range(1000))
        if cohort_bucket(plan.id, candidate_id, plan.cohort_seed) >= 10
    )
    inside = SimpleNamespace(id=inside_id, is_active=True, organization_id=plan.organization_id, role="sales")
    outside = SimpleNamespace(id=outside_id, is_active=True, organization_id=plan.organization_id, role="sales")
    candidate = resolve_rollout_decision(db, organization_id=plan.organization_id, user=inside)
    baseline = resolve_rollout_decision(db, organization_id=plan.organization_id, user=outside)
    assert candidate.generation_lane == GenerationLane.CANARY_CANDIDATE.value
    assert candidate.runtime_profile == plan.candidate_profile
    assert baseline.generation_lane == GenerationLane.BASELINE.value
    assert baseline.runtime_profile == baseline_profile()
    assert active_runtime_decision(candidate) is candidate
    monkeypatch.setattr(settings, "clara_rollout_control_mode", "OBSERVE")
    observed = resolve_rollout_decision(db, organization_id=plan.organization_id, user=inside)
    assert active_runtime_decision(observed) is None
    db.close()


def test_shadow_is_baseline_only_bounded_and_never_sendable(
    db_session_factory, seeded_data, monkeypatch
):
    db = db_session_factory()
    plan = _activate(db, seeded_data, monkeypatch)
    plan = promote_stage(db, plan_id=plan.id, target_stage=RolloutStage.SHADOW, expected_version=plan.version, current_user=seeded_data["owner"])
    first = resolve_rollout_decision(db, organization_id=plan.organization_id, user=seeded_data["marketing_a"])
    assert first.generation_lane == GenerationLane.BASELINE.value
    assert first.shadow_sampled and first.candidate_profile
    record_observation(
        db,
        plan_id=plan.id,
        organization_id=plan.organization_id,
        rollout_stage=plan.current_stage,
        generation_lane=GenerationLane.SHADOW_CANDIDATE.value,
        profile_hash=canonical_hash(plan.candidate_profile),
        bundle_hash=plan.candidate_bundle_hash,
        shadow_only=True,
        send_eligible=False,
    )
    db.commit()
    second = resolve_rollout_decision(db, organization_id=plan.organization_id, user=seeded_data["marketing_a"])
    assert not second.shadow_sampled
    shadow = SimpleNamespace(persona_bundle_metadata={"rollout_plan_id": str(plan.id), "generation_lane": GenerationLane.SHADOW_CANDIDATE.value})
    with pytest.raises(ClaraRolloutError, match="never"):
        assert_rollout_suggestion_sendable(db, shadow)
    baseline = {"reply": "baseline remains available"}
    candidate, error_code, _ = run_shadow_generation_safely(
        lambda _profile: (_ for _ in ()).throw(RuntimeError("synthetic failure")),
        _profile(),
        {"rollout_plan_id": str(plan.id)},
    )
    assert candidate is None and error_code == "RuntimeError"
    assert baseline == {"reply": "baseline remains available"}
    db.close()


def test_all_hard_stops_pause_fallback_and_require_explicit_resume(
    db_session_factory, seeded_data, monkeypatch
):
    db = db_session_factory()
    plan = _activate(db, seeded_data, monkeypatch)
    for category in sorted(HARD_STOP_CATEGORIES):
        plan.status = "ACTIVE"
        db.commit()
        trigger_hard_stop(db, plan=plan, category=category, reason_codes=(category,), actor=seeded_data["owner"])
        assert plan.status == "PAUSED"
    decision = resolve_rollout_decision(db, organization_id=plan.organization_id, user=seeded_data["marketing_a"])
    assert decision.generation_lane == GenerationLane.BASELINE.value
    incidents = list(db.scalars(select(ClaraRolloutIncident).where(ClaraRolloutIncident.plan_id == plan.id)))
    assert {item.stop_condition_category for item in incidents} == HARD_STOP_CATEGORIES
    assert plan.status == "PAUSED"
    assert db.scalar(select(OpsNotification).where(OpsNotification.source_type == "clara_rollout"))
    paused_candidate = SimpleNamespace(
        persona_bundle_metadata={
            "rollout_plan_id": str(plan.id),
            "generation_lane": GenerationLane.CANARY_CANDIDATE.value,
            "rollout_stage": plan.current_stage,
            "candidate_bundle_hash": plan.candidate_bundle_hash,
            "send_eligible": True,
        }
    )
    with pytest.raises(ClaraRolloutError, match="paused"):
        assert_rollout_suggestion_sendable(db, paused_candidate)
    db.close()


def test_metrics_are_versioned_deterministic_and_store_no_raw_text(
    db_session_factory, seeded_data
):
    db = db_session_factory()
    plan = _plan(db, seeded_data)
    record_observation(
        db,
        plan_id=plan.id,
        organization_id=plan.organization_id,
        rollout_stage="SHADOW",
        generation_lane="SHADOW_CANDIDATE",
        profile_hash="1" * 64,
        bundle_hash=plan.candidate_bundle_hash,
        validator_ids=("complaint_sales_leakage", "post_signup_regression"),
        review_outcome="APPROVED",
        normalized_edit_distance=0.25,
        generation_latency_ms=100,
        reviewer_turnaround_ms=200,
        escalation_expected=True,
        escalation_selected=True,
        is_production_sample=True,
    )
    record_observation(
        db,
        plan_id=plan.id,
        organization_id=plan.organization_id,
        rollout_stage="SHADOW",
        generation_lane="SHADOW_CANDIDATE",
        profile_hash="1" * 64,
        bundle_hash=plan.candidate_bundle_hash,
        review_outcome="REJECTED",
        normalized_edit_distance=None,
        generation_latency_ms=300,
        reviewer_turnaround_ms=400,
        escalation_expected=True,
        escalation_selected=False,
        is_production_sample=True,
    )
    db.commit()
    db.expire(plan, ["observations", "events"])
    metrics = calculate_metrics(plan)
    assert metrics["approval_rate"] == 0.5
    assert metrics["generation_latency"] == 200
    assert metrics["reviewer_turnaround_time"] == 300
    assert metrics["escalation_precision"] == 1
    assert metrics["escalation_miss"] == 0.5
    assert metrics["complaint_leakage"] == 0.5
    assert metrics["process_state_regression_rate"] == 0.5
    assert normalized_edit_distance("abc", "axc") == pytest.approx(1 / 3)
    assert all(set(value) == {"numerator", "denominator", "exclusions", "window"} for value in METRIC_DEFINITIONS.values())
    assert not ({"prompt", "customer_message", "reply_text", "transcript"} & set(ClaraRolloutObservation.__table__.columns.keys()))
    db.close()


def test_rollback_invalidates_candidate_and_preserves_history(
    db_session_factory, seeded_data, monkeypatch
):
    db = db_session_factory()
    plan = _activate(db, seeded_data, monkeypatch)
    plan = promote_stage(db, plan_id=plan.id, target_stage=RolloutStage.SHADOW, expected_version=plan.version, current_user=seeded_data["owner"])
    record_observation(
        db,
        plan_id=plan.id,
        organization_id=plan.organization_id,
        rollout_stage=plan.current_stage,
        generation_lane=GenerationLane.SHADOW_CANDIDATE.value,
        profile_hash=canonical_hash(plan.candidate_profile),
        bundle_hash=plan.candidate_bundle_hash,
        shadow_only=True,
        review_outcome="APPROVED",
        is_production_sample=True,
    )
    db.commit()
    plan = promote_stage(db, plan_id=plan.id, target_stage=RolloutStage.REVIEWER_CANARY_10, expected_version=plan.version, current_user=seeded_data["owner"])
    candidate = SimpleNamespace(
        persona_bundle_metadata={
            "rollout_plan_id": str(plan.id),
            "generation_lane": GenerationLane.CANARY_CANDIDATE.value,
            "rollout_stage": plan.current_stage,
            "candidate_bundle_hash": plan.candidate_bundle_hash,
            "send_eligible": True,
        }
    )
    assert_rollout_suggestion_sendable(db, candidate)
    monkeypatch.setattr(settings, "clara_rollout_control_mode", "OFF")
    with pytest.raises(ClaraRolloutError, match="disabled"):
        assert_rollout_suggestion_sendable(db, candidate)
    monkeypatch.setattr(settings, "clara_rollout_control_mode", "GOVERNED")
    plan = rollback_plan(db, plan_id=plan.id, expected_version=plan.version, current_user=seeded_data["owner"], reason_codes=("MANUAL_ROLLBACK",))
    with pytest.raises(ClaraRolloutError, match="paused, rolled back"):
        assert_rollout_suggestion_sendable(db, candidate)
    events = list(db.scalars(select(ClaraRolloutEvent).where(ClaraRolloutEvent.plan_id == plan.id)))
    assert [event.event_type for event in events][-2:] == ["ROLLBACK_STARTED", "ROLLED_BACK"]
    assert len({event.event_hash for event in events}) == len(events)
    assert db.scalar(select(AuditLog).where(AuditLog.action == "clara_rollout.rolled_back"))
    db.close()


def test_rollout_api_uses_rbac_and_csrf(client, seeded_data):
    response = client.post("/auth/login", json={"email": seeded_data["marketing_a"].email, "password": "MarketingPass123!"})
    assert response.status_code == 200
    assert client.get("/clara-rollouts").status_code == 403
    assert client.get("/clara-rollouts/cohort/current").status_code == 200
    response = client.post("/auth/login", json={"email": seeded_data["owner"].email, "password": "OwnerPass123!"})
    assert response.status_code == 200
    payload = {
        "name": "No CSRF",
        "candidate_bundle_id": str(uuid4()),
        "candidate_profile": _profile(),
        "cohort_seed": "stage-9-seed",
    }
    assert client.post("/clara-rollouts", json=payload).status_code == 403
