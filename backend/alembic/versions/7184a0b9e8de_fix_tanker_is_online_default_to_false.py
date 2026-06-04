"""fix tanker is_online default to false

Revision ID: 7184a0b9e8de
Revises: f3a9c1d2b4e5
Create Date: 2026-06-04 20:38:50.444163

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7184a0b9e8de'
down_revision: Union[str, None] = 'f3a9c1d2b4e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        'tankers', 'is_online',
        existing_type=sa.Boolean(),
        server_default=sa.false(),
        existing_nullable=False,
    )
    # Mark all idle tankers offline — only those not actively in a delivery
    op.execute(
        "UPDATE tankers SET is_online = FALSE "
        "WHERE status = 'available'"
    )


def downgrade() -> None:
    op.alter_column(
        'tankers', 'is_online',
        existing_type=sa.Boolean(),
        server_default=sa.true(),
        existing_nullable=False,
    )
