import csv
import io
import json
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from uuid import UUID

from sqlalchemy import desc, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
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
from app.models.performance_action import PerformanceAction
from app.models.sales_performance_snapshot import SalesPerformanceSnapshot
from app.models.product_knowledge import ProductKnowledge
from app.models.reply_suggestion import ReplySuggestion
from app.models.sales_team import SalesTeam
from app.models.sent_message import SentMessage
from app.models.team_performance_snapshot import TeamPerformanceSnapshot
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
    ManagerHistoricalSummary,
    ManagerTeamMemberItem,
    ManagerInsightsResponse,
    ManagerObjectionTrendItem,
    ManagerSalesPerformanceItem,
    ManagerSalesPerformanceSummary,
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
    OperationalScorecard,
    PerformanceActionItem,
    PerformanceActionListResponse,
    WeeklyReviewAlertItem,
    WeeklyReviewEntityItem,
    WeeklyReviewSummaryResponse,
    PerformanceSnapshotGenerationResponse,
    SalesApprovalQueueItem,
    SalesApprovalQueueResponse,
    SalesCoachingSignal,
    SalesPerformanceConversationItem,
    SalesPerformanceDetailResponse,
    SalesPerformanceDetailSummary,
    SalesPerformanceHistoryResponse,
    SalesPerformanceTrend,
    SalesPerformanceDetailUser,
    SalesPerformanceFollowUpItem,
    SalesPerformanceLeadItem,
    TeamPerformanceItem,
    TeamPerformanceHistoryResponse,
    TeamPerformanceSummary,
    TeamTopContributorItem,
    TopCoachingTargetItem,
    SalesPerformanceRow,
    SalesConversationDetail,
    SalesInboxItem,
    PersistedKpiAlertRecord,
    SourcePerformanceRow,
    SalesWorklistItem,
    SalesWorklistResponse,
    WeeklyPerformanceSnapshotItem,
    HistoricalPerformanceSummary,
)
from app.services.access_control_service import (
    apply_sales_user_scope_filter,
    can_access_conversation_in_scope,
    get_accessible_team_ids,
    get_accessible_sales_user_ids,
)
from app.services.chat_review_service import build_chat_review_case_item
from app.services.business_segmentation_service import matches_account_category
from app.services.conversation_lifecycle_service import is_conversation_auto_archived
from app.services.knowledge_update_queue_service import (
    build_knowledge_update_proposal_item,
)
from app.services.performance_action_service import list_performance_actions
from app.services.source_intelligence_service import (
    build_source_label,
    list_channel_definitions,
    matches_source_channel,
    normalize_source_channel,
    normalize_source_key,
)
from app.services.role_service import (
    is_head_like,
    is_manager_like,
    is_sales_like,
    is_superadmin_like,
    normalize_role,
)


GLOBAL_EXTENSION_BUILD_KEY = "global"


def _read_extension_distribution_manifest() -> dict[str, dict[str, object]]:
    manifest_path = Path(settings.extension_distribution_dir).resolve() / "manifest.json"
    if not manifest_path.exists():
        return {}

    try:
        payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}

    if not isinstance(payload, dict):
        return {}

    return {
        str(key): value
        for key, value in payload.items()
        if isinstance(key, str) and isinstance(value, dict)
    }


def dedupe_timeline_messages(messages: list[Message]) -> list[Message]:
    sorted_messages = sorted(
        messages,
        key=lambda message: (
            message.message_timestamp or datetime.min.replace(tzinfo=timezone.utc),
            str(message.id),
        ),
    )

    deduped_messages: list[Message] = []

    for message in sorted_messages:
        if not deduped_messages:
            deduped_messages.append(message)
            continue

        previous = deduped_messages[-1]
        previous_text = (previous.message_text or "").strip()
        current_text = (message.message_text or "").strip()
        previous_timestamp = previous.message_timestamp
        current_timestamp = message.message_timestamp

        is_synthetic_sales_duplicate = (
            previous.sender_type == "sales"
            and message.sender_type == "sales"
            and previous_text
            and previous_text == current_text
            and previous_timestamp is not None
            and current_timestamp is not None
            and abs((current_timestamp - previous_timestamp).total_seconds()) <= 600
            and (
                previous.external_message_id is None
                or message.external_message_id is None
            )
        )

        if not is_synthetic_sales_duplicate:
            deduped_messages.append(message)
            continue

        deduped_messages[-1] = (
            message
            if message.external_message_id and not previous.external_message_id
            else previous
        )

    return deduped_messages


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
    sales_user_lookup: dict[UUID, User] | None = None,
    team_lookup: dict[UUID, SalesTeam] | None = None,
) -> OpsNotificationItem:
    now = datetime.now(timezone.utc)
    lead_id = _extract_notification_lead_id(notification)
    lead = lead_lookup.get(lead_id) if lead_lookup and lead_id else None
    sales_user = (
        sales_user_lookup.get(notification.sales_user_id)
        if sales_user_lookup and notification.sales_user_id is not None
        else None
    )
    team = (
        team_lookup.get(notification.team_id)
        if team_lookup and notification.team_id is not None
        else None
    )
    return OpsNotificationItem(
        id=notification.id,
        organization_id=notification.organization_id,
        user_id=notification.user_id,
        team_id=notification.team_id,
        team_name=team.name if team is not None else None,
        sales_user_id=notification.sales_user_id,
        source_type=notification.source_type,
        source_key=notification.source_key,
        source_reference_id=notification.source_reference_id,
        alert_type=notification.alert_type,
        workflow_scope=notification.workflow_scope,
        owner_role=notification.owner_role,
        target_role=notification.target_role,
        lead_id=lead_id,
        lead_name=lead.display_name if lead is not None else None,
        sales_owner_name=(
            lead.assigned_user.name
            if lead is not None and lead.assigned_user
            else sales_user.name if sales_user is not None else None
        ),
        severity=notification.severity,
        title=notification.title,
        body=notification.body,
        target_href=notification.target_href,
        status=notification.status,
        delivery_channel=notification.delivery_channel,
        delivery_status=notification.delivery_status,
        escalation_level=notification.escalation_level,
        resolution_note=notification.resolution_note,
        metadata_json=notification.metadata_json,
        age_bucket=get_age_bucket(notification.created_at, now),
        acknowledged_by_user_id=notification.acknowledged_by_user_id,
        acknowledged_at=notification.acknowledged_at,
        resolved_by_user_id=notification.resolved_by_user_id,
        delivered_at=notification.delivered_at,
        escalated_at=notification.escalated_at,
        resolved_at=notification.resolved_at,
        ignored_by_user_id=notification.ignored_by_user_id,
        ignored_at=notification.ignored_at,
        triggered_at=notification.triggered_at,
        created_at=notification.created_at,
        updated_at=notification.updated_at,
    )


OPERATIONAL_ALERT_SOURCE_TYPE = "operational_alert"
VALID_OPERATIONAL_ALERT_TRANSITIONS = {
    "active": {"acknowledged", "resolved", "ignored"},
    "acknowledged": {"resolved", "ignored"},
}


def _is_open_notification_status(status: str) -> bool:
    return status in {"active", "acknowledged"}


def _is_operational_alert(notification: OpsNotification) -> bool:
    return notification.source_type == OPERATIONAL_ALERT_SOURCE_TYPE


def _build_operational_alert_seed(
    *,
    current_user: User,
    alert_type: str,
    source_reference_id: UUID | None,
    sales_user_id: UUID | None,
    team_id: UUID | None,
    severity: str,
    title: str,
    body: str,
    target_href: str | None,
    metadata_json: dict[str, object] | None = None,
) -> dict[str, object]:
    scope_suffix = (
        f"team:{team_id}"
        if team_id is not None and is_head_like(current_user.role)
        else f"sales:{sales_user_id}"
        if sales_user_id is not None
        else f"user:{current_user.id}"
    )
    return {
        "organization_id": current_user.organization_id,
        "user_id": None if is_head_like(current_user.role) else current_user.id,
        "team_id": team_id,
        "sales_user_id": sales_user_id,
        "source_type": OPERATIONAL_ALERT_SOURCE_TYPE,
        "source_key": f"ops-alert:{alert_type}:{scope_suffix}",
        "source_reference_id": source_reference_id,
        "alert_type": alert_type,
        "workflow_scope": "head_follow_up" if is_head_like(current_user.role) else "manager_follow_up",
        "owner_role": "manager" if is_head_like(current_user.role) else "sales",
        "target_role": "head" if is_head_like(current_user.role) else "manager",
        "severity": severity,
        "title": title,
        "body": body,
        "target_href": target_href,
        "metadata_json": metadata_json or {},
    }


def _build_sales_operational_alert_seeds(
    *,
    current_user: User,
    sales_items: list[ManagerSalesPerformanceItem],
    sales_user_team_map: dict[UUID, UUID | None],
) -> list[dict[str, object]]:
    alerts: list[dict[str, object]] = []
    if is_head_like(current_user.role):
        return alerts

    for item in sales_items:
        history = item.history_summary
        team_id = sales_user_team_map.get(item.sales_user_id)
        detail_href = f"/dashboard/manager-insights/sales/{item.sales_user_id}?range=7d"

        if item.needs_reply_count >= 2 and (
            (history and history.delta_needs_reply >= 1)
            or item.avg_response_sla_status in {"warning", "critical"}
        ):
            alerts.append(
                _build_operational_alert_seed(
                    current_user=current_user,
                    alert_type="reply_backlog_spike",
                    source_reference_id=item.sales_user_id,
                    sales_user_id=item.sales_user_id,
                    team_id=team_id,
                    severity="high" if item.needs_reply_count >= 4 else "medium",
                    title=f"Reply backlog naik: {item.sales_name}",
                    body=(
                        f"{item.sales_name} punya {item.needs_reply_count} chat yang perlu dibalas. "
                        "Prioritaskan inbox yang belum tersentuh dulu sebelum backlog makin panjang."
                    ),
                    target_href=detail_href,
                    metadata_json={
                        "needs_reply_count": item.needs_reply_count,
                        "delta_needs_reply": history.delta_needs_reply if history else 0,
                    },
                )
            )

        if item.overdue_follow_up_count >= 1 and (
            (history and history.delta_overdue_follow_up >= 1)
            or item.overdue_follow_up_count >= 2
        ):
            alerts.append(
                _build_operational_alert_seed(
                    current_user=current_user,
                    alert_type="overdue_follow_up_spike",
                    source_reference_id=item.sales_user_id,
                    sales_user_id=item.sales_user_id,
                    team_id=team_id,
                    severity="high" if item.overdue_follow_up_count >= 2 else "medium",
                    title=f"Follow-up overdue naik: {item.sales_name}",
                    body=(
                        f"Ada {item.overdue_follow_up_count} follow-up overdue pada {item.sales_name}. "
                        "Kalau dibiarkan, hot lead bisa cepat dingin."
                    ),
                    target_href=detail_href,
                    metadata_json={
                        "overdue_follow_up_count": item.overdue_follow_up_count,
                        "delta_overdue_follow_up": history.delta_overdue_follow_up if history else 0,
                    },
                )
            )

        if item.crm_discipline_status == "needs_attention" and item.scorecard.crm_hygiene_score <= 55:
            alerts.append(
                _build_operational_alert_seed(
                    current_user=current_user,
                    alert_type="crm_discipline_drop",
                    source_reference_id=item.sales_user_id,
                    sales_user_id=item.sales_user_id,
                    team_id=team_id,
                    severity="warning",
                    title=f"Disiplin CRM turun: {item.sales_name}",
                    body=(
                        "Log kerja dan kerapian follow-up mulai longgar. "
                        "Manager perlu cek apakah update CRM dan ritme follow-up masih jalan."
                    ),
                    target_href=detail_href,
                    metadata_json={
                        "crm_hygiene_score": item.scorecard.crm_hygiene_score,
                        "crm_discipline_status": item.crm_discipline_status,
                    },
                )
            )

        if (
            item.hot_leads_count >= 1
            and item.won_deals_count == 0
            and (item.needs_reply_count > 0 or item.overdue_follow_up_count > 0)
        ):
            alerts.append(
                _build_operational_alert_seed(
                    current_user=current_user,
                    alert_type="hot_lead_stagnation",
                    source_reference_id=item.sales_user_id,
                    sales_user_id=item.sales_user_id,
                    team_id=team_id,
                    severity="high" if item.hot_leads_count >= 2 else "warning",
                    title=f"Hot lead tertahan: {item.sales_name}",
                    body=(
                        f"{item.sales_name} masih pegang {item.hot_leads_count} hot lead, "
                        "tetapi pipeline belum bergerak dan respons belum rapi."
                    ),
                    target_href=detail_href,
                    metadata_json={
                        "hot_leads_count": item.hot_leads_count,
                        "won_deals_count": item.won_deals_count,
                    },
                )
            )

    return alerts


def _build_team_operational_alert_seeds(
    *,
    current_user: User,
    team_items: list[TeamPerformanceItem],
) -> list[dict[str, object]]:
    alerts: list[dict[str, object]] = []
    if not is_head_like(current_user.role):
        return alerts

    for item in team_items:
        history = item.history_summary
        target_href = "/dashboard/manager-insights"

        if item.needs_reply_count >= 4 and (
            (history and history.delta_needs_reply >= 2)
            or item.avg_response_sla_status in {"warning", "critical"}
        ):
            alerts.append(
                _build_operational_alert_seed(
                    current_user=current_user,
                    alert_type="reply_backlog_spike",
                    source_reference_id=item.team_id,
                    sales_user_id=None,
                    team_id=item.team_id,
                    severity="high",
                    title=f"Reply backlog naik di {item.team_name}",
                    body=(
                        f"Team {item.team_name} sekarang punya {item.needs_reply_count} chat yang perlu dibalas. "
                        "Head perlu cek apakah ini bottleneck kapasitas atau eksekusi."
                    ),
                    target_href=target_href,
                    metadata_json={
                        "team_name": item.team_name,
                        "needs_reply_count": item.needs_reply_count,
                        "delta_needs_reply": history.delta_needs_reply if history else 0,
                    },
                )
            )

        if item.overdue_follow_up_count >= 2 and (
            (history and history.delta_overdue_follow_up >= 1)
            or item.overdue_follow_up_count >= 3
        ):
            alerts.append(
                _build_operational_alert_seed(
                    current_user=current_user,
                    alert_type="overdue_follow_up_spike",
                    source_reference_id=item.team_id,
                    sales_user_id=None,
                    team_id=item.team_id,
                    severity="critical" if item.overdue_follow_up_count >= 4 else "high",
                    title=f"Follow-up overdue menumpuk di {item.team_name}",
                    body=(
                        f"Ada {item.overdue_follow_up_count} follow-up overdue di team {item.team_name}. "
                        "Risiko kebocoran pipeline mulai besar."
                    ),
                    target_href=target_href,
                    metadata_json={
                        "team_name": item.team_name,
                        "overdue_follow_up_count": item.overdue_follow_up_count,
                        "delta_overdue_follow_up": history.delta_overdue_follow_up if history else 0,
                    },
                )
            )

        if item.crm_discipline_status == "needs_attention" and item.scorecard.crm_hygiene_score <= 55:
            alerts.append(
                _build_operational_alert_seed(
                    current_user=current_user,
                    alert_type="crm_discipline_drop",
                    source_reference_id=item.team_id,
                    sales_user_id=None,
                    team_id=item.team_id,
                    severity="warning",
                    title=f"Disiplin CRM turun di {item.team_name}",
                    body=(
                        "Kerapian CRM tim mulai turun dan perlu intervensi manager sebelum data pipeline makin bias."
                    ),
                    target_href=target_href,
                    metadata_json={
                        "team_name": item.team_name,
                        "crm_hygiene_score": item.scorecard.crm_hygiene_score,
                    },
                )
            )

        if (
            item.hot_leads_count >= 2
            and item.won_deals_count == 0
            and (item.needs_reply_count > 0 or item.overdue_follow_up_count > 0)
        ):
            alerts.append(
                _build_operational_alert_seed(
                    current_user=current_user,
                    alert_type="hot_lead_stagnation",
                    source_reference_id=item.team_id,
                    sales_user_id=None,
                    team_id=item.team_id,
                    severity="high",
                    title=f"Hot lead tertahan di {item.team_name}",
                    body=(
                        f"Team {item.team_name} masih memegang {item.hot_leads_count} hot lead, "
                        "tetapi belum ada pergerakan closing yang cukup."
                    ),
                    target_href=target_href,
                    metadata_json={
                        "team_name": item.team_name,
                        "hot_leads_count": item.hot_leads_count,
                        "won_deals_count": item.won_deals_count,
                    },
                )
            )

    return alerts


