from collections import Counter
from datetime import datetime, timedelta, timezone
import re

from app.schemas.ai_extraction_schema import AIExtractionCreate
from app.schemas.integration_schema import (
    SGCCConversationAnalysisRequest,
    SGCCCustomerIdentityMatchRequest,
    SGCCIdentityMatchCandidateItem,
    SGCCContentRecommendationItem,
    SGCCFollowUpRecommendationRequest,
    SGCCInsightConversationInput,
    SGCCKpiEnrichmentRequest,
    SGCCObjectionInsightItem,
    SGCCReplySuggestionRequest,
)
from app.schemas.reply_suggestion_schema import ReplySuggestionCreate
from app.services.customer_profile_service import (
    compute_identity_metadata,
    normalize_customer_identity_name,
)
from app.services.dashboard_service import (
    build_executive_recommendations,
    build_kpi_alerts,
    build_kpi_observations,
)
from app.services.ai_extraction_service import (
    AIExtractionError,
    call_openai_for_extraction,
)
from app.services.policy_engine import PolicyDecision, decide_reply_action
from app.services.reply_suggestion_service import (
    build_product_option_summary,
    call_openai_for_reply_suggestion,
    get_preferred_reply_register,
    infer_answer_commitment_level,
    infer_latest_customer_intent,
    infer_product_variant_response_mode,
    should_message_ask_product_options,
)


def _format_timestamp(timestamp: datetime | None) -> str:
    if timestamp is None:
        return datetime.now(timezone.utc).isoformat()

    if timestamp.tzinfo is None:
        return timestamp.replace(tzinfo=timezone.utc).isoformat()

    return timestamp.isoformat()


def format_sgcc_transcript(payload: SGCCConversationAnalysisRequest) -> str:
    header_lines = [
        "Context metadata:",
        f"- source_channel: {payload.source_channel}",
        f"- external_conversation_id: {payload.external_conversation_id or '-'}",
        f"- customer_name: {payload.customer_name or '-'}",
        f"- sales_name: {payload.sales_name or '-'}",
        f"- account_category: {payload.account_category or '-'}",
    ]

    if payload.extra_context:
        header_lines.append(f"- extra_context: {payload.extra_context.strip()}")

    message_lines: list[str] = []
    for message in payload.messages:
        message_text = message.message_text.replace("\x00", "").strip()
        if not message_text:
            continue

        message_lines.append(
            f"[{_format_timestamp(message.message_timestamp)}] "
            f"{message.sender_type} ({message.sender_name}): {message_text}"
        )

    if not message_lines:
        raise AIExtractionError("Conversation messages are empty after normalization.")

    return "\n".join([*header_lines, "", "Transcript:", *message_lines])


def analyze_sgcc_conversation(
    payload: SGCCConversationAnalysisRequest,
) -> AIExtractionCreate:
    transcript = format_sgcc_transcript(payload)
    return call_openai_for_extraction(transcript)


def build_sgcc_grounded_knowledge(
    payload: SGCCReplySuggestionRequest,
) -> str:
    cleaned_snippets = [
        snippet.strip()
        for snippet in payload.knowledge_snippets
        if snippet and snippet.strip()
    ]

    if not cleaned_snippets:
        return (
            "- Tidak ada knowledge snippet tambahan dari SGCC.\n"
            "- Gunakan konteks percakapan dan playbook Clara tanpa mengarang klaim produk."
        )

    return "\n".join(f"- {snippet}" for snippet in cleaned_snippets)


def _get_latest_message_text(
    payload: SGCCReplySuggestionRequest,
    sender_type: str,
) -> str:
    for message in reversed(payload.messages):
        if message.sender_type != sender_type:
            continue

        cleaned = message.message_text.replace("\x00", "").strip()
        if cleaned:
            return cleaned

    return ""


def _build_sgcc_prioritized_knowledge_brief(
    payload: SGCCReplySuggestionRequest,
) -> str:
    cleaned_snippets = [
        snippet.strip()
        for snippet in payload.knowledge_snippets
        if snippet and snippet.strip()
    ][:5]

    if not cleaned_snippets:
        return "- Tidak ada fakta prioritas tambahan dari SGCC."

    return "\n".join(f"- {snippet}" for snippet in cleaned_snippets)


