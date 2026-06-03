"""add_tank_floor_level_and_photo_to_site

Revision ID: f3a9c1d2b4e5
Revises: a1b2c3d4e5f6
Create Date: 2026-06-03 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f3a9c1d2b4e5"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "customer_site_profiles",
        sa.Column("tank_floor_level", sa.String(), nullable=True),
    )
    op.add_column(
        "customer_site_profiles",
        sa.Column("tank_photo_url", sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("customer_site_profiles", "tank_photo_url")
    op.drop_column("customer_site_profiles", "tank_floor_level")