def _build_stale_action_alert_seeds(
    *,
    db: Session,
    current_user: User,
    sales_user_team_map: dict[UUID, UUID | None],
) -> list[dict[str, object]]:
    if current_user.organization_id is None:
        return []

    statement = select(PerformanceAction).where(
        PerformanceAction.organization_id == current_user.organization_id,
        PerformanceAction.status.in_(("open", "in_progress")),
        PerformanceAction.created_at <= datetime.now(timezone.utc) - timedelta(days=3),
    )
    accessible_team_ids = get_accessible_team_ids(db=db, current_user=current_user)
    accessible_sales_user_ids = get_accessible_sales_user_ids(db=db, current_user=current_user)

    if not is_head_like(current_user.role):
        if accessible_team_ids:
            statement = statement.where(PerformanceAction.team_id.in_(accessible_team_ids))
        elif accessible_sales_user_ids is not None:
            statement = statement.where(PerformanceAction.sales_user_id.in_(accessible_sales_user_ids))

    actions = list(db.scalars(statement).all())
    if not actions:
        return []

    alerts: list[dict[str, object]] = []
    grouped_count: dict[UUID, int] = {}

    if is_head_like(current_user.role):
        for action in actions:
            if action.team_id is None:
                continue
            grouped_count[action.team_id] = grouped_count.get(action.team_id, 0) + 1
        team_lookup = {
            team.id: team
            for team in db.scalars(
                select(SalesTeam).where(SalesTeam.id.in_(set(grouped_count.keys())))
            ).all()
        } if grouped_count else {}
        for team_id, count in grouped_count.items():
            team = team_lookup.get(team_id)
            alerts.append(
                _build_operational_alert_seed(
                    current_user=current_user,
                    alert_type="stale_coaching_action",
                    source_reference_id=team_id,
                    sales_user_id=None,
                    team_id=team_id,
                    severity="warning",
                    title=f"Aksi coaching stale di {team.name if team else 'tim'}",
                    body=(
                        f"Ada {count} action item coaching/performance yang belum bergerak lebih dari 3 hari."
                    ),
                    target_href="/dashboard/approvals",
                    metadata_json={"stale_action_count": count},
                )
            )
    else:
        for action in actions:
            if action.sales_user_id is None:
                continue
            grouped_count[action.sales_user_id] = grouped_count.get(action.sales_user_id, 0) + 1
        sales_lookup = {
            user.id: user
            for user in db.scalars(
                select(User).where(User.id.in_(set(grouped_count.keys())))
            ).all()
        } if grouped_count else {}
        for sales_user_id, count in grouped_count.items():
            sales_user = sales_lookup.get(sales_user_id)
            alerts.append(
                _build_operational_alert_seed(
                    current_user=current_user,
                    alert_type="stale_coaching_action",
                    source_reference_id=sales_user_id,
                    sales_user_id=sales_user_id,
                    team_id=sales_user_team_map.get(sales_user_id),
                    severity="warning",
                    title=f"Aksi coaching stale: {sales_user.name if sales_user else 'sales'}",
                    body=(
                        f"Ada {count} action item coaching/performance yang belum bergerak lebih dari 3 hari."
                    ),
                    target_href=f"/dashboard/manager-insights/sales/{sales_user_id}?range=7d",
                    metadata_json={"stale_action_count": count},
                )
            )

    return alerts


def sync_operational_alert_notifications(
    *,
    db: Session,
    current_user: User,
    sales_items: list[ManagerSalesPerformanceItem],
    team_items: list[TeamPerformanceItem],
    sales_user_team_map: dict[UUID, UUID | None],
) -> None:
    if current_user.organization_id is None:
        return
    if not (is_manager_like(current_user.role) or is_head_like(current_user.role)):
        return

    desired_notifications = (
        _build_team_operational_alert_seeds(
            current_user=current_user,
            team_items=team_items,
        )
        if is_head_like(current_user.role)
        else _build_sales_operational_alert_seeds(
            current_user=current_user,
            sales_items=sales_items,
            sales_user_team_map=sales_user_team_map,
        )
    )
    desired_notifications.extend(
        _build_stale_action_alert_seeds(
            db=db,
            current_user=current_user,
            sales_user_team_map=sales_user_team_map,
        )
    )

    existing_statement = select(OpsNotification).where(
        OpsNotification.organization_id == current_user.organization_id,
        OpsNotification.source_type == OPERATIONAL_ALERT_SOURCE_TYPE,
    )
    if is_head_like(current_user.role):
        existing_statement = existing_statement.where(
            OpsNotification.user_id.is_(None)
        )
    else:
        existing_statement = existing_statement.where(
            OpsNotification.user_id == current_user.id
        )

    now = datetime.now(timezone.utc)
    existing_notifications = list(db.scalars(existing_statement).all())
    existing_by_key = {
        notification.source_key: notification
        for notification in existing_notifications
    }
    desired_keys = {str(item["source_key"]) for item in desired_notifications}

    for notification in existing_notifications:
        if notification.source_key in desired_keys:
            continue
        if notification.status == "ignored":
            notification.status = "resolved"
            notification.ignored_at = notification.ignored_at or now
            notification.resolved_at = now
            notification.resolved_by_user_id = current_user.id
            db.add(notification)
            continue
        if _is_open_notification_status(notification.status):
            notification.status = "resolved"
            notification.resolved_at = now
            notification.resolved_by_user_id = current_user.id
            db.add(notification)

    for item in desired_notifications:
        source_key = str(item["source_key"])
        notification = existing_by_key.get(source_key)
        if notification is None:
            notification = OpsNotification(
                organization_id=current_user.organization_id,
                user_id=item["user_id"],
                team_id=item["team_id"],
                sales_user_id=item["sales_user_id"],
                source_type=OPERATIONAL_ALERT_SOURCE_TYPE,
                source_key=source_key,
                source_reference_id=item["source_reference_id"],
                alert_type=str(item["alert_type"]),
                workflow_scope=str(item["workflow_scope"]),
                owner_role=str(item["owner_role"]),
                target_role=str(item["target_role"]),
                severity=str(item["severity"]),
                title=str(item["title"]),
                body=str(item["body"]),
                target_href=str(item["target_href"]) if item["target_href"] else None,
                status="active",
                delivery_channel="in_app",
                delivery_status="delivered",
                delivered_at=now,
                escalation_level="none",
                metadata_json=item["metadata_json"],
                triggered_at=now,
            )
        else:
            notification.team_id = item["team_id"]
            notification.sales_user_id = item["sales_user_id"]
            notification.source_reference_id = item["source_reference_id"]
            notification.alert_type = str(item["alert_type"])
            notification.workflow_scope = str(item["workflow_scope"])
            notification.owner_role = str(item["owner_role"])
            notification.target_role = str(item["target_role"])
            notification.severity = str(item["severity"])
            notification.title = str(item["title"])
            notification.body = str(item["body"])
            notification.target_href = (
                str(item["target_href"]) if item["target_href"] else None
            )
            notification.metadata_json = item["metadata_json"]
            if notification.status == "resolved":
                notification.status = "active"
                notification.resolved_at = None
                notification.resolved_by_user_id = None
                notification.resolution_note = None
            if notification.status == "ignored":
                continue
            if notification.delivery_status == "pending":
                notification.delivery_status = "delivered"
                notification.delivered_at = now

        db.add(notification)


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

    sorted_messages = dedupe_timeline_messages(conversation.messages)

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
                "reply_context_text": message.reply_context_text,
                "reply_context_sender_name": message.reply_context_sender_name,
                "reply_context_sender_type": message.reply_context_sender_type,
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


