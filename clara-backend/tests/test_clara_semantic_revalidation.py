import json
from hashlib import sha256
from pathlib import Path
from types import SimpleNamespace

import pytest

from app.core.config import Settings
from app.services import reply_suggestion_service
from app.services.clara_reply_retry_service import VALIDATOR_RULES
from app.services.clara_reply_validation_service import (
    CLARA_VALIDATION_CONTRACT_VERSION,
    CRITICAL_SAFETY_VALIDATOR_IDS,
    ReplyValidationCapabilities,
    ReplyValidationContext,
    SemanticRevalidationMode,
    build_validation_log_metadata,
    evaluate_reply,
    normalize_semantic_revalidation_mode,
)
from app.services.clara_semantic_quality_service import (
    build_semantic_shadow_report,
    render_semantic_shadow_markdown,
)


EXISTING_VALIDATOR_IDS = (
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
)


def _critical_failures(
    text: str,
    *,
    capabilities: ReplyValidationCapabilities | None = None,
) -> set[str]:
    report = evaluate_reply(
        text,
        ReplyValidationContext(
            capabilities=capabilities or ReplyValidationCapabilities()
        ),
    )
    return set(report.critical_failure_ids) & CRITICAL_SAFETY_VALIDATOR_IDS


def test_validation_contract_is_deterministic_and_debug_safe() -> None:
    text = "Profit dijamin pasti setiap bulan."
    first = evaluate_reply(text, ReplyValidationContext())
    second = evaluate_reply(text, ReplyValidationContext())

    assert first.validation_contract_version == (
        CLARA_VALIDATION_CONTRACT_VERSION
    ) == "1.0"
    assert first.content_hash == second.content_hash == sha256(
        text.encode("utf-8")
    ).hexdigest()
    assert first.failed_validator_ids == second.failed_validator_ids
    assert "guaranteed_profit_claim" in first.critical_failure_ids
    metadata = first.debug_metadata()
    serialized = json.dumps(metadata, ensure_ascii=False)
    assert "evaluated_text" not in metadata
    assert text not in serialized
    assert all(
        "diagnostic_metadata" in item
        and "reason_code" in item
        and "retry_eligible" in item
        for item in metadata["validator_results"]
    )


def test_existing_validator_inventory_is_preserved_and_centralized() -> None:
    registry_ids = tuple(rule.validator_id for rule in VALIDATOR_RULES)
    report = evaluate_reply(
        "Perlu cek status resmi sesuai akun yang dipilih dulu.",
        ReplyValidationContext(latest_customer_intent="legality"),
    )
    source = (
        Path(__file__).parents[1] / "app/services/reply_suggestion_service.py"
    ).read_text(encoding="utf-8")

    assert registry_ids[: len(EXISTING_VALIDATOR_IDS)] == EXISTING_VALIDATOR_IDS
    assert set(EXISTING_VALIDATOR_IDS) <= {
        result.validator_id for result in report.validator_results
    }
    assert {
        "missing_legality_authority",
        "vague_legality_deflection",
    } <= set(report.failed_validator_ids)
    assert "_collect_retry_validator_ids" not in source
    assert "needs_retry = (" not in source
    assert "evaluate_reply(primary_text, validation_context)" in source


def test_legality_answer_requires_explicit_trading_risk_boundary() -> None:
    context = ReplyValidationContext(latest_customer_intent="legality")
    incomplete = evaluate_reply(
        "PT Solid Gold Berjangka diawasi BAPPEBTI. Saya bisa jelaskan risikonya.",
        context,
    )
    complete = evaluate_reply(
        "PT Solid Gold Berjangka diawasi BAPPEBTI, tetapi legalitas tidak "
        "menghilangkan risiko kerugian dalam trading.",
        context,
    )

    assert "missing_legality_risk_boundary" in incomplete.failed_validator_ids
    assert "missing_legality_risk_boundary" not in complete.failed_validator_ids


