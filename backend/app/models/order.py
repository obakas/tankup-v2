from sqlalchemy import Column, Integer, String, ForeignKey
from app.core.database import Base
import uuid

class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    tanker_id = Column(Integer, ForeignKey("tankers.id"))

    status = Column(String, default="assigned")  # assigned, in_progress, delivered