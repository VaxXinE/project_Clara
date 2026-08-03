from __future__ import annotations

from datetime import datetime, timezone
import json
import re
from statistics import mean
from uuid import UUID

from sqlalchemy import desc, select
from sqlalchemy.orm import Session, selectinload

from app.models.ai_persona_bundle import AIPersonaBundle
from app.models.clara_evaluation import (
    ClaraEvaluationCaseResult,
    ClaraEvaluationHumanReview,
    ClaraEvaluationRun,
)
from app.models.user import User
from app.services.audit_service import add_audit_log
from app.services.clara_golden_v2_service import (
    CLARA_GOLDEN_DATASET_CONTRACT_VERSION,
    CLARA_GOLDEN_EVALUATOR_CONTRACT_VERSION,
    PROFILES,
    EvaluationOutput,
    EvaluationProfile,
    build_fixture_output,
    canonical_hash,
    evaluate_case,
    load_golden_v2,
    load_golden_v2_thresholds,
)


HUMAN_DIMENSIONS = (
    "factual_correctness",
    "directness",
    "relevance",
    "trust",
    "risk_transparency",
    "process_continuity",
    "tone_fit",
    "cta_appropriateness",
    "operational_usefulness",
    "compliance_safety",
)
CRITICAL_REVIEW_CATEGORIES = {"COMPLAINT", "ADVERSARIAL_COMPLIANCE"}
_SAFE_REASON_CODE = re.compile(r"^[A-Z][A-Z0-9_]{0,63}$")
_SENSITIVE_NOTE = re.compile(
    r"(?:\+62\d{8,}|[\w.+-]+@[\w.-]+\.[a-z]{2,}|\b\d{12,16}\b|password|otp|token|api.?key)",
    re.IGNORECASE,
)


class ClaraEvaluationError(RuntimeError):
    pass


def _run_query():
    return (
        select(ClaraEvaluationRun)
        .options(
            selectinload(ClaraEvaluationRun.case_results),
            selectinload(ClaraEvaluationRun.human_reviews),
        )
        .execution_options(populate_existing=True)
    )


def get_run_or_raise(db: Session, run_id: UUID, *, for_update: bool = False):
    query = _run_query().where(ClaraEvaluationRun.id == run_id)
    if for_update:
        query = query.with_for_update()
    run = db.scalars(query).first()
    if run is None:
        raise ClaraEvaluationError("Evaluation run not found.")
    return run


def list_runs(db: Session) -> list[ClaraEvaluationRun]:
    return list(db.scalars(_run_query().order_by(desc(ClaraEvaluationRun.created_at))).all())


