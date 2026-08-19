from pathlib import Path
from datetime import datetime, timezone

import pytest

from app.core.config import Settings, settings
from app.core.clara_runtime_contract import ActionMode
from app.models.ai_extraction import AIExtraction
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.reply_suggestion import ReplySuggestion
from app.schemas.reply_suggestion_schema import (
    ApproveReplyRequest,
    ReplySuggestionCreate,
)
from app.services.clara_policy_enforcement_service import (
    CLARA_ENFORCEMENT_CONTRACT_VERSION,
    ClaraEnforcementError,
    GenerationStrategy,
    PolicyEnforcementMode,
    ReviewerRequirement,
    assert_suggestion_can_be_approved,
    assert_suggestion_can_be_sent,
    classify_safe_handoff_category,
    critical_validator_ids_for_text,
    decide_enforcement,
    normalize_policy_enforcement_mode,
)
from app.services.clara_safe_handoff_service import (
    SafeHandoffCategory,
    build_safe_handoff,
)
from app.services.extension_ingest_service import (
    ExtensionSnapshotError,
    build_extension_reply_suggestions_response,
    confirm_extension_reply_sent_for_channel,
)
from app.schemas.extension_schema import ExtensionSnapshotSyncResponse
from app.services.reply_suggestion_service import (
    ReplySuggestionError,
    approve_reply_suggestion,
    create_reply_suggestion,
)


def test_enforcement_contract_is_deterministic_and_safe() -> None:
    first = decide_enforcement(
        legacy_policy_action="auto_draft_only",
        policy_risk_level="low",
        critical_validator_ids=("guaranteed_profit_claim",),
    )
    second = decide_enforcement(
        legacy_policy_action="auto_draft_only",
        policy_risk_level="low",
        critical_validator_ids=("guaranteed_profit_claim",),
    )

    assert first.enforcement_contract_version == CLARA_ENFORCEMENT_CONTRACT_VERSION
    assert first.decision_hash == second.decision_hash
    assert first.action_mode == ActionMode.BLOCK
    metadata = first.debug_metadata()
    assert "customer_message" not in metadata
    assert "reply" not in metadata
    assert "prompt" not in metadata


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("OFF", PolicyEnforcementMode.OFF),
        ("observe", PolicyEnforcementMode.OBSERVE),
        (" EnFoRcE ", PolicyEnforcementMode.ENFORCE),
        (None, PolicyEnforcementMode.OBSERVE),
        ("invalid", PolicyEnforcementMode.OBSERVE),
    ],
)
def test_enforcement_mode_normalization(raw, expected) -> None:
    resolution = normalize_policy_enforcement_mode(raw)
    assert resolution.mode == expected
    assert resolution.original_value == raw


def test_enforcement_defaults_remain_rollout_safe() -> None:
    assert Settings.model_fields["clara_policy_enforcement_mode"].default == "OBSERVE"
    assert Settings.model_fields["clara_persona_authority_mode"].default == "LEGACY"
    assert Settings.model_fields["clara_semantic_revalidation_mode"].default == "OFF"


def test_policy_precedence_is_deterministic() -> None:
    security = decide_enforcement(
        legacy_policy_action="auto_draft_only",
        policy_risk_level="low",
        latest_customer_message="Saya rugi dan ingin bicara dengan petugas.",
        critical_validator_ids=("guaranteed_profit_claim",),
        backend_security_denied=True,
    )
    critical = decide_enforcement(
        legacy_policy_action="auto_draft_only",
        policy_risk_level="low",
        latest_customer_message="Saya rugi dan ingin bicara dengan petugas.",
        critical_validator_ids=("guaranteed_profit_claim",),
    )
    complaint = decide_enforcement(
        legacy_policy_action="human_approval_required",
        policy_risk_level="medium",
        latest_customer_message="Saya rugi karena dana saya tidak masuk.",
    )

    assert security.reason_codes == ("backend_security_denied",)
    assert security.action_mode == ActionMode.BLOCK
    assert critical.action_mode == ActionMode.BLOCK
    assert complaint.action_mode == ActionMode.SAFE_HANDOFF


