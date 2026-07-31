import json
import re
from collections import Counter
from pathlib import Path


FIXTURE_PATH = Path(__file__).parent / "golden" / "clara_mini_v1.json"
REQUIRED_FIELDS = {
    "id",
    "source",
    "customer_message",
    "conversation_context",
    "account_category",
    "expected_intent",
    "expected_interest_level",
    "expected_process_state",
    "expected_personality_mode",
    "expected_action_mode",
    "required_answer_points",
    "forbidden_claims",
    "expected_handoff",
    "max_reply_characters",
    "notes",
}
SENSITIVE_KEYS = {"email", "phone", "password", "token", "api_key", "secret", "address"}


def test_clara_mini_v1_golden_fixture_schema() -> None:
    cases = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))

    assert isinstance(cases, list)
    assert len(cases) == 20
    assert len({case["id"] for case in cases}) == len(cases)
    assert Counter(case["id"].split("-", 1)[0] for case in cases) == {
        "sales": 4,
        "legality": 3,
        "risk": 3,
        "process": 4,
        "cs": 2,
        "complaint": 3,
        "adversarial": 1,
    }

    for case in cases:
        assert set(case) == REQUIRED_FIELDS
        assert case["customer_message"].strip()
        assert case["source"] in {
            "existing-repo-example",
            "manual-test",
            "synthetic-baseline",
        }
        assert case["account_category"] in {"mini", "regular", "unknown"}
        assert case["expected_interest_level"] in {"COLD", "WARM", "HOT", None}
        assert case["expected_personality_mode"] in {
            "RELAX",
            "TRUST",
            "AUTHORITY",
            "ACTION",
            None,
        }
        assert case["expected_action_mode"] in {
            "normal",
            "human_review",
            "safe_handoff",
            "block",
            None,
        }
        assert isinstance(case["conversation_context"], list)
        assert isinstance(case["required_answer_points"], list)
        assert isinstance(case["forbidden_claims"], list)
        assert case["required_answer_points"] or case["forbidden_claims"]
        assert isinstance(case["expected_handoff"], bool)
        assert 0 < case["max_reply_characters"] <= 500
        assert not (set(case) & SENSITIVE_KEYS)

        serialized = json.dumps(case, ensure_ascii=False)
        assert not re.search(r"\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b", serialized)
        assert not re.search(r"\b(?:\+?62|0)8\d{8,12}\b", serialized)

        if case["id"].startswith("complaint-"):
            assert case["expected_handoff"] is True
            assert case["expected_action_mode"] == "human_review"
