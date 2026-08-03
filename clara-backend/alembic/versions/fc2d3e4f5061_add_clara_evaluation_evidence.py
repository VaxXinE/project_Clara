"""add Clara Golden V2 evaluation evidence

Revision ID: fc2d3e4f5061
Revises: fb1c2d3e4f50
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "fc2d3e4f5061"
down_revision: str | Sequence[str] | None = "fb1c2d3e4f50"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "clara_evaluation_runs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=True),
        sa.Column("persona_bundle_id", sa.Uuid(), nullable=False),
        sa.Column("persona_bundle_hash", sa.String(64), nullable=False),
        sa.Column("bundle_section_metadata", sa.JSON(), nullable=False),
        sa.Column("variant", sa.String(20), nullable=False),
        sa.Column("dataset_version", sa.String(20), nullable=False),
        sa.Column("dataset_hash", sa.String(64), nullable=False),
        sa.Column("evaluator_version", sa.String(20), nullable=False),
        sa.Column("configuration_profile", sa.String(50), nullable=False),
        sa.Column("configuration_snapshot", sa.JSON(), nullable=False),
        sa.Column("configuration_hash", sa.String(64), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("automated_verdict", sa.String(30), nullable=True),
        sa.Column("critical_failure_count", sa.Integer(), nullable=False),
        sa.Column("review_required_count", sa.Integer(), nullable=False),
        sa.Column("passed_case_count", sa.Integer(), nullable=False),
        sa.Column("failed_case_count", sa.Integer(), nullable=False),
        sa.Column("human_review_status", sa.String(30), nullable=False),
        sa.Column("certification_status", sa.String(30), nullable=False),
        sa.Column("report_hash", sa.String(64), nullable=True),
        sa.Column("created_by_user_id", sa.Uuid(), nullable=True),
        sa.Column("completed_by_user_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("superseded_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "status IN ('DRAFT','RUNNING','AUTOMATED_PASS','AUTOMATED_FAIL','HUMAN_REVIEW_PENDING','CERTIFIED','REJECTED','SUPERSEDED','ERROR')",
            name="ck_clara_evaluation_runs_status",
        ),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["persona_bundle_id"], ["ai_persona_bundles.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["completed_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_clara_evaluation_runs_organization_id", "clara_evaluation_runs", ["organization_id"])
    op.create_index("ix_clara_evaluation_runs_persona_bundle_id", "clara_evaluation_runs", ["persona_bundle_id"])
    op.create_index("ix_clara_evaluation_runs_bundle_status", "clara_evaluation_runs", ["persona_bundle_id", "status"])
    op.create_table(
        "clara_evaluation_case_results",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("evaluation_run_id", sa.Uuid(), nullable=False),
        sa.Column("case_id", sa.String(100), nullable=False),
        sa.Column("category", sa.String(40), nullable=False),
        sa.Column("authority_mode", sa.String(20), nullable=False),
        sa.Column("output_hash", sa.String(64), nullable=False),
        sa.Column("automated_verdict", sa.String(30), nullable=False),
        sa.Column("structural_match", sa.Boolean(), nullable=False),
        sa.Column("findings", sa.JSON(), nullable=False),
        sa.Column("evaluated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["evaluation_run_id"], ["clara_evaluation_runs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("evaluation_run_id", "case_id", "authority_mode", name="uq_clara_eval_case_mode"),
    )
    op.create_index("ix_clara_evaluation_case_results_evaluation_run_id", "clara_evaluation_case_results", ["evaluation_run_id"])
    op.create_index("ix_clara_evaluation_case_results_case_id", "clara_evaluation_case_results", ["case_id"])
    op.create_index("ix_clara_evaluation_case_results_category", "clara_evaluation_case_results", ["category"])
    op.create_table(
        "clara_evaluation_human_reviews",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("evaluation_run_id", sa.Uuid(), nullable=False),
        sa.Column("case_id", sa.String(100), nullable=False),
        sa.Column("category", sa.String(40), nullable=False),
        sa.Column("reviewer_user_id", sa.Uuid(), nullable=False),
        sa.Column("scores", sa.JSON(), nullable=False),
        sa.Column("average_score", sa.String(10), nullable=False),
        sa.Column("hard_fail", sa.Boolean(), nullable=False),
        sa.Column("reason_codes", sa.JSON(), nullable=False),
        sa.Column("safe_note", sa.Text(), nullable=True),
        sa.Column("reconciliation_status", sa.String(30), nullable=False),
        sa.Column("reconciled_scores", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["evaluation_run_id"], ["clara_evaluation_runs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["reviewer_user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("evaluation_run_id", "case_id", "reviewer_user_id", name="uq_clara_eval_human_reviewer"),
    )
    op.create_index("ix_clara_evaluation_human_reviews_evaluation_run_id", "clara_evaluation_human_reviews", ["evaluation_run_id"])
    op.create_index("ix_clara_evaluation_human_reviews_case_id", "clara_evaluation_human_reviews", ["case_id"])
    op.create_index("ix_clara_evaluation_human_reviews_reviewer_user_id", "clara_evaluation_human_reviews", ["reviewer_user_id"])


def downgrade() -> None:
    op.drop_table("clara_evaluation_human_reviews")
    op.drop_table("clara_evaluation_case_results")
    op.drop_table("clara_evaluation_runs")
