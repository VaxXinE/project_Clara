from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
import sys

import pytest
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.models.ai_extraction import AIExtraction
from app.models.conversation import Conversation
from app.models.lead import Lead
from app.models.message import Message
from app.services import reply_suggestion_service


@dataclass(frozen=True)
class ReplyBenchmarkScenario:
    name: str
    account_category: str
    customer_messages: tuple[str, ...]
    sales_messages: tuple[str, ...]
    first_reply: str
    recovered_reply: str
    required_terms: tuple[str, ...]
    forbidden_terms: tuple[str, ...]


class FakeOpenAI:
    captured_system_prompts: list[str] = []

    def __init__(self, *, api_key: str):
        self.api_key = api_key
        self.responses = self

    def create(self, *, input: list[dict[str, str]], **_: object) -> SimpleNamespace:
        FakeOpenAI.captured_system_prompts.append(input[0]["content"])
        next_payload = FakeOpenAI._payloads.pop(0)
        if isinstance(next_payload, SimpleNamespace):
            return next_payload
        return SimpleNamespace(output_parsed=next_payload, output_text="", output=[])


def _build_payload(text: str) -> dict[str, list[dict[str, str]]]:
    return {
        "suggested_replies": [
            {
                "tone": "friendly",
                "text": text,
                "reasoning": "Benchmark payload",
            }
        ]
    }


def _build_text_response(text: str) -> SimpleNamespace:
    return SimpleNamespace(output_parsed=None, output_text=text, output=[])


def _seed_conversation(
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
    *,
    account_category: str,
    customer_messages: tuple[str, ...],
    sales_messages: tuple[str, ...],
) -> Conversation:
    db = db_session_factory()
    org_a = seeded_data["org_a"]
    marketing_b = seeded_data["marketing_b"]

    lead = Lead(
        organization_id=org_a.id,
        assigned_user_id=marketing_b.id,
        display_name="Benchmark Lead",
        source="whatsapp_web",
        account_category=account_category,
        current_stage="qualification",
        lead_temperature="warm",
    )
    db.add(lead)
    db.flush()

    base_time = datetime.now(timezone.utc) - timedelta(minutes=10)
    conversation = Conversation(
        organization_id=org_a.id,
        sales_user_id=marketing_b.id,
        lead_id=lead.id,
        title=f"Benchmark {account_category}",
        source="whatsapp_web",
        status="active",
        current_stage="qualification",
        lead_temperature="warm",
        started_at=base_time,
        last_message_at=base_time + timedelta(minutes=len(customer_messages) + len(sales_messages)),
    )
    db.add(conversation)
    db.flush()

    offset = 0
    total_pairs = max(len(customer_messages), len(sales_messages))
    for index in range(total_pairs):
        if index < len(customer_messages):
            db.add(
                Message(
                    conversation_id=conversation.id,
                    sender_name="Bagol A",
                    sender_type="customer",
                    message_text=customer_messages[index],
                    message_timestamp=base_time + timedelta(minutes=offset),
                )
            )
            offset += 1
        if index < len(sales_messages):
            db.add(
                Message(
                    conversation_id=conversation.id,
                    sender_name="Arya P",
                    sender_type="sales",
                    message_text=sales_messages[index],
                    message_timestamp=base_time + timedelta(minutes=offset),
                )
            )
            offset += 1

    extraction = AIExtraction(
        conversation_id=conversation.id,
        model_name="test-model",
        schema_version="v1",
        lead_temperature="warm",
        pipeline_stage="qualification",
        buying_intent="medium",
        sentiment="neutral",
        risk_level="low",
        main_objections=[],
        budget_signal={"detected": False, "amount_text": None, "notes": ""},
        recommended_reply_strategy={
            "tone": "friendly",
            "key_points": ["Jawab inti pertanyaan dulu"],
            "avoid_topics": [],
        },
        customer_summary="Benchmark conversation.",
        next_best_action="Jawab pertanyaan terakhir customer dengan jelas.",
        content_insight="Used for benchmark scenario.",
        internal_notes="Benchmark seed.",
        confidence_score=0.93,
    )
    db.add(extraction)
    db.commit()
    db.refresh(conversation)
    return conversation


