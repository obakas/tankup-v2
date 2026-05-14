from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from app.core.database import Base
from datetime import datetime


class JobOffer(Base):
    __tablename__ = "job_offers"

    id = Column(Integer, primary_key=True, index=True)

    tanker_id = Column(Integer, ForeignKey("tankers.id"), nullable=False)
    job_type = Column(String, nullable=False)  # "batch" | "priority"
    request_id = Column(Integer, nullable=True)
    batch_id = Column(Integer, nullable=True)

    zone_key = Column(String, nullable=True)
    estimated_distance_km = Column(Float, nullable=True)
    estimated_eta_minutes = Column(Float, nullable=True)

    offered_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    responded_at = Column(DateTime, nullable=True)
    response_type = Column(String, nullable=True)  # "accepted" | "declined" | "timeout"
    decline_reason = Column(String, nullable=True)

    response_seconds = Column(Float, nullable=True)