def summarize_conversation_operational_state(
    conversations: list[Conversation],
) -> tuple[
    dict[UUID, AIExtraction],
    int,
    int,
    int,
]:
    latest_extraction_by_conversation: dict[UUID, AIExtraction] = {}
    total_reply_suggestions = 0
    approved_reply_count = 0
    reply_sent_count = 0

    for conversation in conversations:
        latest_extraction = get_latest_extraction(conversation)
        latest_suggestion = get_latest_reply_suggestion(conversation)
        latest_sent_message = get_latest_sent_message(conversation)

        if latest_extraction is not None:
            latest_extraction_by_conversation[conversation.id] = latest_extraction
        if latest_suggestion is not None:
            total_reply_suggestions += 1
            if latest_suggestion.approval_status == "approved":
                approved_reply_count += 1
        if latest_sent_message is not None:
            reply_sent_count += 1

    return (
        latest_extraction_by_conversation,
        total_reply_suggestions,
        approved_reply_count,
        reply_sent_count,
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


def _resolve_sales_performance_sla_status(
    *,
    needs_reply_count: int,
    overdue_follow_up_count: int,
    hot_leads_count: int,
    needs_analysis_count: int,
) -> str:
    if overdue_follow_up_count > 0 or (needs_reply_count >= 2 and hot_leads_count > 0):
        return "critical"
    if needs_reply_count > 0 or needs_analysis_count > 0:
        return "warning"
    return "healthy"


def _resolve_sales_performance_discipline_status(
    *,
    stale_log_count: int,
    overdue_follow_up_count: int,
) -> str:
    if stale_log_count > 0 or overdue_follow_up_count > 0:
        return "needs_attention"
    return "disciplined"


def _normalize_sales_performance_range(range_label: str | None) -> tuple[str, int]:
    if range_label in {"14d", "30d"}:
        return range_label, int(range_label[:-1])
    return "7d", 7


def _is_between(
    value: datetime | None,
    *,
    start: datetime,
    end: datetime,
) -> bool:
    normalized_value = ensure_aware_utc(value)
    if normalized_value is None:
        return False
    return start <= normalized_value <= end


def _lead_activity_timestamps(lead: Lead) -> list[datetime]:
    timestamps: list[datetime] = []
    for candidate in [
        ensure_aware_utc(lead.last_contact_at),
        ensure_aware_utc(lead.updated_at),
        ensure_aware_utc(lead.next_follow_up_at),
    ]:
        if candidate is not None:
            timestamps.append(candidate)
    return timestamps


def _conversation_activity_timestamps(
    conversation: Conversation,
    latest_message: Message | None,
    latest_extraction: AIExtraction | None,
    latest_suggestion: ReplySuggestion | None,
) -> list[datetime]:
    timestamps: list[datetime] = []
    for candidate in [
        ensure_aware_utc(conversation.last_message_at),
        ensure_aware_utc(conversation.created_at),
        ensure_aware_utc(latest_message.message_timestamp if latest_message else None),
        ensure_aware_utc(latest_extraction.created_at if latest_extraction else None),
        ensure_aware_utc(latest_suggestion.created_at if latest_suggestion else None),
    ]:
        if candidate is not None:
            timestamps.append(candidate)
    return timestamps


def _resolve_sales_performance_momentum(
    *,
    delta_overdue_follow_up: int,
    delta_needs_reply: int,
    delta_won_deals: int,
    delta_analyzed_conversations: int,
    current_discipline_status: str,
    previous_discipline_status: str,
) -> str:
    if (
        delta_overdue_follow_up > 0
        or delta_needs_reply > 0
        or (
            previous_discipline_status == "disciplined"
            and current_discipline_status == "needs_attention"
        )
    ):
        return "declining"
    if (
        delta_overdue_follow_up < 0
        or delta_needs_reply < 0
        or delta_won_deals > 0
        or (
            delta_analyzed_conversations > 0
            and current_discipline_status == "disciplined"
        )
    ):
        return "improving"
    return "stable"


def _clamp_score(value: int) -> int:
    return max(0, min(value, 100))


def _resolve_score_label(overall_score: int) -> str:
    if overall_score >= 85:
        return "excellent"
    if overall_score >= 65:
        return "stable"
    if overall_score >= 45:
        return "needs_attention"
    return "critical"


def _resolve_score_trend_label(score_delta_vs_previous: int) -> str:
    if score_delta_vs_previous >= 6:
        return "improving"
    if score_delta_vs_previous <= -6:
        return "declining"
    return "stable"


def _build_operational_scorecard(
    *,
    active_leads_count: int,
    needs_reply_count: int,
    overdue_follow_up_count: int,
    hot_leads_count: int,
    analyzed_conversations_count: int,
    needs_analysis_count: int,
    won_deals_count: int,
    open_deals_count: int,
    crm_discipline_status: str,
    avg_response_sla_status: str,
    previous_won_deals_count: int = 0,
    previous_needs_reply_count: int = 0,
    previous_overdue_follow_up_count: int = 0,
    previous_hot_leads_count: int = 0,
    previous_analyzed_conversations_count: int = 0,
    previous_open_deals_count: int = 0,
    previous_crm_discipline_status: str = "disciplined",
) -> OperationalScorecard:
    response_penalty = min(needs_reply_count, 4) * 18
    if avg_response_sla_status == "critical":
        response_penalty += 20
    elif avg_response_sla_status == "warning":
        response_penalty += 10
    response_discipline_score = _clamp_score(100 - response_penalty)

    follow_up_discipline_score = _clamp_score(
        100 - min(overdue_follow_up_count, 3) * 28
    )

    if hot_leads_count <= 0:
        hot_lead_handling_score = 85
    else:
        hot_lead_penalty = min(hot_leads_count, needs_reply_count + overdue_follow_up_count) * 18
        if needs_analysis_count > 0:
            hot_lead_penalty += 10
        hot_lead_handling_score = _clamp_score(100 - hot_lead_penalty)

    pipeline_base = 55
    if active_leads_count > 0 or open_deals_count > 0:
        pipeline_base += 10
    pipeline_base += min(won_deals_count, 2) * 18
    if won_deals_count > previous_won_deals_count:
        pipeline_base += 10
    if overdue_follow_up_count > 0:
        pipeline_base -= min(overdue_follow_up_count, 2) * 10
    if active_leads_count == 0 and open_deals_count == 0 and won_deals_count == 0:
        pipeline_base -= 10
    pipeline_movement_score = _clamp_score(pipeline_base)

    crm_hygiene_score = 92 if crm_discipline_status == "disciplined" else 48
    if crm_discipline_status == "needs_attention" and overdue_follow_up_count >= 2:
        crm_hygiene_score = 35

    current_scores = [
        response_discipline_score,
        follow_up_discipline_score,
        hot_lead_handling_score,
        pipeline_movement_score,
        crm_hygiene_score,
    ]
    overall_score = round(sum(current_scores) / len(current_scores))

    previous_response_penalty = min(previous_needs_reply_count, 4) * 18
    previous_follow_score = _clamp_score(100 - min(previous_overdue_follow_up_count, 3) * 28)
    if previous_hot_leads_count <= 0:
        previous_hot_score = 85
    else:
        previous_hot_score = _clamp_score(
            100
            - min(
                previous_hot_leads_count,
                previous_needs_reply_count + previous_overdue_follow_up_count,
            )
            * 18
        )
    previous_pipeline_base = 55
    if active_leads_count > 0 or previous_open_deals_count > 0:
        previous_pipeline_base += 10
    previous_pipeline_base += min(previous_won_deals_count, 2) * 18
    if previous_overdue_follow_up_count > 0:
        previous_pipeline_base -= min(previous_overdue_follow_up_count, 2) * 10
    if previous_crm_discipline_status == "disciplined":
        previous_crm_score = 92
    else:
        previous_crm_score = 35 if previous_overdue_follow_up_count >= 2 else 48
    previous_overall_score = round(
        (
            _clamp_score(100 - previous_response_penalty)
            + previous_follow_score
            + previous_hot_score
            + _clamp_score(previous_pipeline_base)
            + previous_crm_score
        )
        / 5
    )

    lowest_component_key = min(
        {
            "response": response_discipline_score,
            "follow_up": follow_up_discipline_score,
            "hot_lead": hot_lead_handling_score,
            "pipeline": pipeline_movement_score,
            "crm": crm_hygiene_score,
        }.items(),
        key=lambda item: item[1],
    )[0]

    if lowest_component_key == "response":
        primary_reason = "Score turun karena backlog reply masih menahan ritme respons."
        secondary_reason = (
            "Minggu ini reply backlog lebih berat dari periode sebelumnya."
            if needs_reply_count > previous_needs_reply_count
            else "Belum semua conversation yang siap dibalas diproses dengan cepat."
        )
        recommended_action = "Rapikan conversation yang perlu balas dulu sebelum buka lead baru."
    elif lowest_component_key == "follow_up":
        primary_reason = "Score turun karena follow-up overdue masih menumpuk."
        secondary_reason = (
            "Jumlah overdue naik dibanding minggu sebelumnya."
            if overdue_follow_up_count > previous_overdue_follow_up_count
            else "Jadwal follow-up belum kembali ke jalur aman."
        )
        recommended_action = "Selesaikan follow-up overdue paling lama dan isi next action yang tegas."
    elif lowest_component_key == "hot_lead":
        primary_reason = "Score turun karena hot lead belum tertangani cukup cepat."
        secondary_reason = (
            "Masih ada hot lead yang ikut tertahan oleh backlog atau analysis."
        )
        recommended_action = "Prioritaskan hot lead yang belum dibalas atau belum dianalisis."
    elif lowest_component_key == "crm":
        primary_reason = "Score turun karena disiplin CRM masih longgar."
        secondary_reason = (
            "Log stale atau follow-up kosong bikin kualitas pipeline susah dibaca."
        )
        recommended_action = "Rapikan log CRM dan pastikan setiap lead punya langkah follow-up berikutnya."
    else:
        primary_reason = "Score tertahan karena movement pipeline belum cukup sehat."
        secondary_reason = (
            "Pipeline belum banyak bergerak ke deal menang walau ritme operasional sudah lumayan."
        )
        recommended_action = "Dorong lead aktif yang paling dekat closing dan pastikan next step-nya jelas."

    if overall_score >= 85:
        primary_reason = "Score tinggi karena backlog rendah, follow-up rapi, dan pipeline tetap bergerak."
        secondary_reason = "Kondisi operasional stabil dan mudah dipertahankan bila ritme saat ini dijaga."
        recommended_action = "Pertahankan ritme ini dan monitor hanya pada hot lead yang baru masuk."

    score_delta_vs_previous = overall_score - previous_overall_score

    return OperationalScorecard(
        overall_score=overall_score,
        score_label=_resolve_score_label(overall_score),
        response_discipline_score=response_discipline_score,
        follow_up_discipline_score=follow_up_discipline_score,
        hot_lead_handling_score=hot_lead_handling_score,
        pipeline_movement_score=pipeline_movement_score,
        crm_hygiene_score=crm_hygiene_score,
        primary_reason=primary_reason,
        secondary_reason=secondary_reason,
        recommended_action=recommended_action,
        score_delta_vs_previous=score_delta_vs_previous,
        score_trend_label=_resolve_score_trend_label(score_delta_vs_previous),
    )


def _build_sales_coaching_signal(
    *,
    active_leads_count: int,
    needs_reply_count: int,
    overdue_follow_up_count: int,
    hot_leads_count: int,
    needs_analysis_count: int,
    crm_discipline_status: str,
    trend: SalesPerformanceTrend,
) -> SalesCoachingSignal:
    priority_score = 0

    if overdue_follow_up_count > 0:
        priority_score += 40
    if trend.delta_overdue_follow_up > 0:
        priority_score += 20
    if needs_reply_count > 0:
        priority_score += 25
    if trend.momentum_label == "declining":
        priority_score += 20
    if crm_discipline_status == "needs_attention":
        priority_score += 15
    if hot_leads_count > 0 and overdue_follow_up_count > 0:
        priority_score += 10
    if needs_analysis_count > 0:
        priority_score += 10
    if (
        trend.delta_won_deals > 0
        and overdue_follow_up_count == 0
        and needs_reply_count == 0
    ):
        priority_score = max(priority_score - 15, 0)

    if overdue_follow_up_count > 0:
        return SalesCoachingSignal(
            priority_score=priority_score,
            priority_label=(
                "urgent"
                if priority_score >= 70
                else "high" if priority_score >= 40 else "normal"
            ),
            primary_reason=(
                "Follow-up overdue masih menumpuk"
                if trend.delta_overdue_follow_up <= 0
                else "Follow-up overdue naik dibanding periode sebelumnya"
            ),
            recommended_action=(
                "Cek follow-up overdue dulu, lalu rapikan next action di CRM."
            ),
            focus_area="follow_up",
        )

    if needs_reply_count > 0:
        return SalesCoachingSignal(
            priority_score=priority_score,
            priority_label=(
                "urgent"
                if priority_score >= 70
                else "high" if priority_score >= 40 else "normal"
            ),
            primary_reason="Conversation yang perlu dibalas masih menumpuk.",
            recommended_action=(
                "Buka conversation yang belum dibalas dan prioritaskan hot lead."
            ),
            focus_area="reply_backlog",
        )

    if crm_discipline_status == "needs_attention":
        return SalesCoachingSignal(
            priority_score=priority_score,
            priority_label="high" if priority_score >= 40 else "normal",
            primary_reason="Disiplin CRM mulai longgar dan perlu dirapikan lagi.",
            recommended_action=(
                "Rapikan log yang stale lalu pastikan next follow-up selalu terisi."
            ),
            focus_area="discipline",
        )

    if needs_analysis_count > 0:
        return SalesCoachingSignal(
            priority_score=priority_score,
            priority_label="normal",
            primary_reason="Masih ada chat baru yang belum sempat dibaca ulang AI.",
            recommended_action=(
                "Jalankan analysis pada chat terbaru sebelum backlog jawaban ikut naik."
            ),
            focus_area="analysis",
        )

    if trend.delta_won_deals > 0 or active_leads_count > 0:
        return SalesCoachingSignal(
            priority_score=max(priority_score, 0),
            priority_label="stable" if priority_score < 15 else "normal",
            primary_reason="Pipeline masih bergerak dan belum ada backlog yang menonjol.",
            recommended_action="Sales ini stabil, cukup monitor tanpa intervensi tambahan.",
            focus_area="conversion",
        )

    return SalesCoachingSignal(
        priority_score=max(priority_score, 0),
        priority_label="stable",
        primary_reason="Belum ada sinyal operasional yang cukup kuat untuk diintervensi.",
        recommended_action="Cukup monitor ritmenya, belum perlu intervensi tambahan.",
        focus_area="conversion",
    )


def _collect_sales_performance_metrics(
    *,
    owned_leads: list[Lead],
    owned_conversations: list[Conversation],
    now: datetime,
    start: datetime | None = None,
    end: datetime | None = None,
) -> dict[str, int | str | datetime | None]:
    active_leads_count = 0
    overdue_follow_up_count = 0
    hot_lead_keys: set[str] = set()
    won_deals_count = 0
    lost_deals_count = 0
    open_deals_count = 0
    stale_log_count = 0
    latest_activity_candidates: list[datetime] = []

    for lead in owned_leads:
        lead_timestamps = _lead_activity_timestamps(lead)
        in_range = (
            True
            if start is None or end is None
            else any(_is_between(candidate, start=start, end=end) for candidate in lead_timestamps)
        )
        if not in_range:
            continue

        if not lead_has_closed_outcome(lead):
            active_leads_count += 1
            open_deals_count += 1

        if lead.current_stage == "won" or (
            lead.deal is not None and lead.deal.status == "won"
        ):
            won_deals_count += 1
        elif lead.current_stage == "lost" or (
            lead.deal is not None and lead.deal.status == "lost"
        ):
            lost_deals_count += 1

        if lead.lead_temperature == "hot":
            hot_lead_keys.add(f"lead:{lead.id}")

        next_follow_up_at = ensure_aware_utc(lead.next_follow_up_at)
        if next_follow_up_at is not None and next_follow_up_at <= now:
            overdue_follow_up_count += 1

        latest_log = get_latest_discipline_log_for_lead(lead)
        if latest_log is None:
            stale_log_count += 1
        elif start is None or end is None:
            if latest_log.log_date != now.date():
                stale_log_count += 1
        else:
            latest_log_at = datetime.combine(
                latest_log.log_date,
                datetime.min.time(),
                tzinfo=timezone.utc,
            )
            if not _is_between(latest_log_at, start=start, end=end):
                stale_log_count += 1

        latest_activity_candidates.extend(lead_timestamps)

    needs_reply_count = 0
    analyzed_conversations_count = 0
    needs_analysis_count = 0

    for conversation in owned_conversations:
        latest_message = get_latest_message(conversation)
        latest_extraction = get_latest_extraction(conversation)
        latest_suggestion = get_latest_reply_suggestion(conversation)
        latest_sent_message = get_latest_sent_message(conversation)
        activity_timestamps = _conversation_activity_timestamps(
            conversation,
            latest_message,
            latest_extraction,
            latest_suggestion,
        )
        in_range = (
            True
            if start is None or end is None
            else any(_is_between(candidate, start=start, end=end) for candidate in activity_timestamps)
        )
        if not in_range:
            continue

        current_sent_message = resolve_current_sent_message(
            latest_message,
            latest_sent_message,
        )
        ui_status = determine_ui_status(
            latest_message,
            latest_extraction,
            latest_suggestion,
            current_sent_message,
        )

        if latest_extraction is not None:
            analyzed_conversations_count += 1
            extraction_in_range = (
                start is None
                or end is None
                or _is_between(latest_extraction.created_at, start=start, end=end)
            )
            if extraction_in_range and latest_extraction.lead_temperature == "hot":
                hot_lead_keys.add(
                    f"lead:{conversation.lead_id}"
                    if conversation.lead_id is not None
                    else f"conversation:{conversation.id}"
                )
        if ui_status == "needs_analysis":
            needs_analysis_count += 1
        if ui_status in {"needs_reply_suggestion", "needs_approval", "needs_escalation"}:
            needs_reply_count += 1

        latest_activity_candidates.extend(activity_timestamps)

    crm_discipline_status = _resolve_sales_performance_discipline_status(
        stale_log_count=stale_log_count,
        overdue_follow_up_count=overdue_follow_up_count,
    )

    return {
        "active_leads_count": active_leads_count,
        "needs_reply_count": needs_reply_count,
        "overdue_follow_up_count": overdue_follow_up_count,
        "hot_leads_count": len(hot_lead_keys),
        "analyzed_conversations_count": analyzed_conversations_count,
        "needs_analysis_count": needs_analysis_count,
        "won_deals_count": won_deals_count,
        "lost_deals_count": lost_deals_count,
        "open_deals_count": open_deals_count,
        "latest_activity_at": max(latest_activity_candidates, default=None),
        "avg_response_sla_status": _resolve_sales_performance_sla_status(
            needs_reply_count=needs_reply_count,
            overdue_follow_up_count=overdue_follow_up_count,
            hot_leads_count=len(hot_lead_keys),
            needs_analysis_count=needs_analysis_count,
        ),
        "crm_discipline_status": crm_discipline_status,
        "stale_log_count": stale_log_count,
    }


def _build_sales_performance_summary_item(
    *,
    sales_user: User,
    owned_leads: list[Lead],
    owned_conversations: list[Conversation],
    now: datetime,
    range_label: str = "7d",
) -> ManagerSalesPerformanceItem:
    normalized_range_label, range_days = _normalize_sales_performance_range(range_label)
    current_start = now - timedelta(days=range_days)
    previous_start = now - timedelta(days=range_days * 2)
    previous_end = current_start

    current_metrics = _collect_sales_performance_metrics(
        owned_leads=owned_leads,
        owned_conversations=owned_conversations,
        now=now,
        start=current_start,
        end=now,
    )
    previous_metrics = _collect_sales_performance_metrics(
        owned_leads=owned_leads,
        owned_conversations=owned_conversations,
        now=previous_end,
        start=previous_start,
        end=previous_end,
    )

    current_discipline_status = str(current_metrics["crm_discipline_status"])
    previous_discipline_status = str(previous_metrics["crm_discipline_status"])
    delta_active_leads = int(current_metrics["active_leads_count"]) - int(
        previous_metrics["active_leads_count"]
    )
    delta_needs_reply = int(current_metrics["needs_reply_count"]) - int(
        previous_metrics["needs_reply_count"]
    )
    delta_overdue_follow_up = int(current_metrics["overdue_follow_up_count"]) - int(
        previous_metrics["overdue_follow_up_count"]
    )
    delta_hot_leads = int(current_metrics["hot_leads_count"]) - int(
        previous_metrics["hot_leads_count"]
    )
    delta_analyzed_conversations = int(
        current_metrics["analyzed_conversations_count"]
    ) - int(previous_metrics["analyzed_conversations_count"])
    delta_won_deals = int(current_metrics["won_deals_count"]) - int(
        previous_metrics["won_deals_count"]
    )
    trend = SalesPerformanceTrend(
        range_label=normalized_range_label,
        previous_range_label=f"prev_{normalized_range_label}",
        delta_active_leads=delta_active_leads,
        delta_needs_reply=delta_needs_reply,
        delta_overdue_follow_up=delta_overdue_follow_up,
        delta_hot_leads=delta_hot_leads,
        delta_analyzed_conversations=delta_analyzed_conversations,
        delta_won_deals=delta_won_deals,
        momentum_label=_resolve_sales_performance_momentum(
            delta_overdue_follow_up=delta_overdue_follow_up,
            delta_needs_reply=delta_needs_reply,
            delta_won_deals=delta_won_deals,
            delta_analyzed_conversations=delta_analyzed_conversations,
            current_discipline_status=current_discipline_status,
            previous_discipline_status=previous_discipline_status,
        ),
    )
    coaching_signal = _build_sales_coaching_signal(
        active_leads_count=int(current_metrics["active_leads_count"]),
        needs_reply_count=int(current_metrics["needs_reply_count"]),
        overdue_follow_up_count=int(current_metrics["overdue_follow_up_count"]),
        hot_leads_count=int(current_metrics["hot_leads_count"]),
        needs_analysis_count=int(current_metrics["needs_analysis_count"]),
        crm_discipline_status=current_discipline_status,
        trend=trend,
    )
    scorecard = _build_operational_scorecard(
        active_leads_count=int(current_metrics["active_leads_count"]),
        needs_reply_count=int(current_metrics["needs_reply_count"]),
        overdue_follow_up_count=int(current_metrics["overdue_follow_up_count"]),
        hot_leads_count=int(current_metrics["hot_leads_count"]),
        analyzed_conversations_count=int(
            current_metrics["analyzed_conversations_count"]
        ),
        needs_analysis_count=int(current_metrics["needs_analysis_count"]),
        won_deals_count=int(current_metrics["won_deals_count"]),
        open_deals_count=int(current_metrics["open_deals_count"]),
        crm_discipline_status=current_discipline_status,
        avg_response_sla_status=str(current_metrics["avg_response_sla_status"]),
        previous_won_deals_count=int(previous_metrics["won_deals_count"]),
        previous_needs_reply_count=int(previous_metrics["needs_reply_count"]),
        previous_overdue_follow_up_count=int(
            previous_metrics["overdue_follow_up_count"]
        ),
        previous_hot_leads_count=int(previous_metrics["hot_leads_count"]),
        previous_analyzed_conversations_count=int(
            previous_metrics["analyzed_conversations_count"]
        ),
        previous_open_deals_count=int(previous_metrics["open_deals_count"]),
        previous_crm_discipline_status=previous_discipline_status,
    )

    return ManagerSalesPerformanceItem(
        sales_user_id=sales_user.id,
        sales_name=sales_user.name,
        role=normalize_role(sales_user.role),
        active_leads_count=int(current_metrics["active_leads_count"]),
        needs_reply_count=int(current_metrics["needs_reply_count"]),
        overdue_follow_up_count=int(current_metrics["overdue_follow_up_count"]),
        hot_leads_count=int(current_metrics["hot_leads_count"]),
        analyzed_conversations_count=int(current_metrics["analyzed_conversations_count"]),
        needs_analysis_count=int(current_metrics["needs_analysis_count"]),
        won_deals_count=int(current_metrics["won_deals_count"]),
        lost_deals_count=int(current_metrics["lost_deals_count"]),
        open_deals_count=int(current_metrics["open_deals_count"]),
        latest_activity_at=current_metrics["latest_activity_at"],
        avg_response_sla_status=str(current_metrics["avg_response_sla_status"]),
        crm_discipline_status=current_discipline_status,
        trend=trend,
        scorecard=scorecard,
        coaching_signal=coaching_signal,
    )


def _merge_sales_performance_status(
    values: list[str],
    *,
    critical_value: str,
    warning_value: str,
    healthy_value: str,
) -> str:
    if critical_value in values:
        return critical_value
    if warning_value in values:
        return warning_value
    return healthy_value


def _build_team_performance_item(
    *,
    team: SalesTeam | None,
    sales_items: list[ManagerSalesPerformanceItem],
    normalized_range_label: str,
) -> TeamPerformanceItem:
    total_active_leads = sum(item.active_leads_count for item in sales_items)
    total_needs_reply = sum(item.needs_reply_count for item in sales_items)
    total_overdue_follow_up = sum(item.overdue_follow_up_count for item in sales_items)
    total_hot_leads = sum(item.hot_leads_count for item in sales_items)
    total_needs_analysis = sum(item.needs_analysis_count for item in sales_items)
    total_analyzed = sum(item.analyzed_conversations_count for item in sales_items)
    total_won_deals = sum(item.won_deals_count for item in sales_items)
    latest_activity_at = max(
        (item.latest_activity_at for item in sales_items if item.latest_activity_at is not None),
        default=None,
    )
    avg_response_sla_status = _merge_sales_performance_status(
        [item.avg_response_sla_status for item in sales_items],
        critical_value="critical",
        warning_value="warning",
        healthy_value="healthy",
    )
    crm_discipline_status = _merge_sales_performance_status(
        [item.crm_discipline_status for item in sales_items],
        critical_value="needs_attention",
        warning_value="needs_attention",
        healthy_value="disciplined",
    )
    trend = SalesPerformanceTrend(
        range_label=normalized_range_label,
        previous_range_label=f"prev_{normalized_range_label}",
        delta_active_leads=sum(item.trend.delta_active_leads for item in sales_items),
        delta_needs_reply=sum(item.trend.delta_needs_reply for item in sales_items),
        delta_overdue_follow_up=sum(
            item.trend.delta_overdue_follow_up for item in sales_items
        ),
        delta_hot_leads=sum(item.trend.delta_hot_leads for item in sales_items),
        delta_analyzed_conversations=sum(
            item.trend.delta_analyzed_conversations for item in sales_items
        ),
        delta_won_deals=sum(item.trend.delta_won_deals for item in sales_items),
        momentum_label=_resolve_sales_performance_momentum(
            delta_overdue_follow_up=sum(
                item.trend.delta_overdue_follow_up for item in sales_items
            ),
            delta_needs_reply=sum(item.trend.delta_needs_reply for item in sales_items),
            delta_won_deals=sum(item.trend.delta_won_deals for item in sales_items),
            delta_analyzed_conversations=sum(
                item.trend.delta_analyzed_conversations for item in sales_items
            ),
            current_discipline_status=crm_discipline_status,
            previous_discipline_status=crm_discipline_status,
        ),
    )
    coaching_signal = _build_sales_coaching_signal(
        active_leads_count=total_active_leads,
        needs_reply_count=total_needs_reply,
        overdue_follow_up_count=total_overdue_follow_up,
        hot_leads_count=total_hot_leads,
        needs_analysis_count=total_needs_analysis,
        crm_discipline_status=crm_discipline_status,
        trend=trend,
    )
    scorecard = _build_operational_scorecard(
        active_leads_count=total_active_leads,
        needs_reply_count=total_needs_reply,
        overdue_follow_up_count=total_overdue_follow_up,
        hot_leads_count=total_hot_leads,
        analyzed_conversations_count=total_analyzed,
        needs_analysis_count=total_needs_analysis,
        won_deals_count=total_won_deals,
        open_deals_count=total_active_leads,
        crm_discipline_status=crm_discipline_status,
        avg_response_sla_status=avg_response_sla_status,
        previous_won_deals_count=max(total_won_deals - trend.delta_won_deals, 0),
        previous_needs_reply_count=max(total_needs_reply - trend.delta_needs_reply, 0),
        previous_overdue_follow_up_count=max(
            total_overdue_follow_up - trend.delta_overdue_follow_up,
            0,
        ),
        previous_hot_leads_count=max(total_hot_leads - trend.delta_hot_leads, 0),
        previous_analyzed_conversations_count=max(
            total_analyzed - trend.delta_analyzed_conversations,
            0,
        ),
        previous_open_deals_count=max(total_active_leads - trend.delta_active_leads, 0),
        previous_crm_discipline_status=crm_discipline_status,
    )
    top_sales_contributors = [
        TeamTopContributorItem(
            sales_user_id=item.sales_user_id,
            sales_name=item.sales_name,
            priority_label=item.coaching_signal.priority_label,
            primary_reason=item.coaching_signal.primary_reason,
        )
        for item in sorted(
            sales_items,
            key=lambda item: (
                item.coaching_signal.priority_score,
                item.overdue_follow_up_count,
                item.needs_reply_count,
                item.hot_leads_count,
                item.latest_activity_at or datetime.min.replace(tzinfo=timezone.utc),
            ),
            reverse=True,
        )[:3]
    ]

    return TeamPerformanceItem(
        team_id=team.id if team else None,
        team_name=team.name if team else "Tanpa team",
        unit_id=team.unit_id if team else None,
        unit_name=team.unit.name if team and team.unit else None,
        manager_user_name=team.manager_user.name if team and team.manager_user else None,
        member_count=len(sales_items),
        active_leads_count=total_active_leads,
        needs_reply_count=total_needs_reply,
        overdue_follow_up_count=total_overdue_follow_up,
        hot_leads_count=total_hot_leads,
        analyzed_conversations_count=total_analyzed,
        needs_analysis_count=total_needs_analysis,
        won_deals_count=total_won_deals,
        latest_activity_at=latest_activity_at,
        avg_response_sla_status=avg_response_sla_status,
        crm_discipline_status=crm_discipline_status,
        trend=trend,
        scorecard=scorecard,
        coaching_signal=coaching_signal,
        top_sales_contributors=top_sales_contributors,
    )


def _normalize_history_weeks(weeks: int | None) -> int:
    if weeks is None:
        return 4
    return max(2, min(weeks, 8))


def _resolve_weekly_snapshot_dates(now: datetime, weeks: int) -> list[date]:
    current_week_start = (now - timedelta(days=now.weekday())).date()
    return [
        current_week_start - timedelta(days=7 * offset)
        for offset in range(weeks - 1, -1, -1)
    ]


def _resolve_week_bounds(
    snapshot_date: date,
    *,
    now: datetime,
) -> tuple[datetime, datetime]:
    start = datetime.combine(snapshot_date, datetime.min.time(), tzinfo=timezone.utc)
    return start, min(start + timedelta(days=7), now)


def _build_empty_historical_summary() -> HistoricalPerformanceSummary:
    return HistoricalPerformanceSummary(
        trend_label="stable",
        delta_needs_reply=0,
        delta_overdue_follow_up=0,
        delta_won_deals=0,
        latest_snapshot_date=None,
        previous_snapshot_date=None,
    )


def _build_historical_summary_from_metrics(
    *,
    latest_metrics: dict[str, int | str] | None,
    previous_metrics: dict[str, int | str] | None,
    latest_snapshot_date: date | None,
    previous_snapshot_date: date | None,
) -> HistoricalPerformanceSummary:
    if latest_metrics is None:
        return _build_empty_historical_summary()

    latest_needs_reply = int(latest_metrics.get("needs_reply_count", 0))
    latest_overdue = int(latest_metrics.get("overdue_follow_up_count", 0))
    latest_won = int(latest_metrics.get("won_deals_count", 0))
    latest_analyzed = int(latest_metrics.get("analyzed_conversations_count", 0))
    latest_discipline = str(
        latest_metrics.get("crm_discipline_status", "disciplined")
    )

    previous_needs_reply = int((previous_metrics or {}).get("needs_reply_count", 0))
    previous_overdue = int((previous_metrics or {}).get("overdue_follow_up_count", 0))
    previous_won = int((previous_metrics or {}).get("won_deals_count", 0))
    previous_analyzed = int(
        (previous_metrics or {}).get("analyzed_conversations_count", 0)
    )
    previous_discipline = str(
        (previous_metrics or {}).get("crm_discipline_status", latest_discipline)
    )

    return HistoricalPerformanceSummary(
        trend_label=_resolve_sales_performance_momentum(
            delta_overdue_follow_up=latest_overdue - previous_overdue,
            delta_needs_reply=latest_needs_reply - previous_needs_reply,
            delta_won_deals=latest_won - previous_won,
            delta_analyzed_conversations=latest_analyzed - previous_analyzed,
            current_discipline_status=latest_discipline,
            previous_discipline_status=previous_discipline,
        ),
        delta_needs_reply=latest_needs_reply - previous_needs_reply,
        delta_overdue_follow_up=latest_overdue - previous_overdue,
        delta_won_deals=latest_won - previous_won,
        latest_snapshot_date=latest_snapshot_date,
        previous_snapshot_date=previous_snapshot_date,
    )


def _sales_snapshot_to_weekly_item(
    snapshot: SalesPerformanceSnapshot,
) -> WeeklyPerformanceSnapshotItem:
    return WeeklyPerformanceSnapshotItem(
        snapshot_date=snapshot.snapshot_date,
        snapshot_granularity=snapshot.snapshot_granularity,
        active_leads_count=snapshot.active_leads_count,
        needs_reply_count=snapshot.needs_reply_count,
        overdue_follow_up_count=snapshot.overdue_follow_up_count,
        hot_leads_count=snapshot.hot_leads_count,
        analyzed_conversations_count=snapshot.analyzed_conversations_count,
        needs_analysis_count=snapshot.needs_analysis_count,
        won_deals_count=snapshot.won_deals_count,
        lost_deals_count=snapshot.lost_deals_count,
        open_deals_count=snapshot.open_deals_count,
        avg_response_sla_status=snapshot.avg_response_sla_status,
        crm_discipline_status=snapshot.crm_discipline_status,
        coaching_priority_score=snapshot.coaching_priority_score,
        coaching_priority_label=snapshot.coaching_priority_label,
    )


def _team_snapshot_to_weekly_item(
    snapshot: TeamPerformanceSnapshot,
) -> WeeklyPerformanceSnapshotItem:
    return WeeklyPerformanceSnapshotItem(
        snapshot_date=snapshot.snapshot_date,
        snapshot_granularity=snapshot.snapshot_granularity,
        member_count=snapshot.member_count,
        active_leads_count=snapshot.active_leads_count,
        needs_reply_count=snapshot.needs_reply_count,
        overdue_follow_up_count=snapshot.overdue_follow_up_count,
        hot_leads_count=snapshot.hot_leads_count,
        analyzed_conversations_count=snapshot.analyzed_conversations_count,
        needs_analysis_count=snapshot.needs_analysis_count,
        won_deals_count=snapshot.won_deals_count,
        avg_response_sla_status=snapshot.avg_response_sla_status,
        crm_discipline_status=snapshot.crm_discipline_status,
        coaching_priority_score=snapshot.coaching_priority_score,
        coaching_priority_label=snapshot.coaching_priority_label,
    )


def _build_scorecard_from_weekly_history(
    weekly_history: list[WeeklyPerformanceSnapshotItem],
) -> OperationalScorecard | None:
    if not weekly_history:
        return None

    latest = weekly_history[-1]
    previous = weekly_history[-2] if len(weekly_history) > 1 else None
    return _build_operational_scorecard(
        active_leads_count=latest.active_leads_count,
        needs_reply_count=latest.needs_reply_count,
        overdue_follow_up_count=latest.overdue_follow_up_count,
        hot_leads_count=latest.hot_leads_count,
        analyzed_conversations_count=latest.analyzed_conversations_count,
        needs_analysis_count=latest.needs_analysis_count,
        won_deals_count=latest.won_deals_count,
        open_deals_count=latest.open_deals_count or latest.active_leads_count,
        crm_discipline_status=latest.crm_discipline_status,
        avg_response_sla_status=latest.avg_response_sla_status,
        previous_won_deals_count=previous.won_deals_count if previous else 0,
        previous_needs_reply_count=previous.needs_reply_count if previous else 0,
        previous_overdue_follow_up_count=previous.overdue_follow_up_count if previous else 0,
        previous_hot_leads_count=previous.hot_leads_count if previous else 0,
        previous_analyzed_conversations_count=(
            previous.analyzed_conversations_count if previous else 0
        ),
        previous_open_deals_count=(
            previous.open_deals_count
            if previous and previous.open_deals_count is not None
            else previous.active_leads_count if previous else 0
        ),
        previous_crm_discipline_status=(
            previous.crm_discipline_status if previous else latest.crm_discipline_status
        ),
    )


def _load_sales_snapshot_history_map(
    db: Session,
    *,
    organization_id: UUID,
    sales_user_ids: set[UUID],
    weeks: int,
) -> dict[UUID, tuple[list[WeeklyPerformanceSnapshotItem], HistoricalPerformanceSummary]]:
    if not sales_user_ids:
        return {}

    snapshot_dates = _resolve_weekly_snapshot_dates(
        datetime.now(timezone.utc),
        _normalize_history_weeks(weeks),
    )
    rows = db.scalars(
        select(SalesPerformanceSnapshot)
        .where(
            SalesPerformanceSnapshot.organization_id == organization_id,
            SalesPerformanceSnapshot.sales_user_id.in_(sales_user_ids),
            SalesPerformanceSnapshot.snapshot_granularity == "weekly",
            SalesPerformanceSnapshot.snapshot_date.in_(snapshot_dates),
        )
        .order_by(
            SalesPerformanceSnapshot.sales_user_id,
            SalesPerformanceSnapshot.snapshot_date,
        )
    ).all()

    grouped_rows: dict[UUID, list[SalesPerformanceSnapshot]] = {}
    for row in rows:
        grouped_rows.setdefault(row.sales_user_id, []).append(row)

    history_map: dict[
        UUID,
        tuple[list[WeeklyPerformanceSnapshotItem], HistoricalPerformanceSummary],
    ] = {}
    for sales_user_id, snapshots in grouped_rows.items():
        weekly_history = [_sales_snapshot_to_weekly_item(snapshot) for snapshot in snapshots]
        latest = snapshots[-1] if snapshots else None
        previous = snapshots[-2] if len(snapshots) > 1 else None
        history_map[sales_user_id] = (
            weekly_history,
            _build_historical_summary_from_metrics(
                latest_metrics=(
                    {
                        "needs_reply_count": latest.needs_reply_count,
                        "overdue_follow_up_count": latest.overdue_follow_up_count,
                        "won_deals_count": latest.won_deals_count,
                        "analyzed_conversations_count": latest.analyzed_conversations_count,
                        "crm_discipline_status": latest.crm_discipline_status,
                    }
                    if latest is not None
                    else None
                ),
                previous_metrics=(
                    {
                        "needs_reply_count": previous.needs_reply_count,
                        "overdue_follow_up_count": previous.overdue_follow_up_count,
                        "won_deals_count": previous.won_deals_count,
                        "analyzed_conversations_count": previous.analyzed_conversations_count,
                        "crm_discipline_status": previous.crm_discipline_status,
                    }
                    if previous is not None
                    else None
                ),
                latest_snapshot_date=latest.snapshot_date if latest is not None else None,
                previous_snapshot_date=(
                    previous.snapshot_date if previous is not None else None
                ),
            ),
        )

    return history_map


def _load_team_snapshot_history_map(
    db: Session,
    *,
    organization_id: UUID,
    team_ids: set[UUID],
    weeks: int,
) -> dict[UUID, tuple[list[WeeklyPerformanceSnapshotItem], HistoricalPerformanceSummary]]:
    if not team_ids:
        return {}

    snapshot_dates = _resolve_weekly_snapshot_dates(
        datetime.now(timezone.utc),
        _normalize_history_weeks(weeks),
    )
    rows = db.scalars(
        select(TeamPerformanceSnapshot)
        .where(
            TeamPerformanceSnapshot.organization_id == organization_id,
            TeamPerformanceSnapshot.team_id.in_(team_ids),
            TeamPerformanceSnapshot.snapshot_granularity == "weekly",
            TeamPerformanceSnapshot.snapshot_date.in_(snapshot_dates),
        )
        .order_by(
            TeamPerformanceSnapshot.team_id,
            TeamPerformanceSnapshot.snapshot_date,
        )
    ).all()

    grouped_rows: dict[UUID, list[TeamPerformanceSnapshot]] = {}
    for row in rows:
        grouped_rows.setdefault(row.team_id, []).append(row)

    history_map: dict[
        UUID,
        tuple[list[WeeklyPerformanceSnapshotItem], HistoricalPerformanceSummary],
    ] = {}
    for team_id, snapshots in grouped_rows.items():
        weekly_history = [_team_snapshot_to_weekly_item(snapshot) for snapshot in snapshots]
        latest = snapshots[-1] if snapshots else None
        previous = snapshots[-2] if len(snapshots) > 1 else None
        history_map[team_id] = (
            weekly_history,
            _build_historical_summary_from_metrics(
                latest_metrics=(
                    {
                        "needs_reply_count": latest.needs_reply_count,
                        "overdue_follow_up_count": latest.overdue_follow_up_count,
                        "won_deals_count": latest.won_deals_count,
                        "analyzed_conversations_count": latest.analyzed_conversations_count,
                        "crm_discipline_status": latest.crm_discipline_status,
                    }
                    if latest is not None
                    else None
                ),
                previous_metrics=(
                    {
                        "needs_reply_count": previous.needs_reply_count,
                        "overdue_follow_up_count": previous.overdue_follow_up_count,
                        "won_deals_count": previous.won_deals_count,
                        "analyzed_conversations_count": previous.analyzed_conversations_count,
                        "crm_discipline_status": previous.crm_discipline_status,
                    }
                    if previous is not None
                    else None
                ),
                latest_snapshot_date=latest.snapshot_date if latest is not None else None,
                previous_snapshot_date=(
                    previous.snapshot_date if previous is not None else None
                ),
            ),
        )

    return history_map


def ensure_weekly_performance_snapshots(
    db: Session,
    *,
    organization_id: UUID,
    sales_user_ids: set[UUID] | None = None,
    team_ids: set[UUID] | None = None,
    weeks: int = 4,
) -> PerformanceSnapshotGenerationResponse:
    now = datetime.now(timezone.utc)
    normalized_weeks = _normalize_history_weeks(weeks)
    snapshot_dates = _resolve_weekly_snapshot_dates(now, normalized_weeks)

    sales_user_statement = (
        select(User)
        .options(selectinload(User.sales_team).selectinload(SalesTeam.unit))
        .where(User.organization_id == organization_id)
    )
    if sales_user_ids is None and team_ids is not None:
        if not team_ids:
            return PerformanceSnapshotGenerationResponse(
                generated_at=now,
                snapshot_granularity="weekly",
                weeks=normalized_weeks,
                snapshot_dates=snapshot_dates,
                sales_snapshot_count=0,
                team_snapshot_count=0,
            )
        sales_user_statement = sales_user_statement.where(User.team_id.in_(team_ids))
    if sales_user_ids is not None:
        if not sales_user_ids:
            return PerformanceSnapshotGenerationResponse(
                generated_at=now,
                snapshot_granularity="weekly",
                weeks=normalized_weeks,
                snapshot_dates=snapshot_dates,
                sales_snapshot_count=0,
                team_snapshot_count=0,
            )
        sales_user_statement = sales_user_statement.where(User.id.in_(sales_user_ids))

    sales_users = [
        user
        for user in db.scalars(sales_user_statement).all()
        if is_sales_like(user.role)
    ]
    if not sales_users:
        return PerformanceSnapshotGenerationResponse(
            generated_at=now,
            snapshot_granularity="weekly",
            weeks=normalized_weeks,
            snapshot_dates=snapshot_dates,
            sales_snapshot_count=0,
            team_snapshot_count=0,
        )

    sales_user_ids = {user.id for user in sales_users}

    lead_statement = (
        select(Lead)
        .where(
            Lead.organization_id == organization_id,
            Lead.assigned_user_id.in_(sales_user_ids),
        )
        .options(
            selectinload(Lead.discipline_logs),
            selectinload(Lead.deal),
        )
    )
    conversation_statement = (
        select(Conversation)
        .where(
            Conversation.organization_id == organization_id,
            Conversation.sales_user_id.in_(sales_user_ids),
        )
        .options(
            selectinload(Conversation.messages),
            selectinload(Conversation.ai_extractions),
            selectinload(Conversation.reply_suggestions),
            selectinload(Conversation.sent_messages),
        )
    )

    lead_user_map: dict[UUID, list[Lead]] = {}
    for lead in db.scalars(lead_statement).all():
        if lead.assigned_user_id is not None:
            lead_user_map.setdefault(lead.assigned_user_id, []).append(lead)

    conversation_user_map: dict[UUID, list[Conversation]] = {}
    for conversation in db.scalars(conversation_statement).all():
        if conversation.sales_user_id is not None:
            conversation_user_map.setdefault(conversation.sales_user_id, []).append(
                conversation
            )

    existing_sales_rows = db.scalars(
        select(SalesPerformanceSnapshot).where(
            SalesPerformanceSnapshot.organization_id == organization_id,
            SalesPerformanceSnapshot.sales_user_id.in_(sales_user_ids),
            SalesPerformanceSnapshot.snapshot_granularity == "weekly",
            SalesPerformanceSnapshot.snapshot_date.in_(snapshot_dates),
        )
    ).all()
    existing_sales_map = {
        (row.sales_user_id, row.snapshot_date): row for row in existing_sales_rows
    }

    sales_metrics_by_snapshot: dict[
        tuple[UUID, date],
        dict[str, object],
    ] = {}
    sales_snapshot_count = 0

    for sales_user in sales_users:
        owned_leads = lead_user_map.get(sales_user.id, [])
        owned_conversations = conversation_user_map.get(sales_user.id, [])
        for snapshot_date in snapshot_dates:
            current_start, current_end = _resolve_week_bounds(snapshot_date, now=now)
            previous_start = current_start - timedelta(days=7)
            previous_end = current_start
            current_metrics = _collect_sales_performance_metrics(
                owned_leads=owned_leads,
                owned_conversations=owned_conversations,
                now=current_end,
                start=current_start,
                end=current_end,
            )
            previous_metrics = _collect_sales_performance_metrics(
                owned_leads=owned_leads,
                owned_conversations=owned_conversations,
                now=previous_end,
                start=previous_start,
                end=previous_end,
            )
            trend = SalesPerformanceTrend(
                range_label="weekly",
                previous_range_label="prev_weekly",
                delta_active_leads=int(current_metrics["active_leads_count"]) - int(
                    previous_metrics["active_leads_count"]
                ),
                delta_needs_reply=int(current_metrics["needs_reply_count"]) - int(
                    previous_metrics["needs_reply_count"]
                ),
                delta_overdue_follow_up=int(
                    current_metrics["overdue_follow_up_count"]
                ) - int(previous_metrics["overdue_follow_up_count"]),
                delta_hot_leads=int(current_metrics["hot_leads_count"]) - int(
                    previous_metrics["hot_leads_count"]
                ),
                delta_analyzed_conversations=int(
                    current_metrics["analyzed_conversations_count"]
                ) - int(previous_metrics["analyzed_conversations_count"]),
                delta_won_deals=int(current_metrics["won_deals_count"]) - int(
                    previous_metrics["won_deals_count"]
                ),
                momentum_label=_resolve_sales_performance_momentum(
                    delta_overdue_follow_up=int(
                        current_metrics["overdue_follow_up_count"]
                    ) - int(previous_metrics["overdue_follow_up_count"]),
                    delta_needs_reply=int(current_metrics["needs_reply_count"]) - int(
                        previous_metrics["needs_reply_count"]
                    ),
                    delta_won_deals=int(current_metrics["won_deals_count"]) - int(
                        previous_metrics["won_deals_count"]
                    ),
                    delta_analyzed_conversations=int(
                        current_metrics["analyzed_conversations_count"]
                    ) - int(previous_metrics["analyzed_conversations_count"]),
                    current_discipline_status=str(
                        current_metrics["crm_discipline_status"]
                    ),
                    previous_discipline_status=str(
                        previous_metrics["crm_discipline_status"]
                    ),
                ),
            )
            coaching_signal = _build_sales_coaching_signal(
                active_leads_count=int(current_metrics["active_leads_count"]),
                needs_reply_count=int(current_metrics["needs_reply_count"]),
                overdue_follow_up_count=int(
                    current_metrics["overdue_follow_up_count"]
                ),
                hot_leads_count=int(current_metrics["hot_leads_count"]),
                needs_analysis_count=int(current_metrics["needs_analysis_count"]),
                crm_discipline_status=str(current_metrics["crm_discipline_status"]),
                trend=trend,
            )

            snapshot = existing_sales_map.get((sales_user.id, snapshot_date))
            if snapshot is None:
                snapshot = SalesPerformanceSnapshot(
                    organization_id=organization_id,
                    sales_user_id=sales_user.id,
                    team_id=sales_user.team_id,
                    unit_id=(
                        sales_user.sales_team.unit_id
                        if sales_user.sales_team is not None
                        else None
                    ),
                    snapshot_date=snapshot_date,
                    snapshot_granularity="weekly",
                )
                db.add(snapshot)

            snapshot.team_id = sales_user.team_id
            snapshot.unit_id = (
                sales_user.sales_team.unit_id if sales_user.sales_team is not None else None
            )
            snapshot.active_leads_count = int(current_metrics["active_leads_count"])
            snapshot.needs_reply_count = int(current_metrics["needs_reply_count"])
            snapshot.overdue_follow_up_count = int(
                current_metrics["overdue_follow_up_count"]
            )
            snapshot.hot_leads_count = int(current_metrics["hot_leads_count"])
            snapshot.analyzed_conversations_count = int(
                current_metrics["analyzed_conversations_count"]
            )
            snapshot.needs_analysis_count = int(current_metrics["needs_analysis_count"])
            snapshot.won_deals_count = int(current_metrics["won_deals_count"])
            snapshot.lost_deals_count = int(current_metrics["lost_deals_count"])
            snapshot.open_deals_count = int(current_metrics["open_deals_count"])
            snapshot.avg_response_sla_status = str(
                current_metrics["avg_response_sla_status"]
            )
            snapshot.crm_discipline_status = str(current_metrics["crm_discipline_status"])
            snapshot.coaching_priority_score = coaching_signal.priority_score
            snapshot.coaching_priority_label = coaching_signal.priority_label
            sales_snapshot_count += 1

            sales_metrics_by_snapshot[(sales_user.id, snapshot_date)] = {
                "sales_user": sales_user,
                "current_metrics": current_metrics,
                "previous_metrics": previous_metrics,
                "coaching_signal": coaching_signal,
            }

    team_ids_in_scope = {
        user.team_id for user in sales_users if user.team_id is not None
    }
    if team_ids is not None:
        team_ids_in_scope &= team_ids

    if not team_ids_in_scope:
        db.commit()
        return PerformanceSnapshotGenerationResponse(
            generated_at=now,
            snapshot_granularity="weekly",
            weeks=normalized_weeks,
            snapshot_dates=snapshot_dates,
            sales_snapshot_count=sales_snapshot_count,
            team_snapshot_count=0,
        )

    team_statement = (
        select(SalesTeam)
        .options(selectinload(SalesTeam.unit), selectinload(SalesTeam.manager_user))
        .where(
            SalesTeam.organization_id == organization_id,
            SalesTeam.id.in_(team_ids_in_scope),
        )
    )
    teams = {team.id: team for team in db.scalars(team_statement).all()}

    existing_team_rows = db.scalars(
        select(TeamPerformanceSnapshot).where(
            TeamPerformanceSnapshot.organization_id == organization_id,
            TeamPerformanceSnapshot.team_id.in_(set(teams)),
            TeamPerformanceSnapshot.snapshot_granularity == "weekly",
            TeamPerformanceSnapshot.snapshot_date.in_(snapshot_dates),
        )
    ).all()
    existing_team_map = {
        (row.team_id, row.snapshot_date): row for row in existing_team_rows
    }

    team_snapshot_count = 0
    for snapshot_date in snapshot_dates:
        for team_id, team in teams.items():
            team_sales_rows = [
                sales_metrics_by_snapshot[(sales_user.id, snapshot_date)]
                for sales_user in sales_users
                if sales_user.team_id == team_id
                and (sales_user.id, snapshot_date) in sales_metrics_by_snapshot
            ]
            if not team_sales_rows:
                continue

            current_statuses = [
                str(row["current_metrics"]["avg_response_sla_status"])
                for row in team_sales_rows
            ]
            current_discipline_statuses = [
                str(row["current_metrics"]["crm_discipline_status"])
                for row in team_sales_rows
            ]
            previous_discipline_statuses = [
                str(row["previous_metrics"]["crm_discipline_status"])
                for row in team_sales_rows
            ]

            current_metrics = {
                "member_count": len(team_sales_rows),
                "active_leads_count": sum(
                    int(row["current_metrics"]["active_leads_count"])
                    for row in team_sales_rows
                ),
                "needs_reply_count": sum(
                    int(row["current_metrics"]["needs_reply_count"])
                    for row in team_sales_rows
                ),
                "overdue_follow_up_count": sum(
                    int(row["current_metrics"]["overdue_follow_up_count"])
                    for row in team_sales_rows
                ),
                "hot_leads_count": sum(
                    int(row["current_metrics"]["hot_leads_count"])
                    for row in team_sales_rows
                ),
                "analyzed_conversations_count": sum(
                    int(row["current_metrics"]["analyzed_conversations_count"])
                    for row in team_sales_rows
                ),
                "needs_analysis_count": sum(
                    int(row["current_metrics"]["needs_analysis_count"])
                    for row in team_sales_rows
                ),
                "won_deals_count": sum(
                    int(row["current_metrics"]["won_deals_count"])
                    for row in team_sales_rows
                ),
                "avg_response_sla_status": _merge_sales_performance_status(
                    current_statuses,
                    critical_value="critical",
                    warning_value="warning",
                    healthy_value="healthy",
                ),
                "crm_discipline_status": _merge_sales_performance_status(
                    current_discipline_statuses,
                    critical_value="needs_attention",
                    warning_value="needs_attention",
                    healthy_value="disciplined",
                ),
            }
            previous_metrics = {
                "needs_reply_count": sum(
                    int(row["previous_metrics"]["needs_reply_count"])
                    for row in team_sales_rows
                ),
                "overdue_follow_up_count": sum(
                    int(row["previous_metrics"]["overdue_follow_up_count"])
                    for row in team_sales_rows
                ),
                "won_deals_count": sum(
                    int(row["previous_metrics"]["won_deals_count"])
                    for row in team_sales_rows
                ),
                "analyzed_conversations_count": sum(
                    int(row["previous_metrics"]["analyzed_conversations_count"])
                    for row in team_sales_rows
                ),
                "crm_discipline_status": _merge_sales_performance_status(
                    previous_discipline_statuses,
                    critical_value="needs_attention",
                    warning_value="needs_attention",
                    healthy_value="disciplined",
                ),
            }
            trend = SalesPerformanceTrend(
                range_label="weekly",
                previous_range_label="prev_weekly",
                delta_active_leads=current_metrics["active_leads_count"]
                - sum(
                    int(row["previous_metrics"]["active_leads_count"])
                    for row in team_sales_rows
                ),
                delta_needs_reply=current_metrics["needs_reply_count"]
                - previous_metrics["needs_reply_count"],
                delta_overdue_follow_up=current_metrics["overdue_follow_up_count"]
                - previous_metrics["overdue_follow_up_count"],
                delta_hot_leads=current_metrics["hot_leads_count"]
                - sum(
                    int(row["previous_metrics"]["hot_leads_count"])
                    for row in team_sales_rows
                ),
                delta_analyzed_conversations=current_metrics[
                    "analyzed_conversations_count"
                ]
                - previous_metrics["analyzed_conversations_count"],
                delta_won_deals=current_metrics["won_deals_count"]
                - previous_metrics["won_deals_count"],
                momentum_label=_resolve_sales_performance_momentum(
                    delta_overdue_follow_up=current_metrics["overdue_follow_up_count"]
                    - previous_metrics["overdue_follow_up_count"],
                    delta_needs_reply=current_metrics["needs_reply_count"]
                    - previous_metrics["needs_reply_count"],
                    delta_won_deals=current_metrics["won_deals_count"]
                    - previous_metrics["won_deals_count"],
                    delta_analyzed_conversations=current_metrics[
                        "analyzed_conversations_count"
                    ]
                    - previous_metrics["analyzed_conversations_count"],
                    current_discipline_status=str(
                        current_metrics["crm_discipline_status"]
                    ),
                    previous_discipline_status=str(
                        previous_metrics["crm_discipline_status"]
                    ),
                ),
            )
            coaching_signal = _build_sales_coaching_signal(
                active_leads_count=current_metrics["active_leads_count"],
                needs_reply_count=current_metrics["needs_reply_count"],
                overdue_follow_up_count=current_metrics["overdue_follow_up_count"],
                hot_leads_count=current_metrics["hot_leads_count"],
                needs_analysis_count=current_metrics["needs_analysis_count"],
                crm_discipline_status=str(current_metrics["crm_discipline_status"]),
                trend=trend,
            )

            snapshot = existing_team_map.get((team_id, snapshot_date))
            if snapshot is None:
                snapshot = TeamPerformanceSnapshot(
                    organization_id=organization_id,
                    team_id=team_id,
                    unit_id=team.unit_id,
                    snapshot_date=snapshot_date,
                    snapshot_granularity="weekly",
                )
                db.add(snapshot)

            snapshot.unit_id = team.unit_id
            snapshot.member_count = current_metrics["member_count"]
            snapshot.active_leads_count = current_metrics["active_leads_count"]
            snapshot.needs_reply_count = current_metrics["needs_reply_count"]
            snapshot.overdue_follow_up_count = current_metrics["overdue_follow_up_count"]
            snapshot.hot_leads_count = current_metrics["hot_leads_count"]
            snapshot.analyzed_conversations_count = current_metrics[
                "analyzed_conversations_count"
            ]
            snapshot.needs_analysis_count = current_metrics["needs_analysis_count"]
            snapshot.won_deals_count = current_metrics["won_deals_count"]
            snapshot.avg_response_sla_status = str(
                current_metrics["avg_response_sla_status"]
            )
            snapshot.crm_discipline_status = str(current_metrics["crm_discipline_status"])
            snapshot.coaching_priority_score = coaching_signal.priority_score
            snapshot.coaching_priority_label = coaching_signal.priority_label
            team_snapshot_count += 1

    db.commit()

    return PerformanceSnapshotGenerationResponse(
        generated_at=now,
        snapshot_granularity="weekly",
        weeks=normalized_weeks,
        snapshot_dates=snapshot_dates,
        sales_snapshot_count=sales_snapshot_count,
        team_snapshot_count=team_snapshot_count,
    )


def _build_manager_historical_summary(
    team_history_map: dict[
        UUID,
        tuple[list[WeeklyPerformanceSnapshotItem], HistoricalPerformanceSummary],
    ],
) -> ManagerHistoricalSummary:
    latest_totals = {
        "needs_reply_count": 0,
        "overdue_follow_up_count": 0,
        "won_deals_count": 0,
        "analyzed_conversations_count": 0,
    }
    previous_totals = {
        "needs_reply_count": 0,
        "overdue_follow_up_count": 0,
        "won_deals_count": 0,
        "analyzed_conversations_count": 0,
    }
    latest_statuses: list[str] = []
    previous_statuses: list[str] = []
    latest_snapshot_date: date | None = None
    previous_snapshot_date: date | None = None

    for weekly_history, _ in team_history_map.values():
        if not weekly_history:
            continue
        latest = weekly_history[-1]
        latest_totals["needs_reply_count"] += latest.needs_reply_count
        latest_totals["overdue_follow_up_count"] += latest.overdue_follow_up_count
        latest_totals["won_deals_count"] += latest.won_deals_count
        latest_totals["analyzed_conversations_count"] += (
            latest.analyzed_conversations_count
        )
        latest_statuses.append(latest.crm_discipline_status)
        latest_snapshot_date = latest.snapshot_date

        if len(weekly_history) > 1:
            previous = weekly_history[-2]
            previous_totals["needs_reply_count"] += previous.needs_reply_count
            previous_totals["overdue_follow_up_count"] += previous.overdue_follow_up_count
            previous_totals["won_deals_count"] += previous.won_deals_count
            previous_totals["analyzed_conversations_count"] += (
                previous.analyzed_conversations_count
            )
            previous_statuses.append(previous.crm_discipline_status)
            previous_snapshot_date = previous.snapshot_date

    summary = _build_historical_summary_from_metrics(
        latest_metrics={
            **latest_totals,
            "crm_discipline_status": _merge_sales_performance_status(
                latest_statuses or ["disciplined"],
                critical_value="needs_attention",
                warning_value="needs_attention",
                healthy_value="disciplined",
            ),
        }
        if latest_snapshot_date is not None
        else None,
        previous_metrics={
            **previous_totals,
            "crm_discipline_status": _merge_sales_performance_status(
                previous_statuses or ["disciplined"],
                critical_value="needs_attention",
                warning_value="needs_attention",
                healthy_value="disciplined",
            ),
        }
        if previous_snapshot_date is not None
        else None,
        latest_snapshot_date=latest_snapshot_date,
        previous_snapshot_date=previous_snapshot_date,
    )

    return ManagerHistoricalSummary(
        trend_label=summary.trend_label,
        delta_total_needs_reply=summary.delta_needs_reply,
        delta_total_overdue_follow_up=summary.delta_overdue_follow_up,
        latest_snapshot_date=summary.latest_snapshot_date,
        previous_snapshot_date=summary.previous_snapshot_date,
    )


def _build_weekly_review_period(now: datetime) -> tuple[date, date]:
    review_end = (now - timedelta(days=now.weekday() + 1)).date()
    review_start = review_end - timedelta(days=6)
    return review_start, review_end


def _list_open_critical_alerts(
    db: Session,
    *,
    current_user: User,
) -> list[OpsNotification]:
    if current_user.organization_id is None:
        return []

    statement = select(OpsNotification).where(
        OpsNotification.organization_id == current_user.organization_id,
        OpsNotification.source_type == OPERATIONAL_ALERT_SOURCE_TYPE,
        OpsNotification.severity == "critical",
        OpsNotification.status.in_(("active", "acknowledged")),
    )
    if is_head_like(current_user.role):
        statement = statement.where(OpsNotification.user_id.is_(None))
    else:
        statement = statement.where(OpsNotification.user_id == current_user.id)
    return list(
        db.scalars(
            statement.order_by(
                desc(OpsNotification.updated_at),
                desc(OpsNotification.created_at),
            )
        ).all()
    )


def _build_weekly_review_entity(
    *,
    scope_type: str,
    label: str,
    team_name: str | None,
    sales_user_id: UUID | None,
    team_id: UUID | None,
    score: int,
    score_label: str,
    trend_label: str,
    score_delta: int,
    backlog_count: int,
    overdue_count: int,
    action_open_count: int,
    critical_alert_count: int,
    summary: str,
    target_href: str | None,
) -> WeeklyReviewEntityItem:
    return WeeklyReviewEntityItem(
        scope_type=scope_type,
        sales_user_id=sales_user_id,
        team_id=team_id,
        label=label,
        team_name=team_name,
        score=score,
        score_label=score_label,
        trend_label=trend_label,
        score_delta=score_delta,
        backlog_count=backlog_count,
        overdue_count=overdue_count,
        action_open_count=action_open_count,
        critical_alert_count=critical_alert_count,
        summary=summary,
        target_href=target_href,
    )


def _build_weekly_review_summary(
    *,
    db: Session,
    current_user: User,
    scope_label: str,
    sales_items: list[ManagerSalesPerformanceItem],
    team_items: list[TeamPerformanceItem],
) -> WeeklyReviewSummaryResponse:
    now = datetime.now(timezone.utc)
    review_start, review_end = _build_weekly_review_period(now)
    action_payload = list_performance_actions(db=db, current_user=current_user)
    unresolved_actions = [
        item
        for item in action_payload.items
        if item.status in {"open", "in_progress"}
    ]
    critical_alert_rows = _list_open_critical_alerts(db=db, current_user=current_user)

    team_lookup = {
        team.id: team
        for team in db.scalars(
            select(SalesTeam).where(
                SalesTeam.id.in_({item.team_id for item in team_items if item.team_id is not None})
            )
        ).all()
    } if team_items else {}
    sales_lookup = {
        user.id: user
        for user in db.scalars(
            select(User).where(
                User.id.in_({item.sales_user_id for item in sales_items if item.sales_user_id is not None})
            )
        ).all()
    } if sales_items else {}

    action_count_by_sales: dict[UUID, int] = {}
    action_count_by_team: dict[UUID, int] = {}
    for item in unresolved_actions:
        if item.sales_user_id is not None:
            action_count_by_sales[item.sales_user_id] = (
                action_count_by_sales.get(item.sales_user_id, 0) + 1
            )
        if item.team_id is not None:
            action_count_by_team[item.team_id] = action_count_by_team.get(item.team_id, 0) + 1

    critical_count_by_sales: dict[UUID, int] = {}
    critical_count_by_team: dict[UUID, int] = {}
    critical_alert_items: list[WeeklyReviewAlertItem] = []
    for alert in critical_alert_rows:
        if alert.sales_user_id is not None:
            critical_count_by_sales[alert.sales_user_id] = (
                critical_count_by_sales.get(alert.sales_user_id, 0) + 1
            )
        if alert.team_id is not None:
            critical_count_by_team[alert.team_id] = critical_count_by_team.get(alert.team_id, 0) + 1
        critical_alert_items.append(
            WeeklyReviewAlertItem(
                notification_id=alert.id,
                alert_type=alert.alert_type,
                title=alert.title,
                description=alert.body,
                severity=alert.severity,
                status=alert.status,
                team_name=team_lookup.get(alert.team_id).name if alert.team_id in team_lookup else None,
                sales_name=sales_lookup.get(alert.sales_user_id).name if alert.sales_user_id in sales_lookup else None,
                target_href=alert.target_href,
                triggered_at=alert.triggered_at,
            )
        )

    if is_head_like(current_user.role):
        ranked_improvers = sorted(
            team_items,
            key=lambda item: (
                item.scorecard.score_delta_vs_previous,
                item.scorecard.overall_score,
                -item.overdue_follow_up_count,
            ),
            reverse=True,
        )
        ranked_risks = sorted(
            team_items,
            key=lambda item: (
                item.scorecard.score_delta_vs_previous,
                -item.coaching_signal.priority_score,
                -item.overdue_follow_up_count,
                -item.needs_reply_count,
            ),
        )
    else:
        ranked_improvers = sorted(
            sales_items,
            key=lambda item: (
                item.scorecard.score_delta_vs_previous,
                item.scorecard.overall_score,
                -item.overdue_follow_up_count,
            ),
            reverse=True,
        )
        ranked_risks = sorted(
            sales_items,
            key=lambda item: (
                item.scorecard.score_delta_vs_previous,
                -item.coaching_signal.priority_score,
                -item.overdue_follow_up_count,
                -item.needs_reply_count,
            ),
        )

    top_improvers = [
        _build_weekly_review_entity(
            scope_type="team" if is_head_like(current_user.role) else "sales",
            label=item.team_name if is_head_like(current_user.role) else item.sales_name,
            team_name=item.team_name if is_head_like(current_user.role) else None,
            sales_user_id=None if is_head_like(current_user.role) else item.sales_user_id,
            team_id=item.team_id if is_head_like(current_user.role) else None,
            score=item.scorecard.overall_score,
            score_label=item.scorecard.score_label,
            trend_label=item.scorecard.score_trend_label,
            score_delta=item.scorecard.score_delta_vs_previous,
            backlog_count=item.needs_reply_count,
            overdue_count=item.overdue_follow_up_count,
            action_open_count=(
                action_count_by_team.get(item.team_id, 0)
                if is_head_like(current_user.role)
                else action_count_by_sales.get(item.sales_user_id, 0)
            ),
            critical_alert_count=(
                critical_count_by_team.get(item.team_id, 0)
                if is_head_like(current_user.role)
                else critical_count_by_sales.get(item.sales_user_id, 0)
            ),
            summary=item.scorecard.primary_reason,
            target_href="/dashboard/manager-insights",
        )
        for item in ranked_improvers[:3]
    ]

    biggest_risks = [
        _build_weekly_review_entity(
            scope_type="team" if is_head_like(current_user.role) else "sales",
            label=item.team_name if is_head_like(current_user.role) else item.sales_name,
            team_name=item.team_name if is_head_like(current_user.role) else None,
            sales_user_id=None if is_head_like(current_user.role) else item.sales_user_id,
            team_id=item.team_id if is_head_like(current_user.role) else None,
            score=item.scorecard.overall_score,
            score_label=item.scorecard.score_label,
            trend_label=item.scorecard.score_trend_label,
            score_delta=item.scorecard.score_delta_vs_previous,
            backlog_count=item.needs_reply_count,
            overdue_count=item.overdue_follow_up_count,
            action_open_count=(
                action_count_by_team.get(item.team_id, 0)
                if is_head_like(current_user.role)
                else action_count_by_sales.get(item.sales_user_id, 0)
            ),
            critical_alert_count=(
                critical_count_by_team.get(item.team_id, 0)
                if is_head_like(current_user.role)
                else critical_count_by_sales.get(item.sales_user_id, 0)
            ),
            summary=item.coaching_signal.primary_reason,
            target_href="/dashboard/manager-insights",
        )
        for item in ranked_risks[:3]
    ]

    ranked_teams_needing_intervention = sorted(
        team_items,
        key=lambda item: (
            item.coaching_signal.priority_score,
            item.overdue_follow_up_count,
            item.needs_reply_count,
            critical_count_by_team.get(item.team_id, 0),
            action_count_by_team.get(item.team_id, 0),
        ),
        reverse=True,
    )
    teams_needing_intervention = [
        _build_weekly_review_entity(
            scope_type="team",
            label=item.team_name,
            team_name=item.team_name,
            sales_user_id=None,
            team_id=item.team_id,
            score=item.scorecard.overall_score,
            score_label=item.scorecard.score_label,
            trend_label=item.scorecard.score_trend_label,
            score_delta=item.scorecard.score_delta_vs_previous,
            backlog_count=item.needs_reply_count,
            overdue_count=item.overdue_follow_up_count,
            action_open_count=action_count_by_team.get(item.team_id, 0),
            critical_alert_count=critical_count_by_team.get(item.team_id, 0),
            summary=item.coaching_signal.recommended_action,
            target_href="/dashboard/manager-insights",
        )
        for item in ranked_teams_needing_intervention[:3]
    ]

    healthy_team_count = sum(
        item.scorecard.score_label in {"good", "excellent"} and item.crm_discipline_status == "disciplined"
        for item in team_items
    )
    teams_needing_attention_count = max(len(team_items) - healthy_team_count, 0)

    return WeeklyReviewSummaryResponse(
        generated_at=now,
        review_start=review_start,
        review_end=review_end,
        scope_label=scope_label,
        healthy_team_count=healthy_team_count,
        teams_needing_attention_count=teams_needing_attention_count,
        unresolved_action_count=len(unresolved_actions),
        critical_alert_open_count=len(critical_alert_items),
        top_improvers=top_improvers,
        biggest_risks=biggest_risks,
        teams_needing_intervention=teams_needing_intervention,
        unresolved_actions=unresolved_actions[:6],
        critical_alerts_open=critical_alert_items[:6],
    )


def build_weekly_review_csv(summary: WeeklyReviewSummaryResponse) -> str:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "section",
            "name",
            "scope_type",
            "team_name",
            "score",
            "score_label",
            "trend_label",
            "backlog",
            "overdue",
            "action_open_count",
            "critical_alert_count",
            "target_href",
        ]
    )
    for section_name, items in (
        ("top_improvers", summary.top_improvers),
        ("biggest_risks", summary.biggest_risks),
        ("teams_needing_intervention", summary.teams_needing_intervention),
    ):
        for item in items:
            writer.writerow(
                [
                    section_name,
                    item.label,
                    item.scope_type,
                    item.team_name or "",
                    item.score,
                    item.score_label,
                    item.trend_label,
                    item.backlog_count,
                    item.overdue_count,
                    item.action_open_count,
                    item.critical_alert_count,
                    item.target_href or "",
                ]
            )
    return buffer.getvalue()


