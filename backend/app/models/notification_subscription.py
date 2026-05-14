from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, func

from app.core.database import Base


class NotificationSubscription(Base):
    __tablename__ = "notification_subscriptions"

    id = Column(Integer, primary_key=True, index=True)

    user_type = Column(String, nullable=False)  # client | driver | admin
    user_id = Column(Integer, nullable=True)

    endpoint = Column(Text, nullable=False, unique=True)
    p256dh = Column(Text, nullable=False)
    auth = Column(Text, nullable=False)

    is_active = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())