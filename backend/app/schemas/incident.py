from datetime import datetime
from typing import Optional
from pydantic import BaseModel


VALID_INCIDENT_TYPES = {
    "SITE_INACCESSIBLE",
    "CUSTOMER_UNAVAILABLE",
    "TANKER_BREAKDOWN",
    "PUMP_FAILURE",
    "OTP_REFUSAL",
    "QUANTITY_DISPUTE",
    "SAFETY_ISSUE",
    "WRONG_LOCATION",
    "PAYMENT_CONFLICT",
    "CUSTOMER_AGGRESSION",
    "DRIVER_MISCONDUCT",
}

CUSTOMER_INCIDENT_TYPES = {
    "DRIVER_MISCONDUCT",
    "QUANTITY_DISPUTE",
    "PAYMENT_CONFLICT",
    "WRONG_LOCATION",
    "SAFETY_ISSUE",
}


class IncidentCreate(BaseModel):
    incident_type: str
    description: Optional[str] = None
    batch_id: Optional[int] = None
    tanker_id: Optional[int] = None
    delivery_record_id: Optional[int] = None
    # reporter identity — one must be set by the route handler
    reported_by_driver_id: Optional[int] = None
    reported_by_user_id: Optional[int] = None
    source: str  # driver_app | customer_app


class IncidentResolve(BaseModel):
    resolution_note: Optional[str] = None
    new_status: str  # escalated | resolved | closed


class IncidentOut(BaseModel):
    id: int
    incident_type: str
    description: Optional[str]
    status: str
    source: str
    batch_id: Optional[int]
    tanker_id: Optional[int]
    delivery_record_id: Optional[int]
    reported_by_driver_id: Optional[int]
    reported_by_user_id: Optional[int]
    resolution_note: Optional[str]
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime]

    class Config:
        from_attributes = True
