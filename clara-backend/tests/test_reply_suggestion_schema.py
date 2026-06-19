from pathlib import Path
import sys

import pytest
from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.schemas.reply_suggestion_schema import ReplySuggestionCreate
from app.schemas.ai_extraction_schema import (
    AIExtractionCreate,
    AccountCategoryPrediction,
    BudgetSignal,
    CustomerProfileAutofill,
    RecommendedReplyStrategy,
)
from app.services.clara_playbook_service import get_selected_playbook_filenames
from app.services.reply_suggestion_service import (
    build_prioritized_knowledge_brief,
    format_conversation_for_reply,
    get_reply_suggestion_json_schema,
    infer_answer_commitment_level,
    infer_latency_profile,
    infer_latest_customer_intent,
    infer_product_variant_response_mode,
    response_defers_answer_with_question,
    response_misses_latest_customer_intent,
    response_is_vague_after_identity_submission,
    response_starts_too_generic,
)


def build_reply(tone: str) -> dict[str, str]:
    return {
        "tone": tone,
        "text": f"Draft balasan {tone}",
        "reasoning": f"Alasan draft {tone}",
    }


def build_extraction(
    *,
    predicted_value: str = "unknown",
    confidence_score: float = 0.0,
    evidence: str = "Belum ada prediksi yang kuat.",
) -> AIExtractionCreate:
    return AIExtractionCreate(
        lead_temperature="warm",
        pipeline_stage="qualification",
        buying_intent="medium",
        sentiment="neutral",
        risk_level="low",
        main_objections=[],
        budget_signal=BudgetSignal(
            detected=False,
            amount_text=None,
            notes="Belum ada sinyal budget spesifik.",
        ),
        recommended_reply_strategy=RecommendedReplyStrategy(
            tone="friendly",
            key_points=["Jawab inti pertanyaan customer dulu"],
            avoid_topics=[],
        ),
        customer_summary="Customer sedang eksplorasi produk.",
        next_best_action="Jawab pertanyaan terakhir customer dengan ringkas.",
        content_insight="Butuh penjelasan produk yang tepat sasaran.",
        internal_notes="Test helper variant selection.",
        account_category_prediction=AccountCategoryPrediction(
            value=predicted_value,
            confidence_score=confidence_score,
            evidence=evidence,
        ),
        customer_profile_autofill=CustomerProfileAutofill(
            display_name=None,
            phone=None,
            email=None,
            address=None,
            confidence_score=0.0,
            evidence="Belum ada data profil tambahan.",
        ),
        confidence_score=0.82,
    )


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


def test_reply_suggestion_json_schema_can_be_configured_for_single_draft() -> None:
    schema = get_reply_suggestion_json_schema(desired_count=1)

    assert schema["properties"]["suggested_replies"]["minItems"] == 1
    assert schema["properties"]["suggested_replies"]["maxItems"] == 1


def test_infer_latest_customer_intent_detects_product_options() -> None:
    assert (
        infer_latest_customer_intent("Solid ini ada produk apa aja kak?")
        == "product_options"
    )


def test_infer_latest_customer_intent_detects_mechanism() -> None:
    assert infer_latest_customer_intent("Sistemnya gimana bro?") == "mechanism"


def test_infer_latest_customer_intent_detects_identity_submission() -> None:
    assert (
        infer_latest_customer_intent(
            "Nama: Arya hondavario\nNo hp: 088238768897\nDomisili: Depok"
        )
        == "identity_submission"
    )


def test_response_misses_latest_customer_intent_flags_misaligned_answer() -> None:
    assert response_misses_latest_customer_intent(
        "Solid itu diawasi resmi dan ada pengawasan BAPPEBTI.",
        "mechanism",
    )


def test_response_misses_latest_customer_intent_accepts_aligned_answer() -> None:
    assert not response_misses_latest_customer_intent(
        "Sistemnya ada alur belajar dulu, lalu dijelaskan proses entry dan batas risiko secara bertahap.",
        "mechanism",
    )


def test_response_starts_too_generic_flags_weak_opening() -> None:
    assert response_starts_too_generic(
        "Siap kak. Nanti saya bantu jelaskan ya.",
        "mechanism",
    )


def test_response_starts_too_generic_accepts_direct_opening() -> None:
    assert not response_starts_too_generic(
        "Sistemnya dimulai dari penjelasan alur, lalu akun disiapkan sesuai tujuan dan batas risiko.",
        "mechanism",
    )