def test_active_verification_method_fact_must_be_used_when_requested() -> None:
    context = ReplyValidationContext(
        latest_customer_message="Verifikasi pasti video call dengan WPB kan?",
        requested_product_fact_values={
            "process.verification_steps": {
                "verification_method": "video_call",
                "verification_role": "Wakil Pialang Berjangka (WPB)",
            }
        },
    )
    incomplete = evaluate_reply(
        "Verifikasi biasanya tidak selalu harus video call dengan WPB.", context
    )
    complete = evaluate_reply(
        "Ya, berdasarkan fakta aktif verifikasi dilakukan melalui video call "
        "dengan Wakil Pialang Berjangka (WPB).",
        context,
    )

    assert "missing_requested_product_fact" in incomplete.failed_validator_ids
    assert "missing_requested_product_fact" not in complete.failed_validator_ids


def test_active_demo_transaction_fact_must_be_answered_without_denial() -> None:
    context = ReplyValidationContext(
        latest_customer_message=(
            "Sebelum akun real wajib transaksi di akun demo sebanyak 2 kali ya?"
        ),
        requested_product_fact_values={
            "process.verification_steps": {
                "demo_transactions_required_before_real_account": 2,
            }
        },
    )
    denied = evaluate_reply(
        "Tidak wajib, akun demo umumnya hanya dipakai untuk latihan.", context
    )
    grounded = evaluate_reply(
        "Ya, berdasarkan Product Fact aktif ada 2 transaksi demo yang wajib "
        "diselesaikan sebelum akun real.",
        context,
    )

    assert "missing_requested_product_fact" in denied.failed_validator_ids
    assert "missing_requested_product_fact" not in grounded.failed_validator_ids


def test_active_registration_channel_fact_must_be_answered_definitively() -> None:
    context = ReplyValidationContext(
        latest_customer_message=(
            "Sekarang pendaftaran sudah tidak bisa lewat website ya? Hanya lewat aplikasi?"
        ),
        requested_product_fact_values={
            "process.initial_data": {
                "internal_registration_channel": "official_mobile_app_only",
                "website_registration_available": False,
            }
        },
    )
    generic = evaluate_reply(
        "Ketentuan kanal pendaftaran masih perlu dikonfirmasi dulu.", context
    )
    grounded = evaluate_reply(
        "Benar, pendaftaran hanya melalui aplikasi SOLID. Pendaftaran melalui "
        "website sudah tidak tersedia.",
        context,
    )

    assert "missing_requested_product_fact" in generic.failed_validator_ids
    assert "missing_requested_product_fact" not in grounded.failed_validator_ids


