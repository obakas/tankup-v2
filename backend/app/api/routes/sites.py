import mimetypes
import os
import uuid
from datetime import datetime

import requests as http_requests
from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.config import settings
from app.schemas.site_profile import SiteProfileCreate, SiteProfileResponse, SiteProfileUpdate
from app.services.site_intelligence_service import (
    delete_site_profile,
    get_or_create_site_profile,
    get_site_profile_by_id,
    get_site_profiles_for_user,
    update_site_profile,
)

router = APIRouter(prefix="/sites", tags=["sites"])

_ALLOWED_PHOTO_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic"}
_MAX_PHOTO_BYTES = 10 * 1024 * 1024  # 10 MB


def _upload_to_supabase(data: bytes, content_type: str, path: str) -> str:
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
        raise HTTPException(status_code=503, detail="Photo storage is not configured")

    bucket = "tank-photos"
    url = f"{settings.SUPABASE_URL}/storage/v1/object/{bucket}/{path}"
    resp = http_requests.post(
        url,
        headers={
            "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
            "Content-Type": content_type,
            "x-upsert": "true",
        },
        data=data,
        timeout=30,
    )
    if resp.status_code not in (200, 201):
        raise HTTPException(status_code=502, detail=f"Storage upload failed: {resp.text}")

    return f"{settings.SUPABASE_URL}/storage/v1/object/public/{bucket}/{path}"


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
        tank_floor_level=payload.tank_floor_level,
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
        tank_floor_level=payload.tank_floor_level,
        road_difficulty=payload.road_difficulty,
        parking_difficulty=payload.parking_difficulty,
        has_gate=payload.has_gate,
        gate_notes=payload.gate_notes,
        driver_verified_tank_height_m=payload.driver_verified_tank_height_m,
        driver_verified_hose_distance_m=payload.driver_verified_hose_distance_m,
        driver_verified_road_difficulty=payload.driver_verified_road_difficulty,
    )


@router.post("/{site_id}/photo", response_model=SiteProfileResponse)
async def upload_site_photo(site_id: int, file: UploadFile, db: Session = Depends(get_db)):
    content_type = file.content_type or ""
    if content_type not in _ALLOWED_PHOTO_TYPES:
        guessed, _ = mimetypes.guess_type(file.filename or "")
        content_type = guessed or ""
    if content_type not in _ALLOWED_PHOTO_TYPES:
        raise HTTPException(status_code=415, detail="Unsupported file type. Use JPEG, PNG, WebP, or HEIC.")

    data = await file.read()
    if len(data) > _MAX_PHOTO_BYTES:
        raise HTTPException(status_code=413, detail="Photo must be under 10 MB")

    ext = os.path.splitext(file.filename or "photo")[1] or ".jpg"
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    path = f"sites/{site_id}/{timestamp}_{uuid.uuid4().hex[:8]}{ext}"

    public_url = _upload_to_supabase(data, content_type, path)

    return update_site_profile(db, site_id, tank_photo_url=public_url)


@router.delete("/{site_id}", status_code=204)
def delete_site(site_id: int, db: Session = Depends(get_db)):
    delete_site_profile(db, site_id)
