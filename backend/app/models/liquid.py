from sqlalchemy import Column, Integer, String, Boolean
from app.core.database import Base
import uuid

class Liquid(Base):
    __tablename__ = "liquids"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)  # water, diesel
    is_hazardous = Column(Boolean, default=False)