from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.core.rate_constants import (
    DRIVER_BATCH_RATE_PER_LITER,
    DRIVER_BATCH_STOP_BONUS,
    DRIVER_PRIORITY_RATE_PER_LITER,
    DRIVER_SITE_BONUS,
)
from app.models.DeliveryRecord import DeliveryRecord
from app.models.batch import Batch
from app.models.customer_site_profile import CustomerSiteProfile
from app.models.driver_earning import DriverEarning
from app.models.driver_metric import DriverMetric
from app.models.request import LiquidRequest

# Approximate metre values for tank floor level categories
_FLOOR_HEIGHT_M: dict[str, float] = {
    "ground": 0.5,
    "first_floor": 3.5,
    "second_floor": 7.0,
    "third_floor": 10.5,
    "rooftop": 14.0,
}


def create_earning_for_delivery(db: Session, delivery: DeliveryRecord) -> DriverEarning:
    existing = (
        db.query(DriverEarning)
        .filter(DriverEarning.delivery_record_id == delivery.id)
        .first()
    )
    if existing:
        return existing

    liters = delivery.actual_liters_delivered or delivery.planned_liters or 0.0
    is_batch = delivery.job_type == "batch"
    rate = DRIVER_BATCH_RATE_PER_LITER if is_batch else DRIVER_PRIORITY_RATE_PER_LITER
    volume_earnings = liters * rate
    stop_bonus = DRIVER_BATCH_STOP_BONUS if is_batch else 0.0
    job_id = delivery.batch_id if is_batch else delivery.request_id

    earning = DriverEarning(
        tanker_id=delivery.tanker_id,
        delivery_record_id=delivery.id,
        job_type=delivery.job_type,
        job_id=job_id,
        stop_order=delivery.stop_order,
        volume_earnings=round(volume_earnings, 2),
        stop_bonus=stop_bonus,
        site_bonus=None,
        total_earnings=round(volume_earnings + stop_bonus, 2),
        actual_liters_delivered=liters,
        rate_per_liter=rate,
        site_report_submitted=False,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(earning)
    db.flush()
    return earning


def apply_site_report(
    db: Session,
    delivery: DeliveryRecord,
    *,
    tank_height_category: Optional[str],
    hose_difficulty: Optional[int],
    road_difficulty: Optional[int],
    notes: Optional[str],
) -> DriverEarning:
    # Update driver-reported fields on the DeliveryRecord
    if hose_difficulty is not None:
        # Store as rough metres (1 → 5m, 5 → 25m)
        delivery.driver_reported_hose_distance_m = float(hose_difficulty) * 5.0
    if road_difficulty is not None:
        delivery.driver_reported_road_difficulty = road_difficulty
    if tank_height_category is not None:
        delivery.driver_reported_tank_height_m = _FLOOR_HEIGHT_M.get(tank_height_category, 0.5)
    db.add(delivery)

    # Update CustomerSiteProfile with driver-verified data (targeted — do NOT call
    # update_site_on_delivery_complete again to avoid double-incrementing delivery_count)
    site_profile_id = delivery.site_profile_id
    if not site_profile_id and delivery.request_id:
        req = db.query(LiquidRequest).filter(LiquidRequest.id == delivery.request_id).first()
        if req:
            site_profile_id = getattr(req, "site_profile_id", None)

    if site_profile_id:
        profile = (
            db.query(CustomerSiteProfile)
            .filter(CustomerSiteProfile.id == site_profile_id)
            .first()
        )
        if profile:
            if tank_height_category is not None:
                profile.tank_floor_level = tank_height_category
                profile.driver_verified_tank_height_m = _FLOOR_HEIGHT_M.get(tank_height_category, 0.5)
                profile.last_verified_at = datetime.utcnow()
            if hose_difficulty is not None:
                profile.driver_verified_hose_distance_m = float(hose_difficulty) * 5.0
            if road_difficulty is not None:
                profile.driver_verified_road_difficulty = road_difficulty
            db.add(profile)

    # Award site bonus on the DriverEarning row
    earning = (
        db.query(DriverEarning)
        .filter(DriverEarning.delivery_record_id == delivery.id)
        .first()
    )
    if not earning:
        earning = create_earning_for_delivery(db, delivery)

    if not earning.site_report_submitted:
        earning.site_bonus = DRIVER_SITE_BONUS
        earning.site_report_submitted = True
        earning.site_report_submitted_at = datetime.utcnow()
        earning.total_earnings = round(
            earning.volume_earnings + earning.stop_bonus + DRIVER_SITE_BONUS, 2
        )
        earning.updated_at = datetime.utcnow()
        db.add(earning)

        # Update DriverMetric.earnings_today
        metric = (
            db.query(DriverMetric)
            .filter(DriverMetric.tanker_id == delivery.tanker_id)
            .first()
        )
        if metric:
            metric.earnings_today = round((metric.earnings_today or 0.0) + DRIVER_SITE_BONUS, 2)
            db.add(metric)

    db.commit()
    db.refresh(earning)
    return earning


def skip_site_report(db: Session, delivery_id: int, tanker_id: int) -> DriverEarning:
    earning = (
        db.query(DriverEarning)
        .filter(DriverEarning.delivery_record_id == delivery_id)
        .first()
    )
    if not earning:
        delivery = db.query(DeliveryRecord).filter(DeliveryRecord.id == delivery_id).first()
        if delivery:
            earning = create_earning_for_delivery(db, delivery)

    if earning and not earning.site_report_submitted:
        earning.site_bonus = 0.0
        earning.site_report_submitted = True
        earning.site_report_submitted_at = datetime.utcnow()
        earning.updated_at = datetime.utcnow()
        db.add(earning)
        db.commit()
        db.refresh(earning)

    return earning


def get_earnings_for_tanker(
    db: Session, tanker_id: int, period: str
) -> dict:
    now_utc = datetime.utcnow()

    if period == "today":
        # midnight WAT (UTC+1)
        wat_now = now_utc + timedelta(hours=1)
        midnight_wat = wat_now.replace(hour=0, minute=0, second=0, microsecond=0)
        since = midnight_wat - timedelta(hours=1)
        rows = (
            db.query(DriverEarning)
            .filter(DriverEarning.tanker_id == tanker_id, DriverEarning.created_at >= since)
            .order_by(DriverEarning.created_at.desc())
            .all()
        )
    elif period == "week":
        since = now_utc - timedelta(days=7)
        rows = (
            db.query(DriverEarning)
            .filter(DriverEarning.tanker_id == tanker_id, DriverEarning.created_at >= since)
            .order_by(DriverEarning.created_at.desc())
            .all()
        )
    elif period == "month":
        since = now_utc - timedelta(days=30)
        rows = (
            db.query(DriverEarning)
            .filter(DriverEarning.tanker_id == tanker_id, DriverEarning.created_at >= since)
            .order_by(DriverEarning.created_at.desc())
            .all()
        )
    else:  # all
        rows = (
            db.query(DriverEarning)
            .filter(DriverEarning.tanker_id == tanker_id)
            .order_by(DriverEarning.created_at.desc())
            .all()
        )

    # Group by (job_type, job_id)
    groups: dict[tuple, list[DriverEarning]] = {}
    for row in rows:
        key = (row.job_type, row.job_id)
        groups.setdefault(key, []).append(row)

    job_groups = []
    total_summary = dict(
        total=0.0, volume_earnings=0.0, stop_bonuses=0.0,
        site_bonuses=0.0, job_count=0, stop_count=0
    )

    for (job_type, job_id), stops in groups.items():
        job_status = None
        completed_at = None

        if job_type == "batch":
            batch = db.query(Batch).filter(Batch.id == job_id).first()
            if batch:
                job_status = batch.status
                completed_at = getattr(batch, "completed_at", None)
        else:
            req = db.query(LiquidRequest).filter(LiquidRequest.id == job_id).first()
            if req:
                job_status = req.status
                completed_at = getattr(req, "completed_at", None)

        vol_earnings = sum(s.volume_earnings for s in stops)
        stop_bonuses = sum(s.stop_bonus for s in stops)
        site_bonuses = sum(s.site_bonus or 0.0 for s in stops)
        job_total = sum(s.total_earnings for s in stops)
        total_vol_liters = sum(s.actual_liters_delivered or 0.0 for s in stops)

        job_groups.append({
            "job_type": job_type,
            "job_id": job_id,
            "job_status": job_status,
            "completed_at": completed_at,
            "stop_count": len(stops),
            "total_volume_liters": round(total_vol_liters, 2),
            "volume_earnings": round(vol_earnings, 2),
            "stop_bonuses": round(stop_bonuses, 2),
            "site_bonuses": round(site_bonuses, 2),
            "total_earnings": round(job_total, 2),
            "stops": [_earning_to_dict(s) for s in sorted(stops, key=lambda x: (x.stop_order or 0))],
        })

        total_summary["total"] += job_total
        total_summary["volume_earnings"] += vol_earnings
        total_summary["stop_bonuses"] += stop_bonuses
        total_summary["site_bonuses"] += site_bonuses
        total_summary["job_count"] += 1
        total_summary["stop_count"] += len(stops)

    for key in ("total", "volume_earnings", "stop_bonuses", "site_bonuses"):
        total_summary[key] = round(total_summary[key], 2)

    return {
        "tanker_id": tanker_id,
        "period": period,
        "summary": total_summary,
        "jobs": job_groups,
    }


def _earning_to_dict(e: DriverEarning) -> dict:
    return {
        "id": e.id,
        "delivery_record_id": e.delivery_record_id,
        "job_type": e.job_type,
        "job_id": e.job_id,
        "stop_order": e.stop_order,
        "volume_earnings": e.volume_earnings,
        "stop_bonus": e.stop_bonus,
        "site_bonus": e.site_bonus,
        "total_earnings": e.total_earnings,
        "actual_liters_delivered": e.actual_liters_delivered,
        "rate_per_liter": e.rate_per_liter,
        "site_report_submitted": e.site_report_submitted,
        "site_report_submitted_at": e.site_report_submitted_at,
        "created_at": e.created_at,
    }