@pytest.mark.parametrize(
    ("message", "facts", "wrong", "grounded"),
    [
        (
            "Produk apa saja yang bisa saya pelajari?",
            {"account.eligible_products": ["XUL10", "BCO10_BBJ"]},
            "Ada Mini dan Regular Account.",
            "Produk aktif yang bisa dipelajari adalah XUL10 Gold dan BCO10_BBJ "
            "Brent Oil. Keduanya tetap memiliki risiko karena harga dapat berubah.",
        ),
        (
            "Margin itu apa?",
            {"trading.margin": {"daytrade_usd_per_lot": 100}},
            "Margin adalah batas otomatis pada equity.",
            "Margin adalah dana jaminan untuk membuka posisi; nilainya bergantung pada produk dan jenis akun.",
        ),
        (
            "Spread itu apa?",
            {"trading.spread": {"XUL10": {"minimum": 0.2}}},
            "Spread adalah biaya tetap saat membuka posisi.",
            "Spread adalah selisih harga bid dan ask yang dapat berubah mengikuti kondisi pasar.",
        ),
        (
            "Spread minimum XUL10 berapa per sisi?",
            {
                "trading.spread": {
                    "XUL10": {"minimum": 0.2, "unit": "USD/Troy Ounce/side"}
                }
            },
            "Saya perlu cek spread resminya dulu.",
            "Spread minimum XUL10 adalah USD 0,2 per Troy Ounce per sisi.",
        ),
        (
            "Komisi akun Mini per 0,1 lot berapa termasuk pajak?",
            {
                "trading.commission": {
                    "amount_usd": 1,
                    "per_lot": 0.1,
                    "vat_percent": 11,
                }
            },
            "Total komisinya USD 1,11 per 0,1 lot.",
            "Komisi Mini adalah USD 1 per 0,1 lot ditambah PPN 11%.",
        ),
        (
            "Di Gold ada biaya swap gak?",
            {"trading.storage_fee": {"XUL10": {"buy": 0.5}}},
            "Saya belum punya fakta swap Gold.",
            "Gold tidak menggunakan swap forex; istilah resminya "
            "Storage/Rollover Fee, sehingga posisi overnight bukan berarti bebas biaya.",
        ),
    ],
)
def test_p1_requested_knowledge_and_product_facts_are_enforced(
    message: str,
    facts: dict[str, object],
    wrong: str,
    grounded: str,
) -> None:
    context = ReplyValidationContext(
        latest_customer_message=message,
        latest_customer_intent="product_options" if "Produk apa" in message else "product_costs",
        requested_product_fact_values=facts,
    )

    assert "missing_requested_product_fact" in evaluate_reply(
        wrong, context
    ).failed_validator_ids
    assert "missing_requested_product_fact" not in evaluate_reply(
        grounded, context
    ).failed_validator_ids


@pytest.mark.parametrize(
    ("message", "facts", "wrong", "grounded"),
    [
        (
            "Produk apa saja yang bisa saya pelajari?",
            {"account.eligible_products": ["XUL10", "BCO10_BBJ"]},
            "Yang tersedia adalah XUL10 Gold dan BCO10_BBJ Brent Oil.",
            "Yang tersedia adalah XUL10 Gold dan BCO10_BBJ Brent Oil. "
            "Keduanya tetap memiliki risiko kerugian karena harga dapat berubah.",
        ),
        (
            "Auto liquidation itu apa dan levelnya berapa?",
            {
                "trading.margin": {
                    "auto_liquidation_level_percent": 30,
                }
            },
            "Auto liquidation menutup posisi otomatis, tetapi levelnya perlu dicek.",
            "Auto liquidation adalah penutupan posisi otomatis ketika equity "
            "mencapai level 30%.",
        ),
        (
            "Di Gold ada biaya swap nggak?",
            {"trading.storage_fee": {"XUL10": {"buy": 0.5}}},
            "Ada, tetapi untuk Gold disebut Storage/Rollover Fee, bukan swap.",
            "Gold tidak menggunakan swap forex; yang berlaku adalah "
            "Storage/Rollover Fee untuk posisi overnight.",
        ),
    ],
)
def test_p1_uat_failures_require_complete_product_fact_answers(
    message: str,
    facts: dict[str, object],
    wrong: str,
    grounded: str,
) -> None:
    context = ReplyValidationContext(
        latest_customer_message=message,
        latest_customer_intent=(
            "product_options"
            if message.startswith("Produk")
            else "mechanism"
            if message.startswith("Auto")
            else "product_costs"
        ),
        requested_product_fact_values=facts,
    )

    assert "missing_requested_product_fact" in evaluate_reply(
        wrong, context
    ).failed_validator_ids
    assert "missing_requested_product_fact" not in evaluate_reply(
        grounded, context
    ).failed_validator_ids