def generate_sgcc_reply_suggestions(
    payload: SGCCReplySuggestionRequest,
) -> tuple[AIExtractionCreate, PolicyDecision, ReplySuggestionCreate]:
    analysis = payload.analysis or analyze_sgcc_conversation(payload)
    policy_decision = decide_reply_action(analysis)
    transcript = format_sgcc_transcript(payload)
    grounded_knowledge = build_sgcc_grounded_knowledge(payload)
    prioritized_knowledge_brief = _build_sgcc_prioritized_knowledge_brief(payload)
    latest_customer_message = _get_latest_message_text(payload, "customer")
    latest_sales_message = _get_latest_message_text(payload, "sales")
    latest_customer_intent = infer_latest_customer_intent(latest_customer_message)
    preferred_reply_register = get_preferred_reply_register(
        latest_customer_message
    )
    must_answer_with_product_options = should_message_ask_product_options(
        latest_customer_message
    )
    answer_commitment_level = infer_answer_commitment_level(
        latest_customer_message,
        latest_sales_message,
        latest_customer_intent,
    )
    include_all_variants = payload.account_category is None
    variant_response_mode = infer_product_variant_response_mode(
        latest_customer_message=latest_customer_message,
        extraction=analysis,
        current_account_category=payload.account_category,
        include_all_variants=include_all_variants,
        latest_customer_intent=latest_customer_intent,
    )
    avoid_product_variant_locking = (
        must_answer_with_product_options and payload.account_category is None
    )
    must_give_concrete_steps = bool(
        latest_customer_message
        and re.search(
            r"\b(langkah|step|tahapan|cara mulai|gimana caranya|alur)\b",
            latest_customer_message,
            re.IGNORECASE,
        )
    )
    must_give_detailed_explanation = bool(
        latest_customer_message
        and re.search(
            r"\b(detail|detailnya|jelasin semuanya|lengkap|secara rinci)\b",
            latest_customer_message,
            re.IGNORECASE,
        )
    )
    discusses_scalping_context = bool(
        re.search(
            r"\b(scalping|setup|entry|stop loss|take profit|arah market)\b",
            " ".join([latest_customer_message, latest_sales_message]),
            re.IGNORECASE,
        )
    )
    product_option_summary = build_product_option_summary(grounded_knowledge)

    suggestions = call_openai_for_reply_suggestion(
        conversation_text=transcript,
        extraction=analysis,
        action_mode=policy_decision.action_mode,
        grounded_knowledge=grounded_knowledge,
        account_category=payload.account_category,
        include_all_variants=include_all_variants,
        latest_customer_message=latest_customer_message,
        latest_sales_message=latest_sales_message,
        avoid_product_variant_locking=avoid_product_variant_locking,
        preferred_reply_register=preferred_reply_register,
        must_answer_with_product_options=must_answer_with_product_options,
        should_avoid_repeating_sales_reply=False,
        product_option_summary=product_option_summary,
        must_give_concrete_steps=must_give_concrete_steps,
        must_give_detailed_explanation=must_give_detailed_explanation,
        discusses_scalping_or_setup=discusses_scalping_context,
        latest_customer_intent=latest_customer_intent,
        prioritized_knowledge_brief=prioritized_knowledge_brief,
        answer_commitment_level=answer_commitment_level,
        variant_response_mode=variant_response_mode,
    )

    return analysis, policy_decision, suggestions


def _normalized_counter_items(counter: Counter[str], limit: int = 10) -> list[SGCCObjectionInsightItem]:
    return [
        SGCCObjectionInsightItem(topic=topic, count=count)
        for topic, count in counter.most_common(limit)
    ]


