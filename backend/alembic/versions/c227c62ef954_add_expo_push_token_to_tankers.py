"""add expo_push_token to tankers

Revision ID: c227c62ef954
Revises: d4e7f1a2b3c8
Create Date: 2026-06-07 21:26:13.217540

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'c227c62ef954'
down_revision: Union[str, None] = 'd4e7f1a2b3c8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('tankers', sa.Column('expo_push_token', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('tankers', 'expo_push_token')
