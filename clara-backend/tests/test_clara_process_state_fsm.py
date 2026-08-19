from datetime import datetime, timezone
from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app.core.clara_runtime_contract import ProcessState
from app.core.config import settings
from app.models.customer_process_state_event import CustomerProcessStateEvent
from app.models.customer_profile import CustomerProfile
from app.models.conversation import Conversation
from app.models.lead import Lead
from app.models.message import Message
from app.models.organization import Organization
from app.models.user import User
from app.services.clara_legacy_behavior_service import build_runtime_context_block
from app.services.clara_process_state_service import (
    PROCESS_STATE_ORDER,
    ProcessStateMode,
    ProcessStateObservation,
    TransitionDecision,
    TrustLevel,
    apply_manual_process_state_transition,
    decide_process_state_transition,
    derive_process_state_observation,
    get_or_create_process_state,
    has_unresolved_merge_reconciliation,
    normalize_process_state_mode,
    parse_process_state,
    reconcile_customer_process_states,
    record_process_state_observation,
    state_rank,
)
from app.services.clara_reply_validation_service import ReplyValidationContext, evaluate_reply
from app.schemas.ai_extraction_schema import AIExtractionCreate
from app.services.ai_extraction_service import analyze_conversation


def observation(
    state: ProcessState,
    *,
    confidence: float = 0.9,
    trust: TrustLevel = TrustLevel.HIGH,
    evidence: tuple[str, ...] = ("AUTHORIZED_AGENT_CONFIRMATION",),
) -> ProcessStateObservation:
    return ProcessStateObservation(
        proposed_state=state,
        confidence_score=confidence,
        source_type="AGENT_MESSAGE",
        source_trust_level=trust,
        evidence_codes=evidence,
        source_reference_type="message",
        source_reference_id=uuid4(),
        safe_reason_codes=("TEST_CONFIRMATION",),
    )


def decide(
    current: ProcessState,
    candidate: ProcessStateObservation,
    *,
    mode: ProcessStateMode = ProcessStateMode.FSM,
    trust: TrustLevel = TrustLevel.LOW,
    confidence: float = 0,
):
    return decide_process_state_transition(
        current_state=current,
        current_confidence=confidence,
        current_trust_level=trust,
        current_version=1,
        manual_lock=False,
        observation=candidate,
        mode=mode,
    )


def add_profile_and_users(db):
    organization = Organization(name="FSM Org", slug=f"fsm-{uuid4().hex}")
    db.add(organization)
    db.flush()
    profile = CustomerProfile(
        organization_id=organization.id,
        display_name="Customer FSM",
        canonical_key="fsm",
    )
    sales = User(
        organization_id=organization.id,
        name="Sales FSM",
        email=f"sales-{uuid4().hex}@example.test",
        hashed_password="unused",
        role="sales",
    )
    manager = User(
        organization_id=organization.id,
        name="Manager FSM",
        email=f"manager-{uuid4().hex}@example.test",
        hashed_password="unused",
        role="manager",
    )
    db.add_all([profile, sales, manager])
    db.flush()
    return profile, sales, manager


def test_vocabulary_order_and_safe_mode_defaults() -> None:
    assert tuple(state.value for state in PROCESS_STATE_ORDER) == (
        "UNKNOWN",
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
    )
    assert [state_rank(state) for state in PROCESS_STATE_ORDER] == list(range(0, 101, 10))
    for rejected in ("closing", "won", "education", "COLD", "WARM", "HOT"):
        with pytest.raises(ValueError):
            parse_process_state(rejected)
    assert normalize_process_state_mode(None) == ProcessStateMode.LEGACY
    assert normalize_process_state_mode("invalid") == ProcessStateMode.LEGACY
    assert normalize_process_state_mode(" shadow ") == ProcessStateMode.SHADOW
    assert settings.clara_process_state_mode == "LEGACY"
    assert settings.clara_persona_authority_mode == "LEGACY"
    assert settings.clara_semantic_revalidation_mode == "OFF"
    assert settings.clara_policy_enforcement_mode == "OBSERVE"
    assert settings.clara_product_fact_mode == "REGISTRY"