@pytest.mark.parametrize(
    ("message", "account_category", "facts", "expected_parts"),
    [
        (
            "Produk apa saja yang bisa saya pelajari?",
            "mini",
            {"account.eligible_products": ["XUL10", "BCO10_BBJ"]},
            ("XUL10", "BCO10_BBJ", "risiko"),
        ),
        (
            "Komisi akun Mini per 0,1 lot berapa termasuk pajak?",
            "regular",
            {
                "trading.commission": {
                    "amount_usd": 1,
                    "per_lot": 0.1,
                    "vat_percent": 11,
                }
            },
            ("Mini", "USD 1", "0,1 lot", "PPN 11%"),
        ),
    ],
)
def test_p1_active_fact_has_deterministic_fallback_after_invalid_retry(
    message: str,
    account_category: str,
    facts: dict[str, object],
    expected_parts: tuple[str, ...],
) -> None:
    answer = reply_suggestion_service.build_requested_product_fact_fallback(
        latest_customer_message=message,
        account_category=account_category,
        requested_product_fact_values=facts,
    )

    assert answer is not None
    assert all(part in answer for part in expected_parts)


@pytest.mark.parametrize(
    ("text", "validator_id"),
    [
        ("Profit dijamin pasti setiap bulan.", "guaranteed_profit_claim"),
        ("Produk ini bebas risiko.", "risk_free_claim"),
        ("Kak sebaiknya langsung buy sekarang.", "specific_buy_sell_instruction"),
        (
            "Gunakan seluruh dana dan full margin.",
            "all_in_or_full_margin_instruction",
        ),
        (
            "Sudah saya cek di sistem, verifikasi Anda selesai.",
            "fake_verification_status_access",
        ),
        (
            "Sistem kami menunjukkan dana sudah masuk.",
            "fake_account_or_fund_status_access",
        ),
        (
            "Kami pastikan refund akan diterima.",
            "unsupported_refund_or_compensation_promise",
        ),
    ],
)
def test_critical_safety_validator_true_positives(
    text: str,
    validator_id: str,
) -> None:
    assert validator_id in _critical_failures(text)


@pytest.mark.parametrize(
    "text",
    [
        "Profit tidak bisa dijamin dan trading tetap berisiko.",
        "Tidak ada produk trading tanpa risiko.",
        "Secara umum buy dan sell adalah istilah transaksi, bukan rekomendasi.",
        "Jangan all-in; batasi risiko sesuai kemampuan.",
        "Berdasarkan informasi Anda, verifikasi sudah selesai.",
        "Saya tidak bisa menjanjikan refund atau kompensasi.",
    ],
)
def test_critical_safety_validator_false_positives(text: str) -> None:
    assert not _critical_failures(text)


def test_fake_access_and_refund_validators_respect_capabilities() -> None:
    capabilities = ReplyValidationCapabilities(
        can_access_verification_status=True,
        can_access_account_status=True,
        can_access_fund_status=True,
        can_authorize_refund=True,
    )

    assert not _critical_failures(
        "Sudah saya cek di sistem, verifikasi Anda selesai.",
        capabilities=capabilities,
    )
    assert not _critical_failures(
        "Sistem kami menunjukkan dana sudah masuk.",
        capabilities=capabilities,
    )
    assert not _critical_failures(
        "Kami pastikan refund akan diterima.",
        capabilities=capabilities,
    )


def test_retry_revalidation_can_resolve_or_introduce_violation() -> None:
    context = ReplyValidationContext(latest_customer_intent="safety")
    primary = evaluate_reply("Produk ini bebas risiko.", context)
    corrected = evaluate_reply(
        "Trading tetap memiliki risiko dan profit tidak bisa dijamin.",
        context,
    )
    regressed = evaluate_reply(
        "Keuntungan pasti didapat setelah mengikuti arahan.",
        context,
    )

    assert "risk_free_claim" in primary.failed_validator_ids
    assert not corrected.critical_failure_ids
    assert "guaranteed_profit_claim" in regressed.critical_failure_ids

    resolved_metadata = build_validation_log_metadata(
        mode=SemanticRevalidationMode.OBSERVE,
        primary_report=primary,
        retry_report=corrected,
        final_report=corrected,
        final_text=corrected.evaluated_text,
        retry_performed=True,
    )
    regressed_metadata = build_validation_log_metadata(
        mode=SemanticRevalidationMode.OBSERVE,
        primary_report=primary,
        retry_report=regressed,
        final_report=regressed,
        final_text=regressed.evaluated_text,
        retry_performed=True,
    )
    assert resolved_metadata["unresolved_final_validator_ids"] == []
    assert "guaranteed_profit_claim" in (
        regressed_metadata["unresolved_final_validator_ids"]
    )
    assert corrected.evaluated_text not in json.dumps(resolved_metadata)


