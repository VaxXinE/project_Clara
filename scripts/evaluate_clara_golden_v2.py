#!/usr/bin/env python3
import argparse
import json
import os
from pathlib import Path
import re
import sys
from uuid import UUID


ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "clara-backend"
sys.path.insert(0, str(BACKEND))
os.environ.setdefault("APP_ENV", "development")
os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("JWT_SECRET_KEY", "golden-v2-offline-only-key")

try:
    from app.services.clara_golden_v2_service import (  # noqa: E402
        build_fixture_output,
        evaluate_output_matrix,
        evaluate_fixture_matrix,
        load_golden_v2,
    )
except ModuleNotFoundError as exc:
    if exc.name != "pydantic":
        raise
    os.execvp(
        "uv",
        ["uv", "run", "--project", str(BACKEND), "python", __file__, *sys.argv[1:]],
    )


REVIEW_DIMENSIONS = (
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
SAFE_EXPORT_BLOCK = re.compile(
    r"(?:\+62\d{8,}|[\w.+-]+@[\w.-]+\.[a-z]{2,}|\b\d{12,16}\b|password|otp|token|api.?key)",
    re.IGNORECASE,
)


def render_markdown(report: dict) -> str:
    return (
        "# Clara Golden V2 Fixture Report\n\n"
        f"- Run ID: `{report['run_id']}`\n"
        f"- Dataset: `{report['dataset_version']}` / `{report['dataset_hash']}`\n"
        f"- Evaluator: `{report['evaluator_version']}`\n"
        f"- Cases: {report['case_count']}\n"
        f"- Modes: {report['mode_count']}\n"
        f"- Passed: {report['passed']}\n"
        f"- Failed: {report['failed']}\n"
        f"- Critical failures: {len(report['critical_failure_ids'])}\n"
        f"- Report hash: `{report['report_hash']}`\n\n"
        "Fixture execution uses deterministic synthetic outputs and makes no external call.\n"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Run Clara Golden V2 safely offline.")
    parser.add_argument("--output-dir", type=Path, default=ROOT / "tmp/golden-v2")
    parser.add_argument("--bundle-id", type=UUID)
    parser.add_argument("--bundle-hash")
    parser.add_argument("--allow-external-model", action="store_true")
    parser.add_argument("--outputs-file", type=Path)
    parser.add_argument("--provider-id")
    parser.add_argument("--model-id")
    args = parser.parse_args()
    if args.outputs_file and not args.allow_external_model:
        parser.error("--outputs-file requires explicit --allow-external-model")
    if args.allow_external_model and not (
        args.outputs_file and args.provider_id and args.model_id
    ):
        parser.error(
            "Controlled external evaluation requires --outputs-file, --provider-id, "
            "and --model-id. This runner never calls a provider itself."
        )
    outputs = None
    if args.outputs_file:
        outputs = json.loads(args.outputs_file.read_text(encoding="utf-8"))
        report = evaluate_output_matrix(
            outputs_by_mode=outputs,
            persona_bundle_id=args.bundle_id,
            persona_bundle_hash=args.bundle_hash,
            provider_id=args.provider_id,
            model_id=args.model_id,
        )
    else:
        report = evaluate_fixture_matrix(
            persona_bundle_id=args.bundle_id,
            persona_bundle_hash=args.bundle_hash,
        )
    args.output_dir.mkdir(parents=True, exist_ok=True)
    json_path = args.output_dir / "clara-golden-v2-report.json"
    markdown_path = args.output_dir / "clara-golden-v2-report.md"
    review_path = args.output_dir / "clara-golden-v2-human-review.json"
    json_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    markdown_path.write_text(render_markdown(report), encoding="utf-8")
    cases, _ = load_golden_v2()
    persona_results = {
        item["case_id"]: item
        for item in report["results"]
        if item["authority_mode"] == "PERSONA"
    }
    review_pack = []
    for case in cases:
        result = persona_results[case["id"]]
        output = (
            outputs["PERSONA"][case["id"]]
            if outputs
            else build_fixture_output(case).model_dump()
        )
        unsafe = (
            result["sensitive_data_detected"]
            or result["prompt_leakage_detected"]
            or SAFE_EXPORT_BLOCK.search(output["reply_text"])
        )
        review_pack.append(
            {
                "case_id": case["id"],
                "category": case["category"],
                "synthetic_customer_message": case["customer_message"],
                "required_answer_points": case["expected"]["required_answer_points"],
                "reply_text": "[REDACTED_UNSAFE_OUTPUT]" if unsafe else output["reply_text"],
                "automated_reason_codes": result["reason_codes"],
                "scores": {dimension: None for dimension in REVIEW_DIMENSIONS},
                "safe_note": None,
            }
        )
    review_path.write_text(
        json.dumps(review_pack, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(
        f"Golden V2 fixture: cases={report['case_count']} modes={report['mode_count']} "
        f"passed={report['passed']} failed={report['failed']} hash={report['report_hash']}"
    )
    return 1 if report["failed"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
