from collections import Counter
from uuid import UUID

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session, selectinload

from app.models.ai_extraction import AIExtraction
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.reply_suggestion import ReplySuggestion
from app.models.sent_message import SentMessage
from app.models.user import User
from app.schemas.dashboard_schema import (
    DashboardAIExtractionSummary,
    DashboardLatestMessage,
    DashboardReplySuggestionSummary,
    DashboardSentMessageSummary,
    MarketingInsightsPreview,
    MarketingObjectionInsight,
    SalesConversationDetail,
    SalesInboxItem,
)
from app.services.access_control_service import (
    can_access_all_conversations,
    can_access_conversation,
)


def build_ai_summary(
    extraction: AIExtraction | None,
) -> DashboardAIExtractionSummary | None:
    if extraction is None:
        return None

    return DashboardAIExtractionSummary(
        id=extraction.id,
        lead_temperature=extraction.lead_temperature,
        pipeline_stage=extraction.pipeline_stage,
        buying_intent=extraction.buying_intent,
        sentiment=extraction.sentiment,
        risk_level=extraction.risk_level,
        main_objections=extraction.main_objections,
        next_best_action=extraction.next_best_action,
        confidence_score=extraction.confidence_score,
        created_at=extraction.created_at,
    )


def build_reply_summary(
    suggestion: ReplySuggestion | None,
) -> DashboardReplySuggestionSummary | None:
    if suggestion is None:
        return None

    return DashboardReplySuggestionSummary(
        id=suggestion.id,
        action_mode=suggestion.action_mode,
        approval_status=suggestion.approval_status,
        risk_level=suggestion.risk_level,
        suggested_replies=suggestion.suggested_replies,
        policy_reasons=suggestion.policy_reasons,
        created_at=suggestion.created_at,
    )


def get_latest_message(conversation: Conversation) -> Message | None:
    if not conversation.messages:
        return None

    return max(
        conversation.messages,
        key=lambda message: message.message_timestamp,
    )


def get_latest_extraction(conversation: Conversation) -> AIExtraction | None:
    if not conversation.ai_extractions:
        return None

    return max(
        conversation.ai_extractions,
        key=lambda extraction: extraction.created_at,
    )


def get_latest_reply_suggestion(conversation: Conversation) -> ReplySuggestion | None:
    if not conversation.reply_suggestions:
        return None

    return max(
        conversation.reply_suggestions,
        key=lambda suggestion: suggestion.created_at,
    )


def calculate_priority_score(
    extraction: AIExtraction | None,
    suggestion: ReplySuggestion | None,
) -> int:
    score = 0

    if extraction is None:
        return score

    if extraction.lead_temperature == "hot":
        score += 50
    elif extraction.lead_temperature == "warm":
        score += 30
    else:
        score += 10

    if extraction.risk_level == "high":
        score += 30
    elif extraction.risk_level == "medium":
        score += 20
    else:
        score += 5

    if extraction.pipeline_stage in {"closing", "negotiation"}:
        score += 25

    if suggestion is not None and suggestion.approval_status == "pending":
        score += 20

    return score


def determine_ui_status(
    extraction: AIExtraction | None,
    suggestion: ReplySuggestion | None,
    sent_message: SentMessage | None,
) -> str:
    if sent_message is not None:
        return "reply_sent"

    if extraction is None:
        return "needs_analysis"

    if suggestion is None:
        return "needs_reply_suggestion"

    if suggestion.approval_status == "pending":
        if suggestion.action_mode == "escalate_to_human":
            return "needs_escalation"

        if suggestion.action_mode == "human_approval_required":
            return "needs_approval"

        return "draft_ready"

    if suggestion.approval_status == "approved":
        return "approved_ready_to_send"

    if suggestion.approval_status == "rejected":
        return "reply_rejected"

    return "unknown"


def get_sales_inbox(db: Session, current_user: User) -> list[SalesInboxItem]:
    if current_user.organization_id is None:
        return []

    statement = select(Conversation).options(
        selectinload(Conversation.messages),
        selectinload(Conversation.ai_extractions),
        selectinload(Conversation.reply_suggestions),
        selectinload(Conversation.sent_messages),
    )
    statement = statement.where(
        Conversation.organization_id == current_user.organization_id
    )

    if not can_access_all_conversations(current_user):
        statement = statement.where(Conversation.sales_user_id == current_user.id)

    statement = statement.order_by(desc(Conversation.last_message_at))

    conversations = list(db.scalars(statement).all())
    inbox_items: list[SalesInboxItem] = []

    for conversation in conversations:
        latest_message = get_latest_message(conversation)
        latest_extraction = get_latest_extraction(conversation)
        latest_suggestion = get_latest_reply_suggestion(conversation)
        latest_sent_message = get_latest_sent_message(conversation)

        latest_message_summary = None
        if latest_message is not None:
            latest_message_summary = DashboardLatestMessage(
                sender_name=latest_message.sender_name,
                sender_type=latest_message.sender_type,
                message_text=latest_message.message_text,
                message_timestamp=latest_message.message_timestamp,
            )

        inbox_items.append(
            SalesInboxItem(
                conversation_id=conversation.id,
                organization_id=conversation.organization_id,
                title=conversation.title,
                source=conversation.source,
                status=conversation.status,
                started_at=conversation.started_at,
                last_message_at=conversation.last_message_at,
                created_at=conversation.created_at,
                latest_message=latest_message_summary,
                latest_sent_message=build_sent_message_summary(latest_sent_message),
                latest_ai_extraction=build_ai_summary(latest_extraction),
                latest_reply_suggestion=build_reply_summary(latest_suggestion),
                ui_status=determine_ui_status(
                    latest_extraction,
                    latest_suggestion,
                    latest_sent_message,
                ),
                priority_score=calculate_priority_score(
                    latest_extraction,
                    latest_suggestion,
                ),
                sales_user_id=conversation.sales_user_id,
            )
        )

    return sorted(
        inbox_items,
        key=lambda item: (item.priority_score, item.last_message_at or item.created_at),
        reverse=True,
    )


