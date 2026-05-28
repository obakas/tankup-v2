from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.site_profile import SiteProfileCreate, SiteProfileResponse, SiteProfileUpdate
from app.services.site_intelligence_service import (
    get_or_create_site_profile,
    get_site_profile_by_id,
    get_site_profiles_for_user,
    update_site_profile,
)

router = APIRouter(prefix="/sites", tags=["sites"])


@router.post("/", response_model=SiteProfileResponse)
def create_site_profile(payload: SiteProfileCreate, db: Session = Depends(get_db)):
    return get_or_create_site_profile(
        db,
        user_id=payload.user_id,
        latitude=payload.latitude,
        longitude=payload.longitude,
        label=payload.label,
        address=payload.address,
        landmark_notes=payload.landmark_notes,
        tank_capacity_liters=payload.tank_capacity_liters,
        tank_height_m=payload.tank_height_m,
        hose_distance_m=payload.hose_distance_m,
        road_difficulty=payload.road_difficulty,
        parking_difficulty=payload.parking_difficulty,
        has_gate=payload.has_gate,
        gate_notes=payload.gate_notes,
    )


@router.get("/{site_id}", response_model=SiteProfileResponse)
def get_site_profile(site_id: int, db: Session = Depends(get_db)):
    return get_site_profile_by_id(db, site_id)


@router.get("/users/{user_id}", response_model=list[SiteProfileResponse])
def list_user_sites(user_id: int, db: Session = Depends(get_db)):
    return get_site_profiles_for_user(db, user_id)


@router.patch("/{site_id}", response_model=SiteProfileResponse)
def patch_site_profile(site_id: int, payload: SiteProfileUpdate, db: Session = Depends(get_db)):
    return update_site_profile(
        db,
        site_id,
        label=payload.label,
        address=payload.address,
        landmark_notes=payload.landmark_notes,
        tank_capacity_liters=payload.tank_capacity_liters,
        tank_height_m=payload.tank_height_m,
        hose_distance_m=payload.hose_distance_m,
        road_difficulty=payload.road_difficulty,
        parking_difficulty=payload.parking_difficulty,
        has_gate=payload.has_gate,
        gate_notes=payload.gate_notes,
        driver_verified_tank_height_m=payload.driver_verified_tank_height_m,
        driver_verified_hose_distance_m=payload.driver_verified_hose_distance_m,
        driver_verified_road_difficulty=payload.driver_verified_road_difficulty,
    )
