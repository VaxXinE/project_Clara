import sys
from pathlib import Path
from time import perf_counter

from alembic import command
from alembic.config import Config


SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))
sys.path.insert(0, str(SCRIPT_DIR.parent))

from bootstrap_owner import BootstrapError, run_bootstrap
from import_clara_knowledge import KnowledgeImportError, run_import


def get_backend_root() -> Path:
    return SCRIPT_DIR.parent


def get_alembic_config() -> Config:
    backend_root = get_backend_root()
    config = Config(str(backend_root / "alembic.ini"))
    config.set_main_option("script_location", str(backend_root / "alembic"))
    return config


def run_alembic_upgrade() -> str:
    command.upgrade(get_alembic_config(), "heads")
    return "Alembic upgrade heads selesai."


def run_step(step_number: int, total_steps: int, label: str, runner) -> None:
    print(f"[{step_number}/{total_steps}] {label}...", flush=True)
    started_at = perf_counter()
    message = runner()
    elapsed = perf_counter() - started_at
    print(f"[{step_number}/{total_steps}] {label} selesai dalam {elapsed:.2f}s", flush=True)
    if message:
        print(message, flush=True)


def run_setup() -> None:
    run_step(1, 3, "Alembic upgrade", run_alembic_upgrade)
    run_step(2, 3, "Bootstrap superadmin", lambda: run_bootstrap().message)
    run_step(
        3,
        3,
        "Import Clara knowledge",
        lambda: "\n".join(run_import().message_lines),
    )


def main() -> int:
    try:
        run_setup()
    except (BootstrapError, KnowledgeImportError) as exc:
        print(f"Setup lokal gagal: {exc}")
        return 1
    except Exception as exc:  # pragma: no cover - defensive CLI fallback
        print(f"Setup lokal gagal: {exc}")
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
