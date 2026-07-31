#!/usr/bin/env python3
import argparse
import json
import os
import sys
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = REPOSITORY_ROOT / "clara-backend"
DEFAULT_FIXTURE = BACKEND_ROOT / "tests/golden/clara_semantic_outputs_v1.json"
sys.path.insert(0, str(BACKEND_ROOT))
os.environ["APP_ENV"] = "development"
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["JWT_SECRET_KEY"] = "shadow-only-jwt-key-not-used-at-runtime"

if os.environ.get("CLARA_SEMANTIC_BACKEND_ENV") != "1":
    try:
        import sqlalchemy  # noqa: F401
    except ModuleNotFoundError:
        environment = dict(os.environ)
        environment["CLARA_SEMANTIC_BACKEND_ENV"] = "1"
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

from app.services.clara_semantic_quality_service import (  # noqa: E402
    build_semantic_shadow_report,
    render_semantic_shadow_markdown,
)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Evaluate synthetic Clara replies without prompts or production data."
    )
    parser.add_argument(
        "--input-fixture",
        nargs="?",
        type=Path,
        const=DEFAULT_FIXTURE,
        default=DEFAULT_FIXTURE,
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=REPOSITORY_ROOT / "tmp",
    )
    args = parser.parse_args()

    report = build_semantic_shadow_report(args.input_fixture)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    json_path = args.output_dir / "clara-semantic-quality.json"
    markdown_path = args.output_dir / "clara-semantic-quality.md"
    json_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    markdown_path.write_text(
        render_semantic_shadow_markdown(report),
        encoding="utf-8",
    )
    print(
        f"Evaluated {report['evaluation_count']} synthetic outputs from "
        f"{report['case_count']} cases; external_api_called=false."
    )
    print(f"JSON: {json_path}")
    print(f"Markdown: {markdown_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
