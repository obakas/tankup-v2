from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from math import radians, sin, cos, sqrt, atan2
from sqlalchemy.orm import Session

from app.models.driver_metric import DriverMetric
from app.models.job_offer import JobOffer


EARTH_RADIUS_KM = 6371.0


@dataclass
class DriverScoreBreakdown:
    tanker_id: int
    proximity: float
    reliability: float
    responsiveness: float
    area_affinity: float
    fairness: float
    penalty: float
    availability_confidence: float
    final_score: float


def clamp(value: float, minimum: float = 0.0, maximum: float = 1.0) -> float:
    return max(minimum, min(value, maximum))


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)

    a = (
        sin(dlat / 2) ** 2
        + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    )
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return EARTH_RADIUS_KM * c


def get_or_create_metric(db: Session, tanker_id: int) -> DriverMetric:
    metric = db.query(DriverMetric).filter(DriverMetric.tanker_id == tanker_id).first()
    if metric:
        return metric

    metric = DriverMetric(tanker_id=tanker_id)
    db.add(metric)
    db.flush()
    return metric


def score_proximity(tanker, job_lat: float, job_lon: float, max_radius_km: float = 15.0) -> float:
    tanker_lat = getattr(tanker, "latitude", None)
    tanker_lon = getattr(tanker, "longitude", None)

    if tanker_lat is None or tanker_lon is None:
        return 0.2

    distance = haversine_km(tanker_lat, tanker_lon, job_lat, job_lon)
    return clamp(1 - (distance / max_radius_km))


def safe_rate(numerator: int, denominator: int, default: float = 0.5) -> float:
    if denominator <= 0:
        return default
    return clamp(numerator / denominator)


def score_reliability(metric: DriverMetric) -> float:
    acceptance_rate = safe_rate(metric.accepts_total, metric.offers_total, default=0.6)
    completion_rate = safe_rate(metric.completed_total, metric.accepts_total, default=0.7)
    cancellation_rate = safe_rate(metric.cancelled_total, metric.accepts_total, default=0.0)

    score = (
        0.4 * completion_rate
        + 0.3 * acceptance_rate
        + 0.3 * (1 - cancellation_rate)
    )
    return clamp(score)


def score_responsiveness(metric: DriverMetric, target_response_seconds: float = 20.0) -> float:
    score = 1 - min(metric.avg_response_seconds / target_response_seconds, 1.0)
    timeout_penalty = min(metric.timeout_count_today * 0.05, 0.25)
    return clamp(score - timeout_penalty)


def build_zone_key(lat: float, lon: float, precision: int = 2) -> str:
    return f"{round(lat, precision)}:{round(lon, precision)}"


def score_area_affinity(db: Session, tanker_id: int, zone_key: str) -> float:
    offers = db.query(JobOffer).filter(
        JobOffer.tanker_id == tanker_id,
        JobOffer.zone_key == zone_key
    ).all()

    if not offers:
        return 0.5

    total = len(offers)
    accepts = sum(1 for x in offers if x.response_type == "accepted")
    declines = sum(1 for x in offers if x.response_type == "declined")

    acceptance_rate = accepts / total
    decline_penalty = declines / total

    return clamp((0.7 * acceptance_rate) + (0.3 * (1 - decline_penalty)))


def score_fairness(metric: DriverMetric) -> float:
    # Higher score for drivers with fewer jobs and lower earnings today.
    jobs_component = 1 / (1 + metric.jobs_completed_today)
    earnings_component = 1 / (1 + (metric.earnings_today / 100000))

    return clamp((0.5 * jobs_component) + (0.5 * earnings_component))


def compute_availability_confidence(metric: DriverMetric) -> float:
    if metric.timeout_count_today >= 3:
        return 0.5
    if metric.decline_count_today >= 3:
        return 0.7
    return 1.0


def compute_penalty(metric: DriverMetric, area_affinity: float) -> float:
    penalty = 0.0

    if metric.timeout_count_today >= 3:
        penalty += 0.20

    if area_affinity < 0.3:
        penalty += 0.15

    cancellation_rate = safe_rate(metric.cancelled_total, metric.accepts_total, default=0.0)
    if cancellation_rate > 0.15:
        penalty += 0.10

    return clamp(penalty, 0.0, 0.5)