def test_language_precision_blocks_question_hypothetical_and_negation() -> None:
    cases = (
        "Apakah akun saya sudah verified?",
        "Nanti kalau data sudah dikirim kita lanjut.",
        "Data belum saya kirim.",
    )
    for text in cases:
        result = derive_process_state_observation(
            message_text=text,
            sender_type="customer",
            pipeline_stage="closing",
        )
        assert result.proposed_state == ProcessState.UNKNOWN
        assert "PIPELINE_STAGE_HINT" in result.evidence_codes

    explicit = derive_process_state_observation(
        message_text="Data sudah saya kirim.",
        sender_type="customer",
    )
    assert explicit.proposed_state == ProcessState.DATA_SUBMITTED
    assert "DATA_SUBMISSION_CONFIRMED" in explicit.evidence_codes


def test_forward_same_state_skip_and_regression_contract() -> None:
    one_step = decide(
        ProcessState.EXPLORATION,
        observation(ProcessState.READY_TO_PROCEED, confidence=0.8),
    )
    assert one_step.decision == TransitionDecision.APPLIED

    same = decide(
        ProcessState.READY_TO_PROCEED,
        observation(ProcessState.READY_TO_PROCEED, confidence=0.8),
    )
    assert same.decision == TransitionDecision.SAME_STATE_CONFIRMED

    trusted_skip = decide(
        ProcessState.UNKNOWN,
        observation(ProcessState.DATA_SUBMITTED, confidence=0.94),
    )
    assert trusted_skip.decision == TransitionDecision.APPLIED
    weak_skip = decide(
        ProcessState.UNKNOWN,
        observation(ProcessState.DATA_SUBMITTED, confidence=0.84, trust=TrustLevel.MEDIUM),
    )
    assert weak_skip.decision == TransitionDecision.REJECTED_LOW_CONFIDENCE

    regression = decide(
        ProcessState.VERIFIED,
        observation(ProcessState.NEW_INQUIRY, confidence=0.99),
        trust=TrustLevel.HIGH,
        confidence=0.9,
    )
    assert regression.decision == TransitionDecision.REJECTED_REGRESSION
    assert regression.applied_state == ProcessState.VERIFIED
    assert regression.decision_hash == decide(
        ProcessState.VERIFIED,
        observation(
            ProcessState.NEW_INQUIRY,
            confidence=0.99,
            evidence=("AUTHORIZED_AGENT_CONFIRMATION",),
        ),
        trust=TrustLevel.HIGH,
        confidence=0.9,
    ).decision_hash


def test_sensitive_states_require_trusted_specific_evidence() -> None:
    customer_verified = observation(
        ProcessState.VERIFIED,
        confidence=0.95,
        trust=TrustLevel.MEDIUM,
        evidence=("EXPLICIT_CUSTOMER_STATEMENT", "VERIFICATION_COMPLETED_CONFIRMED"),
    )
    assert decide(
        ProcessState.VERIFICATION_IN_PROGRESS, customer_verified
    ).decision == TransitionDecision.REJECTED_INSUFFICIENT_EVIDENCE

    ai_only = observation(
        ProcessState.ACCOUNT_ACTIVE,
        confidence=0.99,
        trust=TrustLevel.HIGH,
        evidence=("AI_INFERENCE_ONLY", "ACCOUNT_ACTIVATION_CONFIRMED"),
    )
    assert decide(
        ProcessState.ONBOARDING_OR_ACTIVATION, ai_only
    ).decision == TransitionDecision.REJECTED_INSUFFICIENT_EVIDENCE

    authorized = observation(
        ProcessState.ACCOUNT_ACTIVE,
        confidence=0.95,
        evidence=("AUTHORIZED_AGENT_CONFIRMATION", "ACCOUNT_ACTIVATION_CONFIRMED"),
    )
    assert decide(
        ProcessState.ONBOARDING_OR_ACTIVATION, authorized
    ).decision == TransitionDecision.APPLIED


