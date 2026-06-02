from collections import Counter
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session, selectinload

from app.models.ai_extraction import AIExtraction
from app.models.audit_log import AuditLog
from app.models.chat_review_case import ChatReviewCase
from app.models.chat_review_note import ChatReviewNote
from app.models.conversation import Conversation
from app.models.kpi_alert_record import KpiAlertRecord
from app.models.kpi_command_snapshot import KpiCommandSnapshot
from app.models.knowledge_update_proposal import KnowledgeUpdateProposal
from app.models.lead import Lead
from app.models.lead_deal import LeadDeal
from app.models.lead_discipline_log import LeadDisciplineLog
from app.models.lead_task import LeadTask
from app.models.marketing_execution_item import (
    MarketingExecutionItem as MarketingExecutionItemModel,
)
from app.models.marketing_insight_snapshot import MarketingInsightSnapshot
from app.models.message import Message
from app.models.organization import Organization
from app.models.ops_notification import OpsNotification
from app.models.product_knowledge import ProductKnowledge
from app.models.reply_suggestion import ReplySuggestion
from app.models.sales_team import SalesTeam
from app.models.sent_message import SentMessage
from app.models.user import User
from app.schemas.channel_schema import ChannelOverviewItem, ChannelOverviewResponse
from app.schemas.dashboard_schema import (
    ChatReviewCenterResponse,
    ChatReviewCaseItem,
    ChatReviewQueueItem,
    DashboardAIExtractionSummary,
    DashboardLatestMessage,
    DashboardReplySuggestionSummary,
    DashboardSentMessageSummary,
    ExecutiveRecommendationItem,
    KnowledgeUpdateProposalItem,
    ManagerBoundaryAlertItem,
    ManagerCoachingPriorityItem,
    ManagerTeamMemberItem,
    ManagerInsightsResponse,
    ManagerObjectionTrendItem,
    ManagerTeamDisciplineRow,
    KpiAlertHistoryResponse,
    KpiAlertItem,
    KpiCommandCenterResponse,
    KpiAlertResolveRequest,
    KpiSnapshotHistoryResponse,
    KpiSnapshotItem,
    KpiSummaryCard,
    MarketingAdsSignal,
    MarketingBreakdownItem,
    MarketingContentBrief,
    MarketingContentRecommendation,
    MarketingExecutionItem,
    MarketingExecutionItemCreateRequest,
    MarketingExecutionSummary,
    MarketingExecutionItemUpdateRequest,
    OrganizationPerformanceRow,
    OpsAuditLogRow,
    OpsConversationRow,
    OpsNotificationItem,
    OpsNotificationResolveRequest,
    OpsNotificationResponse,
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
    PersistedKpiAlertRecord,
    SourcePerformanceRow,
    SalesWorklistItem,
    SalesWorklistResponse,
)
from app.services.access_control_service import (
    apply_sales_user_scope_filter,
    can_access_conversation_in_scope,
    get_accessible_sales_user_ids,
)
from app.services.chat_review_service import build_chat_review_case_item
from app.services.business_segmentation_service import matches_account_category
from app.services.conversation_lifecycle_service import is_conversation_auto_archived
from app.services.knowledge_update_queue_service import (
    build_knowledge_update_proposal_item,
)
from app.services.source_intelligence_service import (
    build_source_label,
    list_channel_definitions,
    matches_source_channel,
    normalize_source_channel,
    normalize_source_key,
)
from app.services.role_service import is_head_like, is_sales_like, is_superadmin_like


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


def get_age_bucket(created_at: datetime | None, now: datetime) -> str:
    created_at_utc = ensure_aware_utc(created_at) or now
    age_seconds = max((now - created_at_utc).total_seconds(), 0)

    if age_seconds >= 72 * 60 * 60:
        return "stale"
    if age_seconds >= 24 * 60 * 60:
        return "aging"
    return "fresh"


def get_latest_discipline_log_for_lead(lead: Lead) -> LeadDisciplineLog | None:
    if not lead.discipline_logs:
        return None
    return max(
        lead.discipline_logs,
        key=lambda log: (log.log_date, log.created_at),
    )


def lead_requires_deal_metrics_sync(lead: Lead) -> bool:
    if lead.current_stage not in {"won", "lost"}:
        return False

    current_deal_status = lead.deal.status if lead.deal is not None else None
    return current_deal_status != lead.current_stage


def lead_has_closed_outcome(lead: Lead) -> bool:
    if lead.current_stage in {"won", "lost"}:
        return True

    if lead.deal is not None and lead.deal.status in {"won", "lost"}:
        return True

    return False


def _extract_notification_lead_id(notification: OpsNotification) -> UUID | None:
    parts = (notification.source_key or "").split(":")
    if notification.source_type == "sales_worklist" and len(parts) >= 2:
        try:
            return UUID(parts[1])
        except (TypeError, ValueError):
            return None

    if notification.source_type == "deal_metrics_sync" and len(parts) >= 2:
        try:
            return UUID(parts[1])
        except (TypeError, ValueError):
            return None

    if notification.target_href and notification.target_href.startswith("/dashboard/crm/"):
        try:
            return UUID(notification.target_href.rsplit("/", 1)[-1])
        except (TypeError, ValueError):
            return None

    return None


def _resolve_notification_workflow_scope(source_type: str) -> str:
    if source_type == "sales_worklist":
        return "cs_follow_up"
    if source_type == "approval_queue":
        return "admin_review"
    if source_type == "deal_metrics_sync":
        return "deal_sync"
    return "ops_oversight"


def _resolve_notification_owner_role(source_type: str) -> str:
    if source_type in {"sales_worklist", "approval_queue", "deal_metrics_sync"}:
        return "sales"
    return "head"


def _resolve_notification_target_role(source_type: str) -> str:
    if source_type == "approval_queue":
        return "manager"
    if source_type == "sales_worklist":
        return "sales"
    if source_type == "deal_metrics_sync":
        return "sales"
    return "superadmin"


