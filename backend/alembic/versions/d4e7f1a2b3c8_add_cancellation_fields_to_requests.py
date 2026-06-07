"""add_cancellation_fields_to_requests

Revision ID: d4e7f1a2b3c8
Revises: f3a9c1d2b4e5
Create Date: 2026-06-06 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d4e7f1a2b3c8"
down_revision: Union[str, None] = "61b3794d5337"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("requests", sa.Column("cancelled_at", sa.DateTime(), nullable=True))
    op.add_column("requests", sa.Column("cancellation_stage", sa.String(), nullable=True))
    op.add_column("requests", sa.Column("cancellation_refund_pct", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("requests", "cancellation_refund_pct")
    op.drop_column("requests", "cancellation_stage")
    op.drop_column("requests", "cancelled_at")
