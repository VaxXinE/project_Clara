from functools import lru_cache
from pathlib import Path


PLAYBOOK_FILES = (
    "instruction.md",
    "GUARDRAIL.md",
    "FLOW.md",
    "PERSONALITY_MODE.md",
    "AUTO_ADAPT.md",
    "CLOSING_ENGINE.md",
)


def get_clara_knowledge_dir() -> Path:
    return Path(__file__).resolve().parents[3] / "clara_knowledge"


def read_markdown_file(path: Path) -> str:
    if not path.exists():
        return ""

    return path.read_text(encoding="utf-8").strip()


@lru_cache(maxsize=1)
def load_clara_response_playbook() -> str:
    knowledge_dir = get_clara_knowledge_dir()
    sections: list[str] = []

    for filename in PLAYBOOK_FILES:
        file_path = knowledge_dir / filename
        content = read_markdown_file(file_path)

        if not content:
            continue

        sections.append(f"## {filename}\n{content}")

    return "\n\n".join(sections).strip()

