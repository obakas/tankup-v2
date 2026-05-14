from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


DeliveryJobType = Literal["batch", "priority"]
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
    job_type: DeliveryJobType

    batch_id: Optional[int] = None
    member_id: Optional[int] = None
    request_id: Optional[int] = None

    tanker_id: int
    user_id: Optional[int] = None
    stop_order: Optional[int] = None

    planned_liters: float
    actual_liters_delivered: Optional[float] = None

    meter_start_reading: Optional[float] = None
    meter_end_reading: Optional[float] = None

    delivery_status: DeliveryStatus

    otp_required: bool
    otp_verified: bool
    delivery_code: Optional[str] = None

    customer_confirmed: bool

    dispatched_at: Optional[datetime] = None
    arrived_at: Optional[datetime] = None
    measurement_started_at: Optional[datetime] = None
    measurement_completed_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None

    latitude: Optional[float] = None
    longitude: Optional[float] = None

    notes: Optional[str] = None
    failure_reason: Optional[str] = None
    photo_proof_url: Optional[str] = None

    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DeliveryCustomerOut(BaseModel):
    user_id: Optional[int] = None
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None


class DeliveryLocationOut(BaseModel):
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class DeliveryTimestampsOut(BaseModel):
    dispatched_at: Optional[datetime] = None
    arrived_at: Optional[datetime] = None
    measurement_started_at: Optional[datetime] = None
    measurement_completed_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None


class DeliveryStopDetailsOut(BaseModel):
    delivery_id: int
    stop_order: Optional[int] = None
    delivery_status: DeliveryStatus

    planned_liters: float
    actual_liters_delivered: Optional[float] = None

    meter_start_reading: Optional[float] = None
    meter_end_reading: Optional[float] = None

    otp_required: bool
    otp_verified: bool
    delivery_code: Optional[str] = None
    customer_confirmed: bool

    customer: DeliveryCustomerOut
    location: DeliveryLocationOut
    timestamps: DeliveryTimestampsOut

    notes: Optional[str] = None
    failure_reason: Optional[str] = None


class DeliveryStopSummaryOut(BaseModel):
    delivery_id: int
    stop_order: Optional[int] = None
    customer_name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    planned_liters: float
    delivery_status: DeliveryStatus


class DeliveryJobMetaOut(BaseModel):
    job_type: DeliveryJobType
    job_id: int
    job_status: str
    total_stops: int
    completed_stops: int
    remaining_stops: int


class DeliveryTankerMetaOut(BaseModel):
    id: int
    driver_name: str
    phone: str
    tank_plate_number: str
    status: str
    is_available: bool


class TankerCurrentStopResponse(BaseModel):
    tanker: DeliveryTankerMetaOut
    job: Optional[DeliveryJobMetaOut] = None
    current_stop: Optional[DeliveryStopDetailsOut] = None
    allowed_actions: list[str] = []
    stops_summary: list[DeliveryStopSummaryOut] = []
    message: Optional[str] = None


class StartMeasurementIn(BaseModel):
    meter_start_reading: float = Field(..., ge=0)


class FinishMeasurementIn(BaseModel):
    meter_end_reading: float = Field(..., ge=0)
    notes: Optional[str] = None


class ConfirmOtpIn(BaseModel):
    otp_code: str = Field(..., min_length=4, max_length=10)


class FailDeliveryIn(BaseModel):
    reason: str = Field(..., min_length=3, max_length=255)


class SkipDeliveryIn(BaseModel):
    reason: str = Field(..., min_length=3, max_length=255)