def test_json_repair_output_can_be_revalidated() -> None:
    context = ReplyValidationContext(latest_customer_intent="safety")
    primary = evaluate_reply(
        "Trading memiliki risiko dan profit tidak bisa dijamin.",
        context,
    )
    repaired = evaluate_reply("Produk ini bebas risiko.", context)
    metadata = build_validation_log_metadata(
        mode=SemanticRevalidationMode.OBSERVE,
        primary_report=primary,
        repair_report=repaired,
        final_report=repaired,
        final_text=repaired.evaluated_text,
        retry_performed=False,
        json_repair_performed=True,
    )

    assert metadata["json_repair_performed"] is True
    assert "risk_free_claim" in metadata["repair_failed_validator_ids"]
    assert "risk_free_claim" in metadata["unresolved_final_validator_ids"]


def test_revalidation_mode_defaults_and_normalizes_safely() -> None:
    assert (
        Settings.model_fields["clara_semantic_revalidation_mode"].default
        == "OFF"
    )
    assert normalize_semantic_revalidation_mode(None) == (
        SemanticRevalidationMode.OFF
    )
    assert normalize_semantic_revalidation_mode("invalid") == (
        SemanticRevalidationMode.OFF
    )
    assert normalize_semantic_revalidation_mode("observe") == (
        SemanticRevalidationMode.OBSERVE
    )
    assert "ENFORCE" not in {mode.value for mode in SemanticRevalidationMode}


def test_off_metadata_does_not_claim_retry_output_was_observed() -> None:
    primary = evaluate_reply(
        "Perlu cek status resmi sesuai akun yang dipilih dulu.",
        ReplyValidationContext(latest_customer_intent="legality"),
    )
    final_text = "Untuk legalitas, perusahaan diawasi BAPPEBTI."
    metadata = build_validation_log_metadata(
        mode=SemanticRevalidationMode.OFF,
        primary_report=primary,
        final_text=final_text,
        retry_performed=True,
    )

    assert metadata["semantic_revalidation_mode"] == "OFF"
    assert metadata["retry_failed_validator_ids"] == []
    assert metadata["unresolved_final_validator_ids"] == []
    assert metadata["final_validation_observed"] is False
    assert metadata["final_reply_hash"] == sha256(
        final_text.encode("utf-8")
    ).hexdigest()


class _FakeOpenAI:
    payloads: list[dict]

    def __init__(self, *, api_key: str) -> None:
        assert api_key
        self.responses = self

    def create(self, **_kwargs) -> SimpleNamespace:
        return SimpleNamespace(
            output_parsed=self.payloads.pop(0),
            output_text="",
            output=[],
        )


def _reply_payload(text: str) -> dict:
    return {
        "suggested_replies": [
            {
                "tone": "friendly",
                "text": text,
                "reasoning": "synthetic Stage 4 test",
            }
        ]
    }


