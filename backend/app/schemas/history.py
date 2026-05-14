from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel

HistoryJobType = Literal["batch", "priority"]


class ClientHistoryItem(BaseModel):
    request_id: int
    delivery_type: HistoryJobType
    request_status: str

    volume_liters: int
    created_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    batch_id: Optional[int] = None
    member_id: Optional[int] = None
    batch_status: Optional[str] = None
    member_status: Optional[str] = None
    payment_status: Optional[str] = None
    refund_status: Optional[str] = None
    amount_paid: Optional[float] = None

    tanker_id: Optional[int] = None
    driver_name: Optional[str] = None

    delivery_id: Optional[int] = None
    delivery_status: Optional[str] = None
    planned_liters: Optional[float] = None
    actual_liters_delivered: Optional[float] = None
    otp_verified: Optional[bool] = None
    delivered_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ClientHistoryResponse(BaseModel):
    user_id: int
    total: int
    items: list[ClientHistoryItem]


class DriverHistoryItem(BaseModel):
    job_type: HistoryJobType
    job_id: int

    tanker_id: int
    tanker_status: Optional[str] = None

    total_stops: int
    delivered_stops: int
    failed_stops: int
    skipped_stops: int

    total_planned_liters: float
    total_actual_liters_delivered: float

    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    last_updated_at: Optional[datetime] = None

    job_status: str
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None

    class Config:
        from_attributes = True


class DriverHistoryResponse(BaseModel):
    tanker_id: int
    total: int
    items: list[DriverHistoryItem]