def test_infer_answer_commitment_level_prefers_direct_answer_for_follow_up() -> None:
    assert (
        infer_answer_commitment_level(
            "Sistemnya bro",
            "Kalau mau saya jelasin sistemnya dulu ya.",
            "mechanism",
        )
        == "direct_answer_first"
    )


def test_response_defers_answer_with_question_flags_question_first() -> None:
    assert response_defers_answer_with_question(
        "Kak mau tahu sistemnya dari sisi alur atau risiko dulu?",
        "direct_answer_first",
    )


def test_response_defers_answer_with_question_accepts_answer_then_single_question() -> None:
    assert not response_defers_answer_with_question(
        "Sistemnya dijelaskan dulu alurnya, lalu akun disesuaikan dengan tujuan dan batas risiko. Kalau mau, saya lanjut jelaskan step awalnya ya?",
        "direct_answer_first",
    )


def test_response_is_vague_after_identity_submission_flags_filler_step() -> None:
    assert response_is_vague_after_identity_submission(
        "Siap bro, tahap berikutnya saya cek alurnya dulu dari data yang sudah masuk, lalu saya kirimkan langkah lanjut yang paling sesuai.",
        latest_customer_intent="next_step",
        customer_has_variant_commitment=True,
        customer_has_identity_submission=True,
    )


def test_response_is_vague_after_identity_submission_accepts_concrete_handoff() -> None:
    assert not response_is_vague_after_identity_submission(
        "Siap bro, data Kak Arya sudah saya terima. Step berikutnya saya lanjutkan ke verifikasi data Mini dulu, lalu saya hubungkan ke tim senior supaya proses onboarding-nya dibantu sampai tuntas.",
        latest_customer_intent="next_step",
        customer_has_variant_commitment=True,
        customer_has_identity_submission=True,
    )


def test_build_prioritized_knowledge_brief_summarizes_top_entries() -> None:
    class DummyEntry:
        def __init__(self, title: str, category: str, content: str):
            self.title = title
            self.category = category
            self.content = content
            self.source_type = "manual_note"

    brief = build_prioritized_knowledge_brief(
        [
            DummyEntry(
                "Mini Positioning",
                "positioning",
                "Mini cocok untuk pemula yang ingin mulai pelan-pelan dengan modal lebih kecil.",
            ),
            DummyEntry(
                "Regular Positioning",
                "positioning",
                "Regular cocok untuk nasabah yang ingin pendekatan trading lebih serius dan terstruktur.",
            ),
        ],
        "product_options",
    )

    assert "Mini Positioning" in brief
    assert "Regular Positioning" in brief
    assert "Fokus saat menjawab" in brief


def test_infer_product_variant_response_mode_compares_all_for_product_options() -> None:
    mode = infer_product_variant_response_mode(
        latest_customer_message="Solid ini ada produk apa aja kak?",
        extraction=build_extraction(),
        current_account_category=None,
        include_all_variants=True,
        latest_customer_intent="product_options",
    )

    assert mode == "compare_all"


def test_infer_product_variant_response_mode_leans_mini_for_beginner_small_capital() -> None:
    mode = infer_product_variant_response_mode(
        latest_customer_message="Saya masih baru mulai dan modal saya sekitar 5 juta, enaknya gimana?",
        extraction=build_extraction(
            predicted_value="mini",
            confidence_score=0.64,
            evidence="Customer pemula dan modal awal kecil.",
        ),
        current_account_category=None,
        include_all_variants=False,
        latest_customer_intent="minimum_capital",
    )

    assert mode == "lean_mini"


def test_infer_product_variant_response_mode_leans_reguler_for_serious_large_capital() -> None:
    mode = infer_product_variant_response_mode(
        latest_customer_message="Saya mau trading lebih serius dan siap modal 150 juta.",
        extraction=build_extraction(
            predicted_value="reguler",
            confidence_score=0.67,
            evidence="Customer menyebut tujuan serius dan modal besar.",
        ),
        current_account_category=None,
        include_all_variants=False,
        latest_customer_intent="general",
    )

    assert mode == "lean_reguler"


def test_infer_product_variant_response_mode_anchors_existing_account_category() -> None:
    mode = infer_product_variant_response_mode(
        latest_customer_message="Sistemnya gimana ya?",
        extraction=build_extraction(),
        current_account_category="mini",
        include_all_variants=False,
        latest_customer_intent="mechanism",
    )

    assert mode == "anchor_mini"


