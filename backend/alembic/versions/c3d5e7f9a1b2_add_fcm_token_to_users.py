"""add_fcm_token_to_users

Revision ID: c3d5e7f9a1b2
Revises: a1e2b9d9a399
Create Date: 2026-07-30 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c3d5e7f9a1b2"
down_revision: Union[str, None] = "a1e2b9d9a399"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("fcm_token", sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "fcm_token")
