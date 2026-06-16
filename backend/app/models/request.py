from datetime import datetime

from sqlalchemy import Column, Integer, Float, ForeignKey, String, DateTime, Boolean
from app.core.database import Base


class LiquidRequest(Base):
    __tablename__ = "requests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    liquid_id = Column(Integer, nullable=False)

    volume_liters = Column(Integer, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)

    delivery_type = Column(String, nullable=False)   # batch or priority
    is_asap = Column(Boolean, default=False)         # meaningful only for priority
    scheduled_for = Column(DateTime, nullable=True)  # meaningful only for priority

    status = Column(String, default="pending")

    # Assignment reliability fields
    retry_count = Column(Integer, default=0, nullable=False)
    last_offer_at = Column(DateTime, nullable=True)
    assignment_failed_reason = Column(String, nullable=True)
    assignment_started_at = Column(DateTime, nullable=True)
    assignment_failed_at = Column(DateTime, nullable=True)
    refund_eligible = Column(Boolean, default=False, nullable=False)

    site_profile_id = Column(Integer, ForeignKey("customer_site_profiles.id"), nullable=True)

    loading_deadline = Column(DateTime, nullable=True)
    accepted_at = Column(DateTime, nullable=True)
    delivering_started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    idempotency_key = Column(String, nullable=True, index=True)

    # Mid-delivery cancellation fields (priority only)
    cancelled_at = Column(DateTime, nullable=True)
    # pre_loading | en_route | arrived | partial_delivery
    cancellation_stage = Column(String, nullable=True)
    # fraction of price to refund: 0.0 = forfeit, 0.5 = half back, etc.
    cancellation_refund_pct = Column(Float, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