def build_sgcc_objection_insights(
    conversations: list[SGCCInsightConversationInput],
) -> tuple[
    list[SGCCObjectionInsightItem],
    dict[str, int],
    dict[str, int],
    dict[str, int],
    dict[str, int],
    list[SGCCContentRecommendationItem],
]:
    objection_counter: Counter[str] = Counter()
    risk_level_counter: Counter[str] = Counter()
    sentiment_counter: Counter[str] = Counter()
    lead_temperature_counter: Counter[str] = Counter()
    pipeline_stage_counter: Counter[str] = Counter()

    for item in conversations:
        analysis = item.analysis
        risk_level_counter[analysis.risk_level] += 1
        sentiment_counter[analysis.sentiment] += 1
        lead_temperature_counter[analysis.lead_temperature] += 1
        pipeline_stage_counter[analysis.pipeline_stage] += 1

        for objection in analysis.main_objections:
            normalized = objection.strip().lower()
            if normalized:
                objection_counter[normalized] += 1

    recommendations: list[SGCCContentRecommendationItem] = []

    for topic, count in objection_counter.most_common(3):
        recommendations.append(
            SGCCContentRecommendationItem(
                title=f"Konten edukasi untuk objection: {topic}",
                rationale=(
                    f"Topik ini muncul {count} kali pada data SGCC dan layak "
                    "dijadikan bahan edukasi, FAQ, atau script pendukung sales."
                ),
                suggested_format="carousel_instagram",
                priority="high" if count >= 3 else "medium",
            )
        )

    if sentiment_counter.get("cautious", 0) > 0:
        recommendations.append(
            SGCCContentRecommendationItem(
                title="Konten trust-building untuk leads yang masih cautious",
                rationale=(
                    "Ada percakapan dengan sentimen cautious. Tim butuh asset "
                    "yang fokus ke legalitas, bukti, proses, dan social proof."
                ),
                suggested_format="video_testimonial",
                priority="high",
            )
        )

    if risk_level_counter.get("high", 0) > 0:
        recommendations.append(
            SGCCContentRecommendationItem(
                title="Playbook respons untuk kasus high risk",
                rationale=(
                    "Terdeteksi percakapan high risk. SGCC sebaiknya menyiapkan "
                    "dokumen resmi, FAQ legalitas, dan jalur eskalasi supervisor."
                ),
                suggested_format="internal_sales_enablement",
                priority="high",
            )
        )

    return (
        _normalized_counter_items(objection_counter, limit=10),
        dict(risk_level_counter),
        dict(sentiment_counter),
        dict(lead_temperature_counter),
        dict(pipeline_stage_counter),
        recommendations[:5],
    )


def _analysis_priority_score(analysis: AIExtractionCreate) -> int:
    score = 0

    if analysis.lead_temperature == "hot":
        score += 50
    elif analysis.lead_temperature == "warm":
        score += 30
    else:
        score += 10

    if analysis.risk_level == "high":
        score += 30
    elif analysis.risk_level == "medium":
        score += 20
    else:
        score += 5

    if analysis.pipeline_stage in {"closing", "negotiation"}:
        score += 25

    return score


def _suggest_next_follow_up_at(
    *,
    urgency_level: str,
    now: datetime,
) -> datetime:
    if urgency_level == "critical":
        return now + timedelta(hours=2)
    if urgency_level == "high":
        return now + timedelta(hours=6)
    if urgency_level == "medium":
        return now + timedelta(days=1)
    return now + timedelta(days=3)


