"""harden complaint incident identity

Revision ID: e9f0a1b2c3d4
Revises: d8e9f0a1b2c3
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "e9f0a1b2c3d4"
down_revision: str | Sequence[str] | None = "d8e9f0a1b2c3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "complaint_cases", sa.Column("issue_signature", sa.String(64), nullable=True)
    )
    op.add_column(
        "complaint_cases", sa.Column("incident_bucket", sa.String(30), nullable=True)
    )
    op.execute(
        "UPDATE complaint_cases SET issue_signature = fingerprint, incident_bucket = 'LEGACY_STAGE_8' WHERE issue_signature IS NULL"
    )
    op.alter_column("complaint_cases", "issue_signature", nullable=False)
    op.alter_column("complaint_cases", "incident_bucket", nullable=False)
    op.create_index(
        "ix_complaint_cases_issue_signature", "complaint_cases", ["issue_signature"]
    )
    op.create_index(
        "ix_complaint_cases_incident_bucket", "complaint_cases", ["incident_bucket"]
    )


def downgrade() -> None:
    op.drop_index("ix_complaint_cases_incident_bucket", table_name="complaint_cases")
    op.drop_index("ix_complaint_cases_issue_signature", table_name="complaint_cases")
    op.drop_column("complaint_cases", "incident_bucket")
    op.drop_column("complaint_cases", "issue_signature")
