from collections import Counter
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session, selectinload

from app.models.ai_extraction import AIExtraction
from app.models.audit_log import AuditLog
from app.models.conversation import Conversation
from app.models.lead import Lead
from app.models.marketing_insight_snapshot import MarketingInsightSnapshot
from app.models.message import Message
from app.models.organization import Organization
from app.models.product_knowledge import ProductKnowledge
from app.models.reply_suggestion import ReplySuggestion
from app.models.sent_message import SentMessage
from app.models.user import User
from app.schemas.dashboard_schema import (
    DashboardAIExtractionSummary,
    DashboardLatestMessage,
    DashboardReplySuggestionSummary,
    DashboardSentMessageSummary,
    ExecutiveRecommendationItem,
    KpiAlertItem,
    KpiCommandCenterResponse,
    KpiSummaryCard,
    MarketingAdsSignal,
    MarketingBreakdownItem,
    MarketingContentBrief,
    MarketingContentRecommendation,
    OrganizationPerformanceRow,
    OpsAuditLogRow,
    OpsConversationRow,
    OpsDatabaseOverviewResponse,
    OpsOrganizationRow,
    OpsProductKnowledgeRow,
    OpsSnapshotRow,
    OpsTableCountItem,
    OpsUserRow,
    MarketingInsightsPreview,
    MarketingKpiSummary,
    MarketingObjectionInsight,
    MarketingPlanningItem,
    SalesApprovalQueueItem,
    SalesApprovalQueueResponse,
    SalesPerformanceRow,
    SalesConversationDetail,
    SalesInboxItem,
    SalesWorklistItem,
    SalesWorklistResponse,
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


def parse_uuid_or_none(value: str | None) -> UUID | None:
    if not value:
        return None

    try:
        return UUID(value)
    except (TypeError, ValueError):
        return None


def ensure_aware_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None

    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)

    return value.astimezone(timezone.utc)


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


def has_fresh_customer_reply(
    latest_message: Message | None,
    sent_message: SentMessage | None,
) -> bool:
    if latest_message is None or sent_message is None:
        return False

    if latest_message.sender_type != "customer":
        return False

    return latest_message.message_timestamp > sent_message.sent_at


def extraction_is_stale(
    extraction: AIExtraction | None,
    latest_message: Message | None,
) -> bool:
    if latest_message is None or latest_message.sender_type != "customer":
        return extraction is None

    if extraction is None:
        return True

    return extraction.created_at < latest_message.message_timestamp


def suggestion_is_stale(
    suggestion: ReplySuggestion | None,
    latest_message: Message | None,
) -> bool:
    if latest_message is None or latest_message.sender_type != "customer":
        return suggestion is None

    if suggestion is None:
        return True

    return suggestion.created_at < latest_message.message_timestamp


def resolve_current_sent_message(
    latest_message: Message | None,
    sent_message: SentMessage | None,
) -> SentMessage | None:
    if has_fresh_customer_reply(latest_message, sent_message):
        return None

    return sent_message


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
    latest_message: Message | None,
    extraction: AIExtraction | None,
    suggestion: ReplySuggestion | None,
    sent_message: SentMessage | None,
) -> str:
    if has_fresh_customer_reply(latest_message, sent_message):
        if extraction_is_stale(extraction, latest_message):
            return "needs_analysis"

        if suggestion_is_stale(suggestion, latest_message):
            return "needs_reply_suggestion"

    if sent_message is not None:
        return "reply_sent"

    if extraction_is_stale(extraction, latest_message):
        return "needs_analysis"

    if suggestion_is_stale(suggestion, latest_message):
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
        latest_sent_message = resolve_current_sent_message(
            latest_message,
            get_latest_sent_message(conversation),
        )

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
                    latest_message,
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


def get_latest_sent_message(conversation: Conversation) -> SentMessage | None:
    if not conversation.sent_messages:
        return None

    return max(
        conversation.sent_messages,
        key=lambda sent_message: sent_message.sent_at,
    )


def get_latest_conversation_for_lead(lead: Lead) -> Conversation | None:
    if not lead.conversations:
        return None

    return max(
        lead.conversations,
        key=lambda conversation: (
            conversation.last_message_at or conversation.created_at,
            conversation.created_at,
        ),
    )


def build_sales_worklist_item(
    *,
    lead: Lead,
    conversation: Conversation,
    latest_message: Message | None,
    latest_extraction: AIExtraction | None,
    latest_suggestion: ReplySuggestion | None,
    latest_sent_message: SentMessage | None,
    now: datetime,
) -> SalesWorklistItem | None:
    current_sent_state = resolve_current_sent_message(latest_message, latest_sent_message)
    ui_status = determine_ui_status(
        latest_message,
        latest_extraction,
        latest_suggestion,
        current_sent_state,
    )
    priority_score = calculate_priority_score(latest_extraction, latest_suggestion)

    task_type: str | None = None
    task_label: str | None = None
    reason: str | None = None
    recommended_action: str | None = None
    next_follow_up_at = ensure_aware_utc(lead.next_follow_up_at)

    if next_follow_up_at is not None and next_follow_up_at <= now:
        task_type = "overdue_follow_up"
        task_label = "Follow up overdue"
        reason = "Lead ini sudah melewati jadwal follow-up yang ditentukan."
        recommended_action = (
            latest_extraction.next_best_action
            if latest_extraction is not None
            else "Hubungi customer lagi dan perbarui status percakapan."
        )
        priority_score += 40
    elif (
        lead.lead_temperature == "hot"
        and latest_message is not None
        and latest_message.sender_type == "customer"
        and current_sent_state is None
    ):
        task_type = "hot_lead_needs_reply"
        task_label = "Hot lead belum dibalas"
        reason = "Customer dengan temperature hot sudah membalas, tapi belum ada balasan final yang terkirim."
        recommended_action = (
            latest_extraction.next_best_action
            if latest_extraction is not None
            else "Balas secepatnya dan arahkan ke langkah closing berikutnya."
        )
        priority_score += 35
    elif ui_status == "approved_ready_to_send":
        task_type = "approved_ready_to_send"
        task_label = "Draft siap dikirim"
        reason = "Sudah ada draft approved, tapi pesan final belum dikirim ke customer."
        recommended_action = "Buka conversation dan kirim balasan approved secepatnya."
        priority_score += 20
    elif ui_status == "needs_analysis":
        task_type = "needs_analysis"
        task_label = "Butuh analisis ulang"
        reason = "Ada balasan customer baru yang belum dibaca ulang oleh AI."
        recommended_action = "Jalankan AI analysis lagi agar next action dan draft ikut refresh."
        priority_score += 15
    elif ui_status == "needs_reply_suggestion":
        task_type = "needs_reply_suggestion"
        task_label = "Butuh draft balasan baru"
        reason = "Analisis sudah ada, tapi Clara belum menyiapkan draft yang relevan dengan chat terbaru."
        recommended_action = "Generate reply suggestion baru dari detail conversation."
        priority_score += 10

    if task_type is None or task_label is None or reason is None or recommended_action is None:
        return None

    return SalesWorklistItem(
        lead_id=lead.id,
        conversation_id=conversation.id,
        lead_name=lead.display_name,
        current_stage=lead.current_stage,
        lead_temperature=lead.lead_temperature,
        priority_score=priority_score,
        task_type=task_type,
        task_label=task_label,
        reason=reason,
        recommended_action=recommended_action,
        last_contact_at=lead.last_contact_at,
        next_follow_up_at=next_follow_up_at,
    )