def build_safe_report(run: ClaraEvaluationRun) -> dict:
    by_mode: dict[str, dict[str, int]] = {}
    by_category: dict[str, dict[str, int]] = {}
    reason_counts: dict[str, int] = {}
    critical_ids: set[str] = set()
    for result in run.case_results:
        mode = by_mode.setdefault(result.authority_mode, {"PASS": 0, "FAIL": 0, "ERROR": 0})
        mode[result.automated_verdict] = mode.get(result.automated_verdict, 0) + 1
        category = by_category.setdefault(result.category, {"PASS": 0, "FAIL": 0, "ERROR": 0})
        category[result.automated_verdict] = category.get(result.automated_verdict, 0) + 1
        for code in result.findings.get("reason_codes", []):
            reason_counts[code] = reason_counts.get(code, 0) + 1
        critical_ids.update(result.findings.get("critical_validator_ids", []))
    review_averages = [float(review.average_score) for review in run.human_reviews]
    payload = {
        "run_id": str(run.id),
        "persona_bundle_id": str(run.persona_bundle_id),
        "persona_bundle_hash": run.persona_bundle_hash,
        "dataset_version": run.dataset_version,
        "dataset_hash": run.dataset_hash,
        "evaluator_version": run.evaluator_version,
        "configuration_profile": run.configuration_profile,
        "configuration_hash": run.configuration_hash,
        "status": run.status,
        "automated_verdict": run.automated_verdict,
        "certification_status": run.certification_status,
        "counts_by_mode": by_mode,
        "counts_by_category": by_category,
        "reason_code_counts": dict(sorted(reason_counts.items())),
        "critical_failure_ids": sorted(critical_ids),
        "process_regression_count": reason_counts.get("PROCESS_REGRESSION", 0),
        "complaint_leakage_count": sum(
            item.findings.get("category") == "COMPLAINT"
            and "complaint_sales_leakage" in item.findings.get("critical_validator_ids", [])
            for item in run.case_results
        ),
        "factual_correction_count": reason_counts.get("MISSING_REQUIRED_FACT_KEYS", 0)
        + reason_counts.get("UNSUPPORTED_FACT_KEYS", 0),
        "sensitive_data_detection_count": sum(
            bool(item.findings.get("sensitive_data_detected")) for item in run.case_results
        ),
        "prompt_leakage_count": sum(
            bool(item.findings.get("prompt_leakage_detected")) for item in run.case_results
        ),
        "human_review_count": len(run.human_reviews),
        "human_score_summary": {
            "average": round(mean(review_averages), 2) if review_averages else None,
            "minimum": min(review_averages) if review_averages else None,
        },
        "reconciliation_statuses": sorted(
            {review.reconciliation_status for review in run.human_reviews}
        ),
        "contains_customer_content": False,
        "note": "Certification is not production activation.",
    }
    payload["report_hash"] = canonical_hash(payload)
    return payload


def _bundle_metadata(bundle: AIPersonaBundle) -> dict:
    if bundle.status != "validated" or bundle.validation_status != "valid":
        raise ClaraEvaluationError("Candidate bundle must be validated and unpublished.")
    if len(bundle.sections) != 5 or not bundle.bundle_sha256:
        raise ClaraEvaluationError("Candidate bundle is incomplete.")
    return {
        item.section_key: {
            "version_id": str(item.persona_config_version_id),
            "content_sha256": item.content_sha256,
        }
        for item in sorted(bundle.sections, key=lambda row: row.position)
    }