def build_ops_notification_item(
    notification: OpsNotification,
    lead_lookup: dict[UUID, Lead] | None = None,
) -> OpsNotificationItem:
    now = datetime.now(timezone.utc)
    lead_id = _extract_notification_lead_id(notification)
    lead = lead_lookup.get(lead_id) if lead_lookup and lead_id else None
    return OpsNotificationItem(
        id=notification.id,
        organization_id=notification.organization_id,
        user_id=notification.user_id,
        source_type=notification.source_type,
        source_key=notification.source_key,
        workflow_scope=notification.workflow_scope,
        owner_role=notification.owner_role,
        target_role=notification.target_role,
        lead_id=lead_id,
        lead_name=lead.display_name if lead is not None else None,
        sales_owner_name=lead.assigned_user.name if lead is not None and lead.assigned_user else None,
        severity=notification.severity,
        title=notification.title,
        body=notification.body,
        target_href=notification.target_href,
        status=notification.status,
        delivery_channel=notification.delivery_channel,
        delivery_status=notification.delivery_status,
        escalation_level=notification.escalation_level,
        resolution_note=notification.resolution_note,
        age_bucket=get_age_bucket(notification.created_at, now),
        acknowledged_by_user_id=notification.acknowledged_by_user_id,
        acknowledged_at=notification.acknowledged_at,
        delivered_at=notification.delivered_at,
        escalated_at=notification.escalated_at,
        resolved_at=notification.resolved_at,
        created_at=notification.created_at,
        updated_at=notification.updated_at,
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


def build_chat_review_case_summary(
    review_case: ChatReviewCase | None,
) -> ChatReviewCaseItem | None:
    if review_case is None:
        return None
    return build_chat_review_case_item(review_case)


def build_knowledge_update_proposal_summary(
    proposal: KnowledgeUpdateProposal | None,
) -> KnowledgeUpdateProposalItem | None:
    if proposal is None:
        return None
    return build_knowledge_update_proposal_item(proposal)


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


def get_review_queue_timestamp(
    ui_status: str,
    latest_message: Message | None,
    extraction: AIExtraction | None,
    suggestion: ReplySuggestion | None,
) -> datetime | None:
    if ui_status in {"needs_analysis", "needs_reply_suggestion"}:
        return latest_message.message_timestamp if latest_message is not None else None

    if ui_status in {
        "needs_escalation",
        "needs_approval",
        "draft_ready",
        "approved_ready_to_send",
        "reply_rejected",
    }:
        return suggestion.created_at if suggestion is not None else None

    if extraction is not None:
        return extraction.created_at

    return latest_message.message_timestamp if latest_message is not None else None


def derive_chat_review_bucket(
    *,
    ui_status: str,
    latest_extraction: AIExtraction | None,
    latest_suggestion: ReplySuggestion | None,
) -> tuple[str | None, str | None, str | None, int]:
    if ui_status == "needs_analysis":
        return (
            "needs_analysis",
            "Butuh AI Analysis",
            "Jalankan AI analysis ulang agar stage, risiko, dan next action sinkron dengan chat terbaru.",
            40,
        )

    if ui_status == "needs_reply_suggestion":
        return (
            "needs_reply_suggestion",
            "Butuh Draft Baru",
            "Generate reply suggestion baru supaya chat ini siap ditindak dari workspace review.",
            30,
        )

    if ui_status == "needs_escalation":
        return (
            "human_escalation",
            "Butuh Review Head",
            "Conversation ini ditandai high risk atau butuh intervensi manusia sebelum ada respons final.",
            60,
        )

    if ui_status == "needs_approval":
        return (
            "pending_approval",
            "Menunggu Approval",
            "Buka detail conversation, cek draft balasan, lalu approve atau reject dengan alasan yang jelas.",
            35,
        )

    if ui_status == "draft_ready":
        return (
            "draft_review",
            "Draft Siap Direview",
            "Draft sudah ada. Validasi tone, fakta, dan arahan aksi sebelum dipakai sales.",
            25,
        )

    if ui_status == "approved_ready_to_send":
        return (
            "ready_to_send",
            "Siap Dikirim",
            "Balasan sudah approved. Pastikan sales mengirim respons dan menutup loop follow-up-nya.",
            20,
        )

    if ui_status == "reply_rejected":
        return (
            "needs_rework",
            "Perlu Rework",
            "Draft sebelumnya ditolak. Generate ulang atau revisi strategi respons sebelum lanjut.",
            25,
        )

    if latest_extraction is not None and latest_extraction.risk_level == "high":
        return (
            "human_escalation",
            "Butuh Review Head",
            "Tidak ada draft pending, tapi sinyal risiko percakapan masih tinggi dan perlu ditinjau manual.",
            45,
        )

    if latest_suggestion is not None and latest_suggestion.approval_status == "pending":
        return (
            "pending_approval",
            "Menunggu Approval",
            "Draft pending masih menunggu keputusan reviewer.",
            35,
        )

    return (None, None, None, 0)


def build_chat_review_item(
    *,
    conversation: Conversation,
    latest_message: Message | None,
    latest_extraction: AIExtraction | None,
    latest_suggestion: ReplySuggestion | None,
    latest_sent_message: SentMessage | None,
    now: datetime,
) -> ChatReviewQueueItem | None:
    current_sent_state = resolve_current_sent_message(latest_message, latest_sent_message)
    ui_status = determine_ui_status(
        latest_message,
        latest_extraction,
        latest_suggestion,
        current_sent_state,
    )
    review_bucket, review_label, recommended_action, review_bonus = derive_chat_review_bucket(
        ui_status=ui_status,
        latest_extraction=latest_extraction,
        latest_suggestion=latest_suggestion,
    )

    if (
        review_bucket is None
        or review_label is None
        or recommended_action is None
    ):
        return None

    queue_since_at = get_review_queue_timestamp(
        ui_status,
        latest_message,
        latest_extraction,
        latest_suggestion,
    )
    risk_level = latest_suggestion.risk_level if latest_suggestion else None
    if risk_level is None and latest_extraction is not None:
        risk_level = latest_extraction.risk_level

    active_review_case = conversation.chat_review_case

    return ChatReviewQueueItem(
        conversation_id=conversation.id,
        lead_id=conversation.lead_id,
        lead_name=(
            conversation.lead.display_name
            if conversation.lead is not None
            else conversation.title
        ),
        conversation_title=conversation.title,
        sales_user_id=conversation.sales_user_id,
        sales_owner_name=conversation.sales_user.name if conversation.sales_user else None,
        source_channel=normalize_source_channel(conversation.source),
        source_label=build_source_label(conversation.source),
        account_category=(
            conversation.lead.account_category
            if conversation.lead is not None
            else "unknown"
        ),
        current_stage=conversation.current_stage,
        lead_temperature=conversation.lead_temperature,
        risk_level=risk_level,
        review_bucket=review_bucket,
        review_label=review_label,
        recommended_action=recommended_action,
        latest_message_preview=(
            latest_message.message_text[:240].strip()
            if latest_message is not None and latest_message.message_text
            else None
        ),
        latest_message_at=latest_message.message_timestamp if latest_message else None,
        queue_since_at=queue_since_at,
        age_bucket=get_age_bucket(queue_since_at, now) if queue_since_at else "fresh",
        priority_score=calculate_priority_score(latest_extraction, latest_suggestion)
        + review_bonus,
        latest_ai_extraction=build_ai_summary(latest_extraction),
        latest_reply_suggestion=build_reply_summary(latest_suggestion),
        latest_sent_message=build_sent_message_summary(latest_sent_message),
        active_review_case_id=active_review_case.id if active_review_case else None,
        active_review_status=active_review_case.status if active_review_case else None,
        active_review_label=active_review_case.review_label if active_review_case else None,
        active_review_reviewer_name=(
            active_review_case.reviewer_user.name
            if active_review_case and active_review_case.reviewer_user
            else None
        ),
    )


def get_sales_inbox(
    db: Session,
    current_user: User,
    *,
    source_channel: str | None = None,
    archive_scope: str = "active",
) -> list[SalesInboxItem]:
    if current_user.organization_id is None and not is_superadmin_like(current_user.role):
        return []

    statement = select(Conversation).options(
        selectinload(Conversation.messages),
        selectinload(Conversation.ai_extractions),
        selectinload(Conversation.reply_suggestions),
        selectinload(Conversation.sent_messages),
        selectinload(Conversation.sales_user),
    )
    if not is_superadmin_like(current_user.role):
        statement = statement.where(
            Conversation.organization_id == current_user.organization_id
        )

    statement = apply_sales_user_scope_filter(
        statement,
        db=db,
        current_user=current_user,
        sales_user_id_column=Conversation.sales_user_id,
    )

    statement = statement.order_by(desc(Conversation.last_message_at))

    normalized_archive_scope = archive_scope if archive_scope in {"active", "archived", "all"} else "active"
    conversations = []
    for conversation in db.scalars(statement).all():
        if not matches_source_channel(conversation.source, source_channel):
            continue

        is_archived = is_conversation_auto_archived(conversation)
        if normalized_archive_scope == "active" and is_archived:
            continue
        if normalized_archive_scope == "archived" and not is_archived:
            continue

        conversations.append(conversation)

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
                source_channel=normalize_source_channel(conversation.source),
                source_label=build_source_label(conversation.source),
                account_category=(
                    conversation.lead.account_category
                    if conversation.lead is not None
                    else "unknown"
                ),
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
                sales_owner_name=conversation.sales_user.name if conversation.sales_user else None,
                is_archived=is_conversation_auto_archived(conversation),
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
            selectinload(Conversation.chat_review_case).selectinload(
                ChatReviewCase.submitted_by_user
            ),
            selectinload(Conversation.chat_review_case).selectinload(
                ChatReviewCase.reviewer_user
            ),
            selectinload(Conversation.chat_review_case)
            .selectinload(ChatReviewCase.notes)
            .selectinload(ChatReviewNote.author_user),
            selectinload(Conversation.knowledge_update_proposal).selectinload(
                KnowledgeUpdateProposal.proposed_by_user
            ),
            selectinload(Conversation.knowledge_update_proposal).selectinload(
                KnowledgeUpdateProposal.reviewed_by_user
            ),
            selectinload(Conversation.knowledge_update_proposal).selectinload(
                KnowledgeUpdateProposal.published_product_knowledge
            ),
        )
    )

    conversation = db.scalars(statement).first()

    if conversation is None:
        return None

    if not can_access_conversation_in_scope(
        db=db,
        current_user=current_user,
        conversation=conversation,
    ):
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
        source_channel=normalize_source_channel(conversation.source),
        source_label=build_source_label(conversation.source),
        account_category=(
            conversation.lead.account_category
            if conversation.lead is not None
            else "unknown"
        ),
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
        chat_review_case=build_chat_review_case_summary(conversation.chat_review_case),
        knowledge_update_proposal=build_knowledge_update_proposal_summary(
            conversation.knowledge_update_proposal
        ),
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
    latest_discipline_log: LeadDisciplineLog | None,
    now: datetime,
) -> SalesWorklistItem | None:
    if lead_has_closed_outcome(lead):
        return None

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
        task_id=None,
        lead_id=lead.id,
        conversation_id=conversation.id,
        lead_name=lead.display_name,
        assigned_user_name=lead.assigned_user.name if lead.assigned_user else None,
        current_stage=lead.current_stage,
        lead_temperature=lead.lead_temperature,
        priority_score=priority_score,
        task_type=task_type,
        task_status=None,
        task_label=task_label,
        reason=reason,
        recommended_action=recommended_action,
        last_contact_at=lead.last_contact_at,
        next_follow_up_at=next_follow_up_at,
        latest_discipline_log_date=(
            latest_discipline_log.log_date if latest_discipline_log else None
        ),
    )


def build_sales_worklist_item_from_task(
    *,
    lead: Lead,
    conversation: Conversation | None,
    task: LeadTask,
    latest_extraction: AIExtraction | None,
    latest_discipline_log: LeadDisciplineLog | None,
    now: datetime,
) -> SalesWorklistItem:
    due_at = ensure_aware_utc(task.due_at)
    is_overdue = due_at is not None and due_at <= now
    is_snoozed = task.status == "snoozed"

    if is_overdue:
        task_type = "overdue_follow_up"
        task_label = task.title
        reason = "Task follow-up ini sudah melewati jadwal dan butuh tindakan segera."
        priority_bonus = 45
    elif is_snoozed:
        task_type = "snoozed_follow_up"
        task_label = task.title
        reason = "Task ini sedang di-snooze. Pastikan alasan penundaannya masih valid."
        priority_bonus = 20
    else:
        task_type = task.task_type
        task_label = task.title
        reason = "Task ini sudah dipersist ke sistem dan menunggu eksekusi manual dari tim."
        priority_bonus = 15

    recommended_action = (
        latest_extraction.next_best_action
        if latest_extraction is not None
        else "Buka detail lead, review konteks terbaru, lalu putuskan follow-up yang paling aman."
    )

    return SalesWorklistItem(
        task_id=task.id,
        lead_id=lead.id,
        conversation_id=conversation.id if conversation else None,
        lead_name=lead.display_name,
        assigned_user_name=task.assigned_user.name if task.assigned_user else None,
        current_stage=lead.current_stage,
        lead_temperature=lead.lead_temperature,
        priority_score=calculate_priority_score(latest_extraction, None) + priority_bonus,
        task_type=task_type,
        task_status=task.status,
        task_label=task_label,
        reason=reason,
        recommended_action=recommended_action,
        last_contact_at=lead.last_contact_at,
        next_follow_up_at=due_at,
        latest_discipline_log_date=(
            latest_discipline_log.log_date if latest_discipline_log else None
        ),
    )


def build_discipline_worklist_item(
    *,
    lead: Lead,
    conversation: Conversation | None,
    latest_discipline_log: LeadDisciplineLog | None,
    now: datetime,
) -> SalesWorklistItem | None:
    if lead_has_closed_outcome(lead):
        return None

    today = now.date()
    latest_log_date = latest_discipline_log.log_date if latest_discipline_log else None

    if latest_log_date == today:
        return None

    if latest_log_date is None:
        task_type = "missing_discipline_log"
        task_label = "Discipline log belum diisi"
        reason = "Belum ada catatan aktivitas harian untuk lead ini."
        recommended_action = "Isi discipline log setelah follow-up atau update status lead hari ini."
        priority_score = 30
    else:
        task_type = "stale_discipline_log"
        task_label = "Discipline log perlu diperbarui"
        reason = "Catatan aktivitas harian lead ini belum diperbarui untuk hari ini."
        recommended_action = "Buka lead, catat hasil aktivitas terbaru, dan tetapkan next follow-up yang jelas."
        priority_score = 20

    return SalesWorklistItem(
        task_id=None,
        lead_id=lead.id,
        conversation_id=conversation.id if conversation else None,
        lead_name=lead.display_name,
        assigned_user_name=lead.assigned_user.name if lead.assigned_user else None,
        current_stage=lead.current_stage,
        lead_temperature=lead.lead_temperature,
        priority_score=priority_score,
        task_type=task_type,
        task_status=None,
        task_label=task_label,
        reason=reason,
        recommended_action=recommended_action,
        last_contact_at=lead.last_contact_at,
        next_follow_up_at=lead.next_follow_up_at,
        latest_discipline_log_date=latest_log_date,
    )


