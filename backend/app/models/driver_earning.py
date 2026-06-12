from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String

from app.core.database import Base


class DriverEarning(Base):
    __tablename__ = "driver_earnings"

    id = Column(Integer, primary_key=True, index=True)

    tanker_id = Column(Integer, ForeignKey("tankers.id"), nullable=False, index=True)
    delivery_record_id = Column(Integer, ForeignKey("delivery_records.id"), unique=True, nullable=False)

    job_type = Column(String, nullable=False)   # "batch" | "priority"
    job_id = Column(Integer, nullable=False)    # batch_id or request_id
    stop_order = Column(Integer, nullable=True)

    volume_earnings = Column(Float, nullable=False, default=0.0)
    stop_bonus = Column(Float, nullable=False, default=0.0)
    # None = form window open; 0 = skipped; 1000 = submitted
    site_bonus = Column(Float, nullable=True)
    total_earnings = Column(Float, nullable=False, default=0.0)

    actual_liters_delivered = Column(Float, nullable=True)
    rate_per_liter = Column(Float, nullable=False, default=0.0)

    site_report_submitted = Column(Boolean, nullable=False, default=False)
    site_report_submitted_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
