from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest
from sqlalchemy import select

from app.core.config import Settings, settings
from app.models.ai_extraction import AIExtraction
from app.models.complaint_case import ComplaintCase, ComplaintCaseEvent
from app.models.conversation import Conversation
from app.models.customer_profile import CustomerProfile
from app.models.lead import Lead
from app.models.message import Message
from app.models.organization import Organization
from app.models.product_fact import ProductFact
from app.models.support_knowledge_article import SupportKnowledgeArticle
from app.models.user import User
from app.schemas.service_routing_schema import SupportArticleResponse
from app.schemas.reply_suggestion_schema import ReplySuggestionCreate
from app.services.clara_complaint_service import (
    append_safe_intake,
    assign_complaint_case,
    build_complaint_intake,
    change_complaint_severity,
    create_or_touch_complaint_case,
    transition_complaint_case,
)
from app.services.clara_safe_handoff_service import (
    SafeHandoffCategory,
    build_safe_handoff,
)
from app.services.clara_service_routing_service import (
    CLARA_SERVICE_ROUTING_CONTRACT_VERSION,
    ComplaintSeverity,
    ServiceGenerationStrategy,
    ServiceRoute,
    ServiceRoutingMode,
    SupportLevel,
    SupportTopic,
    normalize_service_routing_mode,
    route_service_message,
)
from app.services.clara_support_knowledge_service import (
    SupportKnowledgeError,
    create_support_article_draft,
    resolve_support_article,
    transition_support_article_lifecycle,
)
from app.services.reply_suggestion_service import (
    create_reply_suggestion,
    get_effective_service_routing_message,
    should_handoff_after_repeated_unhelpful_answers,
)


def test_all_rollout_defaults_and_routing_fallback_are_safe() -> None:
    defaults = Settings.model_fields
    assert defaults["clara_persona_authority_mode"].default == "LEGACY"
    assert defaults["clara_semantic_revalidation_mode"].default == "OFF"
    assert defaults["clara_policy_enforcement_mode"].default == "OBSERVE"
    assert defaults["clara_product_fact_mode"].default == "REGISTRY"
    assert defaults["clara_process_state_mode"].default == "LEGACY"
    assert defaults["clara_service_routing_mode"].default == "ROUTED"
    assert defaults["clara_complaint_incident_window_days"].default == 30
    assert normalize_service_routing_mode("invalid") == ServiceRoutingMode.LEGACY


def _conversation_messages(*items: tuple[str, str]):
    return SimpleNamespace(
        messages=[
            SimpleNamespace(sender_type=sender_type, message_text=text)
            for sender_type, text in items
        ]
    )


def test_complaint_context_is_preserved_for_immediate_follow_up() -> None:
    conversation = _conversation_messages(
        ("customer", "Withdrawal saya belum masuk."),
        ("sales", "Saya akan meneruskan hal ini ke tim yang tepat."),
        ("customer", "Saya sudah menunggu dan makin kesal."),
    )

    effective_message = get_effective_service_routing_message(conversation)
    decision = route_service_message(effective_message)

    assert "Withdrawal saya belum masuk" in effective_message
    assert decision.route == ServiceRoute.COMPLAINT
    assert (
        decision.generation_strategy
        == ServiceGenerationStrategy.COMPLAINT_SAFE_HANDOFF
    )


def test_human_handoff_stays_in_current_chat_on_immediate_follow_up() -> None:
    conversation = _conversation_messages(
        ("customer", "Bisa sambungkan ke manusia?"),
        ("sales", "Permintaan akan saya teruskan ke petugas."),
        ("customer", "Jangan arahkan saya ke website, saya mau tunggu di sini."),
    )

    decision = route_service_message(
        get_effective_service_routing_message(conversation)
    )

    assert decision.route == ServiceRoute.COMPLAINT
    assert decision.complaint_category == SafeHandoffCategory.HUMAN_REQUEST
    assert (
        "percakapan ini"
        in build_safe_handoff(SafeHandoffCategory.HUMAN_REQUEST).content
    )


def test_three_unhelpful_answer_signals_require_human_handoff() -> None:
    conversation = _conversation_messages(
        ("customer", "Saya masih belum mengerti cara verifikasinya."),
        ("sales", "Berikut alur verifikasinya."),
        ("customer", "Saya tetap belum ngerti, maksudnya bagaimana?"),
        ("sales", "Berikut alur verifikasinya."),
        ("customer", "Jawaban itu belum membantu saya."),
    )

    assert should_handoff_after_repeated_unhelpful_answers(conversation)
    decision = route_service_message(
        get_effective_service_routing_message(conversation)
    )
    assert decision.complaint_category == SafeHandoffCategory.HUMAN_REQUEST