def get_sales_worklist(
    db: Session,
    current_user: User,
) -> SalesWorklistResponse:
    if current_user.organization_id is None and not is_superadmin_like(current_user.role):
        return SalesWorklistResponse(
            generated_at=datetime.now(timezone.utc),
            overdue_count=0,
            hot_lead_count=0,
            ready_to_send_count=0,
            pending_analysis_count=0,
            snoozed_count=0,
            completed_today_count=0,
            due_today_count=0,
            overdue_24h_count=0,
            overdue_72h_count=0,
            open_task_count=0,
            missing_discipline_log_count=0,
            stale_discipline_log_count=0,
            completion_rate_today=0,
            items=[],
            upcoming_items=[],
        )

    statement = select(Lead).options(
        selectinload(Lead.assigned_user),
        selectinload(Lead.tasks).selectinload(LeadTask.assigned_user),
        selectinload(Lead.discipline_logs).selectinload(LeadDisciplineLog.actor_user),
        selectinload(Lead.conversations).selectinload(Conversation.messages),
        selectinload(Lead.conversations).selectinload(Conversation.ai_extractions),
        selectinload(Lead.conversations).selectinload(Conversation.reply_suggestions),
        selectinload(Lead.conversations).selectinload(Conversation.sent_messages),
    )
    if not is_superadmin_like(current_user.role):
        statement = statement.where(Lead.organization_id == current_user.organization_id)

    statement = apply_sales_user_scope_filter(
        statement,
        db=db,
        current_user=current_user,
        sales_user_id_column=Lead.assigned_user_id,
    )

    leads = list(db.scalars(statement).all())
    now = datetime.now(timezone.utc)
    items: list[SalesWorklistItem] = []
    upcoming_items: list[SalesWorklistItem] = []

    overdue_count = 0
    hot_lead_count = 0
    ready_to_send_count = 0
    pending_analysis_count = 0
    snoozed_count = 0
    completed_today_count = 0
    due_today_count = 0
    overdue_24h_count = 0
    overdue_72h_count = 0
    open_task_count = 0
    missing_discipline_log_count = 0
    stale_discipline_log_count = 0

    for lead in leads:
        conversation = get_latest_conversation_for_lead(lead)
        latest_discipline_log = get_latest_discipline_log_for_lead(lead)
        lead_is_closed = lead_has_closed_outcome(lead)

        latest_message = get_latest_message(conversation) if conversation else None
        latest_extraction = get_latest_extraction(conversation) if conversation else None
        latest_suggestion = get_latest_reply_suggestion(conversation) if conversation else None
        latest_sent_message = get_latest_sent_message(conversation) if conversation else None

        open_or_snoozed_tasks = sorted(
            [
                task
                for task in lead.tasks
                if task.status in {"open", "snoozed"}
                and not (
                    lead_is_closed
                    and task.task_type in {"manual_follow_up", "scheduled_follow_up", "approval_follow_up"}
                )
            ],
            key=lambda task: (ensure_aware_utc(task.due_at) or now, task.created_at),
        )
        actionable_open_or_snoozed_tasks = [
            task
            for task in open_or_snoozed_tasks
            if task.status == "snoozed"
            or (task_due_at := ensure_aware_utc(task.due_at)) is None
            or task_due_at.date() <= now.date()
        ]
        future_open_tasks = [
            task
            for task in open_or_snoozed_tasks
            if task.status == "open"
            and (task_due_at := ensure_aware_utc(task.due_at)) is not None
            and task_due_at.date() > now.date()
        ]
        done_today_tasks = [
            task
            for task in lead.tasks
            if task.status == "done"
            and (completed_at := ensure_aware_utc(task.completed_at)) is not None
            and completed_at.date() == now.date()
        ]
        completed_today_count += len(done_today_tasks)
        open_task_count += len(open_or_snoozed_tasks)

        if actionable_open_or_snoozed_tasks:
            task_due_at = ensure_aware_utc(actionable_open_or_snoozed_tasks[0].due_at)
            if task_due_at is not None:
                age_seconds = (now - task_due_at).total_seconds()
                if task_due_at.date() == now.date():
                    due_today_count += 1
                if age_seconds >= 24 * 60 * 60:
                    overdue_24h_count += 1
                if age_seconds >= 72 * 60 * 60:
                    overdue_72h_count += 1
            task_item = build_sales_worklist_item_from_task(
                lead=lead,
                conversation=conversation,
                task=actionable_open_or_snoozed_tasks[0],
                latest_extraction=latest_extraction,
                latest_discipline_log=latest_discipline_log,
                now=now,
            )
            items.append(task_item)
            if task_item.task_type == "overdue_follow_up":
                overdue_count += 1
            elif task_item.task_type == "snoozed_follow_up":
                snoozed_count += 1
            continue

        if future_open_tasks:
            upcoming_items.append(
                build_sales_worklist_item_from_task(
                    lead=lead,
                    conversation=conversation,
                    task=future_open_tasks[0],
                    latest_extraction=latest_extraction,
                    latest_discipline_log=latest_discipline_log,
                    now=now,
                )
            )

        derived_item = None
        if conversation is not None:
            derived_item = build_sales_worklist_item(
                lead=lead,
                conversation=conversation,
                latest_message=latest_message,
                latest_extraction=latest_extraction,
                latest_suggestion=latest_suggestion,
                latest_sent_message=latest_sent_message,
                latest_discipline_log=latest_discipline_log,
                now=now,
            )
        if derived_item is not None:
            items.append(derived_item)

            if derived_item.task_type == "overdue_follow_up":
                overdue_count += 1
            elif derived_item.task_type == "hot_lead_needs_reply":
                hot_lead_count += 1
            elif derived_item.task_type == "approved_ready_to_send":
                ready_to_send_count += 1
            elif derived_item.task_type == "needs_analysis":
                pending_analysis_count += 1
            continue

        discipline_item = build_discipline_worklist_item(
            lead=lead,
            conversation=conversation,
            latest_discipline_log=latest_discipline_log,
            now=now,
        )
        if discipline_item is None:
            continue

        items.append(discipline_item)
        if discipline_item.task_type == "missing_discipline_log":
            missing_discipline_log_count += 1
        elif discipline_item.task_type == "stale_discipline_log":
            stale_discipline_log_count += 1

    items.sort(
        key=lambda item: (item.priority_score, item.last_contact_at or now),
        reverse=True,
    )
    upcoming_items.sort(
        key=lambda item: (
            ensure_aware_utc(item.next_follow_up_at) or now,
            -item.priority_score,
        ),
    )

    return SalesWorklistResponse(
        generated_at=now,
        overdue_count=overdue_count,
        hot_lead_count=hot_lead_count,
        ready_to_send_count=ready_to_send_count,
        pending_analysis_count=pending_analysis_count,
        snoozed_count=snoozed_count,
        completed_today_count=completed_today_count,
        due_today_count=due_today_count,
        overdue_24h_count=overdue_24h_count,
        overdue_72h_count=overdue_72h_count,
        open_task_count=open_task_count,
        missing_discipline_log_count=missing_discipline_log_count,
        stale_discipline_log_count=stale_discipline_log_count,
        completion_rate_today=(
            round(
                (completed_today_count / (completed_today_count + open_task_count)) * 100,
                1,
            )
            if (completed_today_count + open_task_count) > 0
            else 0
        ),
        items=items,
        upcoming_items=upcoming_items,
    )


def _safe_ratio(numerator: int, denominator: int) -> float:
    if denominator <= 0:
        return 0.0
    return round(numerator / denominator, 4)


def _is_open_coaching_status(status: str | None) -> bool:
    return (status or "").strip().lower() in {
        "draft",
        "in_review",
        "needs_rework",
        "escalated",
    }


def _manager_priority_score(
    review_case: ChatReviewCase,
    latest_extraction: AIExtraction | None,
    latest_message_at: datetime | None,
    now: datetime,
) -> int:
    score = 30

    risk_level = (latest_extraction.risk_level if latest_extraction else "").lower()
    if risk_level == "high":
        score += 40
    elif risk_level == "medium":
        score += 20

    status = review_case.status.lower()
    if status == "escalated":
        score += 35
    elif status == "needs_rework":
        score += 20
    elif status == "in_review":
        score += 10

    age_bucket = get_age_bucket(latest_message_at or review_case.updated_at, now)
    if age_bucket == "stale":
        score += 20
    elif age_bucket == "aging":
        score += 10

    return score


