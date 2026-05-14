from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Iterable

from app.models.batch import Batch
from app.models.batch_member import BatchMember
from app.services.driver_scoring_service import haversine_km


NEAR_READY_FILL_RATIO = 0.70
READY_FILL_RATIO = 0.90

NEAR_READY_PAYMENT_RATIO = 0.60
READY_PAYMENT_RATIO = 0.80

MIN_PAID_MEMBERS_FOR_READY = 2

# Strictly ideal compactness target, but we should not let this kill
# obviously healthy full batches in MVP conditions.
MAX_IDEAL_MEMBER_DISTANCE_KM = 1.0

WAIT_URGENCY_FULL_AT_HOURS = 6

MIN_GEO_COMPACTNESS_FOR_PROMOTION = 0.50


@dataclass
class BatchScoreBreakdown:
    fill_ratio: float
    payment_ratio: float
    geo_compactness: float
    wait_urgency: float
    health_score: float
    paid_members_count: int
    total_members_count: int


def clamp(value: float, minimum: float = 0.0, maximum: float = 1.0) -> float:
    return max(minimum, min(value, maximum))


def safe_now() -> datetime:
    return datetime.now(timezone.utc)


def get_batch_age_hours(batch: Batch) -> float:
    created_at = getattr(batch, "created_at", None)
    if not created_at:
        return 0.0

    now = safe_now()

    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)

    return max((now - created_at).total_seconds() / 3600.0, 0.0)


def calculate_fill_ratio(batch: Batch, members: Iterable[BatchMember]) -> float:
    current_volume = float(getattr(batch, "current_volume", 0) or 0)
    target_volume = float(getattr(batch, "target_volume", 0) or 0)

    if target_volume == 0:
        return 0.0

    return clamp(current_volume / target_volume)


def is_member_paid(member: BatchMember) -> bool:
    payment_status = str(getattr(member, "payment_status", "") or "").lower()
    return payment_status in {"paid", "completed", "success", "confirmed"}


def calculate_payment_ratio(members: Iterable[BatchMember]) -> tuple[float, int, int]:
    members = list(members)
    total = len(members)

    if total == 0:
        return 0.0, 0, 0

    paid_count = sum(1 for member in members if is_member_paid(member))
    return clamp(paid_count / total), paid_count, total


def calculate_geo_compactness(batch: Batch, members: Iterable[BatchMember]) -> float:
    """
    Measures how geographically tight the batch is.

    V1:
    - compare each member distance to the batch center
    - average the distance
    - compress score into 0..1 where <= 1km is strong
    """
    members = list(members)
    if not members:
        return 1.0

    batch_lat = getattr(batch, "latitude", None)
    batch_lon = getattr(batch, "longitude", None)

    if batch_lat is None or batch_lon is None:
        return 0.5

    distances: list[float] = []
    for member in members:
        lat = getattr(member, "latitude", None)
        lon = getattr(member, "longitude", None)
        if lat is None or lon is None:
            continue

        distance_km = haversine_km(batch_lat, batch_lon, lat, lon)
        distances.append(distance_km)

    if not distances:
        return 0.5

    avg_distance = sum(distances) / len(distances)

    compactness = 1 - min(avg_distance / MAX_IDEAL_MEMBER_DISTANCE_KM, 1)
    return clamp(compactness)


def calculate_wait_urgency(batch: Batch) -> float:
    age_hours = get_batch_age_hours(batch)
    if WAIT_URGENCY_FULL_AT_HOURS <= 0:
        return 0.0

    return clamp(age_hours / WAIT_URGENCY_FULL_AT_HOURS)


