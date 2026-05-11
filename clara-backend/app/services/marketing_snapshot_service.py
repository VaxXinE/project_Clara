from datetime import date, timedelta

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.models.marketing_insight_snapshot import MarketingInsightSnapshot
from app.models.user import User
from app.schemas.dashboard_schema import (
    MarketingInsightSnapshotComparison,
    MarketingInsightSnapshotResponse,
)
from app.services.dashboard_service import get_marketing_insights_preview


def get_snapshot_scope(current_user: User) -> tuple[str, str | None]:
    if current_user.role == "owner":
        return "global", None

    return "organization", (
        str(current_user.organization_id) if current_user.organization_id else None
    )


def generate_marketing_snapshot(
    db: Session,
    current_user: User,
    window_days: int = 7,
) -> MarketingInsightSnapshotResponse:
    insights = get_marketing_insights_preview(db=db, current_user=current_user)
    scope_type, _ = get_snapshot_scope(current_user)

    today = date.today()
    period_end = today
    period_start = today - timedelta(days=max(window_days - 1, 0))

    snapshot = MarketingInsightSnapshot(
        organization_id=(
            current_user.organization_id if scope_type == "organization" else None
        ),
        scope_type=scope_type,
        snapshot_type="manual",
        period_start=period_start,
        period_end=period_end,
        metrics_json={
            "total_conversations": insights.total_conversations,
            "total_analyzed_conversations": insights.total_analyzed_conversations,
            "top_objections": [item.model_dump() for item in insights.top_objections],
            "lead_temperature_breakdown": insights.lead_temperature_breakdown,
            "risk_level_breakdown": insights.risk_level_breakdown,
            "buying_intent_breakdown": [
                item.model_dump() for item in insights.buying_intent_breakdown
            ],
            "sentiment_breakdown": [
                item.model_dump() for item in insights.sentiment_breakdown
            ],
            "pipeline_stage_breakdown": [
                item.model_dump() for item in insights.pipeline_stage_breakdown
            ],
            "top_content_recommendations": [
                item.model_dump()
                for item in insights.top_content_recommendations
            ],
            "kpi_summary": insights.kpi_summary.model_dump(),
            "generated_at": insights.generated_at.isoformat(),
        },
    )

    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)

    return build_snapshot_response(snapshot)


def list_marketing_snapshots(
    db: Session,
    current_user: User,
    limit: int = 10,
) -> list[MarketingInsightSnapshotResponse]:
    scope_type, _ = get_snapshot_scope(current_user)

    statement = select(MarketingInsightSnapshot).where(
        MarketingInsightSnapshot.scope_type == scope_type
    )
    if scope_type == "organization":
        statement = statement.where(
            MarketingInsightSnapshot.organization_id == current_user.organization_id
        )

    statement = statement.order_by(desc(MarketingInsightSnapshot.created_at)).limit(limit)

    snapshots = list(db.scalars(statement).all())
    return build_snapshot_response_list(snapshots)


def build_snapshot_response_list(
    snapshots: list[MarketingInsightSnapshot],
) -> list[MarketingInsightSnapshotResponse]:
    responses = [build_snapshot_response(snapshot) for snapshot in snapshots]

    for index, response in enumerate(responses):
        previous = responses[index + 1] if index + 1 < len(responses) else None
        response.comparison = compare_snapshots(response, previous)

    return responses


def build_snapshot_response(
    snapshot: MarketingInsightSnapshot,
) -> MarketingInsightSnapshotResponse:
    metrics = snapshot.metrics_json
    return MarketingInsightSnapshotResponse(
        id=snapshot.id,
        organization_id=snapshot.organization_id,
        scope_type=snapshot.scope_type,
        snapshot_type=snapshot.snapshot_type,
        period_start=snapshot.period_start,
        period_end=snapshot.period_end,
        total_conversations=metrics.get("total_conversations", 0),
        total_analyzed_conversations=metrics.get("total_analyzed_conversations", 0),
        top_objections=metrics.get("top_objections", []),
        top_content_recommendations=metrics.get("top_content_recommendations", []),
        kpi_summary=metrics.get("kpi_summary", {}),
        generated_at=metrics.get("generated_at"),
        created_at=snapshot.created_at,
        comparison=None,
    )


def compare_snapshots(
    current: MarketingInsightSnapshotResponse,
    previous: MarketingInsightSnapshotResponse | None,
) -> MarketingInsightSnapshotComparison | None:
    if previous is None:
        return None

    return MarketingInsightSnapshotComparison(
        conversation_delta=current.total_conversations - previous.total_conversations,
        analyzed_delta=(
            current.total_analyzed_conversations
            - previous.total_analyzed_conversations
        ),
        reply_sent_rate_delta=round(
            current.kpi_summary.reply_sent_rate - previous.kpi_summary.reply_sent_rate,
            4,
        ),
        approved_reply_rate_delta=round(
            current.kpi_summary.approved_reply_rate
            - previous.kpi_summary.approved_reply_rate,
            4,
        ),
    )
