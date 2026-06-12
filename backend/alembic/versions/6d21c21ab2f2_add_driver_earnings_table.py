"""add_driver_earnings_table

Revision ID: 6d21c21ab2f2
Revises: c227c62ef954
Create Date: 2026-06-12 09:23:26.020945

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '6d21c21ab2f2'
down_revision: Union[str, None] = 'c227c62ef954'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'driver_earnings',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('tanker_id', sa.Integer(), sa.ForeignKey('tankers.id'), nullable=False),
        sa.Column('delivery_record_id', sa.Integer(), sa.ForeignKey('delivery_records.id'), nullable=False),
        sa.Column('job_type', sa.String(), nullable=False),
        sa.Column('job_id', sa.Integer(), nullable=False),
        sa.Column('stop_order', sa.Integer(), nullable=True),
        sa.Column('volume_earnings', sa.Float(), nullable=False, server_default='0'),
        sa.Column('stop_bonus', sa.Float(), nullable=False, server_default='0'),
        sa.Column('site_bonus', sa.Float(), nullable=True),
        sa.Column('total_earnings', sa.Float(), nullable=False, server_default='0'),
        sa.Column('actual_liters_delivered', sa.Float(), nullable=True),
        sa.Column('rate_per_liter', sa.Float(), nullable=False, server_default='0'),
        sa.Column('site_report_submitted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('site_report_submitted_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_driver_earnings_id', 'driver_earnings', ['id'], unique=False)
    op.create_index('ix_driver_earnings_tanker_id', 'driver_earnings', ['tanker_id'], unique=False)
    op.create_unique_constraint('uq_driver_earnings_delivery_record_id', 'driver_earnings', ['delivery_record_id'])


def downgrade() -> None:
    op.drop_constraint('uq_driver_earnings_delivery_record_id', 'driver_earnings', type_='unique')
    op.drop_index('ix_driver_earnings_tanker_id', table_name='driver_earnings')
    op.drop_index('ix_driver_earnings_id', table_name='driver_earnings')
    op.drop_table('driver_earnings')
