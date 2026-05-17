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
    MarketingBreakdownItem,
    MarketingContentRecommendation,
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


def ensure_aware_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None

    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)

    return value.astimezone(timezone.utc)

    try:
        return UUID(value)
    except (TypeError, ValueError):
        return None


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