def compute_driver_score(
    db: Session,
    tanker,
    *,
    job_lat: float,
    job_lon: float,
    job_type: str,
) -> DriverScoreBreakdown:
    metric = get_or_create_metric(db, tanker.id)

    proximity = score_proximity(tanker, job_lat, job_lon)
    reliability = score_reliability(metric)
    responsiveness = score_responsiveness(metric)
    zone_key = build_zone_key(job_lat, job_lon)
    area_affinity = score_area_affinity(db, tanker.id, zone_key)
    fairness = score_fairness(metric)
    availability_confidence = compute_availability_confidence(metric)
    penalty = compute_penalty(metric, area_affinity)

    if job_type == "priority":
        base = (
            0.25 * reliability
            + 0.20 * responsiveness
            + 0.20 * proximity
            + 0.15 * area_affinity
            + 0.20 * fairness
        )
    else:
        base = (
            0.20 * reliability
            + 0.10 * responsiveness
            + 0.25 * proximity
            + 0.15 * area_affinity
            + 0.30 * fairness
        )

    final_score = max(0.0, (base - penalty)) * availability_confidence

    return DriverScoreBreakdown(
        tanker_id=tanker.id,
        proximity=round(proximity, 4),
        reliability=round(reliability, 4),
        responsiveness=round(responsiveness, 4),
        area_affinity=round(area_affinity, 4),
        fairness=round(fairness, 4),
        penalty=round(penalty, 4),
        availability_confidence=round(availability_confidence, 4),
        final_score=round(final_score * 100, 2),
    )


def score_driver_for_batch(db: Session, tanker, batch, members: list) -> dict:
    """
    V1 batch driver score:
      0.30 * proximity
    + 0.25 * reliability
    + 0.20 * batch_efficiency
    + 0.15 * fairness
    + 0.10 * area_affinity
    - penalties
    """
    proximity = score_proximity(tanker, batch)
    reliability = score_reliability(db, tanker.id)
    batch_efficiency = calculate_batch_efficiency_score(db, tanker.id)
    fairness = score_fairness(db, tanker.id)
    area_affinity = score_area_affinity(db, tanker, batch)
    penalties = compute_penalty(db, tanker.id)

    final_score = (
        0.30 * proximity
        + 0.25 * reliability
        + 0.20 * batch_efficiency
        + 0.15 * fairness
        + 0.10 * area_affinity
        - penalties
    )

    final_score = max(0.0, min(final_score, 1.0))

    return {
        "proximity": round(proximity, 4),
        "reliability": round(reliability, 4),
        "batch_efficiency": round(batch_efficiency, 4),
        "fairness": round(fairness, 4),
        "area_affinity": round(area_affinity, 4),
        "penalties": round(penalties, 4),
        "final_score": round(final_score, 4),
    }

def calculate_batch_efficiency_score(metric: DriverMetric) -> float:
    accepts_total = max(metric.accepts_total or 0, 0)
    completed_total = max(metric.completed_total or 0, 0)
    avg_response_seconds = float(metric.avg_response_seconds or 0.0)

    completion_rate = completed_total / accepts_total if accepts_total > 0 else 0.5
    responsiveness = (
        1 - min(avg_response_seconds / 20.0, 1.0)
        if avg_response_seconds > 0
        else 0.5
    )

    efficiency = (0.7 * completion_rate) + (0.3 * responsiveness)
    return clamp(efficiency)


def score_driver_for_batch(db: Session, tanker, batch, members: list) -> dict:
    metric = get_or_create_metric(db, tanker.id)

    if tanker.latitude is None or tanker.longitude is None or batch.latitude is None or batch.longitude is None:
        proximity = 0.2
    else:
        proximity = score_proximity(
            tanker,
            job_lat=batch.latitude,
            job_lon=batch.longitude,
            max_radius_km=15.0,
        )

    reliability = score_reliability(metric)
    batch_efficiency = calculate_batch_efficiency_score(metric)
    fairness = score_fairness(metric)

    zone_key = build_zone_key(batch.latitude or 0, batch.longitude or 0)
    area_affinity = score_area_affinity(db, tanker.id, zone_key)

    availability_confidence = compute_availability_confidence(metric)
    penalties = compute_penalty(metric, area_affinity)

    final_score = (
        0.30 * proximity
        + 0.25 * reliability
        + 0.20 * batch_efficiency
        + 0.15 * fairness
        + 0.10 * area_affinity
        - penalties
    )

    final_score = max(0.0, min(final_score, 1.0)) * availability_confidence

    return {
        "proximity": round(proximity, 4),
        "reliability": round(reliability, 4),
        "batch_efficiency": round(batch_efficiency, 4),
        "fairness": round(fairness, 4),
        "area_affinity": round(area_affinity, 4),
        "availability_confidence": round(availability_confidence, 4),
        "penalties": round(penalties, 4),
        "final_score": round(final_score, 4),
    }
   