from hashlib import sha256

import pytest

from app.models.ai_persona_config_version import AIPersonaConfigVersion
from app.services.ai_persona_bundle_service import (
    AIPersonaBundleError,
    RUNTIME_SECTION_ORDER,
    create_bundle_draft,
    publish_bundle,
    validate_bundle,
)
from app.services.clara_evaluation_service import (
    HUMAN_DIMENSIONS,
    ClaraEvaluationError,
    build_safe_report,
    certify_run,
    create_run,
    evaluate_run,
    reconcile_case,
    submit_human_review,
)
from app.services.clara_golden_v2_service import EvaluationProfile, load_golden_v2


def _candidate(db, owner):
    ids = {}
    for key in RUNTIME_SECTION_ORDER:
        content = f"Golden V2 synthetic {key}"
        row = AIPersonaConfigVersion(
            variant="mini",
            section_key=key,
            version_number=1,
            status="draft",
            content=content,
            content_sha256=sha256(content.encode()).hexdigest(),
            created_by_user_id=owner.id,
        )
        db.add(row)
        db.flush()
        ids[key] = row.id
    bundle = create_bundle_draft(db, current_user=owner, section_version_ids=ids)
    validate_bundle(db, bundle_id=bundle.id, current_user=owner)
    return bundle


def test_candidate_evaluation_certification_and_publication_gate(
    db_session_factory, seeded_data
):
    db = db_session_factory()
    owner = seeded_data["owner"]
    bundle = _candidate(db, owner)
    with pytest.raises(AIPersonaBundleError, match="certification"):
        publish_bundle(
            db,
            bundle_id=bundle.id,
            current_user=owner,
            expected_current_bundle_hash=None,
            acknowledged_warning_codes=[],
        )
    run = create_run(
        db,
        bundle_id=bundle.id,
        profile=EvaluationProfile.GOVERNED_OFFLINE_SIMULATION,
        current_user=owner,
    )
    assert bundle.status == "validated"
    run = evaluate_run(
        db,
        run_id=run.id,
        outputs_by_mode=None,
        fixture_mode=True,
        current_user=owner,
    )
    assert run.automated_verdict == "PASS"
    assert len(run.case_results) == 90
    report = build_safe_report(run)
    assert report["contains_customer_content"] is False
    assert report["counts_by_mode"]["PERSONA"]["PASS"] == 30
    assert "reply_text" not in str(report)
    with pytest.raises(ClaraEvaluationError, match="incomplete"):
        certify_run(db, run_id=run.id, current_user=owner)

    cases, _ = load_golden_v2()
    scores = {key: 5 for key in HUMAN_DIMENSIONS}
    reconciled_case_id = None
    for case in cases:
        submit_human_review(
            db,
            run_id=run.id,
            case_id=case["id"],
            scores=scores,
            hard_fail=False,
            reason_codes=["SAFE_SYNTHETIC_REVIEW"],
            safe_note="Synthetic output reviewed.",
            current_user=owner,
        )
        if case["category"] in {"COMPLAINT", "ADVERSARIAL_COMPLIANCE"}:
            second_scores = dict(scores)
            if reconciled_case_id is None:
                second_scores["tone_fit"] = 3
                reconciled_case_id = case["id"]
            submit_human_review(
                db,
                run_id=run.id,
                case_id=case["id"],
                scores=second_scores,
                hard_fail=False,
                reason_codes=["SECOND_REVIEW_COMPLETE"],
                safe_note=None,
                current_user=seeded_data["admin_a"],
            )
    assert reconciled_case_id
    with pytest.raises(ClaraEvaluationError, match="reconciliation"):
        certify_run(db, run_id=run.id, current_user=owner)
    reconcile_case(
        db,
        run_id=run.id,
        case_id=reconciled_case_id,
        reconciled_scores=scores,
        current_user=seeded_data["manager_a"],
    )
    certified = certify_run(db, run_id=run.id, current_user=owner)
    assert certified.status == "CERTIFIED"
    assert certified.report_hash == build_safe_report(certified)["report_hash"]
    certified_hash = bundle.bundle_sha256
    bundle.bundle_sha256 = "0" * 64
    db.commit()
    with pytest.raises(AIPersonaBundleError, match="certification"):
        publish_bundle(
            db,
            bundle_id=bundle.id,
            current_user=owner,
            expected_current_bundle_hash=None,
            acknowledged_warning_codes=[],
        )
    bundle.bundle_sha256 = certified_hash
    db.commit()
    published = publish_bundle(
        db,
        bundle_id=bundle.id,
        current_user=owner,
        expected_current_bundle_hash=None,
        acknowledged_warning_codes=[],
    )
    assert published.status == "published"
    with pytest.raises(ClaraEvaluationError, match="immutable"):
        certify_run(db, run_id=run.id, current_user=owner, reject=True)
    db.close()


def test_new_run_supersedes_unfinished_evidence(db_session_factory, seeded_data):
    db = db_session_factory()
    bundle = _candidate(db, seeded_data["owner"])
    first = create_run(
        db,
        bundle_id=bundle.id,
        profile=EvaluationProfile.GOVERNED_OFFLINE_SIMULATION,
        current_user=seeded_data["owner"],
    )
    second = create_run(
        db,
        bundle_id=bundle.id,
        profile=EvaluationProfile.GOVERNED_OFFLINE_SIMULATION,
        current_user=seeded_data["owner"],
    )
    db.refresh(first)
    assert first.status == "SUPERSEDED"
    assert first.superseded_at is not None
    assert second.status == "DRAFT"
    db.close()


def test_evaluation_api_requires_superadmin_and_csrf(client, seeded_data):
    login = lambda email, password: client.post(  # noqa: E731
        "/auth/login", json={"email": email, "password": password}
    )
    assert login(seeded_data["marketing_a"].email, "MarketingPass123!").status_code == 200
    assert client.get("/clara-evaluations").status_code == 403
    marketing_csrf = client.cookies.get("clara_csrf_token")
    assert client.post(
        "/clara-evaluations/00000000-0000-0000-0000-000000000001/cases/sales-01/reviews",
        json={"scores": {key: 5 for key in HUMAN_DIMENSIONS}},
        headers={"X-CSRF-Token": marketing_csrf},
    ).status_code == 403

    assert login(seeded_data["owner"].email, "OwnerPass123!").status_code == 200
    assert client.get("/clara-evaluations").status_code == 200
    response = client.post(
        "/clara-evaluations",
        json={
            "persona_bundle_id": "00000000-0000-0000-0000-000000000001",
            "configuration_profile": "GOVERNED_OFFLINE_SIMULATION",
        },
    )
    assert response.status_code == 403
    csrf = client.cookies.get("clara_csrf_token")
    response = client.post(
        "/clara-evaluations",
        json={
            "persona_bundle_id": "00000000-0000-0000-0000-000000000001",
            "configuration_profile": "GOVERNED_OFFLINE_SIMULATION",
        },
        headers={"X-CSRF-Token": csrf},
    )
    assert response.status_code == 404


def test_automated_fail_and_human_hard_fail_cannot_certify(
    db_session_factory, seeded_data
):
    db = db_session_factory()
    owner = seeded_data["owner"]
    bundle = _candidate(db, owner)
    run = create_run(
        db,
        bundle_id=bundle.id,
        profile=EvaluationProfile.PRODUCTION_BASELINE,
        current_user=owner,
    )
    run.status = "AUTOMATED_FAIL"
    run.automated_verdict = "FAIL"
    db.commit()
    with pytest.raises(ClaraEvaluationError, match="Automated PASS"):
        certify_run(db, run_id=run.id, current_user=owner)
    db.close()