def get_manager_insights(
    db: Session,
    *,
    current_user: User,
    account_category: str | None = None,
) -> ManagerInsightsResponse:
    now = datetime.now(timezone.utc)

    if current_user.organization_id is None and not is_superadmin_like(current_user.role):
        return ManagerInsightsResponse(
            generated_at=now,
            scope_label="No organization scope",
            scope_team_count=0,
            scope_member_count=0,
            total_leads=0,
            stale_lead_ratio=0.0,
            follow_up_compliance_rate=0.0,
            missing_or_stale_log_count=0,
            overdue_follow_up_count=0,
            open_coaching_case_count=0,
            pending_knowledge_proposal_count=0,
            team_discipline=[],
            coaching_priority=[],
            objection_trends=[],
            boundary_alerts=[],
        )

    accessible_user_ids = get_accessible_sales_user_ids(
        db=db,
        current_user=current_user,
    )

    lead_statement = select(Lead).options(
        selectinload(Lead.assigned_user).selectinload(User.sales_team),
        selectinload(Lead.discipline_logs),
    )
    if not is_superadmin_like(current_user.role):
        lead_statement = lead_statement.where(Lead.organization_id == current_user.organization_id)
    lead_statement = apply_sales_user_scope_filter(
        lead_statement,
        db=db,
        current_user=current_user,
        sales_user_id_column=Lead.assigned_user_id,
    )
    leads = [
        lead
        for lead in db.scalars(lead_statement).all()
        if matches_account_category(lead.account_category, account_category)
    ]
    allowed_lead_ids = {lead.id for lead in leads}

    conversation_statement = select(Conversation).options(
        selectinload(Conversation.lead),
        selectinload(Conversation.sales_user).selectinload(User.sales_team),
        selectinload(Conversation.messages),
        selectinload(Conversation.ai_extractions),
        selectinload(Conversation.chat_review_case).selectinload(
            ChatReviewCase.reviewer_user
        ),
        selectinload(Conversation.knowledge_update_proposal),
    )
    if not is_superadmin_like(current_user.role):
        conversation_statement = conversation_statement.where(
            Conversation.organization_id == current_user.organization_id
        )
    conversation_statement = apply_sales_user_scope_filter(
        conversation_statement,
        db=db,
        current_user=current_user,
        sales_user_id_column=Conversation.sales_user_id,
    )
    conversations = [
        conversation
        for conversation in db.scalars(conversation_statement).all()
        if conversation.lead_id is None or conversation.lead_id in allowed_lead_ids
    ]
    conversation_by_id = {conversation.id: conversation for conversation in conversations}

    team_statement = select(SalesTeam).options(
        selectinload(SalesTeam.unit),
        selectinload(SalesTeam.manager_user),
        selectinload(SalesTeam.members),
    )
    if not is_superadmin_like(current_user.role):
        team_statement = team_statement.where(SalesTeam.organization_id == current_user.organization_id)
    teams = list(db.scalars(team_statement).all())

    if accessible_user_ids is not None:
        teams = [
            team
            for team in teams
            if team.manager_user_id == current_user.id
            or any(member.id in accessible_user_ids for member in team.members)
        ]

    team_lead_map: dict[UUID | None, list[Lead]] = {}
    for lead in leads:
        team_id = lead.assigned_user.team_id if lead.assigned_user else None
        team_lead_map.setdefault(team_id, []).append(lead)

    open_review_cases: list[ChatReviewCase] = []
    pending_proposals = 0
    objection_counter: Counter[str] = Counter()

    for conversation in conversations:
        latest_extraction = get_latest_extraction(conversation)
        if latest_extraction:
            objection_counter.update(
                objection.strip().lower()
                for objection in latest_extraction.main_objections
                if objection and objection.strip()
            )

        if conversation.chat_review_case and _is_open_coaching_status(
            conversation.chat_review_case.status
        ):
            open_review_cases.append(conversation.chat_review_case)

        if (
            conversation.knowledge_update_proposal
            and conversation.knowledge_update_proposal.status == "pending_approval"
        ):
            pending_proposals += 1

    total_leads = len(leads)
    missing_or_stale_log_count = 0
    overdue_follow_up_count = 0

    team_rows: list[ManagerTeamDisciplineRow] = []
    boundary_alerts: list[ManagerBoundaryAlertItem] = []

    for team in teams:
        team_leads = team_lead_map.get(team.id, [])
        missing_or_stale_logs = 0
        overdue_follow_ups = 0
        open_case_count = 0
        pending_team_proposals = 0

        for lead in team_leads:
            latest_log = get_latest_discipline_log_for_lead(lead)
            latest_log_date = latest_log.log_date if latest_log else None
            if latest_log_date != now.date():
                missing_or_stale_logs += 1
                missing_or_stale_log_count += 1

            next_follow_up_at = ensure_aware_utc(lead.next_follow_up_at)
            if next_follow_up_at is not None and next_follow_up_at <= now:
                overdue_follow_ups += 1
                overdue_follow_up_count += 1

        for conversation in conversations:
            if conversation.sales_user and conversation.sales_user.team_id == team.id:
                if conversation.chat_review_case and _is_open_coaching_status(
                    conversation.chat_review_case.status
                ):
                    open_case_count += 1
                if (
                    conversation.knowledge_update_proposal
                    and conversation.knowledge_update_proposal.status
                    == "pending_approval"
                ):
                    pending_team_proposals += 1

        lead_count = len(team_leads)
        discipline_compliance_rate = _safe_ratio(
            max(lead_count - missing_or_stale_logs, 0),
            lead_count,
        )
        follow_up_compliance_rate = _safe_ratio(
            max(lead_count - overdue_follow_ups, 0),
            lead_count,
        )

        team_rows.append(
            ManagerTeamDisciplineRow(
                team_id=team.id,
                team_name=team.name,
                unit_id=team.unit_id,
                unit_name=team.unit.name if team.unit else None,
                manager_user_name=team.manager_user.name if team.manager_user else None,
                member_count=len(
                    [
                        member
                        for member in team.members
                        if accessible_user_ids is None or member.id in accessible_user_ids
                    ]
                ),
                members=[
                    ManagerTeamMemberItem(
                        id=member.id,
                        name=member.name,
                        role=member.role,
                        is_active=member.is_active,
                    )
                    for member in sorted(
                        [
                            member
                            for member in team.members
                            if accessible_user_ids is None
                            or member.id in accessible_user_ids
                        ],
                        key=lambda member: (member.role != "manager", member.name.lower()),
                    )
                ],
                lead_count=lead_count,
                missing_or_stale_logs=missing_or_stale_logs,
                overdue_follow_ups=overdue_follow_ups,
                open_coaching_cases=open_case_count,
                pending_knowledge_proposals=pending_team_proposals,
                discipline_compliance_rate=discipline_compliance_rate,
                follow_up_compliance_rate=follow_up_compliance_rate,
            )
        )

        if overdue_follow_ups >= 3:
            boundary_alerts.append(
                ManagerBoundaryAlertItem(
                    team_id=team.id,
                    team_name=team.name,
                    unit_id=team.unit_id,
                    unit_name=team.unit.name if team.unit else None,
                    severity="high",
                    title="Follow-up overdue menumpuk",
                    description=(
                        f"{overdue_follow_ups} lead di team ini sudah melewati jadwal follow-up."
                    ),
                    target_href="/dashboard/follow-up",
                )
            )
        if missing_or_stale_logs >= 3:
            boundary_alerts.append(
                ManagerBoundaryAlertItem(
                    team_id=team.id,
                    team_name=team.name,
                    unit_id=team.unit_id,
                    unit_name=team.unit.name if team.unit else None,
                    severity="medium",
                    title="Discipline log tim mulai longgar",
                    description=(
                        f"{missing_or_stale_logs} lead belum punya log hari ini atau log-nya sudah stale."
                    ),
                    target_href="/dashboard/crm",
                )
            )
        if open_case_count >= 2:
            boundary_alerts.append(
                ManagerBoundaryAlertItem(
                    team_id=team.id,
                    team_name=team.name,
                    unit_id=team.unit_id,
                    unit_name=team.unit.name if team.unit else None,
                    severity="medium",
                    title="Coaching case aktif butuh perhatian",
                    description=(
                        f"Ada {open_case_count} coaching case aktif yang belum selesai di team ini."
                    ),
                    target_href="/dashboard/approvals",
                )
            )

    team_rows.sort(
        key=lambda row: (
            row.missing_or_stale_logs + row.overdue_follow_ups + row.open_coaching_cases,
            row.lead_count,
        ),
        reverse=True,
    )
    boundary_alerts.sort(
        key=lambda item: (
            {"high": 3, "medium": 2, "low": 1}.get(item.severity, 0),
            item.team_name,
        ),
        reverse=True,
    )

    coaching_priority: list[ManagerCoachingPriorityItem] = []
    for review_case in open_review_cases:
        conversation = conversation_by_id.get(review_case.conversation_id)
        if conversation is None:
            continue
        latest_extraction = get_latest_extraction(conversation)
        lead_name = conversation.lead.display_name if conversation.lead else conversation.title
        coaching_priority.append(
            ManagerCoachingPriorityItem(
                review_case_id=review_case.id,
                conversation_id=conversation.id,
                lead_id=conversation.lead_id,
                lead_name=lead_name,
                conversation_title=conversation.title,
                sales_owner_name=conversation.sales_user.name if conversation.sales_user else None,
                reviewer_user_name=review_case.reviewer_user.name if review_case.reviewer_user else None,
                review_status=review_case.status,
                review_label=review_case.review_label,
                risk_level=latest_extraction.risk_level if latest_extraction else None,
                latest_message_at=conversation.last_message_at,
                priority_score=_manager_priority_score(
                    review_case,
                    latest_extraction,
                    conversation.last_message_at,
                    now,
                ),
                recommended_action=review_case.recommended_action,
            )
        )

    coaching_priority.sort(
        key=lambda item: (item.priority_score, item.latest_message_at or now),
        reverse=True,
    )

    scope_label = (
        "Organization-wide manager view"
        if is_head_like(current_user.role)
        else "Scoped team or unit manager view"
    )

    visible_member_count = (
        len(accessible_user_ids) if accessible_user_ids is not None else sum(len(team.members) for team in teams)
    )

    return ManagerInsightsResponse(
        generated_at=now,
        scope_label=scope_label,
        scope_team_count=len(teams),
        scope_member_count=visible_member_count,
        total_leads=total_leads,
        stale_lead_ratio=_safe_ratio(missing_or_stale_log_count, total_leads),
        follow_up_compliance_rate=_safe_ratio(
            max(total_leads - overdue_follow_up_count, 0),
            total_leads,
        ),
        missing_or_stale_log_count=missing_or_stale_log_count,
        overdue_follow_up_count=overdue_follow_up_count,
        open_coaching_case_count=len(open_review_cases),
        pending_knowledge_proposal_count=pending_proposals,
        team_discipline=team_rows,
        coaching_priority=coaching_priority[:8],
        objection_trends=[
            ManagerObjectionTrendItem(objection=objection, count=count)
            for objection, count in objection_counter.most_common(6)
        ],
        boundary_alerts=boundary_alerts[:8],
    )


def get_sales_approval_queue(
    db: Session,
    current_user: User,
    *,
    risk_level: str | None = None,
    action_mode: str | None = None,
    age_bucket: str | None = None,
) -> SalesApprovalQueueResponse:
    now = datetime.now(timezone.utc)

    if current_user.organization_id is None and not is_superadmin_like(current_user.role):
        return SalesApprovalQueueResponse(
            generated_at=now,
            pending_count=0,
            escalation_count=0,
            high_risk_count=0,
            stale_count=0,
            items=[],
        )

    statement = select(Conversation).options(
        selectinload(Conversation.lead),
        selectinload(Conversation.ai_extractions),
        selectinload(Conversation.reply_suggestions),
    )
    if not is_superadmin_like(current_user.role):
        statement = statement.where(Conversation.organization_id == current_user.organization_id)
    statement = statement.order_by(desc(Conversation.last_message_at), desc(Conversation.created_at))

    statement = apply_sales_user_scope_filter(
        statement,
        db=db,
        current_user=current_user,
        sales_user_id_column=Conversation.sales_user_id,
    )

    conversations = list(db.scalars(statement).all())
    items: list[SalesApprovalQueueItem] = []
    escalation_count = 0
    high_risk_count = 0
    stale_count = 0

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
        if latest_suggestion.risk_level == "high":
            high_risk_count += 1
        if get_age_bucket(latest_suggestion.created_at, now) == "stale":
            stale_count += 1

        if risk_level and latest_suggestion.risk_level != risk_level:
            continue
        if action_mode and latest_suggestion.action_mode != action_mode:
            continue
        if age_bucket and get_age_bucket(latest_suggestion.created_at, now) != age_bucket:
            continue

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
        high_risk_count=high_risk_count,
        stale_count=stale_count,
        items=items,
    )


def get_sales_chat_review_center(
    db: Session,
    current_user: User,
    *,
    review_bucket: str | None = None,
    risk_level: str | None = None,
    age_bucket: str | None = None,
    source_channel: str | None = None,
) -> ChatReviewCenterResponse:
    now = datetime.now(timezone.utc)

    if current_user.organization_id is None and not is_superadmin_like(current_user.role):
        return ChatReviewCenterResponse(
            generated_at=now,
            total_items=0,
            needs_analysis_count=0,
            needs_reply_suggestion_count=0,
            pending_approval_count=0,
            escalation_count=0,
            ready_to_send_count=0,
            stale_count=0,
            items=[],
        )

    statement = select(Conversation).options(
        selectinload(Conversation.lead),
        selectinload(Conversation.sales_user),
        selectinload(Conversation.messages),
        selectinload(Conversation.ai_extractions),
        selectinload(Conversation.reply_suggestions),
        selectinload(Conversation.sent_messages),
        selectinload(Conversation.chat_review_case).selectinload(
            ChatReviewCase.reviewer_user
        ),
    )
    if not is_superadmin_like(current_user.role):
        statement = statement.where(Conversation.organization_id == current_user.organization_id)
    statement = statement.order_by(desc(Conversation.last_message_at), desc(Conversation.created_at))

    statement = apply_sales_user_scope_filter(
        statement,
        db=db,
        current_user=current_user,
        sales_user_id_column=Conversation.sales_user_id,
    )

    conversations = list(db.scalars(statement).all())
    items: list[ChatReviewQueueItem] = []

    needs_analysis_count = 0
    needs_reply_suggestion_count = 0
    pending_approval_count = 0
    escalation_count = 0
    ready_to_send_count = 0
    stale_count = 0

    for conversation in conversations:
        if source_channel and not matches_source_channel(conversation.source, source_channel):
            continue

        latest_message = get_latest_message(conversation)
        latest_extraction = get_latest_extraction(conversation)
        latest_suggestion = get_latest_reply_suggestion(conversation)
        latest_sent_message = get_latest_sent_message(conversation)

        item = build_chat_review_item(
            conversation=conversation,
            latest_message=latest_message,
            latest_extraction=latest_extraction,
            latest_suggestion=latest_suggestion,
            latest_sent_message=latest_sent_message,
            now=now,
        )

        if item is None:
            continue

        if review_bucket and item.review_bucket != review_bucket:
            continue
        if risk_level and item.risk_level != risk_level:
            continue
        if age_bucket and item.age_bucket != age_bucket:
            continue

        if item.review_bucket == "needs_analysis":
            needs_analysis_count += 1
        elif item.review_bucket == "needs_reply_suggestion":
            needs_reply_suggestion_count += 1
        elif item.review_bucket in {"pending_approval", "draft_review", "needs_rework"}:
            pending_approval_count += 1
        elif item.review_bucket == "human_escalation":
            escalation_count += 1
        elif item.review_bucket == "ready_to_send":
            ready_to_send_count += 1

        if item.age_bucket == "stale":
            stale_count += 1

        items.append(item)

    items.sort(
        key=lambda item: (
            1 if item.review_bucket == "human_escalation" else 0,
            1 if item.risk_level == "high" else 0,
            item.priority_score,
            item.queue_since_at or now,
        ),
        reverse=True,
    )

    return ChatReviewCenterResponse(
        generated_at=now,
        total_items=len(items),
        needs_analysis_count=needs_analysis_count,
        needs_reply_suggestion_count=needs_reply_suggestion_count,
        pending_approval_count=pending_approval_count,
        escalation_count=escalation_count,
        ready_to_send_count=ready_to_send_count,
        stale_count=stale_count,
        items=items,
    )


