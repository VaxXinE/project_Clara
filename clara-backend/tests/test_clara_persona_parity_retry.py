import json
from pathlib import Path

import pytest

from app.core.clara_runtime_contract import PersonaAuthorityMode
from app.services.clara_reply_retry_service import (
    CLARA_RETRY_CONTRACT_VERSION,
    HYBRID_APPROVED_RETRY_FRAGMENTS,
    LEGACY_RETRY_FRAGMENTS,
    SAFETY_COVERAGE_MATRIX,
    VALIDATOR_RULES,
    RetryCompositionResult,
    compose_plain_json_repair_instructions,
    compose_retry_prompt,
)
from app.services.clara_persona_parity_service import (
    build_shadow_report,
    render_shadow_markdown,
)


ALL_SYSTEM_SECTIONS = frozenset(
    {"instruction", "guardrail", "flow", "personality_mode", "auto_adapt"}
)
VALIDATOR_IDS = (
    "missing_latest_intent",
    "unsupported_fixed_sensitive_number",
    "post_signup_regression",
    "unnecessary_question",
)


def _compose(
    mode: PersonaAuthorityMode,
    *,
    sections: frozenset[str] = ALL_SYSTEM_SECTIONS,
) -> RetryCompositionResult:
    return compose_retry_prompt(
        authority_mode=mode,
        validator_ids=VALIDATOR_IDS,
        desired_count=1,
        available_system_sections=sections,
    )


def test_retry_contract_is_typed_deterministic_and_safe() -> None:
    first = _compose(PersonaAuthorityMode.PERSONA)
    second = _compose(PersonaAuthorityMode.PERSONA)

    assert isinstance(first, RetryCompositionResult)
    assert first.retry_contract_version == CLARA_RETRY_CONTRACT_VERSION == "1.0"
    assert first.validator_ids == VALIDATOR_IDS
    assert first.content_hash == second.content_hash
    assert first.technical_instruction_ids == (
        "valid_json_only",
        "schema_clara_reply_suggestion",
        "reply_count_1",
        "no_markdown",
        "validator_correction_targets",
    )
    metadata = first.debug_metadata()
    assert "content" not in metadata
    assert first.content not in json.dumps(metadata)


def test_validator_registry_is_complete_unique_and_structured() -> None:
    expected_ids = {
        "mixed_register",
        "missing_product_options",
        "unsupported_variant",
        "unnecessary_variant",
        "missing_legality_authority",
        "vague_legality_deflection",
        "missing_legality_risk_boundary",
        "missing_requested_product_fact",
        "unsupported_fixed_sensitive_number",
        "post_signup_regression",
        "repeated_product_selection",
        "repeated_identity_request",
        "abstract_data_requirement",
        "vague_process_direction",
        "repeated_onboarding",
        "followup_topic_break",
        "subject_focus_break",
        "repetitive_closing",
        "response_similarity",
        "insufficient_concrete_detail",
        "missing_latest_intent",
        "generic_opening",
        "unnecessary_question",
        "source_dump_opening",
        "guaranteed_profit_claim",
        "risk_free_claim",
        "specific_buy_sell_instruction",
        "all_in_or_full_margin_instruction",
        "fake_verification_status_access",
        "fake_account_or_fund_status_access",
        "unsupported_refund_or_compensation_promise",
    }
    actual_ids = [rule.validator_id for rule in VALIDATOR_RULES]

    assert len(actual_ids) == len(set(actual_ids))
    assert set(actual_ids) == expected_ids
    assert all(rule.correction_target for rule in VALIDATOR_RULES)
    assert all(rule.canonical_authority_owner.value for rule in VALIDATOR_RULES)


def test_legacy_retry_uses_named_compatibility_fragments() -> None:
    result = _compose(PersonaAuthorityMode.LEGACY)

    assert result.legacy_behavior_present is True
    assert result.behavioral_fragment_names == tuple(
        fragment.name for fragment in LEGACY_RETRY_FRAGMENTS
    )
    assert "LEGACY_RETRY_COMPATIBILITY" in result.content
    assert "Jawab intent terakhir" in result.content
    assert "jangan meminta customer memilih ulang" in result.content
    assert "berikan isi konkret" in result.content


def test_hybrid_retry_only_uses_explicit_missing_section_fallback() -> None:
    complete = _compose(PersonaAuthorityMode.HYBRID)
    assert complete.behavioral_fragment_names == ()
    assert "APPROVED_RETRY_COMPATIBILITY" not in complete.content

    missing_guardrail = _compose(
        PersonaAuthorityMode.HYBRID,
        sections=ALL_SYSTEM_SECTIONS - {"guardrail"},
    )
    assert set(missing_guardrail.behavioral_fragment_names) <= (
        HYBRID_APPROVED_RETRY_FRAGMENTS
    )
    assert missing_guardrail.behavioral_fragment_names == (
        "legacy_retry_legality_grounding",
    )
    assert "APPROVED_RETRY_COMPATIBILITY" in missing_guardrail.content