def get_sales_worklist(
    db: Session,
    current_user: User,
) -> SalesWorklistResponse:
    if current_user.organization_id is None:
        return SalesWorklistResponse(
            generated_at=datetime.now(timezone.utc),
            overdue_count=0,
            hot_lead_count=0,
            ready_to_send_count=0,
            pending_analysis_count=0,
            items=[],
        )

    statement = (
        select(Lead)
        .where(Lead.organization_id == current_user.organization_id)
        .options(
            selectinload(Lead.conversations).selectinload(Conversation.messages),
            selectinload(Lead.conversations).selectinload(Conversation.ai_extractions),
            selectinload(Lead.conversations).selectinload(Conversation.reply_suggestions),
            selectinload(Lead.conversations).selectinload(Conversation.sent_messages),
        )
    )

    if not can_access_all_conversations(current_user):
        statement = statement.where(Lead.assigned_user_id == current_user.id)

    leads = list(db.scalars(statement).all())
    now = datetime.now(timezone.utc)
    items: list[SalesWorklistItem] = []

    overdue_count = 0
    hot_lead_count = 0
    ready_to_send_count = 0
    pending_analysis_count = 0

    for lead in leads:
        conversation = get_latest_conversation_for_lead(lead)
        if conversation is None:
            continue

        latest_message = get_latest_message(conversation)
        latest_extraction = get_latest_extraction(conversation)
        latest_suggestion = get_latest_reply_suggestion(conversation)
        latest_sent_message = get_latest_sent_message(conversation)

        item = build_sales_worklist_item(
            lead=lead,
            conversation=conversation,
            latest_message=latest_message,
            latest_extraction=latest_extraction,
            latest_suggestion=latest_suggestion,
            latest_sent_message=latest_sent_message,
            now=now,
        )
        if item is None:
            continue

        items.append(item)

        if item.task_type == "overdue_follow_up":
            overdue_count += 1
        elif item.task_type == "hot_lead_needs_reply":
            hot_lead_count += 1
        elif item.task_type == "approved_ready_to_send":
            ready_to_send_count += 1
        elif item.task_type == "needs_analysis":
            pending_analysis_count += 1

    items.sort(
        key=lambda item: (item.priority_score, item.last_contact_at or now),
        reverse=True,
    )

    return SalesWorklistResponse(
        generated_at=now,
        overdue_count=overdue_count,
        hot_lead_count=hot_lead_count,
        ready_to_send_count=ready_to_send_count,
        pending_analysis_count=pending_analysis_count,
        items=items,
    )


def get_sales_approval_queue(
    db: Session,
    current_user: User,
) -> SalesApprovalQueueResponse:
    now = datetime.now(timezone.utc)

    if current_user.organization_id is None:
        return SalesApprovalQueueResponse(
            generated_at=now,
            pending_count=0,
            escalation_count=0,
            items=[],
        )

    statement = (
        select(Conversation)
        .where(Conversation.organization_id == current_user.organization_id)
        .options(
            selectinload(Conversation.lead),
            selectinload(Conversation.ai_extractions),
            selectinload(Conversation.reply_suggestions),
        )
        .order_by(desc(Conversation.last_message_at), desc(Conversation.created_at))
    )

    if not can_access_all_conversations(current_user):
        statement = statement.where(Conversation.sales_user_id == current_user.id)

    conversations = list(db.scalars(statement).all())
    items: list[SalesApprovalQueueItem] = []
    escalation_count = 0

    for conversation in conversations:
        latest_suggestion = get_latest_reply_suggestion(conversation)
        if latest_suggestion is None or latest_suggestion.approval_status != "pending":
            continue

        latest_extraction = get_latest_extraction(conversation)
        suggested_reply_preview = None
        if latest_suggestion.suggested_replies:
            first_reply = latest_suggestion.suggested_replies[0]
            suggested_reply_preview = first_reply.get("text")

        if latest_suggestion.action_mode == "escalate_to_human":
            escalation_count += 1

        items.append(
            SalesApprovalQueueItem(
                reply_suggestion_id=latest_suggestion.id,
                conversation_id=conversation.id,
                lead_id=conversation.lead_id,
                lead_name=(
                    conversation.lead.display_name
                    if conversation.lead is not None
                    else conversation.title
                ),
                conversation_title=conversation.title,
                current_stage=conversation.current_stage,
                lead_temperature=conversation.lead_temperature,
                risk_level=latest_suggestion.risk_level,
                action_mode=latest_suggestion.action_mode,
                approval_status=latest_suggestion.approval_status,
                suggested_reply_preview=suggested_reply_preview,
                recommended_action=(
                    latest_extraction.next_best_action
                    if latest_extraction is not None
                    else "Review draft ini dan tentukan perlu approve atau revisi."
                ),
                created_at=latest_suggestion.created_at,
            )
        )

    items.sort(
        key=lambda item: (
            1 if item.action_mode == "escalate_to_human" else 0,
            1 if item.risk_level == "high" else 0,
            item.created_at,
        ),
        reverse=True,
    )

    return SalesApprovalQueueResponse(
        generated_at=now,
        pending_count=len(items),
        escalation_count=escalation_count,
        items=items,
    )