def test_shadow_records_without_applying_and_fsm_is_customer_scoped(
    db_session_factory: sessionmaker,
) -> None:
    db = db_session_factory()
    profile, _, _ = add_profile_and_users(db)
    state = get_or_create_process_state(db, profile)
    shadow = record_process_state_observation(
        db,
        profile=profile,
        observation=observation(ProcessState.NEW_INQUIRY, confidence=0.8),
        mode=ProcessStateMode.SHADOW,
        correlation_id="channel-whatsapp",
    )
    assert shadow.decision == TransitionDecision.OBSERVED
    assert state.current_state == ProcessState.UNKNOWN.value

    applied = record_process_state_observation(
        db,
        profile=profile,
        observation=observation(ProcessState.NEW_INQUIRY, confidence=0.8),
        mode=ProcessStateMode.FSM,
        correlation_id="channel-instagram",
    )
    db.commit()
    db.refresh(state)
    assert applied.decision == TransitionDecision.APPLIED
    assert state.current_state == ProcessState.NEW_INQUIRY.value
    assert len(db.scalars(select(CustomerProcessStateEvent)).all()) == 2
    db.close()


def test_manual_authorization_concurrency_and_immutable_history(
    db_session_factory: sessionmaker,
) -> None:
    db = db_session_factory()
    profile, sales, manager = add_profile_and_users(db)
    state = get_or_create_process_state(db, profile)
    first = apply_manual_process_state_transition(
        db,
        profile=profile,
        proposed_state=ProcessState.DATA_SUBMITTED,
        expected_version=state.version,
        reason_code="SALES_CONFIRMED_DATA",
        actor=sales,
    )
    assert first.applied_state == ProcessState.DATA_SUBMITTED
    db.flush()
    db.refresh(state)

    with pytest.raises(PermissionError):
        apply_manual_process_state_transition(
            db,
            profile=profile,
            proposed_state=ProcessState.EXPLORATION,
            expected_version=state.version,
            reason_code="SALES_REGRESSION",
            actor=sales,
        )
    with pytest.raises(ValueError):
        apply_manual_process_state_transition(
            db,
            profile=profile,
            proposed_state=ProcessState.VERIFIED,
            expected_version=state.version,
            reason_code="",
            actor=manager,
        )

    corrected = apply_manual_process_state_transition(
        db,
        profile=profile,
        proposed_state=ProcessState.EXPLORATION,
        expected_version=state.version,
        reason_code="MANAGER_CORRECTION",
        actor=manager,
    )
    db.commit()
    assert corrected.decision == TransitionDecision.MANUAL_CORRECTION
    events = db.scalars(
        select(CustomerProcessStateEvent).where(
            CustomerProcessStateEvent.customer_profile_id == profile.id
        )
    ).all()
    assert len(events) == 2
    assert {event.decision for event in events} == {"APPLIED", "MANUAL_CORRECTION"}
    db.close()


