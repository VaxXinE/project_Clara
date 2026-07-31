import json

import pytest

from app.core.clara_runtime_contract import (
    PersonaAuthorityMode,
    SystemPlaybookSection,
    normalize_persona_authority_mode,
    runtime_contract_audit_metadata,
)
from app.core.config import Settings, settings
from app.services.clara_legacy_behavior_service import (
    LEGACY_PRODUCT_FACT_INJECTION,
    TECHNICAL_SHELL_VERSION,
    build_authority_debug_metadata,
    build_legacy_product_fact_injection,
    build_runtime_context_block,
    build_technical_prompt_shell,
    compose_authority_system_prompt,
    get_legacy_behavior_fragments,
)


SYSTEM_SECTION_NAMES = frozenset(section.value for section in SystemPlaybookSection)
CONTROLLED_SYSTEM_PLAYBOOK = """
## INSTRUCTION
PERSONA INSTRUCTION
## GUARDRAIL
no guaranteed profit; no invented product fact; no risk-free claim
## FLOW
no process regression; no repeated onboarding; no repeated verification
## PERSONALITY_MODE
RELAX TRUST AUTHORITY ACTION
## AUTO_ADAPT
COLD WARM HOT
""".strip()


def _compose(
    mode: PersonaAuthorityMode,
    *,
    available_sections: frozenset[str] = SYSTEM_SECTION_NAMES,
):
    return compose_authority_system_prompt(
        mode=mode,
        technical_shell=build_technical_prompt_shell(
            mode=mode,
            policy_action="auto_draft_only",
            desired_count=1,
        ),
        runtime_context=build_runtime_context_block(
            latest_customer_intent="minimum_capital",
            preferred_reply_register="natural",
            answer_commitment_level="direct_answer_first",
            variant_response_mode="mini",
            customer_has_variant_commitment=True,
            conversation_variant_focus="mini",
            customer_has_identity_submission=False,
            customer_has_verification_completion=True,
        ),
        product_fact_injection=build_legacy_product_fact_injection("mini"),
        system_playbook=CONTROLLED_SYSTEM_PLAYBOOK,
        available_system_sections=available_sections,
    )