@pytest.mark.parametrize(
    ("scenario"),
    [
        ReplyBenchmarkScenario(
            name="mini_general_opening_avoids_source_dump",
            account_category="mini",
            customer_messages=("Halo kak saya mau tanya tanya tentang mini",),
            sales_messages=(),
            first_reply=(
                "Halo kak, untuk Mini ini produk/prosedur resminya mengacu ke "
                "https://sg-berjangka.com/ ya, dan legalitas resminya tercatat di "
                "https://bappebti.go.id/pialang_berjangka/detail/049."
            ),
            recovered_reply=(
                "Bisa kak. Mini biasanya cocok buat yang mau mulai lebih ringan dulu, "
                "terutama kalau masih baru dan mau paham alurnya dengan jelas. "
                "Kalau kakak mau, saya jelaskan dulu bagian yang paling penting seperti "
                "cara mulai, legalitas, atau modal awalnya."
            ),
            required_terms=("mini", "cara mulai"),
            forbidden_terms=("https://sg-berjangka.com/",),
        ),
        ReplyBenchmarkScenario(
            name="mini_data_prep_becomes_concrete",
            account_category="mini",
            customer_messages=("Apa aja yang perlu saya siapkan kak?",),
            sales_messages=(),
            first_reply=(
                "Untuk awal siapkan data dasar dan data pendukung pembukaan dulu ya kak."
            ),
            recovered_reply=(
                "Untuk awal siapkan data identitas, nomor telepon aktif, dan domisili ya kak. "
                "Kalau sudah siap, next step-nya saya cek dulu kelengkapannya supaya proses verifikasi bisa jalan."
            ),
            required_terms=("identitas", "nomor telepon", "domisili"),
            forbidden_terms=("data dasar",),
        ),
        ReplyBenchmarkScenario(
            name="mini_verification_complete_moves_forward",
            account_category="mini",
            customer_messages=(
                "Nama: Arya Hondavario\nNomor hp: 089888776655\nDomisili: kota Depok",
                "Saya sudah dapat email kalau data saya sudah terverifikasi kak",
            ),
            sales_messages=(
                "Siap kak, data awalnya sudah saya terima dan saya bantu cek kelengkapannya ya.",
            ),
            first_reply=(
                "Siap kak, langkah berikutnya saya lanjut verifikasi kelengkapan data dulu, lalu masuk pembukaan akun."
            ),
            recovered_reply=(
                "Siap kak, berarti tahap verifikasinya sudah selesai. "
                "Setelah ini prosesnya maju ke onboarding dan aktivasi Mini, jadi tidak perlu balik lagi ke cek data awal."
            ),
            required_terms=("onboarding", "aktivasi"),
            forbidden_terms=("kelengkapan data dulu", "kirim nama lengkap"),
        ),
        ReplyBenchmarkScenario(
            name="mini_trading_ready_stops_onboarding_loop",
            account_category="mini",
            customer_messages=(
                "Saya sudah aktivasi mini, langkah selanjutnya apa?",
                "Saya sudah deposit 10 juta ya kak, dan saya mau mulai transaksi",
            ),
            sales_messages=(
                "Siap kak, setelah aktivasi kita lanjut ke step berikutnya ya.",
            ),
            first_reply=(
                "Siap kak, untuk mulai transaksi next step-nya ikuti onboarding dan cek email lanjutan dulu ya."
            ),
            recovered_reply=(
                "Siap kak, kalau akun aktif dan dana sudah masuk berarti tahap administrasinya sudah lewat. "
                "Setelah ini next step-nya masuk ke arahan penggunaan platform dan persiapan mulai transaksi pertamanya."
            ),
            required_terms=("platform", "mulai transaksi"),
            forbidden_terms=("onboarding", "cek email"),
        ),
    ],
    ids=lambda scenario: scenario.name,
)
def test_reply_benchmark_scenarios_recover_from_robotic_or_wrong_answers(
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
    monkeypatch: pytest.MonkeyPatch,
    scenario: ReplyBenchmarkScenario,
) -> None:
    conversation = _seed_conversation(
        db_session_factory,
        seeded_data,
        account_category=scenario.account_category,
        customer_messages=scenario.customer_messages,
        sales_messages=scenario.sales_messages,
    )

    FakeOpenAI._payloads = [
        _build_payload(scenario.first_reply),
        _build_payload(scenario.recovered_reply),
    ]
    FakeOpenAI.captured_system_prompts = []

    monkeypatch.setattr(reply_suggestion_service, "OpenAI", FakeOpenAI)
    monkeypatch.setattr(
        reply_suggestion_service,
        "build_grounded_knowledge_context",
        lambda **_: (
            "official_legality_source: PT Solid Gold Berjangka diawasi BAPPEBTI.\n"
            "product_source: Mini mulai Rp5 juta, Regular mulai Rp100 juta.",
            "- official_legality_source: PT Solid Gold Berjangka diawasi BAPPEBTI.\n"
            "- product_source: Mini mulai Rp5 juta, Regular mulai Rp100 juta.",
        ),
    )

    db = db_session_factory()
    suggestion = reply_suggestion_service.create_reply_suggestion(
        db=db,
        conversation_id=conversation.id,
        desired_count=1,
    )

    text = suggestion.suggested_replies[0]["text"].lower()

    assert len(FakeOpenAI.captured_system_prompts) == 2
    assert FakeOpenAI.captured_system_prompts[0] == FakeOpenAI.captured_system_prompts[1]
    assert "PLAYBOOK INTI WAJIB" in FakeOpenAI.captured_system_prompts[0]

    for term in scenario.required_terms:
        assert term.lower() in text

    for term in scenario.forbidden_terms:
        assert term.lower() not in text


