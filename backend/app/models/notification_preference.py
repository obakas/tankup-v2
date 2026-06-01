from sqlalchemy import Column, Integer, String, DateTime, UniqueConstraint
from sqlalchemy.types import JSON
from sqlalchemy.sql import func

from app.core.database import Base


class NotificationPreference(Base):
    __tablename__ = "notification_preferences"

    id = Column(Integer, primary_key=True, index=True)

    # actor_type: customer | driver | fleet_head | admin
    actor_type = Column(String, nullable=False)
    # actor_id: str(user.id) or str(tanker.id) for customer/driver;
    # admin username for fleet_head/admin
    actor_id = Column(String, nullable=False)

    # dict of category_key -> bool; missing keys treated as True (all-on default)
    preferences = Column(JSON, nullable=False, default=dict)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("actor_type", "actor_id", name="uq_notif_pref_actor"),
    )