def sync_ops_notifications(
    db: Session,
    current_user: User,
) -> list[OpsNotification]:
    now = datetime.now(timezone.utc)
    is_sales_notification_owner = is_sales_like(current_user.role)
    worklist = (
        get_sales_worklist(db=db, current_user=current_user)
        if is_sales_notification_owner
        else None
    )
    approval_queue = get_sales_approval_queue(db=db, current_user=current_user)
    kpi_alerts = (
        list_kpi_alert_records(db=db, current_user=current_user).items
        if is_head_like(current_user.role)
        else []
    )

    desired_notifications: list[dict[str, str | None]] = []

    if worklist is not None:
        for item in worklist.items[:20]:
            if item.task_type not in {
                "overdue_follow_up",
                "hot_lead_needs_reply",
                "approved_ready_to_send",
                "needs_analysis",
            }:
                continue

            severity = "medium"
            if item.task_type in {"overdue_follow_up", "hot_lead_needs_reply"}:
                severity = "high"

            target_href = (
                f"/dashboard/sales/conversations/{item.conversation_id}"
                if item.conversation_id
                else f"/dashboard/crm/{item.lead_id}"
            )

            desired_notifications.append(
                {
                    "source_type": "sales_worklist",
                    "source_key": f"worklist:{item.lead_id}:{item.task_id or item.task_type}",
                    "severity": severity,
                    "title": item.task_label,
                    "body": item.reason,
                    "target_href": target_href,
                }
            )

    for item in approval_queue.items[:20]:
        severity = "high" if item.risk_level == "high" or item.action_mode == "escalate_to_human" else "medium"
        desired_notifications.append(
            {
                "source_type": "approval_queue",
                "source_key": f"approval:{item.reply_suggestion_id}",
                "severity": severity,
                "title": f"Approval queue: {item.lead_name}",
                "body": item.recommended_action,
                "target_href": f"/dashboard/sales/conversations/{item.conversation_id}",
            }
        )

    if is_sales_notification_owner and current_user.organization_id is not None:
        lead_statement = (
            select(Lead)
            .where(Lead.organization_id == current_user.organization_id)
            .options(selectinload(Lead.deal))
            .order_by(desc(Lead.updated_at), desc(Lead.created_at))
        )
        lead_statement = apply_sales_user_scope_filter(
            lead_statement,
            db=db,
            current_user=current_user,
            sales_user_id_column=Lead.assigned_user_id,
        )
        leads_needing_sync = [
            lead
            for lead in db.scalars(lead_statement).all()
            if lead_requires_deal_metrics_sync(lead)
        ]
        for lead in leads_needing_sync[:20]:
            current_deal_status = lead.deal.status if lead.deal is not None else None
            desired_notifications.append(
                {
                    "source_type": "deal_metrics_sync",
                    "source_key": f"deal-sync:{lead.id}:{lead.current_stage}",
                    "severity": "high",
                    "title": f"Deal metrics perlu diupdate: {lead.display_name}",
                    "body": (
                        f"Pipeline stage lead ini sudah {lead.current_stage.upper()} "
                        f"tetapi deal status masih "
                        f"{(current_deal_status or 'belum diisi').upper()}. "
                        "Buka detail lead dan simpan Deal Metrics agar KPI tetap akurat."
                    ),
                    "target_href": f"/dashboard/crm/{lead.id}",
                }
            )

    for alert in kpi_alerts[:20]:
        if alert.status == "resolved":
            continue
        desired_notifications.append(
            {
                "source_type": "kpi_alert",
                "source_key": f"kpi:{alert.id}",
                "severity": alert.severity,
                "title": alert.title,
                "body": alert.description,
                "target_href": alert.target_href,
            }
        )

    statement = select(OpsNotification).where(
        OpsNotification.organization_id == current_user.organization_id
    )
    if not is_superadmin_like(current_user.role):
        statement = statement.where(OpsNotification.user_id == current_user.id)

    existing_notifications = list(db.scalars(statement).all())
    existing_by_key = {
        (notification.source_type, notification.source_key): notification
        for notification in existing_notifications
    }
    desired_keys = {
        (str(item["source_type"]), str(item["source_key"]))
        for item in desired_notifications
    }

    for notification in existing_notifications:
        key = (notification.source_type, notification.source_key)
        if key not in desired_keys and notification.status != "resolved":
            notification.status = "resolved"
            notification.resolved_at = now
            db.add(notification)

    for item in desired_notifications:
        key = (str(item["source_type"]), str(item["source_key"]))
        notification = existing_by_key.get(key)
        if notification is None:
            notification = OpsNotification(
                organization_id=current_user.organization_id,
                user_id=None if is_superadmin_like(current_user.role) else current_user.id,
                source_type=str(item["source_type"]),
                source_key=str(item["source_key"]),
                workflow_scope=_resolve_notification_workflow_scope(str(item["source_type"])),
                owner_role=_resolve_notification_owner_role(str(item["source_type"])),
                target_role=_resolve_notification_target_role(str(item["source_type"])),
                severity=str(item["severity"]),
                title=str(item["title"]),
                body=str(item["body"]),
                target_href=str(item["target_href"]) if item["target_href"] else None,
                status="active",
                delivery_channel="in_app",
                delivery_status="delivered",
                delivered_at=now,
                escalation_level="none",
            )
        else:
            notification.workflow_scope = _resolve_notification_workflow_scope(
                str(item["source_type"])
            )
            notification.owner_role = _resolve_notification_owner_role(
                str(item["source_type"])
            )
            notification.target_role = _resolve_notification_target_role(
                str(item["source_type"])
            )
            notification.severity = str(item["severity"])
            notification.title = str(item["title"])
            notification.body = str(item["body"])
            notification.target_href = (
                str(item["target_href"]) if item["target_href"] else None
            )
            if notification.status == "resolved":
                notification.status = "active"
                notification.resolved_at = None
                notification.resolution_note = None
            if notification.delivery_status == "pending":
                notification.delivery_status = "delivered"
                notification.delivered_at = now

        if notification.severity == "high":
            age_bucket = get_age_bucket(notification.created_at, now)
            if age_bucket == "aging":
                notification.escalation_level = "team_lead"
                notification.escalated_at = notification.escalated_at or now
            elif age_bucket == "stale":
                notification.escalation_level = "superadmin"
                notification.escalated_at = notification.escalated_at or now

        db.add(notification)

    db.commit()

    refreshed_statement = (
        select(OpsNotification)
        .where(OpsNotification.organization_id == current_user.organization_id)
        .order_by(
            desc(OpsNotification.updated_at),
            desc(OpsNotification.created_at),
        )
    )
    if not is_superadmin_like(current_user.role):
        refreshed_statement = refreshed_statement.where(
            OpsNotification.user_id == current_user.id
        )

    return list(db.scalars(refreshed_statement).all())


def list_ops_notifications(
    db: Session,
    current_user: User,
) -> OpsNotificationResponse:
    notifications = sync_ops_notifications(db=db, current_user=current_user)
    lead_ids = {
        lead_id
        for notification in notifications
        for lead_id in [_extract_notification_lead_id(notification)]
        if lead_id is not None
    }
    lead_lookup: dict[UUID, Lead] = {}
    if lead_ids:
        lead_statement = (
            select(Lead)
            .where(Lead.id.in_(lead_ids))
            .options(selectinload(Lead.assigned_user))
        )
        lead_lookup = {
            lead.id: lead
            for lead in db.scalars(lead_statement).all()
        }

    return OpsNotificationResponse(
        generated_at=datetime.now(timezone.utc),
        active_count=sum(1 for item in notifications if item.status == "active"),
        acknowledged_count=sum(
            1 for item in notifications if item.status == "acknowledged"
        ),
        resolved_count=sum(1 for item in notifications if item.status == "resolved"),
        escalated_count=sum(1 for item in notifications if item.escalation_level != "none"),
        items=[build_ops_notification_item(item, lead_lookup) for item in notifications],
    )


def acknowledge_ops_notification(
    db: Session,
    notification_id: UUID,
    current_user: User,
) -> OpsNotificationItem:
    notification = db.get(OpsNotification, notification_id)
    if notification is None:
        raise ValueError("Notification not found.")

    if (
        notification.organization_id != current_user.organization_id
        or (
            notification.user_id is not None
            and notification.user_id != current_user.id
            and not is_superadmin_like(current_user.role)
        )
    ):
        raise ValueError("Notification not found.")

    notification.status = "acknowledged"
    notification.acknowledged_by_user_id = current_user.id
    notification.acknowledged_at = datetime.now(timezone.utc)
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return build_ops_notification_item(notification)


def resolve_ops_notification(
    db: Session,
    notification_id: UUID,
    payload: OpsNotificationResolveRequest | None,
    current_user: User,
) -> OpsNotificationItem:
    notification = db.get(OpsNotification, notification_id)
    if notification is None:
        raise ValueError("Notification not found.")

    if (
        notification.organization_id != current_user.organization_id
        or (
            notification.user_id is not None
            and notification.user_id != current_user.id
            and not is_superadmin_like(current_user.role)
        )
    ):
        raise ValueError("Notification not found.")

    notification.status = "resolved"
    notification.resolved_at = datetime.now(timezone.utc)
    notification.resolution_note = payload.resolution_note.strip() if payload and payload.resolution_note and payload.resolution_note.strip() else None
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return build_ops_notification_item(notification)


def reopen_ops_notification(
    db: Session,
    notification_id: UUID,
    current_user: User,
) -> OpsNotificationItem:
    notification = db.get(OpsNotification, notification_id)
    if notification is None:
        raise ValueError("Notification not found.")

    if (
        notification.organization_id != current_user.organization_id
        or (
            notification.user_id is not None
            and notification.user_id != current_user.id
            and not is_superadmin_like(current_user.role)
        )
    ):
        raise ValueError("Notification not found.")

    notification.status = "active"
    notification.resolved_at = None
    notification.resolution_note = None
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return build_ops_notification_item(notification)


def escalate_ops_notification(
    db: Session,
    notification_id: UUID,
    current_user: User,
) -> OpsNotificationItem:
    notification = db.get(OpsNotification, notification_id)
    if notification is None:
        raise ValueError("Notification not found.")

    if not is_head_like(current_user.role):
        raise ValueError("Notification not found.")
    if (
        notification.organization_id != current_user.organization_id
        and not is_superadmin_like(current_user.role)
    ):
        raise ValueError("Notification not found.")

    if notification.escalation_level == "none":
        notification.escalation_level = "team_lead"
    elif notification.escalation_level == "team_lead":
        notification.escalation_level = "superadmin"
    notification.escalated_at = datetime.now(timezone.utc)
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return build_ops_notification_item(notification)


