from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.core.database import Base


class CustomerSiteProfile(Base):
    __tablename__ = "customer_site_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Identity
    label = Column(String, nullable=True)           # e.g. "Home", "Office"
    address = Column(String, nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    landmark_notes = Column(String, nullable=True)

    # Tank info — customer-submitted estimates
    tank_capacity_liters = Column(Integer, nullable=True)
    tank_height_m = Column(Float, nullable=True)
    hose_distance_m = Column(Float, nullable=True)
    # values: ground | first_floor | second_floor | third_floor | rooftop
    tank_floor_level = Column(String, nullable=True)
    tank_photo_url = Column(String, nullable=True)

    # Accessibility — 1 (easy) to 5 (very hard), customer-submitted
    road_difficulty = Column(Integer, default=1, nullable=False)
    parking_difficulty = Column(Integer, default=1, nullable=False)
    has_gate = Column(Boolean, default=False, nullable=False)
    gate_notes = Column(String, nullable=True)

    # Operational history — updated by the system after each delivery
    delivery_count = Column(Integer, default=0, nullable=False)
    avg_delivery_duration_minutes = Column(Float, nullable=True)
    pump_stress_count = Column(Integer, default=0, nullable=False)
    rejection_count = Column(Integer, default=0, nullable=False)
    incident_count = Column(Integer, default=0, nullable=False)
    dispute_count = Column(Integer, default=0, nullable=False)
    anomaly_count = Column(Integer, default=0, nullable=False)

    # Trust scores: 0.0 (untrustworthy) to 1.0 (fully trusted)
    truthfulness_score = Column(Float, default=1.0, nullable=False)
    cooperation_score = Column(Float, default=1.0, nullable=False)

    # Terrain — fetched from Open-Elevation API at site creation time
    terrain_elevation_m = Column(Float, nullable=True)

    # Verification lifecycle
    # values: unverified | partially_verified | verified | high_risk | restricted
    verification_status = Column(String, default="unverified", nullable=False)

    # Driver-verified measurements — set after field visits
    driver_verified_tank_height_m = Column(Float, nullable=True)
    driver_verified_hose_distance_m = Column(Float, nullable=True)
    driver_verified_road_difficulty = Column(Integer, nullable=True)
    last_verified_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    user = relationship("User", backref="site_profiles")
