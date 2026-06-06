"""add site_verified to delivery_records

Revision ID: 61b3794d5337
Revises: 7184a0b9e8de
Create Date: 2026-06-06 07:26:57.881329

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '61b3794d5337'
down_revision: Union[str, None] = '7184a0b9e8de'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('delivery_records', sa.Column('site_verified', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('delivery_records', sa.Column('site_verified_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column('delivery_records', 'site_verified_at')
    op.drop_column('delivery_records', 'site_verified')