def test_persona_authority_mode_normalization_and_default(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    assert Settings.model_fields["clara_persona_authority_mode"].default == "LEGACY"

    for raw, expected in (
        ("legacy", "LEGACY"),
        ("LEGACY", "LEGACY"),
        ("HyBrId", "HYBRID"),
        ("persona", "PERSONA"),
    ):
        result = normalize_persona_authority_mode(raw)
        assert result.canonical_value == expected
        assert result.original_value == raw
        assert result.is_unknown is False

    for raw in ("invalid", None):
        result = normalize_persona_authority_mode(raw)
        assert result.canonical_value == "LEGACY"
        assert result.original_value == raw
        assert result.is_unknown is True

    monkeypatch.setattr(settings, "clara_persona_authority_mode", "HYBRID")
    assert runtime_contract_audit_metadata()["legacy_behavior_overlay"] is False


def test_legacy_fragments_are_typed_deterministic_and_behavior_only() -> None:
    fragments = get_legacy_behavior_fragments()

    assert [fragment.section for fragment in fragments] == list(
        SystemPlaybookSection
    )
    assert len(fragments) == 5
    assert [fragment.name for fragment in fragments] == [
        "legacy_instruction_role",
        "legacy_guardrail_safety",
        "legacy_flow_movement",
        "legacy_personality_chat",
        "legacy_auto_adapt",
    ]
    assert [fragment.content_hash for fragment in fragments] == [
        fragment.content_hash for fragment in get_legacy_behavior_fragments()
    ]

    combined = "\n".join(fragment.content for fragment in fragments)
    for forbidden in (
        "Rp5",
        "BAPPEBTI",
        "SOLID PRIME",
        "latest_customer",
        "action_mode=",
        "JSON",
    ):
        assert forbidden not in combined


def test_legacy_hybrid_and_persona_composition_boundaries() -> None:
    legacy = _compose(PersonaAuthorityMode.LEGACY)
    assert legacy.legacy_overlay_present is True
    assert len(legacy.included_fragments) == 5
    assert legacy.content.index("TECHNICAL_OUTPUT_CONTRACT") < legacy.content.index(
        "RUNTIME_CONTEXT"
    )
    assert legacy.content.index(LEGACY_PRODUCT_FACT_INJECTION) < legacy.content.index(
        "LEGACY_BEHAVIOR_OVERLAY"
    )
    assert legacy.content.index("LEGACY_BEHAVIOR_OVERLAY") < legacy.content.index(
        "PLAYBOOK INTI WAJIB"
    )
    assert "Rp5.000.000" in legacy.content
    assert "CLOSING dipertahankan hanya sebagai legacy alias" in legacy.content
    legacy_markers = {
        marker
        for fragment in legacy.included_fragments
        for marker in fragment.semantic_markers
    }
    assert {
        "no_guaranteed_profit",
        "no_invented_fact",
        "no_risk_free_claim",
        "no_process_regression",
        "no_repeated_onboarding",
        "no_repeated_verification",
    } <= legacy_markers

    hybrid = _compose(PersonaAuthorityMode.HYBRID)
    assert hybrid.legacy_overlay_present is False
    assert hybrid.included_fragments == ()
    assert hybrid.content.index("FIVE_SYSTEM_PLAYBOOKS") < hybrid.content.index(
        "RUNTIME_CONTEXT"
    )
    assert "LEGACY_BEHAVIOR_OVERLAY" not in hybrid.content
    assert "CLOSING" not in hybrid.content
    assert "ACTION" in hybrid.content
    assert "Rp5.000.000" in hybrid.content

    hybrid_missing_guardrail = _compose(
        PersonaAuthorityMode.HYBRID,
        available_sections=SYSTEM_SECTION_NAMES - {"guardrail"},
    )
    assert [
        fragment.name for fragment in hybrid_missing_guardrail.included_fragments
    ] == ["legacy_guardrail_safety"]
    assert "APPROVED_LEGACY_COMPATIBILITY" in hybrid_missing_guardrail.content

    persona = _compose(PersonaAuthorityMode.PERSONA)
    assert persona.included_fragments == ()
    assert persona.legacy_overlay_present is False
    assert "LEGACY_BEHAVIOR_OVERLAY" not in persona.content
    assert "APPROVED_LEGACY_COMPATIBILITY" not in persona.content
    assert "CLOSING" not in persona.content
    assert persona.content.index("INSTRUCTION") < persona.content.index("GUARDRAIL")
    assert persona.content.index("GUARDRAIL") < persona.content.index("FLOW")
    assert persona.content.index("FLOW") < persona.content.index("PERSONALITY_MODE")
    assert persona.content.index("PERSONALITY_MODE") < persona.content.index(
        "AUTO_ADAPT"
    )
    assert "TECHNICAL_OUTPUT_CONTRACT" in persona.content
    assert "RUNTIME_CONTEXT" in persona.content
    assert LEGACY_PRODUCT_FACT_INJECTION in persona.content
    assert "Rp5.000.000" in persona.content
    assert "no guaranteed profit" in persona.content
    assert "no process regression" in persona.content


def test_authority_debug_metadata_is_safe_and_hash_is_deterministic() -> None:
    authority_prompt = _compose(PersonaAuthorityMode.PERSONA)
    playbook_metadata = {
        "active_system_sections": [
            {
                "section_name": "instruction",
                "effective_source": "MARKDOWN_FALLBACK",
                "content_hash": "abc",
            }
        ],
        "supporting_knowledge_count": 2,
        "response_example_count": 1,
        "legacy_overlay_present": False,
    }
    kwargs = {
        "authority_prompt": authority_prompt,
        "user_prompt": "CUSTOMER PRIVATE MESSAGE",
        "playbook_metadata": playbook_metadata,
        "mode_original_value": "persona",
        "mode_was_normalized": True,
    }

    first = build_authority_debug_metadata(**kwargs)
    second = build_authority_debug_metadata(**kwargs)

    assert first["persona_authority_mode"] == "PERSONA"
    assert first["technical_shell_version"] == TECHNICAL_SHELL_VERSION
    assert first["included_legacy_fragment_names"] == []
    assert first["supporting_playbook_count"] == 2
    assert first["response_example_count"] == 1
    assert first["prompt_content_hash"] == second["prompt_content_hash"]
    debug_json = json.dumps(first)
    assert "CUSTOMER PRIVATE MESSAGE" not in debug_json
    assert CONTROLLED_SYSTEM_PLAYBOOK not in debug_json