@pytest.mark.parametrize(
    "validator_id",
    [
        "guaranteed_profit_claim",
        "risk_free_claim",
        "specific_buy_sell_instruction",
        "all_in_or_full_margin_instruction",
        "fake_verification_status_access",
        "fake_account_or_fund_status_access",
        "unsupported_refund_or_compensation_promise",
    ],
)
def test_each_unresolved_critical_validator_is_not_normal(validator_id: str) -> None:
    decision = decide_enforcement(
        legacy_policy_action="auto_draft_only",
        policy_risk_level="low",
        critical_validator_ids=(validator_id,),
    )
    assert decision.action_mode in {
        ActionMode.BLOCK,
        ActionMode.SAFE_HANDOFF,
    }
    assert decision.generation_strategy != GenerationStrategy.NORMAL_GENERATION


def test_complaint_classifier_requires_personal_context() -> None:
    assert classify_safe_handoff_category("Ini modus penipuan atau bukan?") is None
    assert (
        classify_safe_handoff_category("Saya tanya apakah ini penipuan?") is None
    )
    assert (
        classify_safe_handoff_category(
            "Saya ditipu dan dana saya hilang setelah transaksi."
        )
        == SafeHandoffCategory.FRAUD_ALLEGATION
    )
    assert (
        classify_safe_handoff_category("Apa fungsi regulator Bappebti?") is None
    )
    assert (
        classify_safe_handoff_category(
            "Saya rugi dalam transaksi ini dan akan lapor ke regulator."
        )
        == SafeHandoffCategory.LEGAL_OR_REGULATOR_THREAT
    )
    assert (
        classify_safe_handoff_category("Saya minta refund.")
        == SafeHandoffCategory.REFUND_OR_COMPENSATION
    )
    assert (
        classify_safe_handoff_category(
            "Kalau perusahaannya legal berarti uang saya pasti aman dan nggak mungkin rugi ya?"
        )
        is None
    )
    assert (
        classify_safe_handoff_category(
            "Katanya uang pasti aman dan tidak mungkin rugi, tetapi saya rugi 10 juta."
        )
        == SafeHandoffCategory.FINANCIAL_LOSS_CLAIM
    )
    assert (
        classify_safe_handoff_category(
            "Stop loss bikin saya pasti nggak rugi lebih besar kan?"
        )
        is None
    )


@pytest.mark.parametrize("category", list(SafeHandoffCategory))
def test_safe_handoff_is_deterministic_and_has_no_prohibited_claims(
    category: SafeHandoffCategory,
) -> None:
    first = build_safe_handoff(category)
    second = build_safe_handoff(category)
    lowered = first.content.lower()

    assert first == second
    assert first.content_hash == second.content_hash
    assert "deposit sekarang" not in lowered
    assert "buy" not in lowered
    assert "sell" not in lowered
    assert "kami bersalah" not in lowered
    assert "sudah saya cek" not in lowered
    assert "refund dijamin" not in lowered
    assert "kompensasi dijamin" not in lowered
    assert critical_validator_ids_for_text(first.content) == ()
    assert first.content not in str(first.debug_metadata())


def test_reviewer_role_mapping_is_backend_enforced(monkeypatch) -> None:
    monkeypatch.setattr(settings, "clara_policy_enforcement_mode", "ENFORCE")
    kwargs = {
        "action_mode": "HUMAN_REVIEW",
        "risk_level": "medium",
        "approval_status": "pending",
        "candidate_text": "Saya bantu jelaskan prosesnya secara umum.",
        "policy_reasons": (
            "enforcement:reviewer_requirement=MANAGER_REVIEW",
        ),
    }

    with pytest.raises(ClaraEnforcementError):
        assert_suggestion_can_be_approved(actor_role="sales", **kwargs)

    requirement = assert_suggestion_can_be_approved(
        actor_role="manager", **kwargs
    )
    assert requirement == ReviewerRequirement.MANAGER_REVIEW


