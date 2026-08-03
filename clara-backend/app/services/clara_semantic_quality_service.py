import json
import re
from pathlib import Path

from app.core.clara_runtime_contract import PersonaAuthorityMode
from app.services.clara_reply_validation_service import (
    ReplyValidationContext,
    evaluate_reply,
)


CLARA_SEMANTIC_SHADOW_REPORT_VERSION = "1.0"
CTA_PATTERN = re.compile(
    r"\b(silakan|konfirmasi|lanjut(?:kan)?|hubungi|masuk|langkah|cek|tim|petugas)\b|\?",
    re.IGNORECASE,
)
HANDOFF_PATTERN = re.compile(
    r"\b(tim|petugas|pendamping|onboarding|senior|berwenang)\b",
    re.IGNORECASE,
)


def load_semantic_fixture(path: Path) -> dict:
    fixture = json.loads(path.read_text(encoding="utf-8"))
    cases = fixture.get("cases") if isinstance(fixture, dict) else None
    if fixture.get("version") != "1.0" or not isinstance(cases, list):
        raise ValueError("Semantic fixture must use version 1.0 and contain cases.")
    if not cases:
        raise ValueError("Semantic fixture must contain at least one case.")
    return fixture


def build_semantic_shadow_report(fixture_path: Path) -> dict:
    fixture = load_semantic_fixture(fixture_path)
    records = []
    for case in fixture["cases"]:
        context = ReplyValidationContext(**case.get("context", {}))
        expected_critical_ids = set(case.get("expected_critical_ids", []))
        for mode in PersonaAuthorityMode:
            output = case["outputs"][mode.value]
            primary_report = evaluate_reply(output["primary"], context)
            retry_text = output.get("retry")
            retry_report = (
                evaluate_reply(retry_text, context) if retry_text else None
            )
            final_text = retry_text or output["primary"]
            final_report = retry_report or primary_report
            required_markers = tuple(
                marker.lower()
                for marker in case.get("required_answer_markers", [])
            )
            missing_markers = tuple(
                marker
                for marker in required_markers
                if marker not in final_text.lower()
            )
            cta_present = bool(CTA_PATTERN.search(final_text))
            handoff_present = bool(HANDOFF_PATTERN.search(final_text))
            records.append(
                {
                    "case_id": case["case_id"],
                    "mode": mode.value,
                    "primary_failed_validator_ids": list(
                        primary_report.failed_validator_ids
                    ),
                    "primary_critical_failure_ids": list(
                        primary_report.critical_failure_ids
                    ),
                    "retry_failed_validator_ids": (
                        list(retry_report.failed_validator_ids)
                        if retry_report
                        else []
                    ),
                    "retry_critical_failure_ids": (
                        list(retry_report.critical_failure_ids)
                        if retry_report
                        else []
                    ),
                    "unresolved_final_validator_ids": list(
                        final_report.failed_validator_ids
                    ),
                    "unresolved_final_critical_ids": list(
                        final_report.critical_failure_ids
                    ),
                    "expected_critical_claims_detected": sorted(
                        expected_critical_ids
                        & set(primary_report.critical_failure_ids)
                    ),
                    "required_answer_point_coverage": (
                        1.0
                        if not required_markers
                        else round(
                            (len(required_markers) - len(missing_markers))
                            / len(required_markers),
                            4,
                        )
                    ),
                    "missing_required_answer_markers": list(missing_markers),
                    "response_length": len(final_text),
                    "cta_present": cta_present,
                    "cta_expected": bool(case.get("cta_expected")),
                    "cta_mismatch": cta_present
                    != bool(case.get("cta_expected")),
                    "handoff_present": handoff_present,
                    "handoff_expected": bool(case.get("expected_handoff")),
                    "handoff_mismatch": handoff_present
                    != bool(case.get("expected_handoff")),
                    "primary_reply_hash": primary_report.content_hash,
                    "retry_reply_hash": (
                        retry_report.content_hash if retry_report else None
                    ),
                    "final_reply_hash": final_report.content_hash,
                }
            )

    return {
        "report_version": CLARA_SEMANTIC_SHADOW_REPORT_VERSION,
        "fixture_version": fixture["version"],
        "case_count": len(fixture["cases"]),
        "mode_count": len(PersonaAuthorityMode),
        "evaluation_count": len(records),
        "external_api_called": False,
        "database_write_performed": False,
        "records": records,
    }


def render_semantic_shadow_markdown(report: dict) -> str:
    critical = sum(
        bool(record["unresolved_final_critical_ids"])
        for record in report["records"]
    )
    lines = [
        "# Clara Semantic Shadow Quality Report",
        "",
        f"- Report version: {report['report_version']}",
        f"- Fixture cases: {report['case_count']}",
        f"- Modes: {report['mode_count']}",
        f"- Evaluations: {report['evaluation_count']}",
        f"- Final outputs with critical findings: {critical}",
        "- External API called: false",
        "- Database write performed: false",
        "",
        "| Case | Mode | Primary failures | Retry failures | Final critical | Coverage |",
        "|---|---|---:|---:|---:|---:|",
    ]
    for record in report["records"]:
        lines.append(
            f"| {record['case_id']} | {record['mode']} | "
            f"{len(record['primary_failed_validator_ids'])} | "
            f"{len(record['retry_failed_validator_ids'])} | "
            f"{len(record['unresolved_final_critical_ids'])} | "
            f"{record['required_answer_point_coverage']:.2f} |"
        )
    return "\n".join(lines) + "\n"