def test_persona_retry_has_no_python_behavioral_authority() -> None:
    result = _compose(PersonaAuthorityMode.PERSONA)

    assert result.behavioral_fragment_names == ()
    assert result.legacy_behavior_present is False
    assert "CANONICAL_PLAYBOOK_AUTHORITY=" in result.content
    for forbidden in (
        "LEGACY_BEHAVIOR_OVERLAY",
        "APPROVED_LEGACY_COMPATIBILITY",
        "LEGACY_RETRY_COMPATIBILITY",
        "CLOSING dipertahankan",
        "JAWAB",
        "FRAME",
        "DIRECTION",
        "COLD",
        "WARM",
        "HOT",
        "closing strategy",
        "personality selection",
    ):
        assert forbidden not in result.content


@pytest.mark.parametrize("mode", list(PersonaAuthorityMode))
def test_legality_retry_names_the_missing_risk_boundary(
    mode: PersonaAuthorityMode,
) -> None:
    result = compose_retry_prompt(
        authority_mode=mode,
        validator_ids=("missing_legality_risk_boundary",),
        desired_count=1,
        available_system_sections=ALL_SYSTEM_SECTIONS,
    )

    assert (
        "state_that_legal_status_does_not_remove_trading_loss_risk"
        in result.content
    )
    assert "CANONICAL_PLAYBOOK_AUTHORITY=GUARDRAIL" in result.content or (
        mode == PersonaAuthorityMode.LEGACY
        and "legacy_retry_legality_grounding" in result.content
    )


@pytest.mark.parametrize("mode", list(PersonaAuthorityMode))
def test_plain_json_fallback_is_technical_only(
    mode: PersonaAuthorityMode,
) -> None:
    content = compose_plain_json_repair_instructions(1)

    assert mode.value
    assert "valid JSON" in content
    assert "suggested_replies" in content
    for forbidden in (
        "sales",
        "personality",
        "COLD",
        "WARM",
        "HOT",
        "closing",
        "process",
        "product positioning",
    ):
        assert forbidden.lower() not in content.lower()


def test_safety_coverage_matrix_is_controlled_and_honest() -> None:
    expected = {
        "no_guaranteed_profit",
        "no_risk_free_claim",
        "no_invented_product_fact",
        "no_specific_buy_sell_all_in_advice",
        "no_process_regression",
        "no_repeated_verification",
        "no_repeated_onboarding",
        "no_unsupported_fixed_sensitive_number",
        "no_fake_access_to_verification_status",
        "no_unsupported_legal_detail",
    }

    assert {entry.behavior_id for entry in SAFETY_COVERAGE_MATRIX} == expected
    assert all(entry.remaining_gap for entry in SAFETY_COVERAGE_MATRIX)
    fake_access = next(
        entry
        for entry in SAFETY_COVERAGE_MATRIX
        if entry.behavior_id == "no_fake_access_to_verification_status"
    )
    assert fake_access.backend_validator_ids == (
        "fake_verification_status_access",
    )
    assert fake_access.persona_available is True


def test_reply_service_contains_no_anonymous_legacy_retry_block() -> None:
    source = (
        Path(__file__).parents[1] / "app/services/reply_suggestion_service.py"
    ).read_text(encoding="utf-8")

    assert "compose_retry_prompt(" in source
    assert "Pastikan respons retry:" not in source
    assert "JAWAB -> FRAME -> DIRECTION" not in source


def test_golden_shadow_evaluation_is_offline_safe_and_deterministic() -> None:
    golden_path = Path(__file__).parent / "golden/clara_mini_v1.json"

    first = build_shadow_report(golden_path)
    second = build_shadow_report(golden_path)

    assert first == second
    assert first["golden_case_count"] == 20
    assert first["mode_count"] == 3
    assert first["composition_count"] == 60
    assert first["external_api_called"] is False
    assert first["database_write_performed"] is False
    assert all(
        not record["debug_metadata_exposes_content"]
        for record in first["records"]
    )
    assert all(
        not record["forbidden_authority_leakage"]
        for record in first["records"]
        if record["mode"] == PersonaAuthorityMode.PERSONA
    )
    assert all(
        record["technical_shell_present"]
        and record["runtime_context_present"]
        and record["product_fact_injection_present"]
        and record["supporting_knowledge_lower_authority"]
        and record["retry_contract_present"]
        and record["prompt_hash"]
        and record["retry_prompt_hash"]
        for record in first["records"]
    )
    product_hashes_by_case: dict[str, set[str]] = {}
    for record in first["records"]:
        product_hashes_by_case.setdefault(record["case_id"], set()).add(
            record["product_fact_hash"]
        )
    assert all(len(hashes) == 1 for hashes in product_hashes_by_case.values())

    serialized = json.dumps(first, ensure_ascii=False)
    cases = json.loads(golden_path.read_text(encoding="utf-8"))
    assert all(case["customer_message"] not in serialized for case in cases)
    assert "customer_message" not in serialized
    assert "ACTIVE_CUSTOMER_MESSAGE" not in serialized
    assert render_shadow_markdown(first) == render_shadow_markdown(second)