def test_blocked_suggestion_cannot_be_approved(
    monkeypatch,
) -> None:
    monkeypatch.setattr(settings, "clara_policy_enforcement_mode", "ENFORCE")

    with pytest.raises(ClaraEnforcementError):
        assert_suggestion_can_be_approved(
            action_mode="BLOCK",
            risk_level="high",
            approval_status="blocked",
            actor_role="superadmin",
            candidate_text="Internal inspection only.",
        )


def test_approved_elevated_send_preserves_existing_sender_workflow(monkeypatch) -> None:
    monkeypatch.setattr(settings, "clara_policy_enforcement_mode", "ENFORCE")
    kwargs = {
        "action_mode": "HUMAN_REVIEW",
        "risk_level": "medium",
        "approval_status": "approved",
        "final_text": "Saya bantu jelaskan prosesnya secara umum.",
        "policy_reasons": (
            "enforcement:reviewer_requirement=MANAGER_REVIEW",
        ),
    }

    assert (
        assert_suggestion_can_be_sent(actor_role="sales", **kwargs)
        == ReviewerRequirement.MANAGER_REVIEW
    )

    with pytest.raises(ClaraEnforcementError):
        assert_suggestion_can_be_sent(
            action_mode="NORMAL",
            risk_level="low",
            approval_status="approved",
            actor_role="sales",
            final_text="Keuntungan pasti dijamin.",
        )


def test_enforce_withholds_pending_draft_from_extension(
    db_session_factory,
    seeded_data,
    monkeypatch,
) -> None:
    monkeypatch.setattr(settings, "clara_policy_enforcement_mode", "ENFORCE")
    db = db_session_factory()
    suggestion = _seed_suggestion(db, seeded_data["owned_conversation"])
    extraction = db.get(AIExtraction, suggestion.ai_extraction_id)
    snapshot = ExtensionSnapshotSyncResponse(
        status="duplicate",
        duplicate=True,
        conversation_id=suggestion.conversation_id,
        message_count=1,
        source="whatsapp_extension",
    )

    with pytest.raises(ExtensionSnapshotError):
        build_extension_reply_suggestions_response(
            snapshot_result=snapshot,
            extraction=extraction,
            suggestion=suggestion,
            cached=True,
        )

    suggestion.approval_status = "approved"
    suggestion.final_reply_text = "Balasan final yang sudah direview manusia."
    response = build_extension_reply_suggestions_response(
        snapshot_result=snapshot,
        extraction=extraction,
        suggestion=suggestion,
        cached=True,
    )
    assert response.suggestions == ["Balasan final yang sudah direview manusia."]


def _seed_suggestion(db, conversation, *, action_mode="HUMAN_REVIEW"):
    persisted_conversation = db.get(Conversation, conversation.id)
    persisted_conversation.last_message_at = datetime.now(timezone.utc)
    extraction = AIExtraction(
        conversation_id=conversation.id,
        model_name="test-model",
        schema_version="v1",
        lead_temperature="warm",
        pipeline_stage="qualification",
        buying_intent="medium",
        sentiment="neutral",
        risk_level="medium",
        main_objections=[],
        budget_signal={},
        recommended_reply_strategy={},
        customer_summary="Synthetic test summary.",
        next_best_action="Review the synthetic draft.",
        content_insight="Synthetic test only.",
        internal_notes="Synthetic test only.",
        confidence_score=0.9,
    )
    db.add(extraction)
    db.flush()
    suggestion = ReplySuggestion(
        conversation_id=conversation.id,
        ai_extraction_id=extraction.id,
        model_name="test-model",
        schema_version="v1",
        risk_level="medium",
        action_mode=action_mode,
        approval_status="pending",
        suggested_replies=[
            {
                "tone": "professional",
                "text": "Saya bantu jelaskan prosesnya secara umum.",
                "reasoning": "Synthetic test.",
            }
        ],
        policy_reasons=[
            "enforcement:reviewer_requirement=MANAGER_REVIEW"
        ],
    )
    db.add(suggestion)
    db.commit()
    return suggestion


