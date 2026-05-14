from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float
from app.core.database import Base


class Tanker(Base):
    __tablename__ = "tankers"

    id = Column(Integer, primary_key=True, index=True)

    driver_name = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    tank_plate_number = Column(String, unique=True, nullable=False)

    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    last_location_update_at = Column(DateTime, nullable=True)

    status = Column(String, default="available", nullable=False)
    is_available = Column(Boolean, default=True, nullable=False)

    current_request_id = Column(Integer, nullable=True)
    paused_until = Column(DateTime, nullable=True)
    is_online = Column(Boolean, default=True, nullable=False)

    # pending offer fields
    pending_offer_type = Column(String, nullable=True)      # "priority" or "batch"
    pending_offer_id = Column(Integer, nullable=True)       # request_id or batch_id
    offer_expires_at = Column(DateTime, nullable=True)