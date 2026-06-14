from __future__ import annotations

import logging
from datetime import datetime
from math import log1p
from typing import Optional

import requests as http_requests
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.customer_site_profile import CustomerSiteProfile
from app.models.DeliveryRecord import DeliveryRecord
from app.models.request import LiquidRequest

logger = logging.getLogger(__name__)

# Haversine-based threshold for "same site" deduplication (~50 metres)
_SAME_SITE_THRESHOLD_KM = 0.05


def _fetch_elevation_m(latitude: float, longitude: float) -> Optional[float]:
    """Best-effort elevation lookup via Open-Elevation API. Returns None on any failure."""
    try:
        resp = http_requests.get(
            "https://api.open-elevation.com/api/v1/lookup",
            params={"locations": f"{latitude},{longitude}"},
            timeout=5,
        )
        resp.raise_for_status()
        results = resp.json().get("results", [])
        if results:
            return float(results[0]["elevation"])
    except Exception as exc:
        logger.warning("Elevation fetch failed for (%.4f, %.4f): %s", latitude, longitude, exc)
    return None


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    from math import radians, sin, cos, sqrt, atan2

    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return 6371.0 * 2 * atan2(sqrt(a), sqrt(1 - a))


def get_site_profile_by_id(db: Session, site_id: int) -> CustomerSiteProfile:
    profile = db.query(CustomerSiteProfile).filter(CustomerSiteProfile.id == site_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Site profile not found")
    return profile


def get_site_profiles_for_user(db: Session, user_id: int) -> list[CustomerSiteProfile]:
    return (
        db.query(CustomerSiteProfile)
        .filter(CustomerSiteProfile.user_id == user_id)
        .order_by(CustomerSiteProfile.created_at.desc())
        .all()
    )


def delete_site_profile(db: Session, site_id: int) -> None:
    profile = get_site_profile_by_id(db, site_id)
    db.delete(profile)
    db.commit()


def get_or_create_site_profile(
    db: Session,
    *,
    user_id: int,
    latitude: float,
    longitude: float,
    label: Optional[str] = None,
    address: Optional[str] = None,
    landmark_notes: Optional[str] = None,
    tank_capacity_liters: Optional[int] = None,
    tank_height_m: Optional[float] = None,
    hose_distance_m: Optional[float] = None,
    tank_floor_level: Optional[str] = None,
    road_difficulty: int = 1,
    parking_difficulty: int = 1,
    has_gate: bool = False,
    gate_notes: Optional[str] = None,
) -> CustomerSiteProfile:
    existing = (
        db.query(CustomerSiteProfile)
        .filter(CustomerSiteProfile.user_id == user_id)
        .all()
    )
    for profile in existing:
        if _haversine_km(profile.latitude, profile.longitude, latitude, longitude) <= _SAME_SITE_THRESHOLD_KM:
            return profile

    profile = CustomerSiteProfile(
        user_id=user_id,
        latitude=latitude,
        longitude=longitude,
        label=label,
        address=address,
        landmark_notes=landmark_notes,
        tank_capacity_liters=tank_capacity_liters,
        tank_height_m=tank_height_m,
        hose_distance_m=hose_distance_m,
        tank_floor_level=tank_floor_level,
        road_difficulty=road_difficulty,
        parking_difficulty=parking_difficulty,
        has_gate=has_gate,
        gate_notes=gate_notes,
        terrain_elevation_m=_fetch_elevation_m(latitude, longitude),
    )
    db.add(profile)
    db.flush()
    db.commit()
    db.refresh(profile)
    return profile


def update_site_profile(
    db: Session,
    site_id: int,
    *,
    label: Optional[str] = None,
    address: Optional[str] = None,
    landmark_notes: Optional[str] = None,
    tank_capacity_liters: Optional[int] = None,
    tank_height_m: Optional[float] = None,
    hose_distance_m: Optional[float] = None,
    tank_floor_level: Optional[str] = None,
    tank_photo_url: Optional[str] = None,
    road_difficulty: Optional[int] = None,
    parking_difficulty: Optional[int] = None,
    has_gate: Optional[bool] = None,
    gate_notes: Optional[str] = None,
    driver_verified_tank_height_m: Optional[float] = None,
    driver_verified_hose_distance_m: Optional[float] = None,
    driver_verified_road_difficulty: Optional[int] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
) -> CustomerSiteProfile:
    profile = get_site_profile_by_id(db, site_id)

    if label is not None:
        profile.label = label
    if address is not None:
        profile.address = address
    if landmark_notes is not None:
        profile.landmark_notes = landmark_notes
    if tank_capacity_liters is not None:
        profile.tank_capacity_liters = tank_capacity_liters
    if tank_height_m is not None:
        profile.tank_height_m = tank_height_m
    if hose_distance_m is not None:
        profile.hose_distance_m = hose_distance_m
    if tank_floor_level is not None:
        profile.tank_floor_level = tank_floor_level
    if tank_photo_url is not None:
        profile.tank_photo_url = tank_photo_url
    if road_difficulty is not None:
        profile.road_difficulty = road_difficulty
    if parking_difficulty is not None:
        profile.parking_difficulty = parking_difficulty
    if has_gate is not None:
        profile.has_gate = has_gate
    if gate_notes is not None:
        profile.gate_notes = gate_notes
    if driver_verified_tank_height_m is not None:
        profile.driver_verified_tank_height_m = driver_verified_tank_height_m
        profile.last_verified_at = datetime.utcnow()
    if driver_verified_hose_distance_m is not None:
        profile.driver_verified_hose_distance_m = driver_verified_hose_distance_m
    if driver_verified_road_difficulty is not None:
        profile.driver_verified_road_difficulty = driver_verified_road_difficulty
    if latitude is not None:
        profile.latitude = latitude
    if longitude is not None:
        profile.longitude = longitude

    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


def compute_site_difficulty_score(profile: CustomerSiteProfile) -> float:
    """
    Returns 0.0 (trivial) to 1.0 (extremely hard).

    Uses driver-verified values when available; falls back to customer-reported.
    """
    # Tank height: 0–10 m range
    height = profile.driver_verified_tank_height_m or profile.tank_height_m or 0.0
    height_score = min(height / 10.0, 1.0)

    # Hose distance: 0–50 m range
    hose = profile.driver_verified_hose_distance_m or profile.hose_distance_m or 0.0
    hose_score = min(hose / 50.0, 1.0)

    # Road difficulty: 1–5 → 0.0–1.0
    road = profile.driver_verified_road_difficulty or profile.road_difficulty or 1
    road_score = (road - 1) / 4.0

    # Parking difficulty: 1–5 → 0.0–1.0
    parking_score = (profile.parking_difficulty - 1) / 4.0

    # Pump stress: log-scaled so that a few incidents still move the needle
    pump_score = min(log1p(profile.pump_stress_count or 0) / log1p(10), 1.0)

    return (
        0.35 * height_score
        + 0.25 * hose_score
        + 0.20 * road_score
        + 0.10 * parking_score
        + 0.10 * pump_score
    )


def update_site_on_delivery_complete(db: Session, delivery: DeliveryRecord) -> None:
    """
    Called after a delivery stop transitions to 'delivered'.
    Updates the linked CustomerSiteProfile with operational intelligence.
    """
    site_profile_id = delivery.site_profile_id

    # Fall back to the parent request's profile if not set directly on the delivery
    if not site_profile_id and delivery.request_id:
        request = db.query(LiquidRequest).filter(LiquidRequest.id == delivery.request_id).first()
        if request:
            site_profile_id = getattr(request, "site_profile_id", None)

    if not site_profile_id:
        return

    profile = db.query(CustomerSiteProfile).filter(CustomerSiteProfile.id == site_profile_id).first()
    if not profile:
        return

    # Increment delivery counter
    profile.delivery_count = (profile.delivery_count or 0) + 1

    # Recalculate rolling average duration
    if delivery.dispatched_at and delivery.delivered_at:
        duration_minutes = (delivery.delivered_at - delivery.dispatched_at).total_seconds() / 60
        old_avg = profile.avg_delivery_duration_minutes
        if old_avg is None:
            profile.avg_delivery_duration_minutes = duration_minutes
        else:
            n = profile.delivery_count
            profile.avg_delivery_duration_minutes = ((old_avg * (n - 1)) + duration_minutes) / n

    # Anomaly tracking
    if delivery.anomaly_flagged:
        profile.anomaly_count = (profile.anomaly_count or 0) + 1

    # Truthfulness scoring: compare customer estimate vs driver observation
    customer_height = profile.tank_height_m
    driver_height = delivery.driver_reported_tank_height_m

    if customer_height and driver_height:
        diff_pct = abs(customer_height - driver_height) / max(customer_height, 0.01)
        if diff_pct > 0.20:
            profile.truthfulness_score = max(0.0, (profile.truthfulness_score or 1.0) - 0.10)
            delivery.site_conditions_match = False
        else:
            profile.truthfulness_score = min(1.0, (profile.truthfulness_score or 1.0) + 0.05)
            delivery.site_conditions_match = True

    # Persist driver-verified measurements if submitted
    if delivery.driver_reported_tank_height_m is not None:
        profile.driver_verified_tank_height_m = delivery.driver_reported_tank_height_m
        profile.last_verified_at = datetime.utcnow()
    if delivery.driver_reported_hose_distance_m is not None:
        profile.driver_verified_hose_distance_m = delivery.driver_reported_hose_distance_m
    if delivery.driver_reported_road_difficulty is not None:
        profile.driver_verified_road_difficulty = delivery.driver_reported_road_difficulty

    # Advance verification status
    if profile.verification_status not in ("high_risk", "restricted"):
        if (profile.anomaly_count or 0) >= 3 or (profile.dispute_count or 0) >= 2:
            profile.verification_status = "high_risk"
        elif profile.delivery_count >= 3:
            profile.verification_status = "verified"
        elif profile.delivery_count >= 1:
            profile.verification_status = "partially_verified"

    db.add(profile)
    db.add(delivery)
    db.commit()