def test_new_topic_does_not_inherit_previous_complaint() -> None:
    conversation = _conversation_messages(
        ("customer", "Withdrawal saya belum masuk."),
        ("sales", "Saya akan meneruskan hal ini ke tim yang tepat."),
        ("customer", "Sekarang jelaskan spread secara singkat."),
    )

    decision = route_service_message(
        get_effective_service_routing_message(conversation)
    )

    assert decision.route == ServiceRoute.SALES


@pytest.mark.parametrize(
    ("message", "route", "strategy"),
    [
        (
            "Berapa modal produk mini?",
            ServiceRoute.SALES,
            ServiceGenerationStrategy.EXISTING_SALES_GENERATION,
        ),
        (
            "Apakah perusahaan legal dan diawasi regulator?",
            ServiceRoute.COMPLIANCE_GENERAL,
            ServiceGenerationStrategy.COMPLIANCE_EDUCATION,
        ),
        (
            "Saya tidak bisa login.",
            ServiceRoute.CS_GENERAL,
            ServiceGenerationStrategy.SUPPORT_KNOWLEDGE_DRAFT,
        ),
        (
            "Dana saya hilang dan tolong investigasi.",
            ServiceRoute.COMPLAINT,
            ServiceGenerationStrategy.COMPLAINT_SAFE_HANDOFF,
        ),
        (
            "Bagaimana cuaca hari ini?",
            ServiceRoute.OFF_TOPIC,
            ServiceGenerationStrategy.OFF_TOPIC_BOUNDARY,
        ),
        (
            "Halo",
            ServiceRoute.UNKNOWN,
            ServiceGenerationStrategy.EXISTING_SALES_GENERATION,
        ),
    ],
)
def test_all_routes_and_strategies(message, route, strategy) -> None:
    result = route_service_message(message)
    assert result.top_level_route == route
    assert result.generation_strategy == strategy
    assert result.routing_contract_version == CLARA_SERVICE_ROUTING_CONTRACT_VERSION
    assert 0 <= result.confidence_score <= 1
    assert message not in str(result.debug_metadata())


def test_precedence_and_context_prevent_keyword_only_complaints() -> None:
    generic = route_service_message(
        "Apa kebijakan refund, risiko fraud, dan legalitasnya?"
    )
    personal = route_service_message(
        "Dana saya hilang saat deposit, tetapi saya juga mau produk mini."
    )
    status = route_service_message("Akun saya verified belum? Tolong cek.")
    human_login = route_service_message(
        "Saya tidak bisa login, hubungkan ke petugas manusia."
    )
    assert generic.route == ServiceRoute.COMPLIANCE_GENERAL
    assert generic.create_case is False
    assert personal.route == ServiceRoute.COMPLAINT
    assert personal.create_case is True
    assert personal.complaint_severity == ComplaintSeverity.HIGH
    assert status.support_topic == SupportTopic.STATUS_REQUEST
    assert status.support_level == SupportLevel.HUMAN_REQUIRED
    assert human_login.route == ServiceRoute.COMPLAINT


def test_legality_does_not_mean_risk_free_stays_compliance_education() -> None:
    result = route_service_message(
        "Kalau perusahaannya legal berarti uang saya pasti aman dan nggak mungkin rugi ya?"
    )

    assert result.route == ServiceRoute.COMPLIANCE_GENERAL
    assert result.conversation_intent.value == "RISK_CHECK"
    assert result.create_case is False
    assert result.requires_human is False
    assert result.generation_strategy == ServiceGenerationStrategy.COMPLIANCE_EDUCATION


def test_completed_deposit_statement_is_not_misread_as_status_request() -> None:
    result = route_service_message(
        "Saya sudah deposit 10 juta dan saya mau mulai transaksi."
    )

    assert result.route == ServiceRoute.SALES
    assert result.support_topic == SupportTopic.UNKNOWN


def test_verification_method_question_uses_active_product_fact_generation() -> None:
    result = route_service_message("Verifikasi pasti video call dengan WPB kan?")

    assert result.route == ServiceRoute.SALES
    assert result.requires_human is False
    assert (
        result.generation_strategy
        == ServiceGenerationStrategy.EXISTING_SALES_GENERATION
    )


