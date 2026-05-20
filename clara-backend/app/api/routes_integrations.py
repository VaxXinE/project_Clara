from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import require_sgcc_integration
from app.db.session import get_db
from app.schemas.integration_schema import (
    SGCCConversationAnalysisRequest,
    SGCCConversationAnalysisResponse,
    SGCCCustomerIdentityMatchRequest,
    SGCCCustomerIdentityMatchResponse,
    SGCCFollowUpRecommendationRequest,
    SGCCFollowUpRecommendationResponse,
    SGCCKpiEnrichmentRequest,
    SGCCKpiEnrichmentResponse,
    SGCCObjectionInsightsRequest,
    SGCCObjectionInsightsResponse,
    SGCCReplySuggestionRequest,
    SGCCReplySuggestionResponse,
)
from app.services.ai_extraction_service import AIExtractionError
from app.services.audit_service import create_audit_log
from app.services.reply_suggestion_service import ReplySuggestionError
from app.services.rate_limiter import sgcc_integration_rate_limiter
from app.services.sgcc_integration_service import (
    analyze_sgcc_conversation,
    build_sgcc_customer_identity_match,
    build_sgcc_follow_up_recommendation,
    build_sgcc_kpi_enrichment,
    build_sgcc_objection_insights,
    generate_sgcc_reply_suggestions,
)

router = APIRouter(prefix="/integrations/sgcc", tags=["integrations"])


def enforce_sgcc_rate_limit(request: Request) -> None:
    ip_address = request.client.host if request.client else "unknown"
    rate_limit_key = f"sgcc:{request.url.path}:{ip_address}"

    if not sgcc_integration_rate_limiter.is_allowed(
        key=rate_limit_key,
        limit=settings.sgcc_integration_rate_limit_per_minute,
        window_seconds=60,
    ):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many SGCC integration requests. Please try again later.",
        )


def create_sgcc_audit_entry(
    *,
    db: Session,
    request: Request,
    action: str,
    resource_id: str | None,
    metadata: dict,
) -> None:
    create_audit_log(
        db=db,
        action=action,
        resource_type="sgcc_integration",
        resource_id=resource_id,
        current_user=None,
        request=request,
        metadata={"integration_client": "sgcc", **metadata},
    )