def get_marketing_insights_preview(
    db: Session,
    current_user: User,
) -> MarketingInsightsPreview:
    can_view_global = current_user.role == "owner"

    if current_user.organization_id is None and not can_view_global:
        return MarketingInsightsPreview(
            total_conversations=0,
            total_analyzed_conversations=0,
            top_objections=[],
            lead_temperature_breakdown={},
            risk_level_breakdown={},
            buying_intent_breakdown=[],
            sentiment_breakdown=[],
            pipeline_stage_breakdown=[],
            top_content_recommendations=[],
            content_briefs=[],
            ads_signals=[],
            monthly_content_plan=[],
            kpi_summary=MarketingKpiSummary(
                reply_sent_rate=0,
                analysis_coverage_rate=0,
                approved_reply_rate=0,
                high_risk_conversation_count=0,
            ),
            generated_at=datetime.now(timezone.utc),
        )

    total_conversations_statement = select(func.count(Conversation.id))
    if not can_view_global:
        total_conversations_statement = total_conversations_statement.where(
            Conversation.organization_id == current_user.organization_id
        )
    total_conversations = db.scalar(total_conversations_statement) or 0

    extractions_statement = (
        select(AIExtraction)
        .join(Conversation, AIExtraction.conversation_id == Conversation.id)
        .order_by(desc(AIExtraction.created_at))
    )
    if not can_view_global:
        extractions_statement = extractions_statement.where(
            Conversation.organization_id == current_user.organization_id
        )
    extractions = list(db.scalars(extractions_statement).all())

    objection_counter: Counter[str] = Counter()
    lead_temperature_counter: Counter[str] = Counter()
    risk_level_counter: Counter[str] = Counter()
    buying_intent_counter: Counter[str] = Counter()
    sentiment_counter: Counter[str] = Counter()
    pipeline_stage_counter: Counter[str] = Counter()

    latest_extraction_by_conversation: dict[UUID, AIExtraction] = {}

    for extraction in extractions:
        if extraction.conversation_id not in latest_extraction_by_conversation:
            latest_extraction_by_conversation[extraction.conversation_id] = extraction

    for extraction in latest_extraction_by_conversation.values():
        lead_temperature_counter[extraction.lead_temperature] += 1
        risk_level_counter[extraction.risk_level] += 1
        buying_intent_counter[extraction.buying_intent] += 1
        sentiment_counter[extraction.sentiment] += 1
        pipeline_stage_counter[extraction.pipeline_stage] += 1

        for objection in extraction.main_objections:
            normalized_objection = objection.strip().lower()
            if normalized_objection:
                objection_counter[normalized_objection] += 1

    top_objections = [
        MarketingObjectionInsight(topic=topic, count=count)
        for topic, count in objection_counter.most_common(10)
    ]

    reply_sent_count_statement = (
        select(func.count(SentMessage.id))
        .join(Conversation, SentMessage.conversation_id == Conversation.id)
    )
    approved_reply_count_statement = (
        select(func.count(ReplySuggestion.id))
        .join(Conversation, ReplySuggestion.conversation_id == Conversation.id)
        .where(ReplySuggestion.approval_status == "approved")
    )
    total_reply_suggestions_statement = (
        select(func.count(ReplySuggestion.id))
        .join(Conversation, ReplySuggestion.conversation_id == Conversation.id)
    )

    if not can_view_global:
        reply_sent_count_statement = reply_sent_count_statement.where(
            Conversation.organization_id == current_user.organization_id
        )
        approved_reply_count_statement = approved_reply_count_statement.where(
            Conversation.organization_id == current_user.organization_id
        )
        total_reply_suggestions_statement = total_reply_suggestions_statement.where(
            Conversation.organization_id == current_user.organization_id
        )

    reply_sent_count = db.scalar(reply_sent_count_statement) or 0
    approved_reply_count = db.scalar(approved_reply_count_statement) or 0
    total_reply_suggestions = db.scalar(total_reply_suggestions_statement) or 0

    top_content_recommendations = build_content_recommendations(
        objection_counter=objection_counter,
        sentiment_counter=sentiment_counter,
        risk_level_counter=risk_level_counter,
    )
    content_briefs = build_content_briefs(
        objection_counter=objection_counter,
        sentiment_counter=sentiment_counter,
        risk_level_counter=risk_level_counter,
        buying_intent_counter=buying_intent_counter,
    )
    ads_signals = build_ads_signals(
        lead_temperature_counter=lead_temperature_counter,
        pipeline_stage_counter=pipeline_stage_counter,
        sentiment_counter=sentiment_counter,
        risk_level_counter=risk_level_counter,
        reply_sent_count=reply_sent_count,
        total_conversations=total_conversations,
    )
    monthly_content_plan = build_monthly_content_plan(
        top_objections=top_objections,
        lead_temperature_counter=lead_temperature_counter,
        sentiment_counter=sentiment_counter,
        buying_intent_counter=buying_intent_counter,
    )

    return MarketingInsightsPreview(
        total_conversations=total_conversations,
        total_analyzed_conversations=len(latest_extraction_by_conversation),
        top_objections=top_objections,
        lead_temperature_breakdown=dict(lead_temperature_counter),
        risk_level_breakdown=dict(risk_level_counter),
        buying_intent_breakdown=to_breakdown_items(buying_intent_counter),
        sentiment_breakdown=to_breakdown_items(sentiment_counter),
        pipeline_stage_breakdown=to_breakdown_items(pipeline_stage_counter),
        top_content_recommendations=top_content_recommendations,
        content_briefs=content_briefs,
        ads_signals=ads_signals,
        monthly_content_plan=monthly_content_plan,
        kpi_summary=MarketingKpiSummary(
            reply_sent_rate=safe_ratio(reply_sent_count, total_conversations),
            analysis_coverage_rate=safe_ratio(
                len(latest_extraction_by_conversation),
                total_conversations,
            ),
            approved_reply_rate=safe_ratio(
                approved_reply_count,
                total_reply_suggestions,
            ),
            high_risk_conversation_count=risk_level_counter.get("high", 0),
        ),
        generated_at=datetime.now(timezone.utc),
    )