def test_reply_generation_uses_plain_json_fallback_when_structured_output_is_empty(
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    conversation = _seed_conversation(
        db_session_factory,
        seeded_data,
        account_category="mini",
        customer_messages=("Itu dapet berapa lot? Ketahanan dana berapa",),
        sales_messages=(
            "Minimal deposit Mini mulai dari Rp5.000.000 ya kak. Kalau mau, saya bisa lanjut bantu jelaskan alur deposit resminya biar langkahnya jelas dan nggak keliru.",
        ),
    )

    FakeOpenAI._payloads = [
        SimpleNamespace(output_parsed=None, output_text="", output=[]),
        _build_text_response(
            '{"suggested_replies":[{"tone":"friendly","text":"Untuk jumlah lot dan ketahanan dana nggak bisa disamaratakan ya kak, karena itu tergantung produk yang dipakai, ukuran lot, dan batas risiko per transaksinya. Kalau mau, saya bantu jelaskan dulu gambaran hitung kasarnya biar kakak punya bayangan yang lebih realistis.","reasoning":"Fallback plain JSON"}]}'
        ),
    ]
    FakeOpenAI.captured_system_prompts = []

    monkeypatch.setattr(reply_suggestion_service, "OpenAI", FakeOpenAI)
    monkeypatch.setattr(
        reply_suggestion_service,
        "build_grounded_knowledge_context",
        lambda **_: (
            "product_source: Mini mulai Rp5 juta.\n"
            "faq_lot: lot dan ketahanan dana tergantung produk, ukuran lot, dan batas risiko.",
            "- product_source: Mini mulai Rp5 juta.\n"
            "- faq_lot: lot dan ketahanan dana tergantung produk, ukuran lot, dan batas risiko.",
        ),
    )

    db = db_session_factory()
    suggestion = reply_suggestion_service.create_reply_suggestion(
        db=db,
        conversation_id=conversation.id,
        desired_count=1,
    )

    text = suggestion.suggested_replies[0]["text"].lower()

    assert len(FakeOpenAI.captured_system_prompts) == 2
    assert "lot" in text
    assert "ketahanan dana" in text
    assert "ukuran lot" in text