def test_merge_preserves_history_and_conflict_requires_review(
    db_session_factory: sessionmaker,
) -> None:
    db = db_session_factory()
    source, _, manager = add_profile_and_users(db)
    target = CustomerProfile(
        organization_id=source.organization_id,
        display_name="Target FSM",
        canonical_key=f"target-{uuid4().hex}",
    )
    db.add(target)
    db.flush()
    source_state = get_or_create_process_state(db, source)
    target_state = get_or_create_process_state(db, target)
    source_state.current_state = ProcessState.VERIFIED.value
    source_state.state_rank = state_rank(ProcessState.VERIFIED)
    source_state.source_trust_level = TrustLevel.HIGH.value
    source_state.confidence_score = 0.95
    target_state.current_state = ProcessState.ACCOUNT_ACTIVE.value
    target_state.state_rank = state_rank(ProcessState.ACCOUNT_ACTIVE)
    target_state.source_trust_level = TrustLevel.HIGH.value
    target_state.confidence_score = 0.95
    db.flush()

    result = reconcile_customer_process_states(
        db,
        source_profile=source,
        target_profile=target,
        actor_user_id=manager.id,
    )
    assert result == TransitionDecision.MERGE_RECONCILIATION_REQUIRED
    assert target_state.current_state == ProcessState.ACCOUNT_ACTIVE.value
    assert source_state.manual_lock
    event = db.scalar(
        select(CustomerProcessStateEvent).where(
            CustomerProcessStateEvent.customer_profile_id == target.id
        )
    )
    assert event is not None
    assert event.decision == "MERGE_RECONCILIATION_REQUIRED"
    assert has_unresolved_merge_reconciliation(db, target.id)

    with pytest.raises(ValueError):
        apply_manual_process_state_transition(
            db,
            profile=target,
            proposed_state=ProcessState.VERIFIED,
            expected_version=target_state.version,
            reason_code="NOT_EXPLICIT_MERGE_REVIEW",
            actor=manager,
        )
    apply_manual_process_state_transition(
        db,
        profile=target,
        proposed_state=ProcessState.VERIFIED,
        expected_version=target_state.version,
        reason_code="MERGE_MANAGER_RESOLUTION",
        actor=manager,
    )
    db.flush()
    assert not has_unresolved_merge_reconciliation(db, target.id)

    source.merged_into_profile_id = target.id
    with pytest.raises(ValueError):
        record_process_state_observation(
            db,
            profile=source,
            observation=observation(ProcessState.ACTIVE_SUPPORT),
            mode=ProcessStateMode.FSM,
        )
    db.close()


def test_prompt_and_validator_use_state_only_when_explicitly_supplied() -> None:
    legacy = build_runtime_context_block(
        latest_customer_intent="general",
        preferred_reply_register="neutral_polite",
        answer_commitment_level="answer_then_optional_clarify",
        variant_response_mode="neutral",
        customer_has_variant_commitment=False,
        conversation_variant_focus=None,
        customer_has_identity_submission=False,
        customer_has_verification_completion=False,
    )
    assert "canonical_process_state" not in legacy
    fsm = build_runtime_context_block(
        latest_customer_intent="general",
        preferred_reply_register="neutral_polite",
        answer_commitment_level="answer_then_optional_clarify",
        variant_response_mode="neutral",
        customer_has_variant_commitment=False,
        conversation_variant_focus=None,
        customer_has_identity_submission=True,
        customer_has_verification_completion=True,
        canonical_process_state="FUNDED",
    )
    assert "canonical_process_state=FUNDED" in fsm

    reply = "Silakan kirim nama lengkap dan nomor HP dulu untuk verifikasi."
    legacy_report = evaluate_reply(reply, ReplyValidationContext())
    fsm_report = evaluate_reply(
        reply,
        ReplyValidationContext(canonical_process_state="DATA_SUBMITTED"),
    )
    assert "repeated_identity_request" not in legacy_report.failed_validator_ids
    assert "repeated_identity_request" in fsm_report.failed_validator_ids