@router.post(
    "/conversation-analysis",
    response_model=SGCCConversationAnalysisResponse,
)
def analyze_sgcc_conversation_endpoint(
    payload: SGCCConversationAnalysisRequest,
    request: Request,
    db: Session = Depends(get_db),
    _integration_client: str = Depends(require_sgcc_integration),
):
    enforce_sgcc_rate_limit(request)

    try:
        analysis = analyze_sgcc_conversation(payload)
        create_sgcc_audit_entry(
            db=db,
            request=request,
            action="integration.sgcc.conversation_analysis",
            resource_id=payload.external_conversation_id,
            metadata={
                "source_channel": payload.source_channel,
                "message_count": len(payload.messages),
                "account_category": payload.account_category,
                "risk_level": analysis.risk_level,
                "pipeline_stage": analysis.pipeline_stage,
            },
        )
        return SGCCConversationAnalysisResponse(
            model_name=settings.openai_model,
            analysis=analysis,
        )
    except AIExtractionError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.post(
    "/reply-suggestions",
    response_model=SGCCReplySuggestionResponse,
)
def generate_sgcc_reply_suggestions_endpoint(
    payload: SGCCReplySuggestionRequest,
    request: Request,
    db: Session = Depends(get_db),
    _integration_client: str = Depends(require_sgcc_integration),
):
    enforce_sgcc_rate_limit(request)

    try:
        analysis, policy_decision, suggestions = generate_sgcc_reply_suggestions(
            payload
        )
        create_sgcc_audit_entry(
            db=db,
            request=request,
            action="integration.sgcc.reply_suggestions",
            resource_id=payload.external_conversation_id,
            metadata={
                "source_channel": payload.source_channel,
                "message_count": len(payload.messages),
                "account_category": payload.account_category,
                "used_supplied_analysis": payload.analysis is not None,
                "action_mode": policy_decision.action_mode,
                "risk_level": analysis.risk_level,
            },
        )
        return SGCCReplySuggestionResponse(
            model_name=settings.openai_model,
            analysis=analysis,
            action_mode=policy_decision.action_mode,
            policy_reasons=policy_decision.reasons,
            suggested_replies=suggestions.suggested_replies,
        )
    except (AIExtractionError, ReplySuggestionError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.post(
    "/objection-insights",
    response_model=SGCCObjectionInsightsResponse,
)
def sgcc_objection_insights_endpoint(
    payload: SGCCObjectionInsightsRequest,
    request: Request,
    db: Session = Depends(get_db),
    _integration_client: str = Depends(require_sgcc_integration),
):
    enforce_sgcc_rate_limit(request)

    (
        top_objections,
        risk_level_breakdown,
        sentiment_breakdown,
        lead_temperature_breakdown,
        pipeline_stage_breakdown,
        content_recommendations,
    ) = build_sgcc_objection_insights(payload.conversations)

    create_sgcc_audit_entry(
        db=db,
        request=request,
        action="integration.sgcc.objection_insights",
        resource_id=payload.period_label,
        metadata={
            "conversation_count": len(payload.conversations),
            "period_label": payload.period_label,
            "top_objection_count": len(top_objections),
        },
    )

    return SGCCObjectionInsightsResponse(
        period_label=payload.period_label,
        total_conversations=len(payload.conversations),
        top_objections=top_objections,
        risk_level_breakdown=risk_level_breakdown,
        sentiment_breakdown=sentiment_breakdown,
        lead_temperature_breakdown=lead_temperature_breakdown,
        pipeline_stage_breakdown=pipeline_stage_breakdown,
        content_recommendations=content_recommendations,
    )


@router.post(
    "/follow-up-recommendation",
    response_model=SGCCFollowUpRecommendationResponse,
)
def sgcc_follow_up_recommendation_endpoint(
    payload: SGCCFollowUpRecommendationRequest,
    request: Request,
    db: Session = Depends(get_db),
    _integration_client: str = Depends(require_sgcc_integration),
):
    enforce_sgcc_rate_limit(request)

    try:
        (
            analysis,
            policy_decision,
            priority_score,
            urgency_level,
            task_type,
            reason,
            recommended_action,
            suggested_next_follow_up_at,
        ) = build_sgcc_follow_up_recommendation(payload)

        create_sgcc_audit_entry(
            db=db,
            request=request,
            action="integration.sgcc.follow_up_recommendation",
            resource_id=payload.external_conversation_id,
            metadata={
                "source_channel": payload.source_channel,
                "message_count": len(payload.messages),
                "account_category": payload.account_category,
                "used_supplied_analysis": payload.analysis is not None,
                "priority_score": priority_score,
                "urgency_level": urgency_level,
                "task_type": task_type,
            },
        )

        return SGCCFollowUpRecommendationResponse(
            model_name=settings.openai_model,
            analysis=analysis,
            action_mode=policy_decision.action_mode,
            policy_reasons=policy_decision.reasons,
            priority_score=priority_score,
            urgency_level=urgency_level,
            task_type=task_type,
            reason=reason,
            recommended_action=recommended_action,
            suggested_next_follow_up_at=suggested_next_follow_up_at,
        )
    except AIExtractionError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.post(
    "/customer-identity-match",
    response_model=SGCCCustomerIdentityMatchResponse,
)
def sgcc_customer_identity_match_endpoint(
    payload: SGCCCustomerIdentityMatchRequest,
    request: Request,
    db: Session = Depends(get_db),
    _integration_client: str = Depends(require_sgcc_integration),
):
    enforce_sgcc_rate_limit(request)

    (
        primary_profile,
        recommended_match,
        match_candidates,
        should_merge,
        merge_reason,
    ) = build_sgcc_customer_identity_match(payload)

    create_sgcc_audit_entry(
        db=db,
        request=request,
        action="integration.sgcc.customer_identity_match",
        resource_id=payload.primary_profile.external_customer_id,
        metadata={
            "candidate_count": len(payload.candidate_profiles),
            "screened_match_count": len(match_candidates),
            "should_merge": should_merge,
            "primary_source_channel": payload.primary_profile.source_channel,
        },
    )

    return SGCCCustomerIdentityMatchResponse(
        primary_profile=primary_profile,
        recommended_match=recommended_match,
        match_candidates=match_candidates,
        should_merge=should_merge,
        merge_reason=merge_reason,
    )


@router.post(
    "/kpi-enrichment",
    response_model=SGCCKpiEnrichmentResponse,
)
def sgcc_kpi_enrichment_endpoint(
    payload: SGCCKpiEnrichmentRequest,
    request: Request,
    db: Session = Depends(get_db),
    _integration_client: str = Depends(require_sgcc_integration),
):
    enforce_sgcc_rate_limit(request)

    (
        health_status,
        key_observations,
        alerts,
        recommendations,
        top_priorities,
    ) = build_sgcc_kpi_enrichment(payload)

    create_sgcc_audit_entry(
        db=db,
        request=request,
        action="integration.sgcc.kpi_enrichment",
        resource_id=payload.period_label,
        metadata={
            "source_channel": payload.source_channel,
            "health_status": health_status,
            "alert_count": len(alerts),
            "recommendation_count": len(recommendations),
        },
    )

    return SGCCKpiEnrichmentResponse(
        period_label=payload.period_label,
        source_channel=payload.source_channel,
        health_status=health_status,
        key_observations=key_observations,
        alerts=alerts,
        recommendations=recommendations,
        top_priorities=top_priorities,
    )
