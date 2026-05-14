from datetime import datetime
from typing import Optional, Literal

from pydantic import BaseModel, field_validator


TankerStatus = Literal[
    "available",
    "assigned",
    "loading",
    "delivering",
    "arrived",
    "completed",
    "offline",
]


class TankerBase(BaseModel):
    driver_name: str
    phone: Optional[str] = None
    tank_plate_number: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class TankerCreate(TankerBase):

    @field_validator("tank_plate_number")
    @classmethod
    def normalize_plate(cls, v: str) -> str:
        return v.upper().strip()


class TankerUpdate(BaseModel):
    driver_name: Optional[str] = None
    phone: Optional[str] = None
    tank_plate_number: Optional[str] = None
    is_available: Optional[bool] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class TankerLocationUpdate(BaseModel):
    latitude: float
    longitude: float


class TankerLocationOut(BaseModel):
    tanker_id: int
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    last_location_update_at: Optional[datetime] = None
    tanker_status: str
    is_available: bool

    class Config:
        from_attributes = True


class TankerOut(TankerBase):
    id: int
    status: TankerStatus
    is_available: bool
    current_request_id: Optional[int] = None
    last_location_update_at: Optional[datetime] = None

    class Config:
        from_attributes = True