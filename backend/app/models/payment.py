from sqlalchemy import Column, Integer, String, Float, ForeignKey
from app.core.database import Base
import uuid

class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    batch_id = Column(Integer, ForeignKey("batches.id"))

    amount = Column(Float)
    status = Column(String, default="pending")  # pending, paid
    member_id = Column(Integer, ForeignKey("batch_members.id"))