from app.core.clara_runtime_contract import (
    ActionMode,
    CLARA_RUNTIME_CONTRACT_VERSION,
    ConversationIntent,
    InterestLevel,
    PersonalityMode,
    ProcessState,
    RUNTIME_AUTHORITY_ORDER,
    SYSTEM_PLAYBOOK_SECTION_ORDER,
    TopLevelRouteIntent,
    normalize_action_mode,
    normalize_conversation_intent,
    normalize_interest_level,
    normalize_personality_mode,
    normalize_process_state,
    normalize_top_level_route_intent,
    runtime_contract_audit_metadata,
)


def test_canonical_runtime_vocabulary_and_authority_order() -> None:
    assert [item.value for item in TopLevelRouteIntent] == [
        "SALES",
        "COMPLIANCE_GENERAL",
        "CS_GENERAL",
        "COMPLAINT",
        "OFF_TOPIC",
        "UNKNOWN",
    ]
    assert [item.value for item in ConversationIntent] == [
        "INFO_SEEKING",
        "LEGALITY_CHECK",
        "RISK_CHECK",
        "COST_CHECK",
        "PRODUCT_FIT_CHECK",
        "PROCESS_CHECK",
        "READINESS_VALIDATION",
        "OBJECTION",
        "CLOSING_SIGNAL",
        "POST_ACTIVATION_SUPPORT",
        "COMPLAINT_OR_PROBLEM",
        "UNKNOWN",
    ]
    assert [item.value for item in InterestLevel] == [
        "COLD",
        "WARM",
        "HOT",
        "UNKNOWN",
    ]
    assert [item.value for item in ProcessState] == [
        "NEW_INQUIRY",
        "EXPLORATION",
        "READY_TO_PROCEED",
        "DATA_SUBMITTED",
        "VERIFICATION_IN_PROGRESS",
        "VERIFIED",
        "ONBOARDING_OR_ACTIVATION",
        "ACCOUNT_ACTIVE",
        "FUNDED",
        "ACTIVE_SUPPORT",
        "UNKNOWN",
    ]
    assert [item.value for item in PersonalityMode] == [
        "RELAX",
        "TRUST",
        "AUTHORITY",
        "ACTION",
    ]
    assert [item.value for item in ActionMode] == [
        "NORMAL",
        "HUMAN_REVIEW",
        "SAFE_HANDOFF",
        "BLOCK",
        "UNKNOWN",
    ]
    assert [item.value for item in RUNTIME_AUTHORITY_ORDER] == [
        "BACKEND_SAFETY_ENFORCEMENT",
        "POLICY_DECISION",
        "FIVE_PUBLISHED_SYSTEM_PLAYBOOKS",
        "STRUCTURED_RUNTIME_STATE",
        "APPROVED_PRODUCT_FACTS",
        "SUPPORTING_KNOWLEDGE",
        "RESPONSE_EXAMPLES",
    ]
    assert [item.value for item in SYSTEM_PLAYBOOK_SECTION_ORDER] == [
        "instruction",
        "guardrail",
        "flow",
        "personality_mode",
        "auto_adapt",
    ]
    assert CLARA_RUNTIME_CONTRACT_VERSION == "1.0"


def test_legacy_and_unknown_values_preserve_original_input() -> None:
    closing = normalize_personality_mode("closing")
    assert closing.canonical_value == "ACTION"
    assert closing.original_value == "closing"
    assert closing.was_normalized is True
    assert closing.is_legacy is True
    assert closing.legacy_signal == "CLOSING"

    delayed = normalize_interest_level("DeLaY")
    assert delayed.canonical_value == "UNKNOWN"
    assert delayed.original_value == "DeLaY"
    assert delayed.is_legacy is True
    assert delayed.legacy_signal == "DELAY"

    unknown = normalize_top_level_route_intent("not-a-route")
    assert unknown.canonical_value == "UNKNOWN"
    assert unknown.original_value == "not-a-route"
    assert unknown.is_unknown is True

    for normalizer in (
        normalize_conversation_intent,
        normalize_interest_level,
        normalize_process_state,
        normalize_personality_mode,
        normalize_action_mode,
    ):
        assert normalizer("not-a-value").canonical_value == "UNKNOWN"


def test_case_and_legacy_action_normalization_do_not_change_api_values() -> None:
    assert normalize_interest_level("warm").canonical_value == "WARM"

    review = normalize_action_mode("human_approval_required")
    assert review.canonical_value == "HUMAN_REVIEW"
    assert review.original_value == "human_approval_required"
    assert review.is_legacy is True

    metadata = runtime_contract_audit_metadata()
    assert metadata == {
        "clara_runtime_contract_version": "1.0",
        "legacy_behavior_overlay": True,
        "legacy_behavior_overlay_name": "LEGACY_BEHAVIOR_OVERLAY",
    }
