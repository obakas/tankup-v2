from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer
from app.core.database import Base


class BatchNotificationLog(Base):
    __tablename__ = "batch_notification_logs"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    sent_at = Column(DateTime, default=datetime.utcnow, nullable=False)