def test_registration_question_uses_active_product_fact_generation() -> None:
    result = route_service_message(
        "Sekarang pendaftaran sudah tidak bisa lewat website ya? Hanya lewat aplikasi?"
    )

    assert result.route == ServiceRoute.SALES
    assert result.support_topic == SupportTopic.REGISTRATION_GENERAL
    assert result.requires_human is False
    assert (
        result.generation_strategy
        == ServiceGenerationStrategy.EXISTING_SALES_GENERATION
    )


@pytest.mark.parametrize(
    "message",
    [
        "Kamu siapa? Sama gak dengan aplikasi Solid?",
        "Sama nggak dengan aplikasi Solid?",
    ],
)
def test_clara_identity_and_solid_app_comparison_stays_in_answer_flow(
    message: str,
) -> None:
    result = route_service_message(message)

    assert result.route == ServiceRoute.SALES
    assert result.generation_strategy == ServiceGenerationStrategy.EXISTING_SALES_GENERATION


@pytest.mark.parametrize(
    "message",
    [
        "Ini ujung-ujungnya cuma disuruh deposit kan?",
        "Intinya cuma diarahkan deposit doang kan ujung-ujungnya?",
    ],
)
def test_sales_pressure_objection_is_not_misread_as_funding_support(
    message: str,
) -> None:
    result = route_service_message(message)

    assert result.route == ServiceRoute.SALES
    assert result.conversation_intent.value == "OBJECTION"
    assert result.support_topic == SupportTopic.UNKNOWN
    assert (
        result.generation_strategy
        == ServiceGenerationStrategy.EXISTING_SALES_GENERATION
    )


def test_real_solid_app_error_remains_customer_support() -> None:
    result = route_service_message("Aplikasi Solid error saat login.")

    assert result.route == ServiceRoute.CS_GENERAL
    assert result.support_topic == SupportTopic.LOGIN_GENERAL


def _case_context(db):
    org = Organization(name="Stage 8 Org", slug=f"stage8-{uuid4().hex}")
    db.add(org)
    db.flush()
    head = User(
        organization_id=org.id,
        name="Head",
        email=f"head-{uuid4().hex}@test.local",
        hashed_password="unused",
        role="head",
    )
    manager = User(
        organization_id=org.id,
        name="Manager",
        email=f"manager-{uuid4().hex}@test.local",
        hashed_password="unused",
        role="manager",
    )
    sales = User(
        organization_id=org.id,
        name="Sales",
        email=f"sales-{uuid4().hex}@test.local",
        hashed_password="unused",
        role="sales",
    )
    profile = CustomerProfile(
        organization_id=org.id,
        display_name="Customer",
        canonical_key=f"customer-{uuid4().hex}",
    )
    db.add_all([head, manager, sales, profile])
    db.flush()
    lead = Lead(
        organization_id=org.id,
        assigned_user_id=sales.id,
        customer_profile_id=profile.id,
        display_name="Customer",
        source="manual",
    )
    db.add(lead)
    db.flush()
    conversation = Conversation(
        organization_id=org.id,
        sales_user_id=sales.id,
        lead_id=lead.id,
        title="Governed complaint",
        channel="tawk",
        provider="extension",
        source="extension",
    )
    db.add(conversation)
    db.flush()
    return org, head, manager, sales, conversation


def test_sensitive_intake_retains_only_safe_labels() -> None:
    secret_values = (
        "SecretPass!",
        "123456",
        "1234",
        "sk-abcdefghijklmnop",
        "1234567890123456",
    )
    message = "Kemarin login saya bermasalah. password: SecretPass! OTP 123456 PIN 1234 api key sk-abcdefghijklmnop kartu 1234567890123456. Tolong petugas investigasi."
    result = build_complaint_intake(
        message=message, category=SafeHandoffCategory.PERSONAL_COMPLAINT, channel="tawk"
    )
    assert result.sensitive_information_detected is True
    assert {"PASSWORD", "OTP", "PIN", "API_KEY", "CARD_OR_BANK_CREDENTIAL"} <= set(
        result.sensitive_information_types
    )
    assert result.requested_outcome == "HUMAN_HANDLING"
    assert "APPROXIMATE_TIME" not in result.missing_information
    serialized = str(result.debug_metadata()) + result.safe_summary
    for value in secret_values:
        assert value not in serialized