def get_ops_database_overview(
    db: Session,
    current_user: User,
) -> OpsDatabaseOverviewResponse:
    can_view_global = current_user.role == "owner"
    organization_id = current_user.organization_id

    if organization_id is None and not can_view_global:
        return OpsDatabaseOverviewResponse(
            scope_type="organization",
            organization_id=None,
            table_counts=[],
            recent_users=[],
            recent_organizations=[],
            recent_conversations=[],
            recent_audit_logs=[],
            recent_product_knowledge=[],
            recent_snapshots=[],
        )

    def organization_filtered_count(model: type[User] | type[Conversation]) -> int:
        statement = select(func.count(model.id))
        if not can_view_global:
            statement = statement.where(model.organization_id == organization_id)
        return db.scalar(statement) or 0

    table_counts = [
        OpsTableCountItem(
            label="organizations",
            count=(
                db.scalar(select(func.count(Organization.id)))
                if can_view_global
                else (
                    db.scalar(
                        select(func.count(Organization.id)).where(
                            Organization.id == organization_id
                        )
                    )
                    or 0
                )
            )
            or 0,
        ),
        OpsTableCountItem(
            label="users",
            count=organization_filtered_count(User),
        ),
        OpsTableCountItem(
            label="conversations",
            count=organization_filtered_count(Conversation),
        ),
        OpsTableCountItem(
            label="ai_extractions",
            count=(
                db.scalar(select(func.count(AIExtraction.id)))
                if can_view_global
                else (
                    db.scalar(
                        select(func.count(AIExtraction.id))
                        .join(
                            Conversation,
                            AIExtraction.conversation_id == Conversation.id,
                        )
                        .where(Conversation.organization_id == organization_id)
                    )
                    or 0
                )
            )
            or 0,
        ),
        OpsTableCountItem(
            label="reply_suggestions",
            count=(
                db.scalar(select(func.count(ReplySuggestion.id)))
                if can_view_global
                else (
                    db.scalar(
                        select(func.count(ReplySuggestion.id))
                        .join(
                            Conversation,
                            ReplySuggestion.conversation_id == Conversation.id,
                        )
                        .where(Conversation.organization_id == organization_id)
                    )
                    or 0
                )
            )
            or 0,
        ),
        OpsTableCountItem(
            label="sent_messages",
            count=(
                db.scalar(select(func.count(SentMessage.id)))
                if can_view_global
                else (
                    db.scalar(
                        select(func.count(SentMessage.id))
                        .join(
                            Conversation,
                            SentMessage.conversation_id == Conversation.id,
                        )
                        .where(Conversation.organization_id == organization_id)
                    )
                    or 0
                )
            )
            or 0,
        ),
        OpsTableCountItem(
            label="product_knowledge",
            count=(
                db.scalar(select(func.count(ProductKnowledge.id)))
                if can_view_global
                else (
                    db.scalar(
                        select(func.count(ProductKnowledge.id)).where(
                            ProductKnowledge.organization_id == organization_id
                        )
                    )
                    or 0
                )
            )
            or 0,
        ),
        OpsTableCountItem(
            label="audit_logs",
            count=(
                db.scalar(select(func.count(AuditLog.id)))
                if can_view_global
                else (
                    db.scalar(
                        select(func.count(AuditLog.id)).where(
                            AuditLog.organization_id == str(organization_id)
                        )
                    )
                    or 0
                )
            )
            or 0,
        ),
        OpsTableCountItem(
            label="marketing_snapshots",
            count=(
                db.scalar(select(func.count(MarketingInsightSnapshot.id)))
                if can_view_global
                else (
                    db.scalar(
                        select(func.count(MarketingInsightSnapshot.id)).where(
                            MarketingInsightSnapshot.organization_id == organization_id
                        )
                    )
                    or 0
                )
            )
            or 0,
        ),
    ]

    organizations_statement = select(Organization).order_by(
        desc(Organization.created_at)
    )
    if not can_view_global:
        organizations_statement = organizations_statement.where(
            Organization.id == organization_id
        )

    users_statement = (
        select(User)
        .options(selectinload(User.created_by_user))
        .order_by(desc(User.created_at))
    )
    if not can_view_global:
        users_statement = users_statement.where(User.organization_id == organization_id)

    conversations_statement = (
        select(Conversation)
        .options(
            selectinload(Conversation.sales_user),
            selectinload(Conversation.organization),
        )
        .order_by(desc(Conversation.created_at))
    )
    if not can_view_global:
        conversations_statement = conversations_statement.where(
            Conversation.organization_id == organization_id
        )

    audit_logs_statement = select(AuditLog).order_by(desc(AuditLog.created_at))
    if not can_view_global:
        audit_logs_statement = audit_logs_statement.where(
            AuditLog.organization_id == str(organization_id)
        )

    knowledge_statement = (
        select(ProductKnowledge)
        .options(selectinload(ProductKnowledge.organization))
        .order_by(desc(ProductKnowledge.updated_at))
    )
    if not can_view_global:
        knowledge_statement = knowledge_statement.where(
            ProductKnowledge.organization_id == organization_id
        )

    snapshots_statement = select(MarketingInsightSnapshot).order_by(
        desc(MarketingInsightSnapshot.created_at)
    )
    if not can_view_global:
        snapshots_statement = snapshots_statement.where(
            MarketingInsightSnapshot.organization_id == organization_id
        )

    recent_organizations = [
        OpsOrganizationRow(
            id=organization.id,
            name=organization.name,
            slug=organization.slug,
            created_at=organization.created_at,
        )
        for organization in db.scalars(organizations_statement.limit(10)).all()
    ]

    recent_audit_log_records = db.scalars(audit_logs_statement.limit(12)).all()
    recent_snapshot_records = db.scalars(snapshots_statement.limit(12)).all()

    organization_ids_from_audit_logs = {
        parsed_org_id
        for audit_log in recent_audit_log_records
        if (parsed_org_id := parse_uuid_or_none(audit_log.organization_id)) is not None
    }
    organization_ids_from_snapshots = {
        snapshot.organization_id
        for snapshot in recent_snapshot_records
        if snapshot.organization_id is not None
    }
    organizations_by_id = {
        organization.id: organization.name
        for organization in db.scalars(
            select(Organization).where(
                Organization.id.in_(
                    organization_ids_from_audit_logs | organization_ids_from_snapshots
                )
            )
        ).all()
    }

    recent_users = [
        OpsUserRow(
            id=user.id,
            organization_id=user.organization_id,
            created_by_user_id=user.created_by_user_id,
            created_by_user_name=user.created_by_user.name if user.created_by_user else None,
            name=user.name,
            email=user.email,
            role=user.role,
            is_active=user.is_active,
            created_at=user.created_at,
        )
        for user in db.scalars(users_statement.limit(12)).all()
    ]

    recent_conversations = [
        OpsConversationRow(
            id=conversation.id,
            organization_id=conversation.organization_id,
            organization_name=(
                conversation.organization.name if conversation.organization else None
            ),
            sales_user_id=conversation.sales_user_id,
            sales_owner_name=conversation.sales_user.name if conversation.sales_user else None,
            title=conversation.title,
            source=conversation.source,
            status=conversation.status,
            raw_filename=conversation.raw_filename,
            last_message_at=conversation.last_message_at,
            created_at=conversation.created_at,
        )
        for conversation in db.scalars(conversations_statement.limit(12)).all()
    ]

    recent_audit_logs = [
        OpsAuditLogRow(
            id=audit_log.id,
            organization_id=audit_log.organization_id,
            organization_name=(
                organizations_by_id.get(parsed_org_id)
                if (parsed_org_id := parse_uuid_or_none(audit_log.organization_id))
                else None
            ),
            actor_email=audit_log.actor_email,
            actor_role=audit_log.actor_role,
            action=audit_log.action,
            resource_type=audit_log.resource_type,
            resource_id=audit_log.resource_id,
            created_at=audit_log.created_at,
        )
        for audit_log in recent_audit_log_records
    ]

    recent_product_knowledge = [
        OpsProductKnowledgeRow(
            id=knowledge.id,
            organization_id=knowledge.organization_id,
            organization_name=knowledge.organization.name if knowledge.organization else None,
            title=knowledge.title,
            category=knowledge.category,
            source_type=knowledge.source_type,
            is_active=knowledge.is_active,
            updated_at=knowledge.updated_at,
        )
        for knowledge in db.scalars(knowledge_statement.limit(12)).all()
    ]

    recent_snapshots = [
        OpsSnapshotRow(
            id=snapshot.id,
            organization_id=snapshot.organization_id,
            organization_name=(
                organizations_by_id.get(snapshot.organization_id)
                if snapshot.organization_id
                else None
            ),
            scope_type=snapshot.scope_type,
            snapshot_type=snapshot.snapshot_type,
            period_start=snapshot.period_start,
            period_end=snapshot.period_end,
            total_conversations=snapshot.metrics_json.get("total_conversations", 0),
            total_analyzed_conversations=snapshot.metrics_json.get(
                "total_analyzed_conversations",
                0,
            ),
            created_at=snapshot.created_at,
        )
        for snapshot in recent_snapshot_records
    ]

    return OpsDatabaseOverviewResponse(
        scope_type="global" if can_view_global else "organization",
        organization_id=organization_id,
        table_counts=table_counts,
        recent_users=recent_users,
        recent_organizations=recent_organizations,
        recent_conversations=recent_conversations,
        recent_audit_logs=recent_audit_logs,
        recent_product_knowledge=recent_product_knowledge,
        recent_snapshots=recent_snapshots,
    )