def test_process_state_api_is_authenticated_scoped_and_versioned(
    client,
    seeded_data: dict[str, object],
) -> None:
    profile = seeded_data["owned_customer_profile"]
    unauthenticated = client.get(f"/customers/{profile.id}/process-state")
    assert unauthenticated.status_code == 401

    admin = seeded_data["admin_a"]
    login_response = client.post(
        "/auth/login",
        json={"email": admin.email, "password": "AdminPass123!"},
    )
    assert login_response.status_code == 200
    current = client.get(f"/customers/{profile.id}/process-state")
    assert current.status_code == 200, current.text
    assert current.json()["current_state"] == "UNKNOWN"

    csrf_token = client.cookies.get(settings.csrf_cookie_name)
    assert csrf_token
    changed = client.post(
        f"/customers/{profile.id}/process-state/transitions",
        json={
            "proposed_state": "DATA_SUBMITTED",
            "expected_version": current.json()["version"],
            "reason_code": "HEAD_CONFIRMED_DATA",
        },
        headers={"X-CSRF-Token": csrf_token},
    )
    assert changed.status_code == 200, changed.text
    assert changed.json()["current"]["current_state"] == "DATA_SUBMITTED"

    stale = client.post(
        f"/customers/{profile.id}/process-state/transitions",
        json={
            "proposed_state": "VERIFIED",
            "expected_version": current.json()["version"],
            "reason_code": "STALE_UPDATE",
        },
        headers={"X-CSRF-Token": csrf_token},
    )
    assert stale.status_code == 409
    history = client.get(f"/customers/{profile.id}/process-state/history")
    assert history.status_code == 200
    assert history.json()[0]["reason_codes"] == ["HEAD_CONFIRMED_DATA"]

    other_org_user = seeded_data["marketing_other_org"]
    other_login = client.post(
        "/auth/login",
        json={"email": other_org_user.email, "password": "MarketingPass123!"},
    )
    assert other_login.status_code == 200
    assert client.get(f"/customers/{profile.id}/process-state").status_code == 404


def test_extraction_keeps_pipeline_legacy_and_routes_observation_by_mode(
    db_session_factory: sessionmaker,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db = db_session_factory()
    profile, sales, _ = add_profile_and_users(db)
    lead = Lead(
        organization_id=profile.organization_id,
        assigned_user_id=sales.id,
        customer_profile_id=profile.id,
        display_name="Customer FSM",
        source="whatsapp",
    )
    conversation = Conversation(
        organization_id=profile.organization_id,
        sales_user_id=sales.id,
        title="Customer FSM",
        source="whatsapp",
        lead=lead,
    )
    message = Message(
        conversation=conversation,
        sender_name="Agent",
        sender_type="sales",
        message_text="Data sudah diterima.",
        message_timestamp=datetime.now(timezone.utc),
    )
    db.add_all([lead, conversation, message])
    db.commit()

    monkeypatch.setattr(
        "app.services.ai_extraction_service.call_openai_for_extraction",
        lambda _text: AIExtractionCreate(
            lead_temperature="hot",
            pipeline_stage="closing",
            buying_intent="high",
            sentiment="positive",
            risk_level="low",
            main_objections=[],
            budget_signal={"detected": False, "amount_text": None, "notes": "none"},
            recommended_reply_strategy={
                "tone": "professional",
                "key_points": [],
                "avoid_topics": [],
            },
            customer_summary="Safe synthetic summary.",
            next_best_action="Continue safely.",
            content_insight="Synthetic.",
            internal_notes="Synthetic.",
            confidence_score=0.95,
        ),
    )

    monkeypatch.setattr(settings, "clara_process_state_mode", "SHADOW")
    analyze_conversation(db, conversation.id)
    db.refresh(conversation)
    state = get_or_create_process_state(db, profile)
    assert conversation.current_stage == "closing"
    assert lead.current_stage == "closing"
    assert state.current_state == "UNKNOWN"
    assert db.scalar(select(CustomerProcessStateEvent).order_by(CustomerProcessStateEvent.created_at.desc())).decision == "OBSERVED"

    monkeypatch.setattr(settings, "clara_process_state_mode", "FSM")
    analyze_conversation(db, conversation.id)
    db.refresh(state)
    decisions = list(
        db.scalars(
            select(CustomerProcessStateEvent).order_by(
                CustomerProcessStateEvent.created_at.desc()
            )
        ).all()
    )
    assert state.current_state == "DATA_SUBMITTED", [
        (event.decision, event.proposed_state, event.reason_codes) for event in decisions
    ]
    assert conversation.current_stage == "closing"
    db.close()