def test_idempotency_window_issue_signature_reopen_and_events(
    db_session_factory,
) -> None:
    db = db_session_factory()
    _, head, manager, _, conversation = _case_context(db)
    handoff = build_safe_handoff(SafeHandoffCategory.FINANCIAL_LOSS_CLAIM)
    base = datetime(2026, 8, 1, tzinfo=timezone.utc)
    first = create_or_touch_complaint_case(
        db,
        conversation=conversation,
        message="Kemarin dana saya hilang saat deposit, tolong investigasi.",
        category=handoff.category,
        handoff=handoff,
        policy_decision_hash="a" * 64,
        observed_at=base,
    )
    same = create_or_touch_complaint_case(
        db,
        conversation=conversation,
        message="Dana saya hilang saat deposit dan minta diperiksa.",
        category=handoff.category,
        handoff=handoff,
        policy_decision_hash="a" * 64,
        observed_at=base + timedelta(days=1),
    )
    case = db.get(ComplaintCase, first.case_id)
    case.status = "CLOSED"
    case.closed_at = base + timedelta(days=2)
    db.flush()
    reopened = create_or_touch_complaint_case(
        db,
        conversation=conversation,
        message="Dana saya hilang saat deposit dan minta diperiksa.",
        category=handoff.category,
        handoff=handoff,
        policy_decision_hash="a" * 64,
        observed_at=base + timedelta(days=3),
    )
    different = create_or_touch_complaint_case(
        db,
        conversation=conversation,
        message="Dana saya hilang saat penarikan dan minta diperiksa.",
        category=handoff.category,
        handoff=handoff,
        policy_decision_hash="a" * 64,
        observed_at=base + timedelta(days=1),
    )
    later = create_or_touch_complaint_case(
        db,
        conversation=conversation,
        message="Dana saya hilang saat deposit dan minta diperiksa.",
        category=handoff.category,
        handoff=handoff,
        policy_decision_hash="a" * 64,
        observed_at=base + timedelta(days=35),
    )
    assert first.case_id == same.case_id
    assert different.case_id != first.case_id
    assert later.case_id not in {first.case_id, different.case_id}
    assert reopened.case_id == first.case_id
    assert reopened.create_or_update_action == "REOPEN"
    assert db.get(ComplaintCase, first.case_id).status == "REOPENED"
    events = list(
        db.scalars(
            select(ComplaintCaseEvent).where(
                ComplaintCaseEvent.complaint_case_id == first.case_id
            )
        ).all()
    )
    assert [event.event_type for event in events] == [
        "CREATED",
        "REOBSERVED",
        "REOPENED",
    ]
    db.close()


def test_legacy_shadow_and_routed_mode_isolation(
    db_session_factory, seeded_data, monkeypatch
) -> None:
    db = db_session_factory()
    conversation = seeded_data["owned_conversation"]
    before = (
        conversation.current_stage,
        conversation.lead.current_stage,
        conversation.sales_user_id,
        db.query(ProductFact).count(),
    )
    db.add(
        Message(
            conversation_id=conversation.id,
            sender_name="Customer",
            sender_type="customer",
            message_text="Dana saya hilang saat deposit dan saya minta petugas investigasi.",
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
            main_objections=[],
            budget_signal={},
            recommended_reply_strategy={},
            customer_summary="Safe synthetic fixture.",
            next_best_action="Review.",
            content_insight="Synthetic.",
            internal_notes="Synthetic.",
            confidence_score=0.9,
        )
    )
    db.commit()
    monkeypatch.setattr(settings, "clara_policy_enforcement_mode", "OBSERVE")
    monkeypatch.setattr(
        "app.services.reply_suggestion_service.build_grounded_knowledge_context",
        lambda **_kwargs: ("", ""),
    )
    generated = ReplySuggestionCreate(
        suggested_replies=[
            {
                "tone": "professional",
                "text": "Legacy unchanged output.",
                "reasoning": "test",
            }
        ]
    )
    monkeypatch.setattr(
        "app.services.reply_suggestion_service.call_openai_for_reply_suggestion",
        lambda **_kwargs: generated,
    )

    monkeypatch.setattr(settings, "clara_service_routing_mode", "LEGACY")
    legacy = create_reply_suggestion(db, conversation.id, desired_count=1)
    monkeypatch.setattr(settings, "clara_service_routing_mode", "SHADOW")
    shadow = create_reply_suggestion(db, conversation.id, desired_count=1)
    assert legacy.suggested_replies == shadow.suggested_replies
    assert db.query(ComplaintCase).count() == 0

    monkeypatch.setattr(settings, "clara_service_routing_mode", "ROUTED")
    monkeypatch.setattr(
        "app.services.reply_suggestion_service.call_openai_for_reply_suggestion",
        lambda **_kwargs: pytest.fail("Complaint must skip normal generation."),
    )
    routed = create_reply_suggestion(db, conversation.id, desired_count=1)
    assert routed.model_name == "backend-complaint-handoff-v1"
    assert routed.approval_status == "pending"
    assert routed.action_mode == "SAFE_HANDOFF"
    assert db.query(ComplaintCase).count() == 1
    assert (
        conversation.current_stage,
        conversation.lead.current_stage,
        conversation.sales_user_id,
        db.query(ProductFact).count(),
    ) == before
    db.close()