def build_kpi_observations(
    *,
    summary: KpiSummaryCard,
    top_sales_rows: list[SalesPerformanceRow],
    top_org_rows: list[OrganizationPerformanceRow],
) -> list[str]:
    observations: list[str] = []

    if summary.hot_leads > summary.closing_leads:
        observations.append(
            "Lead panas lebih banyak daripada lead yang sudah masuk closing. Tim sales perlu dorongan follow-up dan closing discipline yang lebih ketat."
        )

    if summary.reply_sent_rate < 0.5:
        observations.append(
            "Reply sent rate masih di bawah 50%. Ada risiko banyak percakapan yang dianalisis tapi belum benar-benar dituntaskan menjadi balasan final."
        )

    if summary.overdue_follow_ups > 0:
        observations.append(
            f"Ada {summary.overdue_follow_ups} follow-up yang sudah overdue. Ini sinyal paling dekat ke kehilangan momentum lead."
        )

    if top_sales_rows:
        best_sales = top_sales_rows[0]
        observations.append(
            f"Sales paling produktif saat ini adalah {best_sales.user_name} dengan {best_sales.replies_sent} reply terkirim dan {best_sales.closing_leads} lead di stage closing."
        )

    if top_org_rows:
        strongest_org = top_org_rows[0]
        observations.append(
            f"Organization dengan pipeline paling siap saat ini adalah {strongest_org.organization_name}, dengan {strongest_org.hot_leads} hot lead dan reply sent rate {(strongest_org.reply_sent_rate * 100):.0f}%."
        )

    if not observations:
        observations.append(
            "Data KPI masih tipis. Tambahkan lebih banyak conversation aktif agar owner view mulai menghasilkan sinyal yang berarti."
        )

    return observations[:5]


def build_kpi_alerts(
    *,
    summary: KpiSummaryCard,
    sales_rows: list[SalesPerformanceRow],
    organization_rows: list[OrganizationPerformanceRow],
) -> list[KpiAlertItem]:
    alerts: list[KpiAlertItem] = []

    if summary.overdue_follow_ups > 0:
        alerts.append(
            KpiAlertItem(
                severity="high",
                title="Follow-up overdue menumpuk",
                description=(
                    f"Ada {summary.overdue_follow_ups} lead yang sudah melewati jadwal follow-up."
                ),
                recommended_action="Dorong tim sales membuka AI Worklist dan selesaikan overdue item hari ini.",
                target_href="/dashboard/follow-up",
            )
        )

    if summary.reply_sent_rate < 0.45 and summary.total_leads > 0:
        alerts.append(
            KpiAlertItem(
                severity="high",
                title="Reply sent rate terlalu rendah",
                description=(
                    f"Reply sent rate baru {(summary.reply_sent_rate * 100):.0f}%, artinya banyak conversation berhenti di draft atau analisis."
                ),
                recommended_action="Audit pipeline balasan, cek approval bottleneck, dan prioritaskan percakapan yang sudah approved-ready-to-send.",
                target_href="/dashboard/follow-up",
            )
        )

    for row in sales_rows:
        if row.overdue_follow_ups >= 2:
            alerts.append(
                KpiAlertItem(
                    severity="medium",
                    title=f"{row.user_name} punya overdue follow-up tinggi",
                    description=(
                        f"{row.user_name} memiliki {row.overdue_follow_ups} follow-up overdue dengan {row.hot_leads} hot lead yang masih aktif."
                    ),
                    recommended_action="Review workload sales ini dan bantu susun prioritas follow-up yang lebih realistis.",
                    target_href="/dashboard/follow-up",
                )
            )

        if row.conversations_owned >= 2 and row.replies_sent == 0:
            alerts.append(
                KpiAlertItem(
                    severity="medium",
                    title=f"{row.user_name} belum mengirim balasan final",
                    description=(
                        f"{row.user_name} punya {row.conversations_owned} conversation, tapi belum ada reply final yang tercatat."
                    ),
                    recommended_action="Periksa apakah tim ini macet di analysis, approval, atau eksekusi kirim di WhatsApp.",
                    target_href="/dashboard/sales",
                )
            )

    for row in organization_rows:
        if row.hot_leads >= 1 and row.reply_sent_rate < 0.4:
            alerts.append(
                KpiAlertItem(
                    severity="medium",
                    title=f"{row.organization_name} lambat mengonversi lead panas",
                    description=(
                        f"Organization ini punya {row.hot_leads} hot lead, tapi reply sent rate baru {(row.reply_sent_rate * 100):.0f}%."
                    ),
                    recommended_action="Sinkronkan sales follow-up dengan insight marketing dan cek kualitas CTA di percakapan aktif.",
                    target_href="/dashboard/kpi",
                )
            )

    return alerts[:8]


