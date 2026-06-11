from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class SiteProfileCreate(BaseModel):
    user_id: int
    latitude: float
    longitude: float
    label: Optional[str] = None
    address: Optional[str] = None
    landmark_notes: Optional[str] = None
    tank_capacity_liters: Optional[int] = None
    tank_height_m: Optional[float] = None
    hose_distance_m: Optional[float] = None
    tank_floor_level: Optional[str] = None
    road_difficulty: int = Field(default=1, ge=1, le=5)
    parking_difficulty: int = Field(default=1, ge=1, le=5)
    has_gate: bool = False
    gate_notes: Optional[str] = None


class SiteProfileUpdate(BaseModel):
    label: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    landmark_notes: Optional[str] = None
    tank_capacity_liters: Optional[int] = None
    tank_height_m: Optional[float] = None
    hose_distance_m: Optional[float] = None
    tank_floor_level: Optional[str] = None
    road_difficulty: Optional[int] = Field(default=None, ge=1, le=5)
    parking_difficulty: Optional[int] = Field(default=None, ge=1, le=5)
    has_gate: Optional[bool] = None
    gate_notes: Optional[str] = None
    # Driver-verified fields (submitted by driver or fleet head)
    driver_verified_tank_height_m: Optional[float] = None
    driver_verified_hose_distance_m: Optional[float] = None
    driver_verified_road_difficulty: Optional[int] = Field(default=None, ge=1, le=5)


class SiteProfileResponse(BaseModel):
    id: int
    user_id: int
    label: Optional[str]
    address: Optional[str]
    latitude: float
    longitude: float
    landmark_notes: Optional[str]
    tank_capacity_liters: Optional[int]
    tank_height_m: Optional[float]
    hose_distance_m: Optional[float]
    tank_floor_level: Optional[str]
    tank_photo_url: Optional[str]
    road_difficulty: int
    parking_difficulty: int
    has_gate: bool
    gate_notes: Optional[str]
    delivery_count: int
    avg_delivery_duration_minutes: Optional[float]
    pump_stress_count: int
    rejection_count: int
    incident_count: int
    dispute_count: int
    anomaly_count: int
    truthfulness_score: float
    cooperation_score: float
    verification_status: str
    driver_verified_tank_height_m: Optional[float]
    driver_verified_hose_distance_m: Optional[float]
    driver_verified_road_difficulty: Optional[int]
    last_verified_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
