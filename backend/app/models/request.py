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

    loading_deadline = Column(DateTime, nullable=True)
    accepted_at = Column(DateTime, nullable=True)
    delivering_started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
