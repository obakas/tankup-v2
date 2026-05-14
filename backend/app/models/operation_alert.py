from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text

from app.core.database import Base


class OperationAlert(Base):
    __tablename__ = "operation_alerts"

    id = Column(Integer, primary_key=True, index=True)

    alert_type = Column(String, nullable=False, index=True)
    severity = Column(String, default="warning", nullable=False, index=True)

    job_type = Column(String, nullable=False, index=True)  # batch / priority / tanker / delivery
    job_id = Column(Integer, nullable=False, index=True)

    request_id = Column(Integer, nullable=True, index=True)
    batch_id = Column(Integer, nullable=True, index=True)
    tanker_id = Column(Integer, nullable=True, index=True)

    message = Column(Text, nullable=False)
    status = Column(String, default="open", nullable=False, index=True)  # open / resolved

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    resolved_at = Column(DateTime, nullable=True)