def get_manager_insights(
    db: Session,
    *,
    current_user: User,
    account_category: str | None = None,
    range_label: str = "7d",
) -> ManagerInsightsResponse:
    now = datetime.now(timezone.utc)
    normalized_range_label, _ = _normalize_sales_performance_range(range_label)

    if current_user.organization_id is None and not is_superadmin_like(current_user.role):
        review_start, review_end = _build_weekly_review_period(now)
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
            historical_summary=ManagerHistoricalSummary(
                trend_label="stable",
                delta_total_needs_reply=0,
                delta_total_overdue_follow_up=0,
                latest_snapshot_date=None,
                previous_snapshot_date=None,
            ),
            weekly_review=WeeklyReviewSummaryResponse(
                generated_at=now,
                review_start=review_start,
                review_end=review_end,
                scope_label="No organization scope",
                healthy_team_count=0,
                teams_needing_attention_count=0,
                unresolved_action_count=0,
                critical_alert_open_count=0,
                top_improvers=[],
                biggest_risks=[],
                teams_needing_intervention=[],
                unresolved_actions=[],
                critical_alerts_open=[],
            ),
            sales_performance_summary=ManagerSalesPerformanceSummary(
                sales_count=0,
                total_active_leads=0,
                total_needs_reply=0,
                total_overdue_follow_up=0,
                range_label=normalized_range_label,
                previous_range_label=f"prev_{normalized_range_label}",
                delta_total_needs_reply=0,
                delta_total_overdue_follow_up=0,
            ),
            sales_performance=[],
            team_performance_summary=TeamPerformanceSummary(
                team_count=0,
                total_needs_reply=0,
                total_overdue_follow_up=0,
                range_label=normalized_range_label,
                previous_range_label=f"prev_{normalized_range_label}",
            ),
            team_performance=[],
            top_coaching_targets=[],
        )

    accessible_user_ids = get_accessible_sales_user_ids(
        db=db,
        current_user=current_user,
    )

    lead_statement = select(Lead).options(
        selectinload(Lead.assigned_user).selectinload(User.sales_team),
        selectinload(Lead.discipline_logs),
        selectinload(Lead.deal),
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
        selectinload(Conversation.reply_suggestions),
        selectinload(Conversation.sent_messages),
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

    sales_user_statement = select(User)
    if not is_superadmin_like(current_user.role):
        sales_user_statement = sales_user_statement.where(
            User.organization_id == current_user.organization_id
        )
    if accessible_user_ids is not None:
        sales_user_statement = sales_user_statement.where(User.id.in_(accessible_user_ids))
    sales_users = [
        user
        for user in db.scalars(sales_user_statement).all()
        if is_sales_like(user.role)
    ]
    sales_users.sort(key=lambda user: user.name.lower())

    team_lead_map: dict[UUID | None, list[Lead]] = {}
    for lead in leads:
        team_id = lead.assigned_user.team_id if lead.assigned_user else None
        team_lead_map.setdefault(team_id, []).append(lead)

    lead_user_map: dict[UUID, list[Lead]] = {}
    for lead in leads:
        if lead.assigned_user_id is None:
            continue
        lead_user_map.setdefault(lead.assigned_user_id, []).append(lead)

    conversation_user_map: dict[UUID, list[Conversation]] = {}
    for conversation in conversations:
        if conversation.sales_user_id is None:
            continue
        conversation_user_map.setdefault(conversation.sales_user_id, []).append(conversation)

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

    sales_performance: list[ManagerSalesPerformanceItem] = []
    for sales_user in sales_users:
        owned_leads = lead_user_map.get(sales_user.id, [])
        owned_conversations = conversation_user_map.get(sales_user.id, [])
        sales_performance.append(
            _build_sales_performance_summary_item(
                sales_user=sales_user,
                owned_leads=owned_leads,
                owned_conversations=owned_conversations,
                now=now,
                range_label=normalized_range_label,
            )
        )

    sales_performance.sort(
        key=lambda item: (
            item.coaching_signal.priority_score,
            item.overdue_follow_up_count,
            item.needs_reply_count,
            item.hot_leads_count,
            item.latest_activity_at or datetime.min.replace(tzinfo=timezone.utc),
        ),
        reverse=True,
    )
    top_coaching_targets = [
        TopCoachingTargetItem(
            sales_user_id=item.sales_user_id,
            sales_name=item.sales_name,
            priority_label=item.coaching_signal.priority_label,
            primary_reason=item.coaching_signal.primary_reason,
            recommended_action=item.coaching_signal.recommended_action,
        )
        for item in sales_performance[:3]
    ]
    team_map = {team.id: team for team in teams}
    sales_user_team_map = {sales_user.id: sales_user.team_id for sales_user in sales_users}
    team_performance_groups: dict[UUID | None, list[ManagerSalesPerformanceItem]] = {}
    for item in sales_performance:
        team_performance_groups.setdefault(
            sales_user_team_map.get(item.sales_user_id),
            [],
        ).append(item)

    team_performance = [
        _build_team_performance_item(
            team=team_map.get(team_id) if team_id is not None else None,
            sales_items=items,
            normalized_range_label=normalized_range_label,
        )
        for team_id, items in team_performance_groups.items()
        if items
    ]
    team_performance.sort(
        key=lambda item: (
            item.coaching_signal.priority_score,
            item.overdue_follow_up_count,
            item.needs_reply_count,
            item.hot_leads_count,
            item.latest_activity_at or datetime.min.replace(tzinfo=timezone.utc),
        ),
        reverse=True,
    )

    if current_user.organization_id is not None:
        ensure_weekly_performance_snapshots(
            db=db,
            organization_id=current_user.organization_id,
            sales_user_ids={user.id for user in sales_users},
            team_ids={team.id for team in teams},
            weeks=4,
        )
        sales_history_map = _load_sales_snapshot_history_map(
            db=db,
            organization_id=current_user.organization_id,
            sales_user_ids={item.sales_user_id for item in sales_performance},
            weeks=4,
        )
        for item in sales_performance:
            weekly_history, history_summary = sales_history_map.get(
                item.sales_user_id,
                ([], _build_empty_historical_summary()),
            )
            item.weekly_history = weekly_history
            item.history_summary = history_summary
            historical_scorecard = _build_scorecard_from_weekly_history(weekly_history)
            if historical_scorecard is not None:
                item.scorecard.score_delta_vs_previous = (
                    historical_scorecard.score_delta_vs_previous
                )
                item.scorecard.score_trend_label = (
                    historical_scorecard.score_trend_label
                )

        team_history_map = _load_team_snapshot_history_map(
            db=db,
            organization_id=current_user.organization_id,
            team_ids={item.team_id for item in team_performance if item.team_id is not None},
            weeks=4,
        )
        for item in team_performance:
            if item.team_id is None:
                item.weekly_history = []
                item.history_summary = _build_empty_historical_summary()
                continue
            weekly_history, history_summary = team_history_map.get(
                item.team_id,
                ([], _build_empty_historical_summary()),
            )
            item.weekly_history = weekly_history
            item.history_summary = history_summary
            historical_scorecard = _build_scorecard_from_weekly_history(weekly_history)
            if historical_scorecard is not None:
                item.scorecard.score_delta_vs_previous = (
                    historical_scorecard.score_delta_vs_previous
                )
                item.scorecard.score_trend_label = (
                    historical_scorecard.score_trend_label
                )
        historical_summary = _build_manager_historical_summary(team_history_map)
    else:
        historical_summary = None

    sync_operational_alert_notifications(
        db=db,
        current_user=current_user,
        sales_items=sales_performance,
        team_items=team_performance,
        sales_user_team_map=sales_user_team_map,
    )
    db.commit()

    scope_label = (
        "Organization-wide manager view"
        if is_head_like(current_user.role)
        else "Scoped team or unit manager view"
    )
    weekly_review = _build_weekly_review_summary(
        db=db,
        current_user=current_user,
        scope_label=scope_label,
        sales_items=sales_performance,
        team_items=team_performance,
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
        historical_summary=historical_summary,
        weekly_review=weekly_review,
        sales_performance_summary=ManagerSalesPerformanceSummary(
            sales_count=len(sales_performance),
            total_active_leads=sum(item.active_leads_count for item in sales_performance),
            total_needs_reply=sum(item.needs_reply_count for item in sales_performance),
            total_overdue_follow_up=sum(
                item.overdue_follow_up_count for item in sales_performance
            ),
            range_label=normalized_range_label,
            previous_range_label=f"prev_{normalized_range_label}",
            delta_total_needs_reply=sum(
                item.trend.delta_needs_reply for item in sales_performance
            ),
            delta_total_overdue_follow_up=sum(
                item.trend.delta_overdue_follow_up for item in sales_performance
            ),
        ),
        sales_performance=sales_performance,
        team_performance_summary=TeamPerformanceSummary(
            team_count=len(team_performance),
            total_needs_reply=sum(item.needs_reply_count for item in team_performance),
            total_overdue_follow_up=sum(
                item.overdue_follow_up_count for item in team_performance
            ),
            range_label=normalized_range_label,
            previous_range_label=f"prev_{normalized_range_label}",
        ),
        team_performance=team_performance,
        top_coaching_targets=top_coaching_targets,
    )


def get_sales_performance_detail(
    db: Session,
    *,
    sales_user_id: UUID,
    current_user: User,
    range_label: str = "7d",
) -> SalesPerformanceDetailResponse:
    now = datetime.now(timezone.utc)
    normalized_range_label, range_days = _normalize_sales_performance_range(range_label)
    current_start = now - timedelta(days=range_days)
    accessible_user_ids = get_accessible_sales_user_ids(
        db=db,
        current_user=current_user,
    )

    sales_user = db.scalar(
        select(User)
        .options(selectinload(User.sales_team).selectinload(SalesTeam.unit))
        .where(User.id == sales_user_id)
    )
    if sales_user is None or not is_sales_like(sales_user.role):
        raise ValueError("Sales user not found.")

    if (
        not is_superadmin_like(current_user.role)
        and current_user.organization_id != sales_user.organization_id
    ):
        raise PermissionError("Sales user not found.")

    if accessible_user_ids is not None and sales_user.id not in accessible_user_ids:
        raise PermissionError("Sales user not found.")

    lead_statement = (
        select(Lead)
        .where(Lead.assigned_user_id == sales_user.id)
        .options(
            selectinload(Lead.assigned_user).selectinload(User.sales_team),
            selectinload(Lead.discipline_logs),
            selectinload(Lead.deal),
            selectinload(Lead.tasks),
        )
        .order_by(desc(Lead.updated_at), desc(Lead.created_at))
    )
    if not is_superadmin_like(current_user.role):
        lead_statement = lead_statement.where(
            Lead.organization_id == current_user.organization_id
        )
    owned_leads = list(db.scalars(lead_statement).all())
    lead_by_id = {lead.id: lead for lead in owned_leads}

    conversation_statement = (
        select(Conversation)
        .where(Conversation.sales_user_id == sales_user.id)
        .options(
            selectinload(Conversation.lead),
            selectinload(Conversation.sales_user).selectinload(User.sales_team),
            selectinload(Conversation.messages),
            selectinload(Conversation.ai_extractions),
            selectinload(Conversation.reply_suggestions),
            selectinload(Conversation.sent_messages),
        )
        .order_by(desc(Conversation.last_message_at), desc(Conversation.created_at))
    )
    if not is_superadmin_like(current_user.role):
        conversation_statement = conversation_statement.where(
            Conversation.organization_id == current_user.organization_id
        )
    owned_conversations = [
        conversation
        for conversation in db.scalars(conversation_statement).all()
        if conversation.lead_id is None or conversation.lead_id in lead_by_id
    ]

    summary_item = _build_sales_performance_summary_item(
        sales_user=sales_user,
        owned_leads=owned_leads,
        owned_conversations=owned_conversations,
        now=now,
        range_label=normalized_range_label,
    )

    lead_items = sorted(
        [
            SalesPerformanceLeadItem(
                lead_id=lead.id,
                lead_name=lead.display_name,
                current_stage=lead.current_stage,
                lead_temperature=lead.lead_temperature,
                next_follow_up_at=lead.next_follow_up_at,
                last_contact_at=lead.last_contact_at,
                discipline_status=_resolve_sales_performance_discipline_status(
                    stale_log_count=(
                        0
                        if (
                            latest_log := get_latest_discipline_log_for_lead(lead)
                        ) is not None
                        and latest_log.log_date == now.date()
                        else 1
                    ),
                    overdue_follow_up_count=(
                        1
                        if (
                            next_follow_up_at := ensure_aware_utc(lead.next_follow_up_at)
                        ) is not None
                        and next_follow_up_at <= now
                        else 0
                    ),
                ),
                target_href=f"/dashboard/crm/{lead.id}",
            )
            for lead in owned_leads
            if any(
                _is_between(timestamp, start=current_start, end=now)
                for timestamp in _lead_activity_timestamps(lead)
            )
        ],
        key=lambda item: (
            item.discipline_status != "needs_attention",
            item.lead_temperature != "hot",
            item.next_follow_up_at or datetime.max.replace(tzinfo=timezone.utc),
            item.last_contact_at or datetime.min.replace(tzinfo=timezone.utc),
        ),
    )

    conversation_items: list[SalesPerformanceConversationItem] = []
    for conversation in owned_conversations:
        latest_message = get_latest_message(conversation)
        latest_extraction = get_latest_extraction(conversation)
        latest_suggestion = get_latest_reply_suggestion(conversation)
        latest_sent_message = get_latest_sent_message(conversation)
        if not any(
            _is_between(timestamp, start=current_start, end=now)
            for timestamp in _conversation_activity_timestamps(
                conversation,
                latest_message,
                latest_extraction,
                latest_suggestion,
            )
        ):
            continue
        current_sent_message = resolve_current_sent_message(
            latest_message,
            latest_sent_message,
        )
        ui_status = determine_ui_status(
            latest_message,
            latest_extraction,
            latest_suggestion,
            current_sent_message,
        )
        risk_level = (
            latest_extraction.risk_level
            if latest_extraction is not None
            else (latest_suggestion.risk_level if latest_suggestion is not None else None)
        )

        if ui_status not in {
            "needs_analysis",
            "needs_reply_suggestion",
            "needs_approval",
            "needs_escalation",
            "approved_ready_to_send",
        } and risk_level != "high":
            continue

        conversation_items.append(
            SalesPerformanceConversationItem(
                conversation_id=conversation.id,
                conversation_title=conversation.title,
                ui_status=ui_status,
                source_channel=normalize_source_channel(conversation.source),
                risk_level=risk_level,
                last_message_at=conversation.last_message_at,
                target_href=f"/dashboard/sales/conversations/{conversation.id}",
            )
        )

    conversation_items.sort(
        key=lambda item: (
            item.ui_status not in {"needs_escalation", "needs_approval"},
            item.risk_level != "high",
            item.last_message_at or datetime.min.replace(tzinfo=timezone.utc),
        ),
        reverse=True,
    )

    follow_up_items_by_lead: dict[UUID, SalesPerformanceFollowUpItem] = {}
    for lead in owned_leads:
        if not any(
            _is_between(timestamp, start=current_start, end=now)
            for timestamp in _lead_activity_timestamps(lead)
        ):
            continue
        overdue_tasks = sorted(
            [
                task
                for task in lead.tasks
                if task.status in {"open", "snoozed"}
                and (task_due_at := ensure_aware_utc(task.due_at)) is not None
                and task_due_at <= now
            ],
            key=lambda task: ensure_aware_utc(task.due_at) or now,
        )
        next_follow_up_at = ensure_aware_utc(lead.next_follow_up_at)
        top_task = overdue_tasks[0] if overdue_tasks else None
        due_at = ensure_aware_utc(top_task.due_at) if top_task is not None else next_follow_up_at

        if due_at is None or due_at > now:
            continue

        priority_label = "sedang"
        if lead.lead_temperature == "hot" or (now - due_at).total_seconds() >= 86400:
            priority_label = "tinggi"
        elif (now - due_at).total_seconds() <= 7200:
            priority_label = "rendah"

        follow_up_items_by_lead[lead.id] = SalesPerformanceFollowUpItem(
            lead_id=lead.id,
            lead_name=lead.display_name,
            task_type=top_task.task_type if top_task is not None else "overdue_follow_up",
            due_at=due_at,
            priority_label=priority_label,
            target_href=f"/dashboard/crm/{lead.id}",
        )

    follow_up_items = sorted(
        follow_up_items_by_lead.values(),
        key=lambda item: (
            item.priority_label != "tinggi",
            item.due_at or datetime.max.replace(tzinfo=timezone.utc),
        ),
    )

    if sales_user.organization_id is not None:
        ensure_weekly_performance_snapshots(
            db=db,
            organization_id=sales_user.organization_id,
            sales_user_ids={sales_user.id},
            team_ids={sales_user.team_id} if sales_user.team_id is not None else None,
            weeks=4,
        )
        weekly_history, history_summary = _load_sales_snapshot_history_map(
            db=db,
            organization_id=sales_user.organization_id,
            sales_user_ids={sales_user.id},
            weeks=4,
        ).get(sales_user.id, ([], _build_empty_historical_summary()))
    else:
        weekly_history, history_summary = [], _build_empty_historical_summary()

    return SalesPerformanceDetailResponse(
        generated_at=now,
        sales_user=SalesPerformanceDetailUser(
            id=sales_user.id,
            name=sales_user.name,
            role=normalize_role(sales_user.role),
            team_name=sales_user.sales_team.name if sales_user.sales_team else None,
            unit_name=(
                sales_user.sales_team.unit.name
                if sales_user.sales_team and sales_user.sales_team.unit
                else None
            ),
            is_active=sales_user.is_active,
        ),
        summary=SalesPerformanceDetailSummary(
            range_label=normalized_range_label,
            previous_range_label=f"prev_{normalized_range_label}",
            active_leads_count=summary_item.active_leads_count,
            needs_reply_count=summary_item.needs_reply_count,
            overdue_follow_up_count=summary_item.overdue_follow_up_count,
            hot_leads_count=summary_item.hot_leads_count,
            analyzed_conversations_count=summary_item.analyzed_conversations_count,
            needs_analysis_count=summary_item.needs_analysis_count,
            won_deals_count=summary_item.won_deals_count,
            lost_deals_count=summary_item.lost_deals_count,
            open_deals_count=summary_item.open_deals_count,
            latest_activity_at=summary_item.latest_activity_at,
            avg_response_sla_status=summary_item.avg_response_sla_status,
            crm_discipline_status=summary_item.crm_discipline_status,
            trend=summary_item.trend,
            scorecard=(
                historical_scorecard
                if (historical_scorecard := _build_scorecard_from_weekly_history(weekly_history))
                is not None
                else summary_item.scorecard
            ),
            coaching_signal=summary_item.coaching_signal,
            weekly_history=weekly_history,
            history_summary=history_summary,
        ),
        lead_items=lead_items[:6],
        conversation_items=conversation_items[:6],
        follow_up_items=follow_up_items[:6],
    )


def get_sales_performance_history(
    db: Session,
    *,
    sales_user_id: UUID,
    current_user: User,
    weeks: int = 4,
) -> SalesPerformanceHistoryResponse:
    sales_user = db.scalar(
        select(User)
        .options(selectinload(User.sales_team).selectinload(SalesTeam.unit))
        .where(User.id == sales_user_id)
    )
    if sales_user is None or not is_sales_like(sales_user.role):
        raise ValueError("Sales user not found.")

    if (
        not is_superadmin_like(current_user.role)
        and current_user.organization_id != sales_user.organization_id
    ):
        raise PermissionError("Sales user not found.")

    accessible_user_ids = get_accessible_sales_user_ids(
        db=db,
        current_user=current_user,
    )
    if accessible_user_ids is not None and sales_user.id not in accessible_user_ids:
        raise PermissionError("Sales user not found.")

    if sales_user.organization_id is None:
        return SalesPerformanceHistoryResponse(
            generated_at=datetime.now(timezone.utc),
            sales_user=SalesPerformanceDetailUser(
                id=sales_user.id,
                name=sales_user.name,
                role=normalize_role(sales_user.role),
                team_name=sales_user.sales_team.name if sales_user.sales_team else None,
                unit_name=(
                    sales_user.sales_team.unit.name
                    if sales_user.sales_team and sales_user.sales_team.unit
                    else None
                ),
                is_active=sales_user.is_active,
            ),
            history_summary=_build_empty_historical_summary(),
            weekly_history=[],
        )

    ensure_weekly_performance_snapshots(
        db=db,
        organization_id=sales_user.organization_id,
        sales_user_ids={sales_user.id},
        team_ids={sales_user.team_id} if sales_user.team_id is not None else None,
        weeks=weeks,
    )
    weekly_history, history_summary = _load_sales_snapshot_history_map(
        db=db,
        organization_id=sales_user.organization_id,
        sales_user_ids={sales_user.id},
        weeks=weeks,
    ).get(sales_user.id, ([], _build_empty_historical_summary()))

    return SalesPerformanceHistoryResponse(
        generated_at=datetime.now(timezone.utc),
        sales_user=SalesPerformanceDetailUser(
            id=sales_user.id,
            name=sales_user.name,
            role=normalize_role(sales_user.role),
            team_name=sales_user.sales_team.name if sales_user.sales_team else None,
            unit_name=(
                sales_user.sales_team.unit.name
                if sales_user.sales_team and sales_user.sales_team.unit
                else None
            ),
            is_active=sales_user.is_active,
        ),
        history_summary=history_summary,
        weekly_history=weekly_history,
    )


def get_team_performance_history(
    db: Session,
    *,
    team_id: UUID,
    current_user: User,
    weeks: int = 4,
) -> TeamPerformanceHistoryResponse:
    team = db.scalar(
        select(SalesTeam)
        .options(selectinload(SalesTeam.unit), selectinload(SalesTeam.manager_user))
        .where(SalesTeam.id == team_id)
    )
    if team is None:
        raise ValueError("Team not found.")

    if (
        not is_superadmin_like(current_user.role)
        and current_user.organization_id != team.organization_id
    ):
        raise PermissionError("Team not found.")

    accessible_team_ids = get_accessible_team_ids(
        db=db,
        current_user=current_user,
    )
    if accessible_team_ids is not None and team.id not in accessible_team_ids:
        raise PermissionError("Team not found.")

    ensure_weekly_performance_snapshots(
        db=db,
        organization_id=team.organization_id,
        team_ids={team.id},
        weeks=weeks,
    )
    weekly_history, history_summary = _load_team_snapshot_history_map(
        db=db,
        organization_id=team.organization_id,
        team_ids={team.id},
        weeks=weeks,
    ).get(team.id, ([], _build_empty_historical_summary()))

    return TeamPerformanceHistoryResponse(
        generated_at=datetime.now(timezone.utc),
        team_id=team.id,
        team_name=team.name,
        unit_id=team.unit_id,
        unit_name=team.unit.name if team.unit else None,
        manager_user_name=team.manager_user.name if team.manager_user else None,
        history_summary=history_summary,
        weekly_history=weekly_history,
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

    if is_manager_like(current_user.role) or is_head_like(current_user.role):
        get_manager_insights(db=db, current_user=current_user)

    desired_notifications: list[dict[str, str | None]] = []

    extension_manifest = _read_extension_distribution_manifest()
    extension_build = extension_manifest.get(GLOBAL_EXTENSION_BUILD_KEY)
    if (
        extension_build
        and current_user.organization_id is not None
        and not is_superadmin_like(current_user.role)
    ):
        extension_version = str(extension_build.get("version") or "").strip()
        uploaded_at = str(extension_build.get("uploaded_at") or "").strip()
        uploaded_by_email = str(extension_build.get("uploaded_by_email") or "").strip()
        version_label = extension_version or "terbaru"
        uploader_label = uploaded_by_email or "superadmin"

        desired_notifications.append(
            {
                "source_type": "extension_build_update",
                "source_key": f"extension-build:{version_label}:{uploaded_at or 'unknown'}",
                "workflow_scope": "ops_oversight",
                "owner_role": "superadmin",
                "target_role": "all",
                "severity": "high",
                "title": f"Extension Clara {version_label} tersedia",
                "body": (
                    "Superadmin baru upload versi extension terbaru. "
                    f"Download dari halaman profile kalau perlu update browser kerja. "
                    f"Uploader: {uploader_label}."
                ),
                "target_href": "/dashboard/profile",
            }
        )

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

    if not is_sales_notification_owner and current_user.organization_id is not None:
        oversight_lead_statement = (
            select(Lead)
            .where(Lead.organization_id == current_user.organization_id)
            .options(selectinload(Lead.assigned_user))
            .order_by(desc(Lead.updated_at), desc(Lead.created_at))
        )
        for lead in db.scalars(oversight_lead_statement).all()[:50]:
            next_follow_up_at = ensure_aware_utc(lead.next_follow_up_at)
            if next_follow_up_at is None or next_follow_up_at > now:
                continue

            desired_notifications.append(
                {
                    "source_type": "oversight_follow_up",
                    "source_key": f"oversight-follow-up:{lead.id}",
                    "severity": "high",
                    "title": f"Follow-up overdue: {lead.display_name}",
                    "body": (
                        "Lead ini melewati jadwal follow-up dan perlu perhatian "
                        "manager/head agar tidak diam terlalu lama."
                    ),
                    "target_href": f"/dashboard/crm/{lead.id}",
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
        OpsNotification.organization_id == current_user.organization_id,
        OpsNotification.source_type != OPERATIONAL_ALERT_SOURCE_TYPE,
    )
    if not is_head_like(current_user.role):
        statement = statement.where(
            or_(
                OpsNotification.user_id == current_user.id,
                (
                    (OpsNotification.source_type == "extension_build_update")
                    & OpsNotification.user_id.is_(None)
                ),
            )
        )

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
        if key not in desired_keys and _is_open_notification_status(notification.status):
            notification.status = "resolved"
            notification.resolved_at = now
            notification.resolved_by_user_id = current_user.id
            db.add(notification)

    for item in desired_notifications:
        key = (str(item["source_type"]), str(item["source_key"]))
        notification = existing_by_key.get(key)
        if notification is None:
            notification = OpsNotification(
                organization_id=current_user.organization_id,
                user_id=(
                    None
                    if (
                        is_head_like(current_user.role)
                        or str(item["source_type"]) == "extension_build_update"
                    )
                    else current_user.id
                ),
                source_type=str(item["source_type"]),
                source_key=str(item["source_key"]),
                workflow_scope=str(
                    item.get("workflow_scope")
                    or _resolve_notification_workflow_scope(str(item["source_type"]))
                ),
                owner_role=str(
                    item.get("owner_role")
                    or _resolve_notification_owner_role(str(item["source_type"]))
                ),
                target_role=str(
                    item.get("target_role")
                    or _resolve_notification_target_role(str(item["source_type"]))
                ),
                severity=str(item["severity"]),
                title=str(item["title"]),
                body=str(item["body"]),
                target_href=str(item["target_href"]) if item["target_href"] else None,
                status="active",
                delivery_channel="in_app",
                delivery_status="delivered",
                delivered_at=now,
                escalation_level="none",
                triggered_at=now,
            )
        else:
            notification.workflow_scope = str(
                item.get("workflow_scope")
                or _resolve_notification_workflow_scope(str(item["source_type"]))
            )
            notification.owner_role = str(
                item.get("owner_role")
                or _resolve_notification_owner_role(str(item["source_type"]))
            )
            notification.target_role = str(
                item.get("target_role")
                or _resolve_notification_target_role(str(item["source_type"]))
            )
            notification.severity = str(item["severity"])
            notification.title = str(item["title"])
            notification.body = str(item["body"])
            notification.target_href = (
                str(item["target_href"]) if item["target_href"] else None
            )
            if (
                notification.status == "resolved"
                and notification.source_type != "extension_build_update"
            ):
                notification.status = "active"
                notification.resolved_at = None
                notification.resolved_by_user_id = None
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
    if is_head_like(current_user.role):
        refreshed_statement = refreshed_statement.where(
            or_(
                OpsNotification.source_type != OPERATIONAL_ALERT_SOURCE_TYPE,
                OpsNotification.user_id.is_(None),
            )
        )
    else:
        refreshed_statement = refreshed_statement.where(
            or_(
                OpsNotification.user_id == current_user.id,
                (
                    (OpsNotification.source_type == "extension_build_update")
                    & OpsNotification.user_id.is_(None)
                ),
            )
        )

    return list(db.scalars(refreshed_statement).all())


def _get_accessible_ops_notification(
    db: Session,
    *,
    notification_id: UUID,
    current_user: User,
) -> OpsNotification:
    notification = db.get(OpsNotification, notification_id)
    if notification is None:
        raise ValueError("Notification not found.")

    if notification.organization_id != current_user.organization_id:
        raise ValueError("Notification not found.")

    if _is_operational_alert(notification):
        if not (
            is_manager_like(current_user.role)
            or is_head_like(current_user.role)
            or is_superadmin_like(current_user.role)
        ):
            raise ValueError("Notification not found.")
        if notification.user_id is None:
            if not (is_head_like(current_user.role) or is_superadmin_like(current_user.role)):
                raise ValueError("Notification not found.")
        elif notification.user_id != current_user.id and not is_superadmin_like(current_user.role):
            raise ValueError("Notification not found.")
        return notification

    if (
        notification.user_id is not None
        and notification.user_id != current_user.id
        and not is_superadmin_like(current_user.role)
    ):
        raise ValueError("Notification not found.")
    return notification


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
    sales_user_ids = {
        notification.sales_user_id
        for notification in notifications
        if notification.sales_user_id is not None
    }
    sales_user_lookup = {
        user.id: user
        for user in db.scalars(select(User).where(User.id.in_(sales_user_ids))).all()
    } if sales_user_ids else {}
    team_ids = {
        notification.team_id
        for notification in notifications
        if notification.team_id is not None
    }
    team_lookup = {
        team.id: team
        for team in db.scalars(select(SalesTeam).where(SalesTeam.id.in_(team_ids))).all()
    } if team_ids else {}

    return OpsNotificationResponse(
        generated_at=datetime.now(timezone.utc),
        active_count=sum(1 for item in notifications if item.status == "active"),
        acknowledged_count=sum(
            1 for item in notifications if item.status == "acknowledged"
        ),
        resolved_count=sum(1 for item in notifications if item.status == "resolved"),
        ignored_count=sum(1 for item in notifications if item.status == "ignored"),
        escalated_count=sum(1 for item in notifications if item.escalation_level != "none"),
        items=[
            build_ops_notification_item(
                item,
                lead_lookup,
                sales_user_lookup,
                team_lookup,
            )
            for item in notifications
        ],
    )


def acknowledge_ops_notification(
    db: Session,
    notification_id: UUID,
    current_user: User,
) -> OpsNotificationItem:
    notification = _get_accessible_ops_notification(
        db=db,
        notification_id=notification_id,
        current_user=current_user,
    )
    if _is_operational_alert(notification) and notification.status != "active":
        raise ValueError("Notification can no longer be acknowledged.")

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
    notification = _get_accessible_ops_notification(
        db=db,
        notification_id=notification_id,
        current_user=current_user,
    )
    if _is_operational_alert(notification) and notification.status not in {"active", "acknowledged"}:
        raise ValueError("Notification can no longer be resolved.")

    notification.status = "resolved"
    notification.resolved_at = datetime.now(timezone.utc)
    notification.resolved_by_user_id = current_user.id
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
    notification = _get_accessible_ops_notification(
        db=db,
        notification_id=notification_id,
        current_user=current_user,
    )
    if _is_operational_alert(notification):
        raise ValueError("Operational alert cannot be reopened manually.")

    notification.status = "active"
    notification.resolved_at = None
    notification.resolved_by_user_id = None
    notification.resolution_note = None
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return build_ops_notification_item(notification)


def ignore_ops_notification(
    db: Session,
    notification_id: UUID,
    payload: OpsNotificationResolveRequest | None,
    current_user: User,
) -> OpsNotificationItem:
    notification = _get_accessible_ops_notification(
        db=db,
        notification_id=notification_id,
        current_user=current_user,
    )
    if _is_operational_alert(notification):
        allowed_targets = VALID_OPERATIONAL_ALERT_TRANSITIONS.get(notification.status, set())
        if "ignored" not in allowed_targets:
            raise ValueError("Notification can no longer be ignored.")

    notification.status = "ignored"
    notification.ignored_at = datetime.now(timezone.utc)
    notification.ignored_by_user_id = current_user.id
    notification.resolution_note = (
        payload.resolution_note.strip()
        if payload and payload.resolution_note and payload.resolution_note.strip()
        else notification.resolution_note
    )
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

    conversations_statement = select(Conversation).options(
        selectinload(Conversation.ai_extractions),
        selectinload(Conversation.reply_suggestions),
        selectinload(Conversation.sent_messages),
    )
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

    objection_counter: Counter[str] = Counter()
    lead_temperature_counter: Counter[str] = Counter()
    risk_level_counter: Counter[str] = Counter()
    buying_intent_counter: Counter[str] = Counter()
    sentiment_counter: Counter[str] = Counter()
    pipeline_stage_counter: Counter[str] = Counter()

    (
        latest_extraction_by_conversation,
        total_reply_suggestions,
        approved_reply_count,
        reply_sent_count,
    ) = summarize_conversation_operational_state(conversations)

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