def get_sales_conversation_detail(
    db: Session,
    conversation_id: UUID,
    current_user: User,
) -> SalesConversationDetail | None:
    statement = (
        select(Conversation)
        .where(Conversation.id == conversation_id)
        .options(
            selectinload(Conversation.messages),
            selectinload(Conversation.ai_extractions),
            selectinload(Conversation.reply_suggestions),
            selectinload(Conversation.sent_messages),
        )
    )

    conversation = db.scalars(statement).first()

    if conversation is None:
        return None

    if not can_access_conversation(current_user, conversation):
        return None

    latest_extraction = get_latest_extraction(conversation)
    latest_suggestion = get_latest_reply_suggestion(conversation)

    sorted_messages = sorted(
        conversation.messages,
        key=lambda message: message.message_timestamp,
    )

    sorted_sent_messages = sorted(
        conversation.sent_messages,
        key=lambda sent_message: sent_message.sent_at,
        reverse=True,
    )

    return SalesConversationDetail(
        conversation_id=conversation.id,
        organization_id=conversation.organization_id,
        title=conversation.title,
        source=conversation.source,
        status=conversation.status,
        started_at=conversation.started_at,
        last_message_at=conversation.last_message_at,
        messages=[
            {
                "id": str(message.id),
                "sender_name": message.sender_name,
                "sender_type": message.sender_type,
                "message_text": message.message_text,
                "message_timestamp": message.message_timestamp.isoformat(),
            }
            for message in sorted_messages
        ],
        latest_ai_extraction=build_ai_summary(latest_extraction),
        latest_reply_suggestion=build_reply_summary(latest_suggestion),
        sent_messages=[
            {
                "id": str(sent_message.id),
                "reply_suggestion_id": str(sent_message.reply_suggestion_id) if sent_message.reply_suggestion_id else None,
                "send_mode": sent_message.send_mode,
                "message_text": sent_message.message_text,
                "sent_by_name": sent_message.sent_by_name,
                "sent_at": sent_message.sent_at.isoformat(),
            }
            for sent_message in sorted_sent_messages
        ],
        sales_user_id=conversation.sales_user_id,
    )


def get_marketing_insights_preview(
    db: Session,
    current_user: User,
) -> MarketingInsightsPreview:
    if current_user.organization_id is None:
        return MarketingInsightsPreview(
            total_conversations=0,
            total_analyzed_conversations=0,
            top_objections=[],
            lead_temperature_breakdown={},
            risk_level_breakdown={},
        )

    total_conversations = (
        db.scalar(
            select(func.count(Conversation.id)).where(
                Conversation.organization_id == current_user.organization_id
            )
        )
        or 0
    )

    extractions = list(
        db.scalars(
            select(AIExtraction)
            .join(Conversation, AIExtraction.conversation_id == Conversation.id)
            .where(Conversation.organization_id == current_user.organization_id)
            .order_by(desc(AIExtraction.created_at))
        ).all()
    )

    objection_counter: Counter[str] = Counter()
    lead_temperature_counter: Counter[str] = Counter()
    risk_level_counter: Counter[str] = Counter()

    latest_extraction_by_conversation: dict[UUID, AIExtraction] = {}

    for extraction in extractions:
        if extraction.conversation_id not in latest_extraction_by_conversation:
            latest_extraction_by_conversation[extraction.conversation_id] = extraction

    for extraction in latest_extraction_by_conversation.values():
        lead_temperature_counter[extraction.lead_temperature] += 1
        risk_level_counter[extraction.risk_level] += 1

        for objection in extraction.main_objections:
            normalized_objection = objection.strip().lower()
            if normalized_objection:
                objection_counter[normalized_objection] += 1

    top_objections = [
        MarketingObjectionInsight(topic=topic, count=count)
        for topic, count in objection_counter.most_common(10)
    ]

    return MarketingInsightsPreview(
        total_conversations=total_conversations,
        total_analyzed_conversations=len(latest_extraction_by_conversation),
        top_objections=top_objections,
        lead_temperature_breakdown=dict(lead_temperature_counter),
        risk_level_breakdown=dict(risk_level_counter),
    )


def build_sent_message_summary(
    sent_message: SentMessage | None,
) -> DashboardSentMessageSummary | None:
    if sent_message is None:
        return None

    return DashboardSentMessageSummary(
        id=sent_message.id,
        reply_suggestion_id=sent_message.reply_suggestion_id,
        send_mode=sent_message.send_mode,
        message_text=sent_message.message_text,
        sent_by_name=sent_message.sent_by_name,
        sent_at=sent_message.sent_at,
    )


def get_latest_sent_message(conversation: Conversation) -> SentMessage | None:
    if not conversation.sent_messages:
        return None

    return max(
        conversation.sent_messages,
        key=lambda sent_message: sent_message.sent_at,
    )
