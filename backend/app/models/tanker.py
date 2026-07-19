from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, ForeignKey
from app.core.database import Base


class Tanker(Base):
    __tablename__ = "tankers"

    id = Column(Integer, primary_key=True, index=True)

    driver_name = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    tank_plate_number = Column(String, unique=True, nullable=False)
    fleet_number = Column(String, nullable=True)
    hub_id = Column(Integer, ForeignKey("hubs.id"), nullable=True)

    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    last_location_update_at = Column(DateTime, nullable=True)

    status = Column(String, default="available", nullable=False)
    is_available = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)

    current_request_id = Column(Integer, nullable=True)
    paused_until = Column(DateTime, nullable=True)
    is_online = Column(Boolean, default=False, nullable=False)

    # pending offer fields
    pending_offer_type = Column(String, nullable=True)      # "priority" or "batch"
    pending_offer_id = Column(Integer, nullable=True)       # request_id or batch_id
    offer_expires_at = Column(DateTime, nullable=True)
    offer_reminder_sent = Column(Boolean, default=False, nullable=False)

    expo_push_token = Column(String, nullable=True)
    fcm_token = Column(String, nullable=True)

    # driver offline mid-delivery tracking
    last_heartbeat_at = Column(DateTime, nullable=True)
    offline_grace_started_at = Column(DateTime, nullable=True)
    offline_notified_at = Column(DateTime, nullable=True)
    offline_escalated_at = Column(DateTime, nullable=True)
    offline_followup_sent_at = Column(DateTime, nullable=True)