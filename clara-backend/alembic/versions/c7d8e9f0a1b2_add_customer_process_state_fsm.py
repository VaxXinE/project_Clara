"""add customer process state FSM

Revision ID: c7d8e9f0a1b2
Revises: f0a1b2c3d4e5
Create Date: 2026-07-31 16:00:00.000000
"""

from collections.abc import Sequence
from datetime import datetime, timezone
from uuid import uuid4

from alembic import op
import sqlalchemy as sa


revision: str = "c7d8e9f0a1b2"
down_revision: str | Sequence[str] | None = "f0a1b2c3d4e5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


PROCESS_STATES = (
    "UNKNOWN",
    "NEW_INQUIRY",
    "EXPLORATION",
    "READY_TO_PROCEED",
    "DATA_SUBMITTED",
    "VERIFICATION_IN_PROGRESS",
    "VERIFIED",
    "ONBOARDING_OR_ACTIVATION",
    "ACCOUNT_ACTIVE",
    "FUNDED",
    "ACTIVE_SUPPORT",
)


def upgrade() -> None:
    op.create_table(
        "customer_process_states",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=True),
        sa.Column("customer_profile_id", sa.Uuid(), nullable=False),
        sa.Column("current_state", sa.String(length=40), nullable=False),
        sa.Column("state_rank", sa.Integer(), nullable=False),
        sa.Column("confidence_score", sa.Float(), nullable=False),
        sa.Column("source_type", sa.String(length=50), nullable=False),
        sa.Column("source_reference_type", sa.String(length=50), nullable=True),
        sa.Column("source_reference_id", sa.Uuid(), nullable=True),
        sa.Column("source_trust_level", sa.String(length=20), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("manual_lock", sa.Boolean(), nullable=False),
        sa.Column("last_confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_transition_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            f"current_state IN {PROCESS_STATES}",
            name="ck_customer_process_states_current_state",
        ),
        sa.CheckConstraint("state_rank >= 0", name="ck_customer_process_states_rank"),
        sa.CheckConstraint("version > 0", name="ck_customer_process_states_version"),
        sa.ForeignKeyConstraint(
            ["organization_id"], ["organizations.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["customer_profile_id"], ["customer_profiles.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "customer_profile_id",
            name="uq_customer_process_states_customer_profile_id",
        ),
    )
    op.create_index(
        "ix_customer_process_states_organization_id",
        "customer_process_states",
        ["organization_id"],
    )
    op.create_index(
        "ix_customer_process_states_customer_profile_id",
        "customer_process_states",
        ["customer_profile_id"],
    )
    op.create_table(
        "customer_process_state_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("process_state_id", sa.Uuid(), nullable=False),
        sa.Column("customer_profile_id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=True),
        sa.Column("previous_state", sa.String(length=40), nullable=False),
        sa.Column("proposed_state", sa.String(length=40), nullable=False),
        sa.Column("applied_state", sa.String(length=40), nullable=False),
        sa.Column("decision", sa.String(length=50), nullable=False),
        sa.Column("transition_type", sa.String(length=50), nullable=False),
        sa.Column("source_type", sa.String(length=50), nullable=False),
        sa.Column("source_reference_type", sa.String(length=50), nullable=True),
        sa.Column("source_reference_id", sa.Uuid(), nullable=True),
        sa.Column("evidence_codes", sa.JSON(), nullable=False),
        sa.Column("confidence_score", sa.Float(), nullable=False),
        sa.Column("source_trust_level", sa.String(length=20), nullable=False),
        sa.Column("actor_user_id", sa.Uuid(), nullable=True),
        sa.Column("reason_codes", sa.JSON(), nullable=False),
        sa.Column("correlation_id", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["process_state_id"], ["customer_process_states.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["customer_profile_id"], ["customer_profiles.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"], ["organizations.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    for column in ("process_state_id", "customer_profile_id", "organization_id", "decision", "correlation_id"):
        op.create_index(
            f"ix_customer_process_state_events_{column}",
            "customer_process_state_events",
            [column],
        )
    _backfill_unknown_states()


def _backfill_unknown_states() -> None:
    connection = op.get_bind()
    profiles = sa.table(
        "customer_profiles",
        sa.column("id", sa.Uuid()),
        sa.column("organization_id", sa.Uuid()),
        sa.column("merged_into_profile_id", sa.Uuid()),
    )
    states = sa.table(
        "customer_process_states",
        sa.column("id", sa.Uuid()),
        sa.column("organization_id", sa.Uuid()),
        sa.column("customer_profile_id", sa.Uuid()),
        sa.column("current_state", sa.String()),
        sa.column("state_rank", sa.Integer()),
        sa.column("confidence_score", sa.Float()),
        sa.column("source_type", sa.String()),
        sa.column("source_reference_type", sa.String()),
        sa.column("source_reference_id", sa.Uuid()),
        sa.column("source_trust_level", sa.String()),
        sa.column("version", sa.Integer()),
        sa.column("manual_lock", sa.Boolean()),
        sa.column("last_confirmed_at", sa.DateTime(timezone=True)),
        sa.column("last_transition_at", sa.DateTime(timezone=True)),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("updated_at", sa.DateTime(timezone=True)),
    )
    now = datetime.now(timezone.utc)
    rows = connection.execute(
        sa.select(profiles.c.id, profiles.c.organization_id).where(
            profiles.c.merged_into_profile_id.is_(None),
            ~sa.exists().where(states.c.customer_profile_id == profiles.c.id),
        )
    ).all()
    for profile_id, organization_id in rows:
        connection.execute(
            states.insert().values(
                id=uuid4(),
                organization_id=organization_id,
                customer_profile_id=profile_id,
                current_state="UNKNOWN",
                state_rank=0,
                confidence_score=0,
                source_type="MIGRATION_BACKFILL",
                source_reference_type=None,
                source_reference_id=None,
                source_trust_level="LOW",
                version=1,
                manual_lock=False,
                last_confirmed_at=None,
                last_transition_at=None,
                created_at=now,
                updated_at=now,
            )
        )


def downgrade() -> None:
    for column in ("correlation_id", "decision", "organization_id", "customer_profile_id", "process_state_id"):
        op.drop_index(
            f"ix_customer_process_state_events_{column}",
            table_name="customer_process_state_events",
        )
    op.drop_table("customer_process_state_events")
    op.drop_index(
        "ix_customer_process_states_customer_profile_id",
        table_name="customer_process_states",
    )
    op.drop_index(
        "ix_customer_process_states_organization_id",
        table_name="customer_process_states",
    )
    op.drop_table("customer_process_states")
