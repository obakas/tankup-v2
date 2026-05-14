from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
)

from app.core.database import Base


class DeliveryRecord(Base):
    __tablename__ = "delivery_records"

    id = Column(Integer, primary_key=True, index=True)

    # batch | priority
    job_type = Column(String, nullable=False)

    # exactly one of these should be used depending on job_type
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=True)
    member_id = Column(Integer, ForeignKey("batch_members.id"), nullable=True)
    request_id = Column(Integer, ForeignKey("requests.id"), nullable=True)

    tanker_id = Column(Integer, ForeignKey("tankers.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    stop_order = Column(Integer, nullable=True)

    planned_liters = Column(Float, nullable=False)
    actual_liters_delivered = Column(Float, nullable=True)

    meter_start_reading = Column(Float, nullable=True)
    meter_end_reading = Column(Float, nullable=True)

    # pending | en_route | arrived | measuring | awaiting_otp | delivered | failed | skipped
    delivery_status = Column(String, default="pending", nullable=False)

    # trust controls
    measurement_required = Column(Boolean, default=True, nullable=False)
    measurement_valid = Column(Boolean, default=False, nullable=False)
    anomaly_flagged = Column(Boolean, default=False, nullable=False)
    anomaly_reason = Column(String, nullable=True)

    otp_required = Column(Boolean, default=True, nullable=False)
    otp_verified = Column(Boolean, default=False, nullable=False)
    otp_verified_at = Column(DateTime, nullable=True)
    otp_expires_at = Column(DateTime, nullable=True)
    otp_consumed_at = Column(DateTime, nullable=True)
    otp_invalid_attempts = Column(Integer, default=0, nullable=False)

    # store OTP here so batch + priority can share one flow
    delivery_code = Column(String, nullable=True)

    customer_confirmed = Column(Boolean, default=False, nullable=False)
    customer_confirmed_at = Column(DateTime, nullable=True)

    dispatched_at = Column(DateTime, nullable=True)
    arrived_at = Column(DateTime, nullable=True)
    measurement_started_at = Column(DateTime, nullable=True)
    measurement_completed_at = Column(DateTime, nullable=True)
    delivered_at = Column(DateTime, nullable=True)
    failed_at = Column(DateTime, nullable=True)
    skipped_at = Column(DateTime, nullable=True)

    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)

    notes = Column(String, nullable=True)
    failure_reason = Column(String, nullable=True)
    skip_reason = Column(String, nullable=True)

    photo_proof_url = Column(String, nullable=True)
    
    batch_member_id = Column(Integer, ForeignKey("batch_members.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )