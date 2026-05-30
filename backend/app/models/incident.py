from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from app.core.database import Base


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)

    # Who filed it
    reported_by_driver_id = Column(Integer, ForeignKey("tankers.id"), nullable=True)
    reported_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # What it's linked to
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=True)
    tanker_id = Column(Integer, ForeignKey("tankers.id"), nullable=True)
    delivery_record_id = Column(Integer, nullable=True)  # FK to delivery_records if table exists

    # Incident details
    incident_type = Column(String, nullable=False)
    # SITE_INACCESSIBLE | CUSTOMER_UNAVAILABLE | TANKER_BREAKDOWN | PUMP_FAILURE |
    # OTP_REFUSAL | QUANTITY_DISPUTE | SAFETY_ISSUE | WRONG_LOCATION |
    # PAYMENT_CONFLICT | CUSTOMER_AGGRESSION | DRIVER_MISCONDUCT

    description = Column(Text, nullable=True)

    status = Column(String, default="created", nullable=False)
    # created | escalated | resolved | closed

    source = Column(String, nullable=False)
    # driver_app | customer_app

    resolved_by_admin_id = Column(Integer, nullable=True)
    resolution_note = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    resolved_at = Column(DateTime, nullable=True)