def get_marketing_insights_preview(
    db: Session,
    current_user: User,
) -> MarketingInsightsPreview:
    can_view_global = is_superadmin_like(current_user.role)
    organization_ids: set[UUID] | None = None

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
            execution_items=[],
            execution_summary=MarketingExecutionSummary(
                total_items=0,
                done_items=0,
                published_items=0,
                leads_generated=0,
                qualified_leads=0,
                won_leads=0,
                attributed_pipeline_value=0,
                attributed_won_value=0,
                attributed_deposit_amount=0,
            ),
            kpi_summary=MarketingKpiSummary(
                reply_sent_rate=0,
                analysis_coverage_rate=0,
                approved_reply_rate=0,
                high_risk_conversation_count=0,
            ),
            generated_at=datetime.now(timezone.utc),
        )

    if can_view_global:
        organization_ids = {
            organization_id
            for organization_id in db.scalars(select(Organization.id)).all()
            if organization_id is not None
        }

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
    execution_item_models = get_marketing_execution_item_models(
        db=db,
        organization_id=None if can_view_global else current_user.organization_id,
        organization_ids=organization_ids if can_view_global else None,
    )
    execution_items = [
        build_marketing_execution_item(item)
        for item in execution_item_models
    ]

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
        execution_items=execution_items,
        execution_summary=build_marketing_execution_summary(execution_item_models),
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


VALID_MARKETING_EXECUTION_ITEM_TYPES = {"content_brief", "ads_signal"}
VALID_MARKETING_EXECUTION_STATUS = {"draft", "assigned", "in_progress", "done"}
VALID_MARKETING_EXECUTION_PRIORITY = {"low", "medium", "high"}


def get_marketing_execution_item_models(
    db: Session,
    *,
    organization_id: UUID | None,
    organization_ids: set[UUID] | None = None,
) -> list[MarketingExecutionItemModel]:
    if organization_id is None and not organization_ids:
        return []

    statement = select(MarketingExecutionItemModel).options(
        selectinload(MarketingExecutionItemModel.created_by_user),
        selectinload(MarketingExecutionItemModel.assigned_user),
    )
    if organization_ids:
        statement = statement.where(
            MarketingExecutionItemModel.organization_id.in_(organization_ids)
        )
    else:
        statement = statement.where(
            MarketingExecutionItemModel.organization_id == organization_id
        )
    statement = statement.order_by(
        MarketingExecutionItemModel.status.asc(),
        desc(MarketingExecutionItemModel.updated_at),
    )
    return list(db.scalars(statement).all())