def build_executive_recommendations(
    *,
    summary: KpiSummaryCard,
    alerts: list[KpiAlertItem],
    sales_rows: list[SalesPerformanceRow],
    organization_rows: list[OrganizationPerformanceRow],
) -> list[ExecutiveRecommendationItem]:
    recommendations: list[ExecutiveRecommendationItem] = []

    if summary.overdue_follow_ups > 0:
        recommendations.append(
            ExecutiveRecommendationItem(
                title="Jadikan overdue follow-up sebagai prioritas harian",
                rationale="Lead yang sudah lewat jadwal follow-up adalah sumber kehilangan momentum tercepat.",
                owner_role="admin",
                next_step="Pantau AI Worklist setiap pagi dan pastikan overdue item turun sebelum siang.",
                target_href="/dashboard/follow-up",
            )
        )

    if any(alert.severity == "high" for alert in alerts):
        recommendations.append(
            ExecutiveRecommendationItem(
                title="Lakukan review pipeline balasan mingguan",
                rationale="High-severity alert menandakan ada bottleneck operasional yang tidak bisa dibiarkan berjalan otomatis terus.",
                owner_role="owner",
                next_step="Review KPI center, cocokkan dengan inbox/worklist, lalu tentukan intervensi per org atau per sales.",
                target_href="/dashboard/kpi",
            )
        )

    if organization_rows:
        top_org = organization_rows[0]
        recommendations.append(
            ExecutiveRecommendationItem(
                title=f"Scale pola yang berhasil di {top_org.organization_name}",
                rationale="Organization dengan health paling baik bisa dijadikan baseline proses untuk tim lain.",
                owner_role="owner",
                next_step="Dokumentasikan pola follow-up, quality reply, dan angle marketing yang membuat org ini lebih siap closing.",
                target_href="/dashboard/marketing",
            )
        )

    if sales_rows:
        weakest_sales = sorted(
            sales_rows,
            key=lambda row: (row.replies_sent, -row.overdue_follow_ups, row.hot_leads),
        )[0]
        recommendations.append(
            ExecutiveRecommendationItem(
                title=f"Coaching targeted untuk {weakest_sales.user_name}",
                rationale="Sales dengan delivery rendah atau overdue tinggi biasanya memberi dampak cepat jika dibantu langsung.",
                owner_role="admin",
                next_step="Buka inbox dan worklist milik sales ini, lalu bantu rapikan prioritas conversation yang paling dekat ke closing.",
                target_href="/dashboard/sales",
            )
        )

    if summary.approved_reply_rate < 0.5:
        recommendations.append(
            ExecutiveRecommendationItem(
                title="Rapikan kualitas draft dan approval flow",
                rationale="Approved reply rate yang rendah berarti tim sering berhenti di draft yang belum cukup percaya diri untuk dikirim.",
                owner_role="admin",
                next_step="Audit kualitas suggestion Clara, cek objection yang belum terjawab, dan perkuat product knowledge atau playbook yang relevan.",
                target_href="/dashboard/knowledge",
            )
        )

    return recommendations[:6]