def test_format_conversation_for_reply_uses_shorter_window_for_single_reply() -> None:
    class DummyMessage:
        def __init__(self, index: int):
            from datetime import datetime, timedelta, timezone

            self.message_timestamp = datetime(2026, 6, 18, 10, 0, tzinfo=timezone.utc) + timedelta(minutes=index)
            self.sender_type = "customer" if index % 2 == 0 else "sales"
            self.sender_name = f"user-{index}"
            self.message_text = f"pesan ke-{index} " + ("x" * 40)

    class DummyConversation:
        def __init__(self):
            self.messages = [DummyMessage(index) for index in range(12)]

    compact = format_conversation_for_reply(DummyConversation(), desired_count=1)
    regular = format_conversation_for_reply(DummyConversation(), desired_count=3)

    assert "pesan ke-0" not in compact
    assert "pesan ke-3" not in compact
    assert "pesan ke-4" in regular
    assert "pesan ke-4" in compact
    assert "pesan ke-11" in compact


def test_format_conversation_for_reply_fast_profile_uses_tighter_window() -> None:
    class DummyMessage:
        def __init__(self, index: int):
            from datetime import datetime, timedelta, timezone

            self.message_timestamp = datetime(2026, 6, 18, 10, 0, tzinfo=timezone.utc) + timedelta(minutes=index)
            self.sender_type = "customer" if index % 2 == 0 else "sales"
            self.sender_name = f"user-{index}"
            self.message_text = f"pesan ke-{index} " + ("x" * 260)

    class DummyConversation:
        def __init__(self):
            self.messages = [DummyMessage(index) for index in range(12)]

    fast = format_conversation_for_reply(
        DummyConversation(),
        latency_profile="fast",
        desired_count=1,
    )

    assert "pesan ke-7" not in fast
    assert "pesan ke-8" in fast
    assert "..." in fast


def test_get_selected_playbook_filenames_uses_compact_subset_for_single_reply() -> None:
    filenames = get_selected_playbook_filenames(
        latest_customer_intent="product_options",
        desired_count=1,
    )

    assert "INSTRUCTION.md" in filenames
    assert "POSITIONING.md" in filenames
    assert "SALES_KNOWLEDGE_BRIDGE_MINI.md" in filenames
    assert "SALES_KNOWLEDGE_BRIDGE_REGULAR.md" in filenames
    assert "CONVERSION_LAYER.md" not in filenames


def test_get_selected_playbook_filenames_uses_faster_subset_for_fast_profile() -> None:
    filenames = get_selected_playbook_filenames(
        latest_customer_intent="mechanism",
        desired_count=1,
        latency_profile="fast",
    )

    assert "INSTRUCTION.md" in filenames
    assert "GUARDRAIL.md" in filenames
    assert "FLOW.md" in filenames
    assert "PERSONALITY_MODE.md" not in filenames


def test_get_selected_playbook_filenames_uses_ultra_fast_subset() -> None:
    filenames = get_selected_playbook_filenames(
        latest_customer_intent="legality",
        desired_count=1,
        latency_profile="ultra_fast",
    )

    assert "INSTRUCTION.md" in filenames
    assert "GUARDRAIL.md" in filenames
    assert "OBJECTION.md" in filenames
    assert "FLOW.md" not in filenames


def test_infer_latency_profile_prefers_fast_for_simple_single_reply() -> None:
    profile = infer_latency_profile(
        desired_count=1,
        latest_customer_intent="mechanism",
        must_answer_with_product_options=False,
        must_give_detailed_explanation=False,
        must_give_concrete_steps=False,
        discusses_scalping_or_setup=False,
        include_all_variants=False,
    )

    assert profile == "fast"


def test_infer_latency_profile_prefers_fast_for_product_comparison() -> None:
    profile = infer_latency_profile(
        desired_count=1,
        latest_customer_intent="product_options",
        must_answer_with_product_options=True,
        must_give_detailed_explanation=False,
        must_give_concrete_steps=False,
        discusses_scalping_or_setup=False,
        include_all_variants=True,
    )

    assert profile == "fast"


def test_infer_latency_profile_prefers_fast_for_simple_product_options() -> None:
    profile = infer_latency_profile(
        desired_count=1,
        latest_customer_intent="product_options",
        must_answer_with_product_options=True,
        must_give_detailed_explanation=False,
        must_give_concrete_steps=False,
        discusses_scalping_or_setup=False,
        include_all_variants=False,
    )

    assert profile == "fast"


def test_infer_latency_profile_prefers_ultra_fast_for_simple_legality() -> None:
    profile = infer_latency_profile(
        desired_count=1,
        latest_customer_intent="legality",
        must_answer_with_product_options=False,
        must_give_detailed_explanation=False,
        must_give_concrete_steps=False,
        discusses_scalping_or_setup=False,
        include_all_variants=False,
    )

    assert profile == "ultra_fast"