def build_sgcc_follow_up_recommendation(
    payload: SGCCFollowUpRecommendationRequest,
) -> tuple[AIExtractionCreate, PolicyDecision, int, str, str, str, str, datetime]:
    analysis = payload.analysis or analyze_sgcc_conversation(payload)
    policy_decision = decide_reply_action(analysis)
    now = datetime.now(timezone.utc)

    priority_score = _analysis_priority_score(analysis)
    latest_message = payload.messages[-1] if payload.messages else None
    next_follow_up_at = payload.next_follow_up_at
    task_type = "standard_follow_up"
    urgency_level = "medium"
    reason = (
        "Lead masih memerlukan tindak lanjut berdasarkan konteks percakapan dan "
        "hasil analisis Clara."
    )
    recommended_action = analysis.next_best_action

    normalized_follow_up_at: datetime | None = None
    if next_follow_up_at is not None:
        normalized_follow_up_at = (
            next_follow_up_at.replace(tzinfo=timezone.utc)
            if next_follow_up_at.tzinfo is None
            else next_follow_up_at.astimezone(timezone.utc)
        )

    if normalized_follow_up_at is not None and normalized_follow_up_at <= now:
        task_type = "overdue_follow_up"
        urgency_level = "critical"
        reason = "Jadwal follow-up sudah lewat dan prospek ini berisiko kehilangan momentum."
        priority_score += 40
    elif (
        analysis.lead_temperature == "hot"
        and latest_message is not None
        and latest_message.sender_type == "customer"
    ):
        task_type = "hot_lead_needs_reply"
        urgency_level = "high"
        reason = "Customer terakhir membalas dan lead bertemperatur hot. Respons cepat sangat penting."
        priority_score += 35
    elif policy_decision.action_mode == "escalate_to_human":
        task_type = "supervisor_review"
        urgency_level = "high"
        reason = "Percakapan high risk dan butuh eskalasi ke supervisor atau PIC senior."
        priority_score += 25
        recommended_action = (
            "Eskalasi kasus ini ke supervisor, review legal/risk concern, lalu "
            "tentukan follow-up yang paling aman."
        )
    elif analysis.pipeline_stage in {"closing", "negotiation"}:
        task_type = "closing_follow_up"
        urgency_level = "high"
        reason = "Lead sudah masuk negotiation/closing dan perlu follow-up disiplin sampai keputusan final."
        priority_score += 20

    suggested_next_follow_up_at = _suggest_next_follow_up_at(
        urgency_level=urgency_level,
        now=now,
    )

    return (
        analysis,
        policy_decision,
        priority_score,
        urgency_level,
        task_type,
        reason,
        recommended_action,
        suggested_next_follow_up_at,
    )


def _normalize_phone(phone_number: str | None) -> str | None:
    if phone_number is None:
        return None

    digits = re.sub(r"\D+", "", phone_number)
    return digits or None


def _normalize_email(email: str | None) -> str | None:
    if email is None:
        return None

    normalized = email.strip().lower()
    return normalized or None


def _build_identity_match_item(profile) -> SGCCIdentityMatchCandidateItem:
    canonical_key = normalize_customer_identity_name(profile.display_name)
    identity_confidence, match_strategy = compute_identity_metadata(
        display_name=profile.display_name,
        canonical_key=canonical_key,
    )
    return SGCCIdentityMatchCandidateItem(
        external_customer_id=profile.external_customer_id,
        display_name=profile.display_name,
        canonical_key=canonical_key,
        identity_confidence=identity_confidence,
        match_strategy=match_strategy,
        match_score=1.0,
        overlap_reason="Profil acuan utama dari SGCC.",
        shared_signals=[],
        source_channel=profile.source_channel,
    )


def _calculate_identity_match(
    primary_profile,
    candidate_profile,
) -> tuple[float, str, list[str]]:
    primary_key = normalize_customer_identity_name(primary_profile.display_name)
    candidate_key = normalize_customer_identity_name(candidate_profile.display_name)
    primary_tokens = set(primary_key.split())
    candidate_tokens = set(candidate_key.split())
    overlap = primary_tokens & candidate_tokens
    union = primary_tokens | candidate_tokens

    score = 0.0
    shared_signals: list[str] = []
    reasons: list[str] = []

    if union:
        token_score = len(overlap) / len(union)
        score += token_score * 0.6
        if overlap:
            shared_signals.append(f"token:{','.join(sorted(overlap))}")
            reasons.append(f"Overlap token identitas: {', '.join(sorted(overlap))}.")

    primary_phone = _normalize_phone(primary_profile.phone_number)
    candidate_phone = _normalize_phone(candidate_profile.phone_number)
    if primary_phone and candidate_phone and primary_phone == candidate_phone:
        score += 0.3
        shared_signals.append("phone:exact")
        reasons.append("Nomor telepon identik.")

    primary_email = _normalize_email(primary_profile.email)
    candidate_email = _normalize_email(candidate_profile.email)
    if primary_email and candidate_email and primary_email == candidate_email:
        score += 0.3
        shared_signals.append("email:exact")
        reasons.append("Email identik.")

    if primary_profile.source_channel == candidate_profile.source_channel:
        score += 0.05
        shared_signals.append("source_channel:same")
        reasons.append("Datang dari channel yang sama.")

    if (
        primary_profile.assigned_user_name
        and candidate_profile.assigned_user_name
        and primary_profile.assigned_user_name.strip().lower()
        == candidate_profile.assigned_user_name.strip().lower()
    ):
        score += 0.1
        shared_signals.append("assigned_user:same")
        reasons.append("PIC SGCC yang sama.")

    score = min(round(score, 2), 0.99)
    if not reasons:
        reasons.append("Kecocokan masih lemah dan hanya berbasis sinyal terbatas.")
    return score, " ".join(reasons), shared_signals


