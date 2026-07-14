"""add_fcm_token_to_tankers

Revision ID: b8f2c4d6e9a1
Revises: ad0f3accd208
Create Date: 2026-07-13 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b8f2c4d6e9a1"
down_revision: Union[str, None] = "ad0f3accd208"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "tankers",
        sa.Column("fcm_token", sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("tankers", "fcm_token")