def test_approval_service_uses_authenticated_reviewer_role(
    db_session_factory,
    seeded_data,
    monkeypatch,
) -> None:
    monkeypatch.setattr(settings, "clara_policy_enforcement_mode", "ENFORCE")
    db = db_session_factory()
    suggestion = _seed_suggestion(db, seeded_data["owned_conversation"])
    payload = ApproveReplyRequest(
        selected_reply_text="Saya bantu jelaskan prosesnya secara umum.",
        final_reply_text="Saya bantu jelaskan prosesnya secara umum.",
        reviewer_name="spoofed-name",
    )

    with pytest.raises(ReplySuggestionError):
        approve_reply_suggestion(
            db,
            suggestion.id,
            payload,
            reviewer_role="sales",
            authenticated_reviewer_name="Sales User",
        )

    approved = approve_reply_suggestion(
        db,
        suggestion.id,
        payload,
        reviewer_role="manager",
        authenticated_reviewer_name="Manager User",
    )
    assert approved.approval_status == "approved"
    assert approved.approval_logs[0].reviewer_name == "Manager User"


def test_extension_pending_send_cannot_auto_approve_in_enforce(
    db_session_factory,
    seeded_data,
    monkeypatch,
) -> None:
    monkeypatch.setattr(settings, "clara_policy_enforcement_mode", "ENFORCE")
    db = db_session_factory()
    suggestion = _seed_suggestion(db, seeded_data["owned_conversation"])

    with pytest.raises(ExtensionSnapshotError):
        confirm_extension_reply_sent_for_channel(
            db,
            channel="whatsapp",
            reply_suggestion_id=suggestion.id,
            selected_reply_text="Saya bantu jelaskan prosesnya secara umum.",
            final_reply_text="Saya bantu jelaskan prosesnya secara umum.",
            sent_by_name="Sales User",
            sender_role="sales",
        )

    db.refresh(suggestion)
    assert suggestion.approval_status == "pending"

    payload = ApproveReplyRequest(
        selected_reply_text="Saya bantu jelaskan prosesnya secara umum.",
        final_reply_text="Saya bantu jelaskan prosesnya secara umum.",
        reviewer_name="Manager User",
    )
    approve_reply_suggestion(
        db,
        suggestion.id,
        payload,
        reviewer_role="manager",
        authenticated_reviewer_name="Manager User",
    )
    with pytest.raises(ExtensionSnapshotError):
        confirm_extension_reply_sent_for_channel(
            db,
            channel="whatsapp",
            reply_suggestion_id=suggestion.id,
            selected_reply_text=payload.selected_reply_text,
            final_reply_text="Teks ini diubah setelah approval.",
            sent_by_name="Sales User",
            sender_role="sales",
        )

    result = confirm_extension_reply_sent_for_channel(
        db,
        channel="whatsapp",
        reply_suggestion_id=suggestion.id,
        selected_reply_text=payload.selected_reply_text,
        final_reply_text=payload.final_reply_text,
        sent_by_name="Sales User",
        sender_role="sales",
    )
    assert result.auto_approved is False
    assert result.approval_status == "approved"


def test_observe_keeps_extension_legacy_auto_approval(
    db_session_factory,
    seeded_data,
    monkeypatch,
) -> None:
    monkeypatch.setattr(settings, "clara_policy_enforcement_mode", "OBSERVE")
    db = db_session_factory()
    suggestion = _seed_suggestion(db, seeded_data["owned_conversation"])

    result = confirm_extension_reply_sent_for_channel(
        db,
        channel="whatsapp",
        reply_suggestion_id=suggestion.id,
        selected_reply_text="Saya bantu jelaskan prosesnya secara umum.",
        final_reply_text="Saya bantu jelaskan prosesnya secara umum.",
        sent_by_name="Sales User",
        sender_role="sales",
    )
    assert result.auto_approved is True
    assert result.approval_status == "approved"


