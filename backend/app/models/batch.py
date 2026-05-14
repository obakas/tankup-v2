from datetime import datetime

from sqlalchemy import Column, String, Integer, Float, ForeignKey, DateTime

from app.core.database import Base


class Batch(Base):
    __tablename__ = "batches"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    liquid_id = Column(Integer)

    current_volume = Column(Float, default=0)
    target_volume = Column(Float, default=10000)

    volume_liters = Column(Integer)
    latitude = Column(Float)
    longitude = Column(Float)

    status = Column(String, default="forming")
    base_price = Column(Float, default=40000)

    tanker_id = Column(Integer, ForeignKey("tankers.id"), nullable=True)
    assignment_started_at = Column(DateTime, nullable=True)
    assignment_failed_at = Column(DateTime, nullable=True)
    loading_deadline = Column(DateTime, nullable=True)
    delivering_started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    search_radius_km = Column(Float, default=1.0)
    expires_at = Column(DateTime, nullable=True)
    last_health_check_at = Column(DateTime, nullable=True)
    assigned_at = Column(DateTime, nullable=True)
    last_radius_expansion_at = Column(DateTime, nullable=True)
