#!/usr/bin/env python3
import argparse
import json
import os
import sys
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = REPOSITORY_ROOT / "clara-backend"
sys.path.insert(0, str(BACKEND_ROOT))
os.environ["APP_ENV"] = "development"
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["JWT_SECRET_KEY"] = "shadow-only-jwt-key-not-used-at-runtime"

if os.environ.get("CLARA_PARITY_BACKEND_ENV") != "1":
    try:
        import sqlalchemy  # noqa: F401
    except ModuleNotFoundError:
        environment = dict(os.environ)
        environment["CLARA_PARITY_BACKEND_ENV"] = "1"
        os.execvpe(
            "uv",
            [
                "uv",
                "run",
                "--project",
                str(BACKEND_ROOT),
                "python",
                str(Path(__file__).resolve()),
                *sys.argv[1:],
            ],
            environment,
        )

from app.services.clara_persona_parity_service import (  # noqa: E402
    build_shadow_report,
    render_shadow_markdown,
)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Inspect Clara persona parity offline without calling an LLM."
    )
    parser.add_argument(
        "--golden",
        type=Path,
        default=BACKEND_ROOT / "tests/golden/clara_mini_v1.json",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=REPOSITORY_ROOT / "tmp",
    )
    parser.add_argument("--include-safe-excerpts", action="store_true")
    args = parser.parse_args()

    report = build_shadow_report(
        args.golden,
        include_safe_excerpts=args.include_safe_excerpts,
    )
    args.output_dir.mkdir(parents=True, exist_ok=True)
    json_path = args.output_dir / "clara-persona-parity.json"
    markdown_path = args.output_dir / "clara-persona-parity.md"
    json_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    markdown_path.write_text(
        render_shadow_markdown(report),
        encoding="utf-8",
    )

    failures = sum(
        bool(record["missing_sections"])
        or bool(record["forbidden_authority_leakage"])
        or record["debug_metadata_exposes_content"]
        for record in report["records"]
    )
    print(
        f"Composed {report['composition_count']} prompts from "
        f"{report['golden_case_count']} safe golden cases; failures={failures}."
    )
    print(f"JSON: {json_path}")
    print(f"Markdown: {markdown_path}")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