def test_enforce_personal_complaint_skips_normal_generation(
    db_session_factory,
    seeded_data,
    monkeypatch,
) -> None:
    monkeypatch.setattr(settings, "clara_policy_enforcement_mode", "ENFORCE")
    monkeypatch.setattr(
        "app.services.reply_suggestion_service.build_grounded_knowledge_context",
        lambda **_kwargs: ("", ""),
    )
    monkeypatch.setattr(
        "app.services.reply_suggestion_service.call_openai_for_reply_suggestion",
        lambda **_kwargs: pytest.fail("Normal LLM generation must not run."),
    )
    db = db_session_factory()
    conversation = seeded_data["owned_conversation"]
    db.add(
        Message(
            conversation_id=conversation.id,
            sender_name="Synthetic Customer",
            sender_type="customer",
            message_text="Saya rugi dan dana saya tidak masuk. Saya minta refund.",
            message_timestamp=datetime.now(timezone.utc),
        )
    )
    db.add(
        AIExtraction(
            conversation_id=conversation.id,
            model_name="test-model",
            schema_version="v1",
            lead_temperature="warm",
            pipeline_stage="objection",
            buying_intent="low",
            sentiment="angry",
            risk_level="high",
            main_objections=["Synthetic complaint"],
            budget_signal={},
            recommended_reply_strategy={},
            customer_summary="Synthetic complaint.",
            next_best_action="Escalate.",
            content_insight="Synthetic test.",
            internal_notes="Synthetic test.",
            confidence_score=0.95,
        )
    )
    db.commit()

    suggestion = create_reply_suggestion(db, conversation.id, desired_count=1)

    assert suggestion.action_mode == "SAFE_HANDOFF"
    assert suggestion.approval_status == "pending"
    assert suggestion.model_name == "backend-safe-handoff-v1"
    assert len(suggestion.suggested_replies) == 1
    text = suggestion.suggested_replies[0]["text"].lower()
    assert "tim yang berwenang" in text
    assert "deposit" not in text


def test_enforce_blocks_critical_generated_output_without_exposing_it(
    db_session_factory,
    seeded_data,
    monkeypatch,
) -> None:
    monkeypatch.setattr(settings, "clara_policy_enforcement_mode", "ENFORCE")
    monkeypatch.setattr(
        "app.services.reply_suggestion_service.build_grounded_knowledge_context",
        lambda **_kwargs: ("", ""),
    )
    unsafe_text = "Keuntungan pasti dijamin untuk kakak."
    monkeypatch.setattr(
        "app.services.reply_suggestion_service.call_openai_for_reply_suggestion",
        lambda **_kwargs: ReplySuggestionCreate(
            suggested_replies=[
                {
                    "tone": "friendly",
                    "text": unsafe_text,
                    "reasoning": "Synthetic unsafe output.",
                }
            ]
        ),
    )
    db = db_session_factory()
    conversation = seeded_data["owned_conversation"]
    now = datetime.now(timezone.utc)
    db.add(
        Message(
            conversation_id=conversation.id,
            sender_name="Synthetic Customer",
            sender_type="customer",
            message_text="Tolong jelaskan produk ini secara umum.",
            message_timestamp=now,
        )
    )
    db.add(
        AIExtraction(
            conversation_id=conversation.id,
            model_name="test-model",
            schema_version="v1",
            lead_temperature="cold",
            pipeline_stage="education",
            buying_intent="low",
            sentiment="neutral",
            risk_level="low",
            main_objections=[],
            budget_signal={},
            recommended_reply_strategy={},
            customer_summary="Synthetic education request.",
            next_best_action="Explain safely.",
            content_insight="Synthetic test.",
            internal_notes="Synthetic test.",
            confidence_score=0.95,
        )
    )
    db.commit()

    suggestion = create_reply_suggestion(db, conversation.id, desired_count=1)

    assert suggestion.action_mode == "BLOCK"
    assert suggestion.approval_status == "blocked"
    assert suggestion.suggested_replies == []
    assert unsafe_text not in str(suggestion.policy_reasons)


def test_no_stage_5_migration_was_added() -> None:
    repository_root = Path(__file__).resolve().parents[2]
    migration_names = [
        path.name.lower()
        for path in (repository_root / "clara-backend").rglob("*.py")
        if "versions" in path.parts
    ]
    assert not any("stage_5" in name or "enforcement" in name for name in migration_names)
