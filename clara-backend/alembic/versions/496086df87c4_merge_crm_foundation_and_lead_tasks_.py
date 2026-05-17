"""merge crm foundation and lead tasks heads

Revision ID: 496086df87c4
Revises: e7f8a9b0c1d2, f4a1b2c3d4e5
Create Date: 2026-05-18 00:39:59.441466

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '496086df87c4'
down_revision: Union[str, Sequence[str], None] = ('e7f8a9b0c1d2', 'f4a1b2c3d4e5')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