def calculate_batch_health_score(
    batch: Batch,
    members: Iterable[BatchMember],
) -> BatchScoreBreakdown:
    """
    V1 formula:
      0.35 * fill_ratio
    + 0.25 * payment_ratio
    + 0.20 * geo_compactness
    + 0.20 * wait_urgency
    """
    members = list(members)

    fill_ratio = calculate_fill_ratio(batch, members)
    payment_ratio, paid_count, total_count = calculate_payment_ratio(members)
    geo_compactness = calculate_geo_compactness(batch, members)
    wait_urgency = calculate_wait_urgency(batch)

    health_score = (
        0.35 * fill_ratio
        + 0.25 * payment_ratio
        + 0.20 * geo_compactness
        + 0.20 * wait_urgency
    )

    return BatchScoreBreakdown(
        fill_ratio=round(fill_ratio, 4),
        payment_ratio=round(payment_ratio, 4),
        geo_compactness=round(geo_compactness, 4),
        wait_urgency=round(wait_urgency, 4),
        health_score=round(clamp(health_score), 4),
        paid_members_count=paid_count,
        total_members_count=total_count,
    )


def is_batch_near_ready(batch: Batch, members: Iterable[BatchMember]) -> bool:
    score = calculate_batch_health_score(batch, members)

    # Strong override: once a batch is 90%+ full and has decent payment signal,
    # don't let compactness alone keep it in "forming".
    if (
        score.fill_ratio >= 0.90
        and score.payment_ratio >= NEAR_READY_PAYMENT_RATIO
        and score.paid_members_count >= 2
    ):
        return True

    return (
        score.fill_ratio >= NEAR_READY_FILL_RATIO
        and score.payment_ratio >= NEAR_READY_PAYMENT_RATIO
        and score.geo_compactness >= MIN_GEO_COMPACTNESS_FOR_PROMOTION
    )


def is_batch_ready_for_assignment(batch: Batch, members: Iterable[BatchMember]) -> bool:
    score = calculate_batch_health_score(batch, members)

    # Strong override: if the tanker is effectively full and members are paid,
    # do not let compactness block assignment in the MVP.
    if (
        score.fill_ratio >= 1.0
        and score.payment_ratio >= READY_PAYMENT_RATIO
        and score.paid_members_count >= MIN_PAID_MEMBERS_FOR_READY
    ):
        return True

    # Also allow the normal 90% threshold when payment signal is strong and
    # enough paid members exist.
    if (
        score.fill_ratio >= READY_FILL_RATIO
        and score.payment_ratio >= READY_PAYMENT_RATIO
        and score.paid_members_count >= MIN_PAID_MEMBERS_FOR_READY
        and score.geo_compactness >= MIN_GEO_COMPACTNESS_FOR_PROMOTION
    ):
        return True

    return False


def should_widen_radius(batch: Batch, members: Iterable[BatchMember]) -> bool:
    """
    Used to relax matching rules for old / struggling batches.
    """
    age_hours = get_batch_age_hours(batch)
    fill_ratio = calculate_fill_ratio(batch, members)
    payment_ratio, _, _ = calculate_payment_ratio(members)

    return (
        age_hours >= 3
        and fill_ratio < NEAR_READY_FILL_RATIO
        and payment_ratio < READY_PAYMENT_RATIO
    )


def should_expire_batch(batch: Batch, members: Iterable[BatchMember]) -> bool:
    """
    Conservative V1 rule:
    - if older than 24 hours and still weak, expire it
    """
    age_hours = get_batch_age_hours(batch)
    score = calculate_batch_health_score(batch, members)

    return (
        age_hours >= 24
        and score.fill_ratio < 0.50
        and score.payment_ratio < 0.50
    )


def get_batch_dispatch_priority(batch: Batch, members: Iterable[BatchMember]) -> float:
    """
    Useful when multiple ready batches are competing for tanker assignment.
    We bias toward strong, older, healthier batches.
    """
    score = calculate_batch_health_score(batch, members)

    dispatch_priority = (
        0.45 * score.health_score
        + 0.30 * score.wait_urgency
        + 0.15 * score.payment_ratio
        + 0.10 * score.fill_ratio
    )

    return round(clamp(dispatch_priority), 4)