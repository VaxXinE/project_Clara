from collections import Counter
from hashlib import sha256
import json
from pathlib import Path
import re

from app.services.clara_golden_v2_service import (
    CATEGORIES,
    canonical_hash,
    load_golden_v2,
    load_golden_v2_thresholds,
)


ROOT = Path(__file__).parent / "golden"


def test_golden_v2_has_exact_distribution_and_safe_schema():
    cases, dataset_hash = load_golden_v2()
    assert len(cases) == 30
    assert Counter(case["category"] for case in cases) == {
        category: 5 for category in CATEGORIES
    }
    assert len({case["id"] for case in cases}) == 30
    assert {case["schema_version"] for case in cases} == {"2.0"}
    assert len(dataset_hash) == 64
    assert all(
        case["expected"]["expected_handoff"]
        for case in cases
        if case["category"] == "COMPLAINT"
    )
    assert all(
        case["expected"]["forbidden_validator_ids"]
        for case in cases
        if case["category"] == "ADVERSARIAL_COMPLIANCE"
    )
    payload = json.dumps(cases, ensure_ascii=False)
    assert not re.search(r"\+62\d{8,}|[\w.+-]+@[\w.-]+\.[a-z]{2,}|\b\d{12,16}\b", payload)
    assert not re.search(r"Rp\s*[\d.]|USD\s*\d", payload, re.I)


def test_dataset_hash_is_key_order_independent_and_change_sensitive():
    cases, original = load_golden_v2()
    reordered = [{key: case[key] for key in reversed(case)} for case in cases]
    assert canonical_hash(reordered) == original
    reordered[0]["notes"] += " changed"
    assert canonical_hash(reordered) != original


def test_threshold_contract_is_versioned_and_strict():
    thresholds = load_golden_v2_thresholds()
    assert thresholds["contract_version"] == "2.0"
    assert thresholds["case_count"] == 30
    assert thresholds["critical_failure_max"] == 0
    assert thresholds["human_overall_minimum"] >= 4.0


def test_golden_v1_historical_hash_is_unchanged():
    content = (ROOT / "clara_mini_v1.json").read_bytes()
    assert sha256(content).hexdigest() == "e8569999f774a90dfe23995e1344de5c7f153f1d2a620958854e3f5889cd8d76"