def _generate_observed_reply(
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
    mode: str,
) -> str:
    primary = "Perlu cek status resmi sesuai akun yang dipilih dulu."
    retry = "Profit dijamin pasti setiap bulan."
    _FakeOpenAI.payloads = [_reply_payload(primary), _reply_payload(retry)]
    monkeypatch.setattr(reply_suggestion_service, "OpenAI", _FakeOpenAI)
    monkeypatch.setattr(
        reply_suggestion_service.settings,
        "openai_api_key",
        "sk-synthetic-stage-4-test-only",
    )
    monkeypatch.setattr(
        reply_suggestion_service.settings,
        "clara_semantic_revalidation_mode",
        mode,
    )
    extraction = SimpleNamespace(
        pipeline_stage="qualification",
        lead_temperature="warm",
        buying_intent="medium",
        sentiment="neutral",
        risk_level="low",
        main_objections=[],
        budget_signal=None,
        account_category_prediction=None,
        recommended_reply_strategy=SimpleNamespace(
            tone="professional",
            key_points=[],
            avoid_topics=[],
        ),
        customer_summary="Synthetic summary.",
        next_best_action="Jawab legalitas.",
        content_insight="Synthetic.",
        internal_notes="Synthetic.",
        confidence_score=0.9,
    )
    caplog.clear()
    result = reply_suggestion_service.call_openai_for_reply_suggestion(
        conversation_text="Synthetic conversation.",
        extraction=extraction,
        action_mode="auto_draft_only",
        grounded_knowledge="PT Solid Gold Berjangka diawasi BAPPEBTI.",
        account_category="mini",
        include_all_variants=False,
        latest_customer_message="Perusahaannya legal?",
        latest_sales_message="",
        avoid_product_variant_locking=False,
        preferred_reply_register="neutral_polite",
        must_answer_with_product_options=False,
        should_avoid_repeating_sales_reply=False,
        product_option_summary="",
        must_give_concrete_steps=False,
        must_give_detailed_explanation=False,
        discusses_scalping_or_setup=False,
        latest_customer_intent="legality",
        prioritized_knowledge_brief="BAPPEBTI.",
        answer_commitment_level="direct_answer_first",
        variant_response_mode="anchor_mini",
        customer_has_variant_commitment=True,
        conversation_variant_focus="mini",
        customer_has_identity_submission=False,
        known_identity_fields={},
        customer_has_verification_completion=False,
        latency_profile="standard",
        desired_count=1,
        db=None,
    )
    completion = next(
        record
        for record in reversed(caplog.records)
        if record.message == "reply_generation_completed"
    )
    assert completion.semantic_revalidation_mode == mode
    if mode == "OBSERVE":
        assert "guaranteed_profit_claim" in (
            completion.unresolved_final_validator_ids
        )
        assert completion.final_validation_observed is True
    else:
        assert completion.unresolved_final_validator_ids == []
        assert completion.final_validation_observed is False
    assert retry not in json.dumps(completion.__dict__, default=str)
    return result.suggested_replies[0].text


def test_observe_records_retry_violations_without_changing_selection(
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level("INFO", logger="clara.reply")

    off_text = _generate_observed_reply(monkeypatch, caplog, "OFF")
    observe_text = _generate_observed_reply(monkeypatch, caplog, "OBSERVE")

    assert off_text == observe_text == "Profit dijamin pasti setiap bulan."


def test_semantic_shadow_evaluator_is_offline_safe_and_deterministic() -> None:
    fixture = Path(__file__).parent / "golden/clara_semantic_outputs_v1.json"
    first = build_semantic_shadow_report(fixture)
    second = build_semantic_shadow_report(fixture)

    assert first == second
    assert first["case_count"] == 12
    assert first["mode_count"] == 3
    assert first["evaluation_count"] == 36
    assert first["external_api_called"] is False
    assert first["database_write_performed"] is False
    assert {record["mode"] for record in first["records"]} == {
        "LEGACY",
        "HYBRID",
        "PERSONA",
    }

    serialized = json.dumps(first, ensure_ascii=False)
    fixture_content = json.loads(fixture.read_text(encoding="utf-8"))
    for case in fixture_content["cases"]:
        for output in case["outputs"].values():
            assert output["primary"] not in serialized
            if output.get("retry"):
                assert output["retry"] not in serialized
    assert "customer_message" not in serialized
    assert render_semantic_shadow_markdown(first) == (
        render_semantic_shadow_markdown(second)
    )