def build_marketing_execution_item(
    item: MarketingExecutionItemModel,
) -> MarketingExecutionItem:
    return MarketingExecutionItem(
        id=item.id,
        organization_id=item.organization_id,
        created_by_user_id=item.created_by_user_id,
        created_by_user_name=item.created_by_user.name if item.created_by_user else None,
        assigned_user_id=item.assigned_user_id,
        assigned_user_name=item.assigned_user.name if item.assigned_user else None,
        item_type=item.item_type,
        source_kind=item.source_kind,
        status=item.status,
        priority=item.priority,
        title=item.title,
        summary=item.summary,
        recommended_action=item.recommended_action,
        campaign_name=item.campaign_name,
        notes=item.notes,
        result_notes=item.result_notes,
        published_at=item.published_at,
        leads_generated=item.leads_generated,
        qualified_leads=item.qualified_leads,
        won_leads=item.won_leads,
        attributed_pipeline_value=float(item.attributed_pipeline_value or 0),
        attributed_won_value=float(item.attributed_won_value or 0),
        attributed_deposit_amount=float(item.attributed_deposit_amount or 0),
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def build_marketing_execution_summary(
    items: list[MarketingExecutionItemModel],
) -> MarketingExecutionSummary:
    return MarketingExecutionSummary(
        total_items=len(items),
        done_items=sum(1 for item in items if item.status == "done"),
        published_items=sum(1 for item in items if item.published_at is not None),
        leads_generated=sum(item.leads_generated for item in items),
        qualified_leads=sum(item.qualified_leads for item in items),
        won_leads=sum(item.won_leads for item in items),
        attributed_pipeline_value=round(
            sum(float(item.attributed_pipeline_value or 0) for item in items),
            2,
        ),
        attributed_won_value=round(
            sum(float(item.attributed_won_value or 0) for item in items),
            2,
        ),
        attributed_deposit_amount=round(
            sum(float(item.attributed_deposit_amount or 0) for item in items),
            2,
        ),
    )


def validate_marketing_execution_assignee(
    db: Session,
    *,
    organization_id: UUID | None,
    assigned_user_id: UUID | None,
) -> User | None:
    if assigned_user_id is None:
        return None

    assignee = db.get(User, assigned_user_id)
    if assignee is None or not assignee.is_active:
        raise ValueError("Assigned user is invalid or inactive.")
    if organization_id is None or assignee.organization_id != organization_id:
        raise ValueError("Assigned user must belong to the same organization.")
    return assignee


def list_marketing_execution_items(
    db: Session,
    *,
    current_user: User,
) -> list[MarketingExecutionItem]:
    items = get_marketing_execution_item_models(
        db=db,
        organization_id=current_user.organization_id,
    )
    return [build_marketing_execution_item(item) for item in items]


def create_marketing_execution_item(
    db: Session,
    *,
    payload: MarketingExecutionItemCreateRequest,
    current_user: User,
) -> MarketingExecutionItem:
    if current_user.organization_id is None:
        raise ValueError("Current user does not belong to an organization.")
    if payload.item_type not in VALID_MARKETING_EXECUTION_ITEM_TYPES:
        raise ValueError("Invalid marketing execution item type.")
    if payload.priority not in VALID_MARKETING_EXECUTION_PRIORITY:
        raise ValueError("Invalid marketing execution priority.")

    assignee = validate_marketing_execution_assignee(
        db=db,
        organization_id=current_user.organization_id,
        assigned_user_id=payload.assigned_user_id,
    )

    item = MarketingExecutionItemModel(
        organization_id=current_user.organization_id,
        created_by_user_id=current_user.id,
        assigned_user_id=assignee.id if assignee else None,
        item_type=payload.item_type,
        source_kind=payload.source_kind,
        status="assigned" if assignee else "draft",
        priority=payload.priority,
        title=payload.title.strip(),
        summary=payload.summary.strip(),
        recommended_action=payload.recommended_action.strip(),
        campaign_name=payload.campaign_name.strip() if payload.campaign_name else None,
        notes=payload.notes.strip() if payload.notes else None,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return build_marketing_execution_item(item)


def update_marketing_execution_item(
    db: Session,
    *,
    item_id: UUID,
    payload: MarketingExecutionItemUpdateRequest,
    current_user: User,
) -> MarketingExecutionItem:
    if current_user.organization_id is None:
        raise ValueError("Current user does not belong to an organization.")

    statement = (
        select(MarketingExecutionItemModel)
        .where(
            MarketingExecutionItemModel.id == item_id,
            MarketingExecutionItemModel.organization_id == current_user.organization_id,
        )
        .options(
            selectinload(MarketingExecutionItemModel.created_by_user),
            selectinload(MarketingExecutionItemModel.assigned_user),
        )
    )
    item = db.scalars(statement).first()
    if item is None:
        raise ValueError("Marketing execution item not found.")

    if payload.status is not None:
        if payload.status not in VALID_MARKETING_EXECUTION_STATUS:
            raise ValueError("Invalid marketing execution status.")
        item.status = payload.status

    if "assigned_user_id" in payload.model_fields_set:
        assignee = validate_marketing_execution_assignee(
            db=db,
            organization_id=current_user.organization_id,
            assigned_user_id=payload.assigned_user_id,
        )
        item.assigned_user_id = assignee.id if assignee else None
        if item.assigned_user_id is None and item.status == "assigned":
            item.status = "draft"
        elif item.assigned_user_id is not None and item.status == "draft":
            item.status = "assigned"

    if "campaign_name" in payload.model_fields_set:
        item.campaign_name = payload.campaign_name.strip() if payload.campaign_name else None

    if payload.notes is not None:
        item.notes = payload.notes.strip() or None
    if payload.result_notes is not None:
        item.result_notes = payload.result_notes.strip() or None
    if "published_at" in payload.model_fields_set:
        item.published_at = payload.published_at

    numeric_fields = {
        "leads_generated": payload.leads_generated,
        "qualified_leads": payload.qualified_leads,
        "won_leads": payload.won_leads,
        "attributed_pipeline_value": payload.attributed_pipeline_value,
        "attributed_won_value": payload.attributed_won_value,
        "attributed_deposit_amount": payload.attributed_deposit_amount,
    }
    for field_name, value in numeric_fields.items():
        if value is None:
            continue
        if value < 0:
            raise ValueError(f"{field_name} must be zero or positive.")
        setattr(item, field_name, value)

    db.add(item)
    db.commit()
    db.refresh(item)
    return build_marketing_execution_item(item)


def get_ops_database_overview(
    db: Session,
    current_user: User,
) -> OpsDatabaseOverviewResponse:
    can_view_global = is_superadmin_like(current_user.role)
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
    marketing_execution_summary: MarketingExecutionSummary,
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

    if summary.won_value > 0 or summary.deposit_amount > 0:
        observations.append(
            f"Nilai deal yang sudah dimenangkan saat ini {summary.won_value:,.0f} IDR dengan deposit tercatat {summary.deposit_amount:,.0f} IDR."
        )

    if marketing_execution_summary.attributed_won_value > 0:
        observations.append(
            f"Execution marketing yang sudah ditandai menghasilkan won value {marketing_execution_summary.attributed_won_value:,.0f} IDR dari {marketing_execution_summary.won_leads} lead won."
        )

    if top_sales_rows:
        best_sales = top_sales_rows[0]
        observations.append(
            f"Sales paling produktif saat ini adalah {best_sales.user_name} dengan {best_sales.replies_sent} reply terkirim, {best_sales.closing_leads} lead di stage closing, dan won value {best_sales.won_value:,.0f} IDR."
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

    if summary.pipeline_value > 0 and summary.win_rate < 0.35:
        alerts.append(
            KpiAlertItem(
                severity="medium",
                title="Pipeline value belum terkonversi dengan sehat",
                description=(
                    f"Pipeline terbuka bernilai {summary.pipeline_value:,.0f} IDR, tapi win rate baru {(summary.win_rate * 100):.0f}%."
                ),
                recommended_action="Review lead yang sudah masuk closing atau negotiation, lalu pastikan follow-up dan handling objection paling dekat ke nilai terbesar berjalan hari ini.",
                target_href="/dashboard/crm",
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
    marketing_execution_summary: MarketingExecutionSummary,
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
                owner_role="head",
                next_step="Pantau AI Worklist setiap pagi dan pastikan overdue item turun sebelum siang.",
                target_href="/dashboard/follow-up",
            )
        )

    if marketing_execution_summary.total_items > 0 and marketing_execution_summary.attributed_won_value == 0:
        recommendations.append(
            ExecutiveRecommendationItem(
                title="Tutup loop hasil marketing ke angka bisnis",
                rationale="Execution item sudah berjalan, tapi belum ada won value yang diatribusikan sehingga owner belum bisa membaca ROI lapangan dengan jelas.",
                owner_role="head",
                next_step="Minta tim marketing mengisi leads generated, qualified leads, dan won value pada execution item yang sudah selesai.",
                target_href="/dashboard/marketing",
            )
        )

    if summary.pipeline_value > 0 and summary.win_rate < 0.4:
        recommendations.append(
            ExecutiveRecommendationItem(
                title="Jaga pipeline value agar tidak bocor di stage akhir",
                rationale="Nilai pipeline yang besar tanpa win rate yang sehat biasanya berarti banyak lead bagus berhenti di objection atau negotiation.",
                owner_role="superadmin",
                next_step="Audit lead dengan expected value tertinggi, cek siapa owner-nya, lalu pastikan follow-up dan CTA closing-nya benar-benar dieksekusi.",
                target_href="/dashboard/crm",
            )
        )

    if any(alert.severity == "high" for alert in alerts):
        recommendations.append(
            ExecutiveRecommendationItem(
                title="Lakukan review pipeline balasan mingguan",
                rationale="High-severity alert menandakan ada bottleneck operasional yang tidak bisa dibiarkan berjalan otomatis terus.",
                owner_role="superadmin",
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
                owner_role="superadmin",
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
                owner_role="head",
                next_step="Buka inbox dan worklist milik sales ini, lalu bantu rapikan prioritas conversation yang paling dekat ke closing.",
                target_href="/dashboard/sales",
            )
        )

    if summary.approved_reply_rate < 0.5:
        recommendations.append(
            ExecutiveRecommendationItem(
                title="Rapikan kualitas draft dan approval flow",
                rationale="Approved reply rate yang rendah berarti tim sering berhenti di draft yang belum cukup percaya diri untuk dikirim.",
                owner_role="head",
                next_step="Audit kualitas suggestion Clara, cek objection yang belum terjawab, dan perkuat product knowledge atau playbook yang relevan.",
                target_href="/dashboard/knowledge",
            )
        )

    return recommendations[:6]


def build_alert_key(
    *,
    scope_type: str,
    organization_id: UUID | None,
    alert: KpiAlertItem,
) -> str:
    scope_part = str(organization_id) if organization_id is not None else "global"
    return f"{scope_type}:{scope_part}:{alert.severity}:{alert.title}"


def build_persisted_alert_item(alert: KpiAlertRecord) -> PersistedKpiAlertRecord:
    return PersistedKpiAlertRecord(
        id=alert.id,
        organization_id=alert.organization_id,
        scope_type=alert.scope_type,
        severity=alert.severity,
        title=alert.title,
        description=alert.description,
        recommended_action=alert.recommended_action,
        target_href=alert.target_href,
        status=alert.status,
        acknowledged_by_user_id=alert.acknowledged_by_user_id,
        resolved_by_user_id=alert.resolved_by_user_id,
        first_detected_at=alert.first_detected_at,
        last_detected_at=alert.last_detected_at,
        acknowledged_at=alert.acknowledged_at,
        resolved_at=alert.resolved_at,
        resolution_note=alert.resolution_note,
        created_at=alert.created_at,
        updated_at=alert.updated_at,
    )


def build_kpi_snapshot_item(snapshot: KpiCommandSnapshot) -> KpiSnapshotItem:
    return KpiSnapshotItem(
        id=snapshot.id,
        organization_id=snapshot.organization_id,
        scope_type=snapshot.scope_type,
        snapshot_type=snapshot.snapshot_type,
        metrics_json=snapshot.metrics_json,
        observations_json=snapshot.observations_json,
        created_at=snapshot.created_at,
    )


def resolve_kpi_scope(current_user: User) -> tuple[bool, str, UUID | None]:
    can_view_global = is_superadmin_like(current_user.role)
    scope_type = "global" if can_view_global else "organization"
    organization_id = None if can_view_global else current_user.organization_id
    return can_view_global, scope_type, organization_id


def get_channel_overview(
    db: Session,
    current_user: User,
) -> ChannelOverviewResponse:
    can_view_global = is_superadmin_like(current_user.role)
    scope_type = "global" if can_view_global else "organization"
    scoped_organization_id = None if can_view_global else current_user.organization_id
    now = datetime.now(timezone.utc)

    conversation_statement = select(Conversation)
    lead_statement = select(Lead)

    if not can_view_global:
        if scoped_organization_id is None:
            return ChannelOverviewResponse(generated_at=now, scope_type=scope_type, items=[])
        conversation_statement = conversation_statement.where(
            Conversation.organization_id == scoped_organization_id
        )
        lead_statement = lead_statement.where(Lead.organization_id == scoped_organization_id)

    conversations = db.scalars(conversation_statement).all()
    leads = db.scalars(lead_statement).all()

    items: list[ChannelOverviewItem] = []
    for definition in list_channel_definitions():
        channel_key = str(definition["key"])
        channel_conversations = [
            conversation
            for conversation in conversations
            if normalize_source_channel(conversation.source) == channel_key
        ]
        channel_leads = [
            lead for lead in leads if normalize_source_channel(lead.source) == channel_key
        ]
        latest_activity_at = max(
            (
                ensure_aware_utc(conversation.last_message_at) or conversation.created_at
                for conversation in channel_conversations
            ),
            default=None,
        )
        items.append(
            ChannelOverviewItem(
                key=channel_key,
                label=str(definition["label"]),
                description=str(definition["description"]),
                supports_file_upload=bool(definition["supports_file_upload"]),
                supports_text_paste=bool(definition["supports_text_paste"]),
                supports_live_sync=bool(definition["supports_live_sync"]),
                supported_sources=list(definition["supported_sources"]),
                conversation_count=len(channel_conversations),
                lead_count=len(channel_leads),
                latest_activity_at=latest_activity_at,
            )
        )

    return ChannelOverviewResponse(
        generated_at=now,
        scope_type=scope_type,
        items=items,
    )


def build_kpi_command_center_data(
    db: Session,
    current_user: User,
    *,
    source_channel: str | None = None,
    account_category: str | None = None,
) -> dict:
    can_view_global, scope_type, scoped_organization_id = resolve_kpi_scope(current_user)
    now = datetime.now(timezone.utc)

    organizations_statement = select(Organization)
    if not can_view_global:
        if scoped_organization_id is None:
            return {
                "scope_type": scope_type,
                "generated_at": now,
                "summary": KpiSummaryCard(
                    total_organizations=0,
                    total_sales_users=0,
                    total_leads=0,
                    hot_leads=0,
                    closing_leads=0,
                    analyzed_conversations=0,
                    reply_sent_rate=0,
                    approved_reply_rate=0,
                    overdue_follow_ups=0,
                    pipeline_value=0,
                    won_value=0,
                    deposit_amount=0,
                    win_rate=0,
                ),
                "key_observations": [],
                "alerts": [],
                "recommendations": [],
                "sales_performance": [],
                "organization_performance": [],
                "source_performance": [],
                "marketing_execution_summary": MarketingExecutionSummary(
                    total_items=0,
                    done_items=0,
                    published_items=0,
                    leads_generated=0,
                    qualified_leads=0,
                    won_leads=0,
                    attributed_pipeline_value=0,
                    attributed_won_value=0,
                    attributed_deposit_amount=0,
                ),
                "organization_id": scoped_organization_id,
            }
        organizations_statement = organizations_statement.where(
            Organization.id == scoped_organization_id
        )

    organizations = list(db.scalars(organizations_statement).all())
    organization_ids = {organization.id for organization in organizations}

    users_statement = select(User).where(
        User.role == "sales",
        User.is_active.is_(True),
    )
    if not can_view_global:
        users_statement = users_statement.where(
            User.organization_id == scoped_organization_id
        )
    users = list(db.scalars(users_statement).all())

    leads_statement = select(Lead).options(
        selectinload(Lead.conversations).selectinload(Conversation.ai_extractions),
        selectinload(Lead.conversations).selectinload(Conversation.reply_suggestions),
        selectinload(Lead.conversations).selectinload(Conversation.sent_messages),
        selectinload(Lead.deal).selectinload(LeadDeal.owner_user),
    )
    if not can_view_global:
        leads_statement = leads_statement.where(
            Lead.organization_id == scoped_organization_id
        )
    elif organization_ids:
        leads_statement = leads_statement.where(Lead.organization_id.in_(organization_ids))
    leads = [
        lead
        for lead in db.scalars(leads_statement).all()
        if matches_source_channel(lead.source, source_channel)
        and matches_account_category(lead.account_category, account_category)
    ]
    allowed_lead_ids = {lead.id for lead in leads}

    conversations_statement = select(Conversation)
    if not can_view_global:
        conversations_statement = conversations_statement.where(
            Conversation.organization_id == scoped_organization_id
        )
    elif organization_ids:
        conversations_statement = conversations_statement.where(
            Conversation.organization_id.in_(organization_ids)
        )
    conversations = [
        conversation
        for conversation in db.scalars(conversations_statement).all()
        if matches_source_channel(conversation.source, source_channel)
        and (conversation.lead_id is None or conversation.lead_id in allowed_lead_ids)
    ]

    total_conversations = len(conversations)
    analyzed_conversations = 0
    approved_reply_count = 0
    total_reply_suggestions = 0
    reply_sent_count = 0

    sales_rows: list[SalesPerformanceRow] = []
    organization_rows: list[OrganizationPerformanceRow] = []

    organization_name_by_id = {organization.id: organization.name for organization in organizations}

    for user in users:
        assigned_leads = [lead for lead in leads if lead.assigned_user_id == user.id]
        assigned_deals = [lead.deal for lead in assigned_leads if lead.deal is not None]
        owned_conversations = [
            conversation for conversation in conversations if conversation.sales_user_id == user.id
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
                won_leads=sum(1 for deal in assigned_deals if deal.status == "won"),
                pipeline_value=round(
                    sum(float(deal.expected_value) for deal in assigned_deals if deal.status == "open"),
                    2,
                ),
                won_value=round(
                    sum(float(deal.expected_value) for deal in assigned_deals if deal.status == "won"),
                    2,
                ),
                deposit_amount=round(
                    sum(float(deal.deposit_amount) for deal in assigned_deals),
                    2,
                ),
            )
        )

    for organization in organizations:
        org_leads = [lead for lead in leads if lead.organization_id == organization.id]
        org_deals = [lead.deal for lead in org_leads if lead.deal is not None]
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
                won_leads=sum(1 for deal in org_deals if deal.status == "won"),
                pipeline_value=round(
                    sum(float(deal.expected_value) for deal in org_deals if deal.status == "open"),
                    2,
                ),
                won_value=round(
                    sum(float(deal.expected_value) for deal in org_deals if deal.status == "won"),
                    2,
                ),
                deposit_amount=round(
                    sum(float(deal.deposit_amount) for deal in org_deals),
                    2,
                ),
            )
        )

    sales_rows.sort(
        key=lambda row: (
            row.won_value,
            row.deposit_amount,
            row.replies_sent,
            row.closing_leads,
            row.hot_leads,
            row.assigned_leads,
        ),
        reverse=True,
    )
    organization_rows.sort(
        key=lambda row: (
            row.won_value,
            row.deposit_amount,
            row.hot_leads,
            row.closing_leads,
            row.reply_sent_rate,
            row.total_leads,
        ),
        reverse=True,
    )

    source_keys = {
        normalize_source_key(lead.source) for lead in leads
    } | {
        normalize_source_key(conversation.source) for conversation in conversations
    }
    marketing_execution_statement = select(MarketingExecutionItemModel)
    if not can_view_global:
        marketing_execution_statement = marketing_execution_statement.where(
            MarketingExecutionItemModel.organization_id == scoped_organization_id
        )
    elif organization_ids:
        marketing_execution_statement = marketing_execution_statement.where(
            MarketingExecutionItemModel.organization_id.in_(organization_ids)
        )
    marketing_execution_items = list(db.scalars(marketing_execution_statement).all())
    source_rows: list[SourcePerformanceRow] = []
    for source_key in sorted(source_keys):
        source_leads = [
            lead for lead in leads if normalize_source_key(lead.source) == source_key
        ]
        source_conversations = [
            conversation
            for conversation in conversations
            if normalize_source_key(conversation.source) == source_key
        ]
        source_sent_count = sum(
            1
            for conversation in source_conversations
            if get_latest_sent_message(conversation) is not None
        )
        source_analyzed_count = sum(
            1
            for conversation in source_conversations
            if get_latest_extraction(conversation) is not None
        )
        source_rows.append(
            SourcePerformanceRow(
                source_key=source_key,
                source_channel=normalize_source_channel(source_key),
                source_label=build_source_label(source_key),
                lead_count=len(source_leads),
                conversation_count=len(source_conversations),
                analyzed_conversations=source_analyzed_count,
                hot_leads=sum(1 for lead in source_leads if lead.lead_temperature == "hot"),
                reply_sent_rate=safe_ratio(source_sent_count, len(source_conversations)),
                pipeline_value=round(
                    sum(
                        float(lead.deal.expected_value)
                        for lead in source_leads
                        if lead.deal is not None and lead.deal.status == "open"
                    ),
                    2,
                ),
                won_value=round(
                    sum(
                        float(lead.deal.expected_value)
                        for lead in source_leads
                        if lead.deal is not None and lead.deal.status == "won"
                    ),
                    2,
                ),
            )
        )

    source_rows.sort(
        key=lambda row: (
            row.won_value,
            row.pipeline_value,
            row.conversation_count,
            row.lead_count,
        ),
        reverse=True,
    )
    marketing_execution_summary = build_marketing_execution_summary(
        marketing_execution_items
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
        pipeline_value=round(
            sum(
                float(lead.deal.expected_value)
                for lead in leads
                if lead.deal is not None and lead.deal.status == "open"
            ),
            2,
        ),
        won_value=round(
            sum(
                float(lead.deal.expected_value)
                for lead in leads
                if lead.deal is not None and lead.deal.status == "won"
            ),
            2,
        ),
        deposit_amount=round(
            sum(float(lead.deal.deposit_amount) for lead in leads if lead.deal is not None),
            2,
        ),
        win_rate=safe_ratio(
            sum(1 for lead in leads if lead.deal is not None and lead.deal.status == "won"),
            sum(
                1
                for lead in leads
                if lead.deal is not None and lead.deal.status in {"won", "lost"}
            ),
        ),
    )

    alerts = build_kpi_alerts(
        summary=summary,
        sales_rows=sales_rows,
        organization_rows=organization_rows,
    )
    observations = build_kpi_observations(
        summary=summary,
        marketing_execution_summary=marketing_execution_summary,
        top_sales_rows=sales_rows[:3],
        top_org_rows=organization_rows[:3],
    )
    recommendations = build_executive_recommendations(
        summary=summary,
        marketing_execution_summary=marketing_execution_summary,
        alerts=alerts,
        sales_rows=sales_rows,
        organization_rows=organization_rows,
    )

    return {
        "scope_type": scope_type,
        "generated_at": now,
        "summary": summary,
        "key_observations": observations,
        "alerts": alerts,
        "recommendations": recommendations,
        "sales_performance": sales_rows,
        "organization_performance": organization_rows,
        "source_performance": source_rows,
        "marketing_execution_summary": marketing_execution_summary,
        "organization_id": scoped_organization_id,
    }