def build_sgcc_customer_identity_match(
    payload: SGCCCustomerIdentityMatchRequest,
) -> tuple[SGCCIdentityMatchCandidateItem, SGCCIdentityMatchCandidateItem | None, list[SGCCIdentityMatchCandidateItem], bool, str]:
    primary_item = _build_identity_match_item(payload.primary_profile)
    candidates: list[SGCCIdentityMatchCandidateItem] = []

    for candidate in payload.candidate_profiles:
        candidate_key = normalize_customer_identity_name(candidate.display_name)
        identity_confidence, match_strategy = compute_identity_metadata(
            display_name=candidate.display_name,
            canonical_key=candidate_key,
        )
        match_score, overlap_reason, shared_signals = _calculate_identity_match(
            payload.primary_profile,
            candidate,
        )
        if match_score < payload.match_threshold:
            continue

        candidates.append(
            SGCCIdentityMatchCandidateItem(
                external_customer_id=candidate.external_customer_id,
                display_name=candidate.display_name,
                canonical_key=candidate_key,
                identity_confidence=identity_confidence,
                match_strategy=match_strategy,
                match_score=match_score,
                overlap_reason=overlap_reason,
                shared_signals=shared_signals,
                source_channel=candidate.source_channel,
            )
        )

    candidates.sort(key=lambda item: item.match_score, reverse=True)
    recommended_match = candidates[0] if candidates else None
    should_merge = recommended_match is not None and recommended_match.match_score >= max(
        payload.match_threshold,
        0.7,
    )
    merge_reason = (
        f"Candidate teratas memiliki match_score {recommended_match.match_score:.2f} dan cukup kuat untuk digabung."
        if should_merge and recommended_match is not None
        else (
            f"Belum ada candidate di atas threshold merge kuat. Threshold screening saat ini {payload.match_threshold:.2f}."
            if candidates
            else "Tidak ada candidate yang lolos threshold screening."
        )
    )

    return primary_item, recommended_match, candidates[:10], should_merge, merge_reason


def build_sgcc_kpi_enrichment(
    payload: SGCCKpiEnrichmentRequest,
) -> tuple[str, list[str], list, list, list[str]]:
    alerts = build_kpi_alerts(
        summary=payload.summary,
        sales_rows=payload.sales_performance,
        organization_rows=payload.organization_performance,
    )
    observations = build_kpi_observations(
        summary=payload.summary,
        marketing_execution_summary=payload.marketing_execution_summary,
        top_sales_rows=payload.sales_performance[:3],
        top_org_rows=payload.organization_performance[:3],
    )
    recommendations = build_executive_recommendations(
        summary=payload.summary,
        marketing_execution_summary=payload.marketing_execution_summary,
        alerts=alerts,
        sales_rows=payload.sales_performance,
        organization_rows=payload.organization_performance,
    )

    high_alert_count = sum(1 for alert in alerts if alert.severity == "high")
    medium_alert_count = sum(1 for alert in alerts if alert.severity == "medium")
    if high_alert_count > 0:
        health_status = "critical"
    elif medium_alert_count > 1 or payload.summary.reply_sent_rate < 0.5:
        health_status = "attention"
    else:
        health_status = "healthy"

    top_priorities: list[str] = []
    for alert in alerts[:2]:
        top_priorities.append(f"[{alert.severity.upper()}] {alert.title}")
    for recommendation in recommendations[:2]:
        top_priorities.append(recommendation.next_step)

    return (
        health_status,
        observations[:5],
        alerts[:8],
        recommendations[:6],
        top_priorities[:4],
    )