def create_run(
    db: Session,
    *,
    bundle_id: UUID,
    profile: EvaluationProfile,
    current_user: User,
) -> ClaraEvaluationRun:
    bundle = db.get(AIPersonaBundle, bundle_id)
    if bundle is None:
        raise ClaraEvaluationError("Persona bundle not found.")
    metadata = _bundle_metadata(bundle)
    _, dataset_hash = load_golden_v2()
    config = PROFILES[profile]
    now = datetime.now(timezone.utc)
    prior_runs = db.scalars(
        select(ClaraEvaluationRun).where(
            ClaraEvaluationRun.persona_bundle_id == bundle.id,
            ClaraEvaluationRun.status.in_(
                {"DRAFT", "RUNNING", "AUTOMATED_PASS", "AUTOMATED_FAIL", "HUMAN_REVIEW_PENDING"}
            ),
        )
    ).all()
    for prior in prior_runs:
        prior.status = "SUPERSEDED"
        prior.superseded_at = now
    run = ClaraEvaluationRun(
        organization_id=current_user.organization_id,
        persona_bundle_id=bundle.id,
        persona_bundle_hash=bundle.bundle_sha256,
        bundle_section_metadata=metadata,
        variant="mini",
        dataset_version=CLARA_GOLDEN_DATASET_CONTRACT_VERSION,
        dataset_hash=dataset_hash,
        evaluator_version=CLARA_GOLDEN_EVALUATOR_CONTRACT_VERSION,
        configuration_profile=profile.value,
        configuration_snapshot={
            key: (value.value if hasattr(value, "value") else value)
            for key, value in config.__dict__.items()
        },
        configuration_hash=config.configuration_hash,
        status="DRAFT",
        created_by_user_id=current_user.id,
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


def evaluate_run(
    db: Session,
    *,
    run_id: UUID,
    outputs_by_mode: dict[str, dict[str, dict]] | None,
    fixture_mode: bool,
    current_user: User,
) -> ClaraEvaluationRun:
    run = get_run_or_raise(db, run_id, for_update=True)
    if run.status != "DRAFT":
        raise ClaraEvaluationError("Only a draft run can be evaluated.")
    bundle = db.get(AIPersonaBundle, run.persona_bundle_id)
    _, current_dataset_hash = load_golden_v2()
    if bundle is None or bundle.bundle_sha256 != run.persona_bundle_hash:
        raise ClaraEvaluationError("Bundle hash changed; create a new run.")
    if current_dataset_hash != run.dataset_hash:
        raise ClaraEvaluationError("Dataset hash changed; create a new run.")

    cases, _ = load_golden_v2()
    run.status = "RUNNING"
    db.flush()
    results = []
    for mode in ("LEGACY", "HYBRID", "PERSONA"):
        for case in cases:
            if fixture_mode:
                output = build_fixture_output(case)
            else:
                try:
                    output = EvaluationOutput.model_validate(
                        (outputs_by_mode or {})[mode][case["id"]]
                    )
                except (KeyError, ValueError) as exc:
                    raise ClaraEvaluationError(
                        f"Missing or invalid output for {mode}:{case['id']}."
                    ) from exc
            result = evaluate_case(
                run_id=run.id,
                case=case,
                output=output,
                authority_mode=mode,
                dataset_hash=run.dataset_hash,
                persona_bundle_id=run.persona_bundle_id,
                persona_bundle_hash=run.persona_bundle_hash,
            )
            findings = result.as_dict()
            findings.pop("evaluated_at")
            findings.pop("output_hash")
            findings = json.loads(json.dumps(findings, default=str))
            db.add(
                ClaraEvaluationCaseResult(
                    evaluation_run_id=run.id,
                    case_id=case["id"],
                    category=case["category"],
                    authority_mode=mode,
                    output_hash=result.output_hash,
                    automated_verdict=result.automated_verdict,
                    structural_match=result.structural_match,
                    findings=findings,
                    evaluated_at=result.evaluated_at,
                )
            )
            results.append(result)
    failures = [result for result in results if result.automated_verdict == "FAIL"]
    errors = [result for result in results if result.automated_verdict == "ERROR"]
    run.critical_failure_count = sum(bool(item.critical_validator_ids) for item in results)
    run.failed_case_count = len(failures)
    run.passed_case_count = sum(item.automated_verdict == "PASS" for item in results)
    run.review_required_count = sum(
        item.automated_verdict == "REVIEW_REQUIRED" for item in results
    )
    run.automated_verdict = "FAIL" if failures or errors else "PASS"
    run.status = "AUTOMATED_FAIL" if failures or errors else "HUMAN_REVIEW_PENDING"
    run.human_review_status = "PENDING"
    report_core = {
        "run_id": str(run.id),
        "bundle_hash": run.persona_bundle_hash,
        "dataset_hash": run.dataset_hash,
        "evaluator_version": run.evaluator_version,
        "configuration_hash": run.configuration_hash,
        "passed": run.passed_case_count,
        "failed": run.failed_case_count,
        "critical": run.critical_failure_count,
    }
    run.report_hash = canonical_hash(report_core)
    run.completed_by_user_id = current_user.id
    run.completed_at = datetime.now(timezone.utc)
    db.commit()
    db.expire(run, ["case_results", "human_reviews"])
    return get_run_or_raise(db, run.id)


def submit_human_review(
    db: Session,
    *,
    run_id: UUID,
    case_id: str,
    scores: dict[str, int],
    hard_fail: bool,
    reason_codes: list[str],
    safe_note: str | None,
    current_user: User,
) -> ClaraEvaluationHumanReview:
    run = get_run_or_raise(db, run_id, for_update=True)
    if run.status not in {"HUMAN_REVIEW_PENDING", "AUTOMATED_PASS"}:
        raise ClaraEvaluationError("Run is not open for human review.")
    if set(scores) != set(HUMAN_DIMENSIONS) or any(
        type(value) is not int or value < 1 or value > 5 for value in scores.values()
    ):
        raise ClaraEvaluationError("All ten review dimensions require scores from 1 to 5.")
    if any(not _SAFE_REASON_CODE.fullmatch(code) for code in reason_codes):
        raise ClaraEvaluationError("Human review reason codes are invalid.")
    if safe_note and _SENSITIVE_NOTE.search(safe_note):
        raise ClaraEvaluationError("Human review note may contain sensitive data.")
    persona_result = next(
        (
            item
            for item in run.case_results
            if item.case_id == case_id and item.authority_mode == "PERSONA"
        ),
        None,
    )
    if persona_result is None:
        raise ClaraEvaluationError("PERSONA case result not found.")
    if db.scalar(
        select(ClaraEvaluationHumanReview.id).where(
            ClaraEvaluationHumanReview.evaluation_run_id == run.id,
            ClaraEvaluationHumanReview.case_id == case_id,
            ClaraEvaluationHumanReview.reviewer_user_id == current_user.id,
        )
    ):
        raise ClaraEvaluationError("Reviewer already scored this case.")
    review = ClaraEvaluationHumanReview(
        evaluation_run_id=run.id,
        case_id=case_id,
        category=persona_result.category,
        reviewer_user_id=current_user.id,
        scores=scores,
        average_score=f"{mean(scores.values()):.2f}",
        hard_fail=hard_fail,
        reason_codes=sorted(set(reason_codes)),
        safe_note=(safe_note or "").strip()[:500] or None,
    )
    db.add(review)
    run.human_review_status = "IN_PROGRESS"
    db.commit()
    db.refresh(review)
    return review


def reconcile_case(
    db: Session,
    *,
    run_id: UUID,
    case_id: str,
    reconciled_scores: dict[str, int],
    current_user: User,
) -> ClaraEvaluationRun:
    run = get_run_or_raise(db, run_id, for_update=True)
    reviews = [item for item in run.human_reviews if item.case_id == case_id]
    if len(reviews) < 2:
        raise ClaraEvaluationError("Two reviews are required before reconciliation.")
    if current_user.id in {item.reviewer_user_id for item in reviews}:
        raise ClaraEvaluationError("A conflicting reviewer cannot reconcile their own case.")
    if set(reconciled_scores) != set(HUMAN_DIMENSIONS) or any(
        type(value) is not int or value < 1 or value > 5
        for value in reconciled_scores.values()
    ):
        raise ClaraEvaluationError("Reconciliation requires all dimensions from 1 to 5.")
    for review in reviews:
        review.reconciliation_status = "RECONCILED"
        review.reconciled_scores = reconciled_scores
    db.commit()
    return get_run_or_raise(db, run.id)


def certify_run(
    db: Session, *, run_id: UUID, current_user: User, reject: bool = False
) -> ClaraEvaluationRun:
    run = get_run_or_raise(db, run_id, for_update=True)
    if run.status == "CERTIFIED":
        if reject:
            raise ClaraEvaluationError("Certification is immutable.")
        return run
    if reject:
        run.status = "REJECTED"
        run.certification_status = "REJECTED"
        run.completed_by_user_id = current_user.id
        run.completed_at = datetime.now(timezone.utc)
        db.commit()
        return get_run_or_raise(db, run.id)
    if run.status != "HUMAN_REVIEW_PENDING" or run.automated_verdict != "PASS":
        raise ClaraEvaluationError("Automated PASS is required for certification.")
    cases, dataset_hash = load_golden_v2()
    thresholds = load_golden_v2_thresholds()
    bundle = db.get(AIPersonaBundle, run.persona_bundle_id)
    if (
        bundle is None
        or bundle.bundle_sha256 != run.persona_bundle_hash
        or dataset_hash != run.dataset_hash
        or run.evaluator_version != CLARA_GOLDEN_EVALUATOR_CONTRACT_VERSION
        or run.superseded_at is not None
    ):
        raise ClaraEvaluationError("Certification evidence is stale or superseded.")
    reviews_by_case: dict[str, list[ClaraEvaluationHumanReview]] = {}
    for review in run.human_reviews:
        reviews_by_case.setdefault(review.case_id, []).append(review)
    for case in cases:
        reviews = reviews_by_case.get(case["id"], [])
        required = 2 if case["category"] in CRITICAL_REVIEW_CATEGORIES else 1
        if len(reviews) < required:
            raise ClaraEvaluationError("Human review is incomplete.")
        if any(review.hard_fail for review in reviews):
            raise ClaraEvaluationError("Human hard fail rejects certification.")
        effective_scores = [review.reconciled_scores or review.scores for review in reviews]
        if any(
            min(scores.values()) < thresholds["human_dimension_minimum"]
            or mean(scores.values()) < thresholds["human_overall_minimum"]
            for scores in effective_scores
        ):
            raise ClaraEvaluationError("Human score threshold is not met.")
        if case["category"] in CRITICAL_REVIEW_CATEGORIES and any(
            scores["compliance_safety"]
            != thresholds["critical_category_compliance_safety"]
            for scores in effective_scores
        ):
            raise ClaraEvaluationError("Compliance safety must be 5 for critical cases.")
        if len(reviews) >= 2 and any(
            abs(reviews[0].scores[key] - reviews[1].scores[key]) > 1
            for key in HUMAN_DIMENSIONS
        ) and not all(item.reconciliation_status == "RECONCILED" for item in reviews):
            raise ClaraEvaluationError("Reviewer disagreement requires reconciliation.")
    run.status = "CERTIFIED"
    run.human_review_status = "COMPLETE"
    run.certification_status = "CERTIFIED"
    run.completed_by_user_id = current_user.id
    run.completed_at = datetime.now(timezone.utc)
    run.report_hash = build_safe_report(run)["report_hash"]
    add_audit_log(
        db,
        action="clara_evaluation.certify",
        resource_type="clara_evaluation_run",
        resource_id=str(run.id),
        current_user=current_user,
        metadata={
            "bundle_id": str(run.persona_bundle_id),
            "bundle_hash": run.persona_bundle_hash,
            "dataset_hash": run.dataset_hash,
            "evaluator_version": run.evaluator_version,
            "report_hash": run.report_hash,
        },
    )
    db.commit()
    return get_run_or_raise(db, run.id)


def get_valid_certification(db: Session, bundle: AIPersonaBundle):
    candidate_ids = [bundle.id]
    if bundle.source_bundle_id and bundle.source_type == "rollback":
        candidate_ids.append(bundle.source_bundle_id)
    _, dataset_hash = load_golden_v2()
    return db.scalars(
        select(ClaraEvaluationRun)
        .where(
            ClaraEvaluationRun.persona_bundle_id.in_(candidate_ids),
            ClaraEvaluationRun.persona_bundle_hash == bundle.bundle_sha256,
            ClaraEvaluationRun.dataset_hash == dataset_hash,
            ClaraEvaluationRun.evaluator_version
            == CLARA_GOLDEN_EVALUATOR_CONTRACT_VERSION,
            ClaraEvaluationRun.status == "CERTIFIED",
            ClaraEvaluationRun.certification_status == "CERTIFIED",
            ClaraEvaluationRun.superseded_at.is_(None),
        )
        .order_by(desc(ClaraEvaluationRun.completed_at))
    ).first()


def assert_bundle_certified_for_publication(db: Session, bundle: AIPersonaBundle):
    certification = get_valid_certification(db, bundle)
    if certification is None:
        raise ClaraEvaluationError(
            "A current Golden V2 certification is required before Mini publication."
        )
    return certification
