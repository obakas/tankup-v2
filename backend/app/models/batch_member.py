from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, String, Integer, ForeignKey
from app.core.database import Base
from datetime import datetime
from sqlalchemy import Column, DateTime
# import uuid

class BatchMember(Base):
    __tablename__ = "batch_members"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    request_id = Column(Integer, ForeignKey("requests.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    volume_liters = Column(Integer)

    requested_volume = Column(Integer)  # e.g. 2000L

    status = Column(String, default="active", nullable=False)
    # active | forfeited | expired | delivered

    payment_status = Column(String, default="pending", nullable=False)
    # pending | paid | forfeited | refunded

    joined_at = Column(DateTime, default=datetime.utcnow)
    payment_deadline = Column(DateTime)
    latitude = Column(Float)
    longitude = Column(Float)
    delivered_at = Column(DateTime, nullable=True)

    customer_confirmed = Column(Boolean, default=False)
    customer_confirmed_at = Column(DateTime, nullable=True)
    delivery_code = Column(String, nullable=True)

    # refund fields
    refund_status = Column(String, default="none", nullable=False)  
    # values: none | pending | processing | refunded | failed | forfeited

    refund_amount = Column(Float, nullable=True)
    refunded_at = Column(DateTime, nullable=True)
    refund_reference = Column(String, nullable=True, unique=True)
    refund_failure_reason = Column(String, nullable=True)

    # optional but useful
    refund_requested_at = Column(DateTime, nullable=True)
    # OPTIONAL but STRONGLY recommended
    amount_paid = Column(Float, nullable=True)