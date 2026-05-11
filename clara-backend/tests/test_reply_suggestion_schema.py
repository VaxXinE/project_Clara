from pathlib import Path
import sys

import pytest
from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.schemas.reply_suggestion_schema import ReplySuggestionCreate


def build_reply(tone: str) -> dict[str, str]:
    return {
        "tone": tone,
        "text": f"Draft balasan {tone}",
        "reasoning": f"Alasan draft {tone}",
    }


def test_reply_suggestion_requires_exactly_three_drafts() -> None:
    payload = {
        "suggested_replies": [
            build_reply("friendly"),
            build_reply("professional"),
            build_reply("empathetic"),
        ]
    }

    parsed = ReplySuggestionCreate.model_validate(payload)

    assert len(parsed.suggested_replies) == 3


def test_reply_suggestion_rejects_single_draft() -> None:
    payload = {
        "suggested_replies": [
            build_reply("friendly"),
        ]
    }

    with pytest.raises(ValidationError):
        ReplySuggestionCreate.model_validate(payload)
