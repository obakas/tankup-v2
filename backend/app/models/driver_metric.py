from sqlalchemy import Column, Integer, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from app.core.database import Base
from datetime import datetime


class DriverMetric(Base):
    __tablename__ = "driver_metrics"

    id = Column(Integer, primary_key=True, index=True)
    tanker_id = Column(Integer, ForeignKey("tankers.id"), unique=True, nullable=False)

    offers_total = Column(Integer, default=0, nullable=False)
    accepts_total = Column(Integer, default=0, nullable=False)
    declines_total = Column(Integer, default=0, nullable=False)
    timeouts_total = Column(Integer, default=0, nullable=False)

    completed_total = Column(Integer, default=0, nullable=False)
    cancelled_total = Column(Integer, default=0, nullable=False)

    priority_offers_total = Column(Integer, default=0, nullable=False)
    priority_accepts_total = Column(Integer, default=0, nullable=False)
    priority_completed_total = Column(Integer, default=0, nullable=False)

    avg_response_seconds = Column(Float, default=15.0, nullable=False)

    jobs_completed_today = Column(Integer, default=0, nullable=False)
    earnings_today = Column(Float, default=0.0, nullable=False)

    timeout_count_today = Column(Integer, default=0, nullable=False)
    decline_count_today = Column(Integer, default=0, nullable=False)

    last_offered_at = Column(DateTime, nullable=True)
    last_accepted_at = Column(DateTime, nullable=True)
    last_completed_at = Column(DateTime, nullable=True)

    reliability_score_cached = Column(Float, default=0.5, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    tanker = relationship("Tanker", backref="metric")