def test_sensitive_support_fallback_answers_latest_intent_without_repeating(
    db_session_factory, seeded_data, monkeypatch
) -> None:
    db = db_session_factory()
    conversation = seeded_data["owned_conversation"]
    now = datetime.now(timezone.utc)
    db.add(
        Message(
            conversation_id=conversation.id,
            sender_name="Customer",
            sender_type="customer",
            message_text="OTP saya 47193, tolong login dan cek status akun saya.",
            message_timestamp=now,
        )
    )
    db.add(
        AIExtraction(
            conversation_id=conversation.id,
            model_name="test-model",
            schema_version="v1",
            lead_temperature="warm",
            pipeline_stage="post_activation",
            buying_intent="low",
            sentiment="neutral",
            risk_level="high",
            main_objections=[],
            budget_signal={},
            recommended_reply_strategy={},
            customer_summary="Sensitive account access request.",
            next_best_action="Give safe account-access guidance.",
            content_insight="Synthetic.",
            internal_notes="Synthetic.",
            confidence_score=0.9,
        )
    )
    db.commit()
    monkeypatch.setattr(settings, "clara_service_routing_mode", "ROUTED")
    monkeypatch.setattr(settings, "clara_policy_enforcement_mode", "OBSERVE")
    monkeypatch.setattr(
        "app.services.reply_suggestion_service.call_openai_for_reply_suggestion",
        lambda **_kwargs: pytest.fail("Sensitive support must skip normal generation."),
    )

    otp_suggestion = create_reply_suggestion(db, conversation.id, desired_count=1)
    otp_text = otp_suggestion.suggested_replies[0]["text"].lower()

    assert "otp" in otp_text
    assert "tidak dapat login" in otp_text
    assert "47193" not in otp_text

    db.add(
        Message(
            conversation_id=conversation.id,
            sender_name="Customer",
            sender_type="customer",
            message_text="Saya kirim foto KTP dan buku rekening di chat ini ya?",
            message_timestamp=now + timedelta(seconds=1),
        )
    )
    db.commit()

    document_suggestion = create_reply_suggestion(
        db,
        conversation.id,
        desired_count=1,
    )
    document_text = document_suggestion.suggested_replies[0]["text"].lower()

    assert "ktp" in document_text
    assert "buku rekening" in document_text
    assert "jangan kirim" in document_text
    assert document_text != otp_text

    db.close()