def get_kpi_command_center(
    db: Session,
    current_user: User,
) -> KpiCommandCenterResponse:
    can_view_global = current_user.role == "owner"
    now = datetime.now(timezone.utc)

    organizations_statement = select(Organization)
    if not can_view_global:
        if current_user.organization_id is None:
            return KpiCommandCenterResponse(
                scope_type="organization",
                generated_at=now,
                summary=KpiSummaryCard(
                    total_organizations=0,
                    total_sales_users=0,
                    total_leads=0,
                    hot_leads=0,
                    closing_leads=0,
                    analyzed_conversations=0,
                    reply_sent_rate=0,
                    approved_reply_rate=0,
                    overdue_follow_ups=0,
                ),
                key_observations=[],
                alerts=[],
                recommendations=[],
                sales_performance=[],
                organization_performance=[],
            )
        organizations_statement = organizations_statement.where(
            Organization.id == current_user.organization_id
        )

    organizations = list(db.scalars(organizations_statement).all())
    organization_ids = {organization.id for organization in organizations}

    users_statement = select(User).where(
        User.role == "marketing",
        User.is_active.is_(True),
    )
    if not can_view_global:
        users_statement = users_statement.where(
            User.organization_id == current_user.organization_id
        )
    users = list(db.scalars(users_statement).all())

    leads_statement = select(Lead).options(
        selectinload(Lead.conversations).selectinload(Conversation.ai_extractions),
        selectinload(Lead.conversations).selectinload(Conversation.reply_suggestions),
        selectinload(Lead.conversations).selectinload(Conversation.sent_messages),
    )
    if not can_view_global:
        leads_statement = leads_statement.where(
            Lead.organization_id == current_user.organization_id
        )
    elif organization_ids:
        leads_statement = leads_statement.where(Lead.organization_id.in_(organization_ids))
    leads = list(db.scalars(leads_statement).all())

    conversations_statement = select(Conversation)
    if not can_view_global:
        conversations_statement = conversations_statement.where(
            Conversation.organization_id == current_user.organization_id
        )
    elif organization_ids:
        conversations_statement = conversations_statement.where(
            Conversation.organization_id.in_(organization_ids)
        )
    conversations = list(db.scalars(conversations_statement).all())

    total_conversations = len(conversations)
    analyzed_conversations = 0
    approved_reply_count = 0
    total_reply_suggestions = 0
    reply_sent_count = 0

    sales_rows: list[SalesPerformanceRow] = []
    organization_rows: list[OrganizationPerformanceRow] = []

    organization_name_by_id = {organization.id: organization.name for organization in organizations}

    for user in users:
        assigned_leads = [
            lead for lead in leads if lead.assigned_user_id == user.id
        ]
        owned_conversations = [
            conversation
            for conversation in conversations
            if conversation.sales_user_id == user.id
        ]

        user_analyzed = 0
        user_approved = 0
        user_sent = 0

        for conversation in owned_conversations:
            latest_extraction = get_latest_extraction(conversation)
            latest_suggestion = get_latest_reply_suggestion(conversation)
            latest_sent_message = get_latest_sent_message(conversation)

            if latest_extraction is not None:
                user_analyzed += 1
            if latest_suggestion is not None:
                total_reply_suggestions += 1
                if latest_suggestion.approval_status == "approved":
                    user_approved += 1
                    approved_reply_count += 1
            if latest_sent_message is not None:
                user_sent += 1
                reply_sent_count += 1

        analyzed_conversations += user_analyzed

        sales_rows.append(
            SalesPerformanceRow(
                user_id=user.id,
                user_name=user.name,
                organization_id=user.organization_id,
                organization_name=organization_name_by_id.get(user.organization_id),
                assigned_leads=len(assigned_leads),
                hot_leads=sum(1 for lead in assigned_leads if lead.lead_temperature == "hot"),
                closing_leads=sum(1 for lead in assigned_leads if lead.current_stage == "closing"),
                conversations_owned=len(owned_conversations),
                analyzed_conversations=user_analyzed,
                approved_drafts=user_approved,
                replies_sent=user_sent,
                overdue_follow_ups=sum(
                    1
                    for lead in assigned_leads
                    if (follow_up := ensure_aware_utc(lead.next_follow_up_at)) is not None
                    and follow_up <= now
                ),
            )
        )

    for organization in organizations:
        org_leads = [lead for lead in leads if lead.organization_id == organization.id]
        org_conversations = [
            conversation
            for conversation in conversations
            if conversation.organization_id == organization.id
        ]

        org_analyzed = 0
        org_approved = 0
        org_sent = 0

        for conversation in org_conversations:
            latest_extraction = get_latest_extraction(conversation)
            latest_suggestion = get_latest_reply_suggestion(conversation)
            latest_sent_message = get_latest_sent_message(conversation)

            if latest_extraction is not None:
                org_analyzed += 1
            if latest_suggestion is not None and latest_suggestion.approval_status == "approved":
                org_approved += 1
            if latest_sent_message is not None:
                org_sent += 1

        organization_rows.append(
            OrganizationPerformanceRow(
                organization_id=organization.id,
                organization_name=organization.name,
                total_leads=len(org_leads),
                hot_leads=sum(1 for lead in org_leads if lead.lead_temperature == "hot"),
                closing_leads=sum(1 for lead in org_leads if lead.current_stage == "closing"),
                conversations=len(org_conversations),
                analyzed_conversations=org_analyzed,
                reply_sent_rate=safe_ratio(org_sent, len(org_conversations)),
                approved_reply_rate=safe_ratio(org_approved, len(org_conversations)),
                overdue_follow_ups=sum(
                    1
                    for lead in org_leads
                    if (follow_up := ensure_aware_utc(lead.next_follow_up_at)) is not None
                    and follow_up <= now
                ),
            )
        )

    sales_rows.sort(
        key=lambda row: (
            row.replies_sent,
            row.closing_leads,
            row.hot_leads,
            row.assigned_leads,
        ),
        reverse=True,
    )
    organization_rows.sort(
        key=lambda row: (
            row.hot_leads,
            row.closing_leads,
            row.reply_sent_rate,
            row.total_leads,
        ),
        reverse=True,
    )

    summary = KpiSummaryCard(
        total_organizations=len(organizations),
        total_sales_users=len(users),
        total_leads=len(leads),
        hot_leads=sum(1 for lead in leads if lead.lead_temperature == "hot"),
        closing_leads=sum(1 for lead in leads if lead.current_stage == "closing"),
        analyzed_conversations=analyzed_conversations,
        reply_sent_rate=safe_ratio(reply_sent_count, total_conversations),
        approved_reply_rate=safe_ratio(approved_reply_count, total_reply_suggestions),
        overdue_follow_ups=sum(
            1
            for lead in leads
            if (follow_up := ensure_aware_utc(lead.next_follow_up_at)) is not None
            and follow_up <= now
        ),
    )

    alerts = build_kpi_alerts(
        summary=summary,
        sales_rows=sales_rows,
        organization_rows=organization_rows,
    )

    return KpiCommandCenterResponse(
        scope_type="global" if can_view_global else "organization",
        generated_at=now,
        summary=summary,
        key_observations=build_kpi_observations(
            summary=summary,
            top_sales_rows=sales_rows[:3],
            top_org_rows=organization_rows[:3],
        ),
        alerts=alerts,
        recommendations=build_executive_recommendations(
            summary=summary,
            alerts=alerts,
            sales_rows=sales_rows,
            organization_rows=organization_rows,
        ),
        sales_performance=sales_rows,
        organization_performance=organization_rows,
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


def to_breakdown_items(counter: Counter[str]) -> list[MarketingBreakdownItem]:
    return [
        MarketingBreakdownItem(label=label, count=count)
        for label, count in counter.most_common()
    ]


def safe_ratio(numerator: int, denominator: int) -> float:
    if denominator <= 0:
        return 0

    return round(numerator / denominator, 4)


def build_content_recommendations(
    objection_counter: Counter[str],
    sentiment_counter: Counter[str],
    risk_level_counter: Counter[str],
) -> list[MarketingContentRecommendation]:
    recommendations: list[MarketingContentRecommendation] = []

    for topic, count in objection_counter.most_common(3):
        recommendations.append(
            MarketingContentRecommendation(
                title=f"Konten edukasi untuk objection: {topic}",
                rationale=(
                    f"Topik ini muncul {count} kali di percakapan terbaru dan"
                    " layak dijadikan bahan edukasi atau FAQ."
                ),
                suggested_format="carousel_instagram",
                priority="high" if count >= 3 else "medium",
            )
        )

    if sentiment_counter.get("cautious", 0) > 0:
        recommendations.append(
            MarketingContentRecommendation(
                title="Konten trust-building dan social proof",
                rationale=(
                    "Ada customer dengan sentimen cautious. Fokuskan konten pada"
                    " bukti, testimoni, dan transparansi proses."
                ),
                suggested_format="video_testimonial",
                priority="high",
            )
        )

    if risk_level_counter.get("high", 0) > 0:
        recommendations.append(
            MarketingContentRecommendation(
                title="Playbook respons untuk isu berisiko tinggi",
                rationale=(
                    "Ada percakapan high risk. Marketing dan sales butuh asset"
                    " resmi agar tidak menjawab secara improvisasi."
                ),
                suggested_format="internal_sales_enablement",
                priority="high",
            )
        )

    return recommendations[:5]


def build_content_briefs(
    *,
    objection_counter: Counter[str],
    sentiment_counter: Counter[str],
    risk_level_counter: Counter[str],
    buying_intent_counter: Counter[str],
) -> list[MarketingContentBrief]:
    briefs: list[MarketingContentBrief] = []

    for topic, count in objection_counter.most_common(2):
        briefs.append(
            MarketingContentBrief(
                title=f"Brief edukasi objection: {topic}",
                audience_segment="Leads yang masih ragu sebelum registrasi",
                key_message=(
                    f"Topik '{topic}' muncul {count} kali. Konten harus menjawab"
                    " keraguan paling sering dengan bukti, alur yang jelas, dan CTA"
                    " follow-up ke sales."
                ),
                suggested_format="short_video_or_carousel",
                tone="reassuring",
                call_to_action="Ajak audience minta penjelasan lanjutan via WhatsApp.",
                urgency="high" if count >= 3 else "medium",
            )
        )

    if sentiment_counter.get("cautious", 0) > 0:
        briefs.append(
            MarketingContentBrief(
                title="Brief trust-building untuk leads cautious",
                audience_segment="Audience yang tertarik tapi belum cukup percaya",
                key_message=(
                    "Tekankan legalitas, transparansi proses, dan testimoni nyata"
                    " agar rasa aman naik sebelum masuk ke pembicaraan closing."
                ),
                suggested_format="testimonial_video",
                tone="empathetic",
                call_to_action="Dorong audience untuk cek bukti dan konsultasi langsung.",
                urgency="high",
            )
        )

    if (
        risk_level_counter.get("high", 0) > 0
        and buying_intent_counter.get("high", 0) > 0
    ):
        briefs.append(
            MarketingContentBrief(
                title="Brief klarifikasi untuk hot leads berisiko tinggi",
                audience_segment="Prospek dengan intent tinggi tapi masih menahan keputusan",
                key_message=(
                    "Sediakan asset resmi yang menjawab titik risiko utama agar sales"
                    " tidak menjelaskan dengan improvisasi."
                ),
                suggested_format="faq_landing_snippet",
                tone="professional",
                call_to_action="Arahkan ke chat sales untuk dapat panduan personal.",
                urgency="high",
            )
        )

    return briefs[:4]


def build_ads_signals(
    *,
    lead_temperature_counter: Counter[str],
    pipeline_stage_counter: Counter[str],
    sentiment_counter: Counter[str],
    risk_level_counter: Counter[str],
    reply_sent_count: int,
    total_conversations: int,
) -> list[MarketingAdsSignal]:
    signals: list[MarketingAdsSignal] = []
    reply_sent_rate = safe_ratio(reply_sent_count, total_conversations)

    hot_count = lead_temperature_counter.get("hot", 0)
    warm_count = lead_temperature_counter.get("warm", 0)
    cautious_count = sentiment_counter.get("cautious", 0)
    high_risk_count = risk_level_counter.get("high", 0)
    closing_count = pipeline_stage_counter.get("closing", 0)

    if cautious_count > 0:
        signals.append(
            MarketingAdsSignal(
                title="Naikkan budget retargeting untuk audience yang sudah engage",
                observation=(
                    f"Ada {cautious_count} percakapan dengan sentimen cautious."
                    " Mereka tertarik, tapi masih butuh trust layer tambahan."
                ),
                recommendation=(
                    "Geser budget ke creative retargeting berisi legalitas,"
                    " transparansi, dan social proof."
                ),
                budget_shift="Top up retargeting warm audience, kurangi cold broad test.",
                urgency="high",
            )
        )

    if hot_count > 0 and closing_count < hot_count:
        signals.append(
            MarketingAdsSignal(
                title="Perkuat nurturing untuk hot leads yang belum masuk closing",
                observation=(
                    f"Lead hot terdeteksi {hot_count}, tapi stage closing baru {closing_count}."
                ),
                recommendation=(
                    "Siapkan creative follow-up dan landing support agar lead panas"
                    " tidak drop di tengah funnel."
                ),
                budget_shift="Tambah spend pada audience warm-to-hot yang sudah pernah klik/chat.",
                urgency="high",
            )
        )

    if high_risk_count > 0 or reply_sent_rate < 0.5:
        signals.append(
            MarketingAdsSignal(
                title="Turunkan friksi pesan awal di top funnel",
                observation=(
                    f"High-risk conversations: {high_risk_count}. Reply sent rate saat ini"
                    f" {reply_sent_rate * 100:.0f}%."
                ),
                recommendation=(
                    "Uji angle iklan yang lebih edukatif dan lebih spesifik soal"
                    " ekspektasi, supaya sales menerima lead yang lebih siap."
                ),
                budget_shift="Kurangi creative hype, alihkan ke angle edukasi dan FAQ.",
                urgency="medium",
            )
        )

    if warm_count > 0 and not signals:
        signals.append(
            MarketingAdsSignal(
                title="Pertahankan budget nurture untuk warm leads",
                observation=(
                    f"Warm leads terdeteksi {warm_count} dan belum ada sinyal anomali besar."
                ),
                recommendation=(
                    "Lanjutkan campaign nurture dengan pembuktian value dan contoh use case."
                ),
                budget_shift="Pertahankan distribusi budget sambil monitor performa mingguan.",
                urgency="medium",
            )
        )

    return signals[:4]


def build_monthly_content_plan(
    *,
    top_objections: list[MarketingObjectionInsight],
    lead_temperature_counter: Counter[str],
    sentiment_counter: Counter[str],
    buying_intent_counter: Counter[str],
) -> list[MarketingPlanningItem]:
    primary_objection = top_objections[0].topic if top_objections else "trust dan klarifikasi awal"
    secondary_objection = (
        top_objections[1].topic if len(top_objections) > 1 else "bukti hasil dan proses"
    )
    cautious_count = sentiment_counter.get("cautious", 0)
    high_intent_count = buying_intent_counter.get("high", 0)
    hot_count = lead_temperature_counter.get("hot", 0)

    return [
        MarketingPlanningItem(
            window_label="Week 1",
            theme=f"Jawab objection utama: {primary_objection}",
            objective="Naikkan trust awal dan kurangi friksi sebelum audience chat ke sales.",
            suggested_format="carousel_and_short_video",
            primary_metric="WhatsApp inquiries from educated audience",
        ),
        MarketingPlanningItem(
            window_label="Week 2",
            theme="Bangun social proof dan bukti proses",
            objective=(
                "Ubah audience cautious menjadi lebih siap masuk percakapan"
                if cautious_count > 0
                else "Pertahankan rasa aman audience dengan bukti yang konkret"
            ),
            suggested_format="testimonial_video",
            primary_metric="Reply quality and follow-up continuation rate",
        ),
        MarketingPlanningItem(
            window_label="Week 3",
            theme=f"Perkuat angle intent tinggi: {secondary_objection}",
            objective=(
                "Dorong warm leads menjadi closing-ready"
                if high_intent_count > 0 or hot_count > 0
                else "Bangun minat yang lebih jelas sebelum CTA konsultasi"
            ),
            suggested_format="faq_reels_or_landing_snippet",
            primary_metric="Warm-to-hot lead progression",
        ),
        MarketingPlanningItem(
            window_label="Week 4",
            theme="Recap insight dan refresh creative terbaik",
            objective="Scale angle yang paling banyak menurunkan resistance di chat.",
            suggested_format="best_angle_recut",
            primary_metric="Cost per qualified conversation",
        ),
    ]
