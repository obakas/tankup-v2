from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class TankHeightCategory(str, Enum):
    ground = "ground"
    first_floor = "first_floor"
    second_floor = "second_floor"
    third_floor = "third_floor"
    rooftop = "rooftop"


class SiteReportIn(BaseModel):
    tank_height_category: Optional[TankHeightCategory] = None
    hose_difficulty: Optional[int] = Field(None, ge=1, le=5)
    road_difficulty: Optional[int] = Field(None, ge=1, le=5)
    notes: Optional[str] = Field(None, max_length=500)


class DriverEarningOut(BaseModel):
    id: int
    delivery_record_id: int
    job_type: str
    job_id: int
    stop_order: Optional[int] = None
    volume_earnings: float
    stop_bonus: float
    site_bonus: Optional[float] = None
    total_earnings: float
    actual_liters_delivered: Optional[float] = None
    rate_per_liter: float
    site_report_submitted: bool
    site_report_submitted_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class EarningsPeriodSummary(BaseModel):
    total: float
    volume_earnings: float
    stop_bonuses: float
    site_bonuses: float
    job_count: int
    stop_count: int


class DriverEarningJobGroup(BaseModel):
    job_type: str
    job_id: int
    job_status: Optional[str] = None
    completed_at: Optional[datetime] = None
    stop_count: int
    total_volume_liters: float
    volume_earnings: float
    stop_bonuses: float
    site_bonuses: float
    total_earnings: float
    stops: list[DriverEarningOut]


class DriverEarningsResponse(BaseModel):
    tanker_id: int
    period: str
    summary: EarningsPeriodSummary
    jobs: list[DriverEarningJobGroup]