def test_every_complaint_mutation_appends_an_event(db_session_factory) -> None:
    db = db_session_factory()
    _, head, manager, _, conversation = _case_context(db)
    handoff = build_safe_handoff(SafeHandoffCategory.PERSONAL_COMPLAINT)
    result = create_or_touch_complaint_case(
        db,
        conversation=conversation,
        message="Saya mengalami masalah transaksi dan minta petugas.",
        category=handoff.category,
        handoff=handoff,
        policy_decision_hash=None,
    )
    case = db.get(ComplaintCase, result.case_id)
    assign_complaint_case(
        db,
        case,
        assigned_user_id=manager.id,
        expected_version=case.version,
        actor_user_id=head.id,
        reason_codes=("triage_assignment",),
    )
    change_complaint_severity(
        db,
        case,
        new_severity="HIGH",
        expected_version=case.version,
        actor_user_id=head.id,
        reason_codes=("financial_review",),
    )
    append_safe_intake(
        db,
        case,
        expected_version=case.version,
        actor_user_id=manager.id,
        reason_codes=("safe_context",),
        safe_metadata={"approximate_time": "TODAY", "ignored_raw": "secret"},
    )
    transition_complaint_case(
        db,
        case,
        new_status="IN_REVIEW",
        expected_version=case.version,
        actor_user_id=head.id,
        reason_codes=("triaged",),
    )
    transition_complaint_case(
        db,
        case,
        new_status="RESOLVED",
        expected_version=case.version,
        actor_user_id=head.id,
        reason_codes=("review_complete",),
    )
    transition_complaint_case(
        db,
        case,
        new_status="CLOSED",
        expected_version=case.version,
        actor_user_id=head.id,
        reason_codes=("closure_approved",),
    )
    db.flush()
    events = list(
        db.scalars(
            select(ComplaintCaseEvent)
            .where(ComplaintCaseEvent.complaint_case_id == case.id)
            .order_by(ComplaintCaseEvent.created_at)
        ).all()
    )
    assert [event.event_type for event in events] == [
        "CREATED",
        "ASSIGNED",
        "SEVERITY_CHANGED",
        "SAFE_INTAKE_APPENDED",
        "STATUS_CHANGED",
        "RESOLVED",
        "CLOSED",
    ]
    assert "ignored_raw" not in str(events[3].safe_metadata)
    db.close()


def test_support_lifecycle_resolution_conflict_and_fact_boundary(
    db_session_factory,
) -> None:
    db = db_session_factory()
    org, head, manager, sales, _ = _case_context(db)
    kwargs = dict(
        organization_id=org.id,
        title="Login aman",
        topic="LOGIN_GENERAL",
        support_level="LEVEL_1",
        content="Gunakan menu bantuan resmi untuk memulihkan akses.",
        customer_safe=True,
        source="official_manual",
        source_reference="support-manual-v1",
        risk_class="LOW",
        effective_from=None,
        effective_until=None,
    )
    article = create_support_article_draft(db, current_user=head, **kwargs)
    assert (
        resolve_support_article(db, topic="LOGIN_GENERAL", organization_id=org.id)
        is None
    )
    transition_support_article_lifecycle(
        db, article=article, action="approve", current_user=manager
    )
    assert (
        resolve_support_article(db, topic="LOGIN_GENERAL", organization_id=org.id)
        is None
    )
    transition_support_article_lifecycle(
        db, article=article, action="activate", current_user=head
    )
    assert (
        resolve_support_article(db, topic="LOGIN_GENERAL", organization_id=org.id).id
        == article.id
    )
    conflicting = SupportKnowledgeArticle(
        **{
            column.name: getattr(article, column.name)
            for column in SupportKnowledgeArticle.__table__.columns
            if column.name not in {"id", "created_at", "updated_at"}
        }
    )
    conflicting.version = 2
    conflicting.source_hash = "b" * 64
    db.add(conflicting)
    db.flush()
    assert (
        resolve_support_article(db, topic="LOGIN_GENERAL", organization_id=org.id)
        is None
    )
    with pytest.raises(SupportKnowledgeError):
        transition_support_article_lifecycle(
            db, article=article, action="retire", current_user=sales
        )
    with pytest.raises(SupportKnowledgeError):
        create_support_article_draft(
            db,
            current_user=head,
            **{**kwargs, "content": "Spread 1% dan modal minimum Rp5.000.000."},
        )
    db.close()


def test_support_draft_can_be_retired_before_activation(
    db_session_factory,
) -> None:
    db = db_session_factory()
    org, head, _, _, _ = _case_context(db)
    article = create_support_article_draft(
        db,
        organization_id=org.id,
        title="Draft yang dibatalkan",
        topic="LOGIN_GENERAL",
        support_level="LEVEL_1",
        content="Gunakan kanal bantuan resmi.",
        customer_safe=True,
        source="official_manual",
        source_reference="support-manual-v2",
        risk_class="LOW",
        effective_from=None,
        effective_until=None,
        current_user=head,
    )

    transition_support_article_lifecycle(
        db,
        article=article,
        action="retire",
        current_user=head,
    )

    assert article.lifecycle_status == "RETIRED"
    db.close()


def test_support_response_exposes_content_for_authorized_editor() -> None:
    assert "content" in SupportArticleResponse.model_fields
