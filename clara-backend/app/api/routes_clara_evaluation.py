from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.db.session import get_db
from app.models.user import User
from app.schemas.clara_evaluation_schema import (
    CertificationDecisionRequest,
    EvaluationExecuteRequest,
    EvaluationRunCreateRequest,
    HumanReviewRequest,
    ReconcileReviewRequest,
)
from app.services.clara_evaluation_service import (
    ClaraEvaluationError,
    build_safe_report,
    certify_run,
    create_run,
    evaluate_run,
    get_run_or_raise,
    get_valid_certification,
    list_runs,
    reconcile_case,
    submit_human_review,
)
from app.services.clara_golden_v2_service import EvaluationProfile
from app.models.ai_persona_bundle import AIPersonaBundle


router = APIRouter(prefix="/clara-evaluations", tags=["clara-evaluations"])


def _error(exc: ClaraEvaluationError) -> HTTPException:
    return HTTPException(
        status_code=(
            status.HTTP_404_NOT_FOUND
            if "not found" in str(exc).lower()
            else status.HTTP_409_CONFLICT
        ),
        detail=str(exc),
    )


def _serialize_run(run) -> dict:
    return {
        "id": run.id,
        "persona_bundle_id": run.persona_bundle_id,
        "persona_bundle_hash": run.persona_bundle_hash,
        "bundle_section_metadata": run.bundle_section_metadata,
        "variant": run.variant,
        "dataset_version": run.dataset_version,
        "dataset_hash": run.dataset_hash,
        "evaluator_version": run.evaluator_version,
        "configuration_profile": run.configuration_profile,
        "configuration_hash": run.configuration_hash,
        "status": run.status,
        "automated_verdict": run.automated_verdict,
        "critical_failure_count": run.critical_failure_count,
        "review_required_count": run.review_required_count,
        "passed_case_count": run.passed_case_count,
        "failed_case_count": run.failed_case_count,
        "human_review_status": run.human_review_status,
        "human_review_count": len(run.human_reviews),
        "certification_status": run.certification_status,
        "report_hash": run.report_hash,
        "created_at": run.created_at,
        "completed_at": run.completed_at,
        "superseded_at": run.superseded_at,
    }


@router.get("")
def list_runs_endpoint(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("superadmin")),
):
    return [_serialize_run(run) for run in list_runs(db)]


@router.get("/{run_id}")
def get_run_endpoint(
    run_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("superadmin")),
):
    try:
        return _serialize_run(get_run_or_raise(db, run_id))
    except ClaraEvaluationError as exc:
        raise _error(exc) from exc


@router.get("/{run_id}/cases")
def get_case_findings_endpoint(
    run_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("superadmin")),
):
    try:
        run = get_run_or_raise(db, run_id)
    except ClaraEvaluationError as exc:
        raise _error(exc) from exc
    return [
        {
            "case_id": item.case_id,
            "category": item.category,
            "authority_mode": item.authority_mode,
            "output_hash": item.output_hash,
            "automated_verdict": item.automated_verdict,
            "structural_match": item.structural_match,
            "findings": item.findings,
            "review_count": sum(
                review.case_id == item.case_id for review in run.human_reviews
            ),
        }
        for item in run.case_results
    ]


@router.get("/{run_id}/report")
def get_safe_report_endpoint(
    run_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("superadmin")),
):
    try:
        return build_safe_report(get_run_or_raise(db, run_id))
    except ClaraEvaluationError as exc:
        raise _error(exc) from exc


@router.post("", status_code=status.HTTP_201_CREATED)
def create_run_endpoint(
    payload: EvaluationRunCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("superadmin")),
):
    try:
        run = create_run(
            db,
            bundle_id=payload.persona_bundle_id,
            profile=EvaluationProfile(payload.configuration_profile),
            current_user=current_user,
        )
    except ClaraEvaluationError as exc:
        raise _error(exc) from exc
    return _serialize_run(run)


@router.post("/{run_id}/evaluate")
def evaluate_run_endpoint(
    run_id: UUID,
    payload: EvaluationExecuteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("superadmin")),
):
    try:
        run = evaluate_run(
            db,
            run_id=run_id,
            outputs_by_mode=payload.outputs_by_mode,
            fixture_mode=payload.fixture_mode,
            current_user=current_user,
        )
    except ClaraEvaluationError as exc:
        raise _error(exc) from exc
    return _serialize_run(run)


@router.post("/{run_id}/cases/{case_id}/reviews", status_code=201)
def submit_review_endpoint(
    run_id: UUID,
    case_id: str,
    payload: HumanReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("superadmin")),
):
    try:
        review = submit_human_review(
            db,
            run_id=run_id,
            case_id=case_id,
            scores=payload.scores,
            hard_fail=payload.hard_fail,
            reason_codes=payload.reason_codes,
            safe_note=payload.safe_note,
            current_user=current_user,
        )
    except ClaraEvaluationError as exc:
        raise _error(exc) from exc
    return {
        "id": review.id,
        "case_id": review.case_id,
        "average_score": review.average_score,
        "reconciliation_status": review.reconciliation_status,
    }


@router.post("/{run_id}/cases/{case_id}/reconcile")
def reconcile_endpoint(
    run_id: UUID,
    case_id: str,
    payload: ReconcileReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("superadmin")),
):
    try:
        return _serialize_run(
            reconcile_case(
                db,
                run_id=run_id,
                case_id=case_id,
                reconciled_scores=payload.reconciled_scores,
                current_user=current_user,
            )
        )
    except ClaraEvaluationError as exc:
        raise _error(exc) from exc


@router.post("/{run_id}/certification")
def certification_endpoint(
    run_id: UUID,
    payload: CertificationDecisionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("superadmin")),
):
    try:
        run = certify_run(
            db,
            run_id=run_id,
            current_user=current_user,
            reject=payload.decision == "REJECT",
        )
    except ClaraEvaluationError as exc:
        raise _error(exc) from exc
    return _serialize_run(run)


@router.get("/bundles/{bundle_id}/certification")
def bundle_certification_endpoint(
    bundle_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("superadmin")),
):
    bundle = db.get(AIPersonaBundle, bundle_id)
    if bundle is None:
        raise HTTPException(status_code=404, detail="Persona bundle not found.")
    run = get_valid_certification(db, bundle)
    return {
        "certified": run is not None,
        "run": _serialize_run(run) if run else None,
        "bundle_hash_match": bool(run and run.persona_bundle_hash == bundle.bundle_sha256),
        "message": "Certification is not production activation.",
    }
