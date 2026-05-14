import datetime
from typing import Optional, List, Literal
from pydantic import BaseModel


class DeliveryPlanStop(BaseModel):
    member_id: int
    request_id: Optional[int] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    volume_liters: Optional[int] = None
    sequence: int


class AssignedTankerSnapshot(BaseModel):
    tanker_id: int
    driver_name: str
    phone: str
    tank_plate_number: str
    status: str


class BatchLiveResponse(BaseModel):
    batch_id: int
    status: Literal[
        "forming",
        "near_ready",
        "ready_for_assignment",
        "assigned",
        "loading",
        "delivering",
        "arrived",
        "completed",
        "partially_completed",
        "failed",
        "expired",
        "assignment_failed",
    ]
    current_volume: float
    target_volume: float
    progress_percent: float
    member_count: int

    tanker_id: Optional[int] = None
    driver_name: Optional[str] = None
    tanker_status: Optional[str] = None
    tanker_phone: Optional[str] = None

    tanker_latitude: Optional[float] = None
    tanker_longitude: Optional[float] = None
    last_location_update_at: Optional[datetime.datetime] = None

    customer_latitude: Optional[float] = None
    customer_longitude: Optional[float] = None

    otp: Optional[str] = None
    is_member_active: Optional[bool] = None
    refund_eligible: Optional[bool] = None

    member_id: Optional[int] = None
    member_status: Optional[str] = None
    member_payment_status: Optional[str] = None

    refund_status: Optional[str] = None
    refund_amount: Optional[float] = None
    refunded_at: Optional[datetime.datetime] = None
    refund_reference: Optional[str] = None
    member_delivery_id: Optional[int] = None
    member_delivery_status: Optional[Literal["pending", "en_route", "arrived", "measuring", "awaiting_otp", "delivered", "failed", "skipped"]] = None
    member_delivery_code: Optional[str] = None
    otp_verified: Optional[bool] = None
    otp_required: Optional[bool] = None

    planned_liters: Optional[float] = None
    actual_liters_delivered: Optional[float] = None
    meter_start_reading: Optional[float] = None
    meter_end_reading: Optional[float] = None

    arrived_at: Optional[datetime.datetime] = None
    measurement_started_at: Optional[datetime.datetime] = None
    measurement_completed_at: Optional[datetime.datetime] = None
    delivered_at: Optional[datetime.datetime] = None

    failure_reason: Optional[str] = None
    notes: Optional[str] = None
