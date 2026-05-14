from typing import Optional, Literal
from datetime import datetime
from pydantic import BaseModel


DeliveryStatus = Literal[
    "pending",
    "en_route",
    "arrived",
    "measuring",
    "awaiting_otp",
    "delivered",
    "failed",
    "skipped",
]


class DeliveryOut(BaseModel):
    id: int
    job_type: Literal["batch", "priority"]
    batch_id: Optional[int] = None
    member_id: Optional[int] = None
    request_id: Optional[int] = None
    tanker_id: int
    stop_order: Optional[int] = None
    planned_liters: float
    actual_liters_delivered: Optional[float] = None
    meter_start_reading: Optional[float] = None
    meter_end_reading: Optional[float] = None
    delivery_status: DeliveryStatus
    otp_required: bool
    otp_verified: bool
    customer_confirmed: bool
    dispatched_at: Optional[datetime] = None
    arrived_at: Optional[datetime] = None
    measurement_started_at: Optional[datetime] = None
    measurement_completed_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    notes: Optional[str] = None
    failure_reason: Optional[str] = None

    class Config:
        from_attributes = True