def sync_persistent_kpi_alerts(
    db: Session,
    *,
    scope_type: str,
    organization_id: UUID | None,
    alerts: list[KpiAlertItem],
) -> list[PersistedKpiAlertRecord]:
    statement = select(KpiAlertRecord).where(
        KpiAlertRecord.scope_type == scope_type,
        KpiAlertRecord.organization_id == organization_id,
    )
    existing_records = list(db.scalars(statement).all())
    existing_by_key = {record.alert_key: record for record in existing_records}
    current_keys: set[str] = set()
    now = datetime.now(timezone.utc)

    for alert in alerts:
        alert_key = build_alert_key(
            scope_type=scope_type,
            organization_id=organization_id,
            alert=alert,
        )
        current_keys.add(alert_key)
        existing = existing_by_key.get(alert_key)

        if existing is None:
            existing = KpiAlertRecord(
                organization_id=organization_id,
                scope_type=scope_type,
                alert_key=alert_key,
                severity=alert.severity,
                title=alert.title,
                description=alert.description,
                recommended_action=alert.recommended_action,
                target_href=alert.target_href,
                status="active",
                first_detected_at=now,
                last_detected_at=now,
            )
        else:
            existing.severity = alert.severity
            existing.title = alert.title
            existing.description = alert.description
            existing.recommended_action = alert.recommended_action
            existing.target_href = alert.target_href
            existing.last_detected_at = now
            existing.resolved_at = None
            existing.resolved_by_user_id = None
            existing.resolution_note = None
            if existing.status == "resolved":
                existing.status = "active"

        db.add(existing)

    for existing in existing_records:
        if existing.alert_key not in current_keys and existing.status in {"active", "acknowledged"}:
            existing.status = "resolved"
            existing.resolved_at = now
            db.add(existing)

    db.commit()

    refreshed_statement = (
        select(KpiAlertRecord)
        .where(
            KpiAlertRecord.scope_type == scope_type,
            KpiAlertRecord.organization_id == organization_id,
        )
        .order_by(desc(KpiAlertRecord.last_detected_at), desc(KpiAlertRecord.created_at))
    )
    return [
        build_persisted_alert_item(item)
        for item in db.scalars(refreshed_statement).all()
    ]


def create_kpi_snapshot(
    db: Session,
    *,
    scope_type: str,
    organization_id: UUID | None,
    summary: KpiSummaryCard,
    observations: list[str],
) -> KpiSnapshotItem:
    snapshot = KpiCommandSnapshot(
        organization_id=organization_id,
        scope_type=scope_type,
        snapshot_type="manual_refresh",
        metrics_json=summary.model_dump(),
        observations_json=observations,
    )
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)
    return build_kpi_snapshot_item(snapshot)


def list_kpi_snapshots(
    db: Session,
    current_user: User,
) -> KpiSnapshotHistoryResponse:
    _, scope_type, scoped_organization_id = resolve_kpi_scope(current_user)
    statement = select(KpiCommandSnapshot).where(
        KpiCommandSnapshot.scope_type == scope_type,
        KpiCommandSnapshot.organization_id == scoped_organization_id,
    ).order_by(desc(KpiCommandSnapshot.created_at))
    items = [build_kpi_snapshot_item(item) for item in db.scalars(statement).all()]
    return KpiSnapshotHistoryResponse(
        generated_at=datetime.now(timezone.utc),
        items=items,
    )


def list_kpi_alert_records(
    db: Session,
    current_user: User,
) -> KpiAlertHistoryResponse:
    _, scope_type, scoped_organization_id = resolve_kpi_scope(current_user)
    statement = select(KpiAlertRecord).where(
        KpiAlertRecord.scope_type == scope_type,
        KpiAlertRecord.organization_id == scoped_organization_id,
    ).order_by(desc(KpiAlertRecord.last_detected_at), desc(KpiAlertRecord.created_at))
    items = [build_persisted_alert_item(item) for item in db.scalars(statement).all()]
    return KpiAlertHistoryResponse(
        generated_at=datetime.now(timezone.utc),
        active_count=sum(1 for item in items if item.status == "active"),
        acknowledged_count=sum(1 for item in items if item.status == "acknowledged"),
        resolved_count=sum(1 for item in items if item.status == "resolved"),
        items=items,
    )


def acknowledge_kpi_alert(
    db: Session,
    *,
    alert_id: UUID,
    current_user: User,
) -> PersistedKpiAlertRecord:
    _, scope_type, scoped_organization_id = resolve_kpi_scope(current_user)
    alert = db.get(KpiAlertRecord, alert_id)
    if alert is None:
        raise ValueError("Alert not found.")

    if alert.scope_type != scope_type or alert.organization_id != scoped_organization_id:
        raise ValueError("Alert not found.")

    alert.status = "acknowledged"
    alert.acknowledged_by_user_id = current_user.id
    alert.acknowledged_at = datetime.now(timezone.utc)
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return build_persisted_alert_item(alert)


def resolve_kpi_alert(
    db: Session,
    *,
    alert_id: UUID,
    payload: KpiAlertResolveRequest | None,
    current_user: User,
) -> PersistedKpiAlertRecord:
    _, scope_type, scoped_organization_id = resolve_kpi_scope(current_user)
    alert = db.get(KpiAlertRecord, alert_id)
    if alert is None:
        raise ValueError("Alert not found.")

    if alert.scope_type != scope_type or alert.organization_id != scoped_organization_id:
        raise ValueError("Alert not found.")

    alert.status = "resolved"
    alert.resolved_by_user_id = current_user.id
    alert.resolved_at = datetime.now(timezone.utc)
    resolution_note = payload.resolution_note if payload is not None else None
    alert.resolution_note = resolution_note.strip() if resolution_note else None
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return build_persisted_alert_item(alert)


def reopen_kpi_alert(
    db: Session,
    *,
    alert_id: UUID,
    current_user: User,
) -> PersistedKpiAlertRecord:
    _, scope_type, scoped_organization_id = resolve_kpi_scope(current_user)
    alert = db.get(KpiAlertRecord, alert_id)
    if alert is None:
        raise ValueError("Alert not found.")

    if alert.scope_type != scope_type or alert.organization_id != scoped_organization_id:
        raise ValueError("Alert not found.")

    alert.status = "active"
    alert.resolved_by_user_id = None
    alert.resolved_at = None
    alert.resolution_note = None
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return build_persisted_alert_item(alert)


def refresh_kpi_command_center(
    db: Session,
    current_user: User,
    *,
    source_channel: str | None = None,
    account_category: str | None = None,
) -> KpiCommandCenterResponse:
    data = build_kpi_command_center_data(
        db=db,
        current_user=current_user,
        source_channel=source_channel,
        account_category=account_category,
    )
    persisted_alerts = sync_persistent_kpi_alerts(
        db=db,
        scope_type=data["scope_type"],
        organization_id=data["organization_id"],
        alerts=data["alerts"],
    )
    create_kpi_snapshot(
        db=db,
        scope_type=data["scope_type"],
        organization_id=data["organization_id"],
        summary=data["summary"],
        observations=data["key_observations"],
    )

    return KpiCommandCenterResponse(
        scope_type=data["scope_type"],
        generated_at=data["generated_at"],
        summary=data["summary"],
        key_observations=data["key_observations"],
        alerts=data["alerts"],
        persisted_alerts=persisted_alerts[:8],
        recommendations=data["recommendations"],
        sales_performance=data["sales_performance"],
        organization_performance=data["organization_performance"],
        source_performance=data["source_performance"],
        marketing_execution_summary=data["marketing_execution_summary"],
    )


def get_kpi_command_center(
    db: Session,
    current_user: User,
    *,
    source_channel: str | None = None,
    account_category: str | None = None,
) -> KpiCommandCenterResponse:
    data = build_kpi_command_center_data(
        db=db,
        current_user=current_user,
        source_channel=source_channel,
        account_category=account_category,
    )
    persisted_alerts = list_kpi_alert_records(db=db, current_user=current_user).items[:8]

    return KpiCommandCenterResponse(
        scope_type=data["scope_type"],
        generated_at=data["generated_at"],
        summary=data["summary"],
        key_observations=data["key_observations"],
        alerts=data["alerts"],
        persisted_alerts=persisted_alerts,
        recommendations=data["recommendations"],
        sales_performance=data["sales_performance"],
        organization_performance=data["organization_performance"],
        source_performance=data["source_performance"],
        marketing_execution_summary=data["marketing_execution_summary"],
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
