"""add Clara Stage 9 rollout control plane

Revision ID: fd3e4f506172
Revises: fc2d3e4f5061
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "fd3e4f506172"
down_revision: str | Sequence[str] | None = "fc2d3e4f5061"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "clara_rollout_plans",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("variant", sa.String(20), nullable=False),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("current_stage", sa.String(40), nullable=True),
        sa.Column("candidate_bundle_id", sa.Uuid(), nullable=False),
        sa.Column("candidate_bundle_hash", sa.String(64), nullable=False),
        sa.Column("certification_run_id", sa.Uuid(), nullable=False),
        sa.Column("certification_report_hash", sa.String(64), nullable=False),
        sa.Column("baseline_profile", sa.JSON(), nullable=False),
        sa.Column("candidate_profile", sa.JSON(), nullable=False),
        sa.Column("cohort_percentage", sa.Integer(), nullable=False),
        sa.Column("cohort_seed", sa.String(128), nullable=False),
        sa.Column("shadow_sample_percentage", sa.Integer(), nullable=False),
        sa.Column("daily_shadow_limit", sa.Integer(), nullable=False),
        sa.Column("promotion_thresholds", sa.JSON(), nullable=False),
        sa.Column("required_sample_size", sa.Integer(), nullable=False),
        sa.Column("started_by_user_id", sa.Uuid(), nullable=True),
        sa.Column("approved_by_user_id", sa.Uuid(), nullable=True),
        sa.Column("paused_by_user_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("activated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("paused_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["candidate_bundle_id"], ["ai_persona_bundles.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["certification_run_id"], ["clara_evaluation_runs.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["started_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["approved_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["paused_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.CheckConstraint("variant = 'mini'", name="ck_clara_rollout_plan_variant"),
        sa.CheckConstraint("status IN ('DRAFT','READY','ACTIVE','PAUSED','STOPPED','ROLLED_BACK','COMPLETED','REJECTED')", name="ck_clara_rollout_plan_status"),
        sa.CheckConstraint("current_stage IS NULL OR current_stage IN ('INTERNAL_SIMULATION','SHADOW','REVIEWER_CANARY_10','REVIEWER_CANARY_30','SEMI_AUTOMATIC_100')", name="ck_clara_rollout_plan_stage"),
        sa.CheckConstraint("cohort_percentage BETWEEN 0 AND 100", name="ck_clara_rollout_plan_cohort"),
        sa.CheckConstraint("shadow_sample_percentage BETWEEN 0 AND 100", name="ck_clara_rollout_plan_shadow_sample"),
        sa.CheckConstraint("daily_shadow_limit >= 0 AND required_sample_size >= 0", name="ck_clara_rollout_plan_sample_limits"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_clara_rollout_plans_organization_id", "clara_rollout_plans", ["organization_id"])
    op.create_index("ix_clara_rollout_plans_candidate_bundle_id", "clara_rollout_plans", ["candidate_bundle_id"])
    op.create_index("ix_clara_rollout_plans_certification_run_id", "clara_rollout_plans", ["certification_run_id"])
    op.create_index("ix_clara_rollout_plan_org_status", "clara_rollout_plans", ["organization_id", "variant", "status"])
    op.create_index("uq_clara_rollout_active_org_variant", "clara_rollout_plans", ["organization_id", "variant"], unique=True, postgresql_where=sa.text("status = 'ACTIVE'"), sqlite_where=sa.text("status = 'ACTIVE'"))

    op.create_table(
        "clara_rollout_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("plan_id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column("actor_user_id", sa.Uuid(), nullable=True),
        sa.Column("reason_codes", sa.JSON(), nullable=False),
        sa.Column("safe_metadata", sa.JSON(), nullable=False),
        sa.Column("event_hash", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["plan_id"], ["clara_rollout_plans.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.CheckConstraint("event_type IN ('CREATED','READINESS_VALIDATED','ACTIVATED','STAGE_PROMOTED','PAUSED','RESUMED','STOP_CONDITION_TRIGGERED','ROLLBACK_STARTED','ROLLED_BACK','COMPLETED','REJECTED')", name="ck_clara_rollout_event_type"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("event_hash"),
    )
    for column in ("plan_id", "organization_id", "event_type"):
        op.create_index(f"ix_clara_rollout_events_{column}", "clara_rollout_events", [column])

    op.create_table(
        "clara_rollout_observations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("plan_id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("suggestion_id", sa.Uuid(), nullable=True),
        sa.Column("conversation_id", sa.Uuid(), nullable=True),
        sa.Column("reviewer_user_id", sa.Uuid(), nullable=True),
        sa.Column("rollout_stage", sa.String(40), nullable=False),
        sa.Column("generation_lane", sa.String(30), nullable=False),
        sa.Column("profile_hash", sa.String(64), nullable=False),
        sa.Column("bundle_hash", sa.String(64), nullable=False),
        sa.Column("cohort_eligible", sa.Boolean(), nullable=False),
        sa.Column("shadow_only", sa.Boolean(), nullable=False),
        sa.Column("send_eligible", sa.Boolean(), nullable=False),
        sa.Column("route", sa.String(40), nullable=True),
        sa.Column("policy_action", sa.String(40), nullable=True),
        sa.Column("process_state", sa.String(50), nullable=True),
        sa.Column("validator_ids", sa.JSON(), nullable=False),
        sa.Column("reason_codes", sa.JSON(), nullable=False),
        sa.Column("input_length", sa.Integer(), nullable=True),
        sa.Column("output_length", sa.Integer(), nullable=True),
        sa.Column("normalized_edit_distance", sa.Float(), nullable=True),
        sa.Column("review_outcome", sa.String(30), nullable=True),
        sa.Column("generation_latency_ms", sa.Integer(), nullable=True),
        sa.Column("reviewer_turnaround_ms", sa.Integer(), nullable=True),
        sa.Column("escalation_expected", sa.Boolean(), nullable=True),
        sa.Column("escalation_selected", sa.Boolean(), nullable=True),
        sa.Column("delivery_authorization_failed", sa.Boolean(), nullable=False),
        sa.Column("customer_movement", sa.String(40), nullable=True),
        sa.Column("is_production_sample", sa.Boolean(), nullable=False),
        sa.Column("output_hash", sa.String(64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["plan_id"], ["clara_rollout_plans.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["suggestion_id"], ["reply_suggestions.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["conversation_id"], ["conversations.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["reviewer_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.CheckConstraint("rollout_stage IN ('INTERNAL_SIMULATION','SHADOW','REVIEWER_CANARY_10','REVIEWER_CANARY_30','SEMI_AUTOMATIC_100')", name="ck_clara_rollout_observation_stage"),
        sa.CheckConstraint("generation_lane IN ('BASELINE','SHADOW_CANDIDATE','CANARY_CANDIDATE')", name="ck_clara_rollout_observation_lane"),
        sa.PrimaryKeyConstraint("id"),
    )
    for column in ("plan_id", "organization_id", "suggestion_id", "conversation_id", "reviewer_user_id"):
        op.create_index(f"ix_clara_rollout_observations_{column}", "clara_rollout_observations", [column])

    op.create_table(
        "clara_rollout_incidents",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("plan_id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("severity", sa.String(20), nullable=False),
        sa.Column("stop_condition_category", sa.String(80), nullable=False),
        sa.Column("source_suggestion_id", sa.Uuid(), nullable=True),
        sa.Column("source_conversation_id", sa.Uuid(), nullable=True),
        sa.Column("safe_reason_codes", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("acknowledged_by_user_id", sa.Uuid(), nullable=True),
        sa.Column("resolved_by_user_id", sa.Uuid(), nullable=True),
        sa.Column("resolution_note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["plan_id"], ["clara_rollout_plans.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["source_suggestion_id"], ["reply_suggestions.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["source_conversation_id"], ["conversations.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["acknowledged_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["resolved_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.CheckConstraint("status IN ('OPEN','ACKNOWLEDGED','RESOLVED')", name="ck_clara_rollout_incident_status"),
        sa.PrimaryKeyConstraint("id"),
    )
    for column in ("plan_id", "organization_id", "stop_condition_category"):
        op.create_index(f"ix_clara_rollout_incidents_{column}", "clara_rollout_incidents", [column])


def downgrade() -> None:
    op.drop_table("clara_rollout_incidents")
    op.drop_table("clara_rollout_observations")
    op.drop_table("clara_rollout_events")
    op.drop_table("clara_rollout_plans")
