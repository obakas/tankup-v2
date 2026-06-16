"""add_idempotency_key_to_requests

Revision ID: b2c3d4e5f6a7
Revises: f3a9c1d2b4e5
Create Date: 2026-06-16 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, None] = "911bce4277c5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("requests", sa.Column("idempotency_key", sa.String(), nullable=True))
    op.create_index("ix_requests_idempotency_key", "requests", ["idempotency_key"])


def downgrade() -> None:
    op.drop_index("ix_requests_idempotency_key", table_name="requests")
    op.drop_column("requests", "idempotency_key")
