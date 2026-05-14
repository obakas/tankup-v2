from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Iterable

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.batch import Batch
from app.models.batch_member import BatchMember
from app.models.request import LiquidRequest
from app.models.tanker import Tanker
from app.models.job_offer import JobOffer
from app.services.driver_scoring_service import (
    compute_driver_score,
    build_zone_key,
    get_or_create_metric,
    haversine_km,
    score_driver_for_batch,
)
from app.services.operation_alert_service import create_operation_alert
from app.utils.time_policy import (
    OFFER_TIMEOUT_BLACKLIST_MINUTES, 
    OFFER_EXPIRY_ALERT_AFTER_FAILURES,
    OFFER_ACCEPT_TIMEOUT_SECONDS,
    PRIORITY_ASSIGNMENT_TIMEOUT_MINUTES,
    LOCATION_STALE_AFTER_MINUTES,)

# MAX_BATCH_ASSIGNMENT_RADIUS_KM = 2.0
MIN_BATCH_ASSIGNMENT_RADIUS_KM = 5.0
# LOCATION_STALE_AFTER_MINUTES = 3
# OFFER_TTL_SECONDS = 60
MAX_PRIORITY_ASSIGNMENT_RETRIES = 5
# PRIORITY_ASSIGNMENT_TIMEOUT_MINUTES = 20



def _has_recent_location(tanker: Tanker, *, max_age_minutes: int = LOCATION_STALE_AFTER_MINUTES) -> bool:
    last_update = getattr(tanker, "last_location_update_at", None)
    if not last_update:
        return False
    return last_update >= datetime.utcnow() - timedelta(minutes=max_age_minutes)


def _has_real_coordinates(tanker: Tanker) -> bool:
    lat = getattr(tanker, "latitude", None)
    lon = getattr(tanker, "longitude", None)

    if lat is None or lon is None:
        return False

    # Reject obvious placeholder coordinates that poison distance-based assignment.
    if abs(lat) < 0.0001 and abs(lon) < 0.0001:
        return False

    if abs(lat - 1.0) < 0.0001 and abs(lon - 1.0) < 0.0001:
        return False

    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        return False

    return True


def _is_assignable_available_tanker(tanker: Tanker) -> bool:
    is_online = bool(getattr(tanker, "is_online", True))
    is_available = bool(getattr(tanker, "is_available", False))
    status = str(getattr(tanker, "status", "") or "").lower()
    paused_until = getattr(tanker, "paused_until", None)
    pending_offer_type = getattr(tanker, "pending_offer_type", None)
    pending_offer_id = getattr(tanker, "pending_offer_id", None)
    current_request_id = getattr(tanker, "current_request_id", None)

    if not is_online:
        return False

    if not is_available or status != "available":
        return False

    if pending_offer_type or pending_offer_id:
        return False

    if current_request_id is not None:
        return False

    if paused_until and paused_until > datetime.utcnow():
        return False

    return True


def get_eligible_tankers(db: Session):
    tankers = db.query(Tanker).all()
    return [tanker for tanker in tankers if _is_assignable_available_tanker(tanker)]


def rank_tankers_for_job(
    db: Session,
    *,
    job_lat: float,
    job_lon: float,
    job_type: str,
):
    tankers = get_eligible_tankers(db)

    ranked = []
    for tanker in tankers:
        if tanker.paused_until and tanker.paused_until > datetime.utcnow():
            continue

        breakdown = compute_driver_score(
            db,
            tanker,
            job_lat=job_lat,
            job_lon=job_lon,
            job_type=job_type,
        )
        ranked.append((tanker, breakdown))

    ranked.sort(key=lambda item: item[1].final_score, reverse=True)
    return ranked


def create_job_offer(
    db: Session,
    *,
    tanker_id: int,
    job_type: str,
    request_id: int | None = None,
    batch_id: int | None = None,
    job_lat: float,
    job_lon: float,
    estimated_distance_km: float | None = None,
    estimated_eta_minutes: float | None = None,
):
    offer = JobOffer(
        tanker_id=tanker_id,
        job_type=job_type,
        request_id=request_id,
        batch_id=batch_id,
        zone_key=build_zone_key(job_lat, job_lon),
        estimated_distance_km=estimated_distance_km,
        estimated_eta_minutes=estimated_eta_minutes,
    )
    db.add(offer)

    metric = get_or_create_metric(db, tanker_id)
    metric.offers_total += 1
    if job_type == "priority":
        metric.priority_offers_total += 1
    metric.last_offered_at = datetime.utcnow()

    db.flush()
    return offer


def mark_offer_accepted(db: Session, offer: JobOffer, response_seconds: float | None = None):
    offer.response_type = "accepted"
    offer.responded_at = datetime.utcnow()
    offer.response_seconds = response_seconds

    metric = get_or_create_metric(db, offer.tanker_id)
    metric.accepts_total += 1
    if offer.job_type == "priority":
        metric.priority_accepts_total += 1
    metric.last_accepted_at = datetime.utcnow()

    if response_seconds is not None:
        old = metric.avg_response_seconds
        metric.avg_response_seconds = ((old * 4) + response_seconds) / 5


def mark_offer_declined(
    db: Session,
    offer: JobOffer,
    *,
    decline_reason: str,
    response_seconds: float | None = None,
):
    offer.response_type = "declined"
    offer.decline_reason = decline_reason
    offer.responded_at = datetime.utcnow()
    offer.response_seconds = response_seconds

    metric = get_or_create_metric(db, offer.tanker_id)
    metric.declines_total += 1
    metric.decline_count_today += 1

    if response_seconds is not None:
        old = metric.avg_response_seconds
        metric.avg_response_seconds = ((old * 4) + response_seconds) / 5


def mark_offer_timeout(db: Session, offer: JobOffer):
    offer.response_type = "timeout"
    offer.responded_at = datetime.utcnow()

    metric = get_or_create_metric(db, offer.tanker_id)
    metric.timeouts_total += 1
    metric.timeout_count_today += 1


def mark_job_completed(db: Session, tanker_id: int, job_type: str, earnings: float = 0.0):
    metric = get_or_create_metric(db, tanker_id)

    metric.completed_total += 1
    metric.jobs_completed_today += 1
    metric.earnings_today += earnings
    metric.last_completed_at = datetime.utcnow()

    if job_type == "priority":
        metric.priority_completed_total += 1


def get_open_offer_for_tanker(db: Session, tanker_id: int) -> JobOffer | None:
    return (
        db.query(JobOffer)
        .filter(
            JobOffer.tanker_id == tanker_id,
            JobOffer.response_type.is_(None),
        )
        .order_by(JobOffer.id.desc())
        .first()
    )


def has_active_offer_for_priority_request(db: Session, request_id: int) -> bool:
    return (
        db.query(Tanker)
        .filter(
            Tanker.pending_offer_type == "priority",
            Tanker.pending_offer_id == request_id,
            Tanker.offer_expires_at.is_not(None),
        )
        .first()
        is not None
    )


def has_active_offer_for_batch(db: Session, batch_id: int) -> bool:
    return (
        db.query(Tanker)
        .filter(
            Tanker.pending_offer_type == "batch",
            Tanker.pending_offer_id == batch_id,
            Tanker.offer_expires_at.is_not(None),
        )
        .first()
        is not None
    )




def mark_priority_assignment_failed(
    db: Session,
    request: LiquidRequest,
    *,
    reason: str,
    refund_eligible: bool = True,
) -> LiquidRequest:
    request.status = "assignment_failed"
    request.assignment_failed_reason = reason
    request.assignment_failed_at = datetime.utcnow()
    request.refund_eligible = refund_eligible
    db.add(request)
    db.flush()
    return request


def has_assignable_tanker_for_request(
    db: Session,
    request: LiquidRequest,
    excluded_tanker_ids: Iterable[int] | None = None,
) -> bool:
    ranked = rank_tankers_for_job(
        db,
        job_lat=request.latitude,
        job_lon=request.longitude,
        job_type="priority",
    )
    ranked = _filter_ranked_candidates(ranked, excluded_tanker_ids)
    return len(ranked) > 0


def is_priority_assignment_timeout_expired(request: LiquidRequest) -> bool:
    if request.status not in {"searching_driver", "assignment_pending"}:
        return False
    started_at = getattr(request, "assignment_started_at", None) or getattr(request, "created_at", None)
    if not started_at:
        return False
    return started_at + timedelta(minutes=PRIORITY_ASSIGNMENT_TIMEOUT_MINUTES) <= datetime.utcnow()


def process_priority_assignment_timeouts(db: Session) -> list[dict[str, Any]]:
    requests = (
        db.query(LiquidRequest)
        .filter(LiquidRequest.delivery_type == "priority")
        .filter(LiquidRequest.status.in_(["searching_driver", "assignment_pending"]))
        .all()
    )

    results: list[dict[str, Any]] = []
    for request in requests:
        if has_active_offer_for_priority_request(db, request.id):
            continue
        if not is_priority_assignment_timeout_expired(request):
            continue

        tried_ids = get_previously_tried_tanker_ids_for_priority_request(db, request.id)
        if has_assignable_tanker_for_request(db, request, excluded_tanker_ids=tried_ids):
            continue

        mark_priority_assignment_failed(
            db,
            request,
            reason=request.assignment_failed_reason or "no_driver_available_within_timeout",
            refund_eligible=True,
        )
        db.commit()
        db.refresh(request)
        results.append({
            "request_id": request.id,
            "status": request.status,
            "assignment_failed_at": request.assignment_failed_at.isoformat() if request.assignment_failed_at else None,
            "refund_eligible": request.refund_eligible,
            "reason": request.assignment_failed_reason,
        })

    return results


def clear_tanker_offer(db: Session, tanker: Tanker, *, make_available: bool = True) -> Tanker:
    tanker.pending_offer_type = None
    tanker.pending_offer_id = None
    tanker.offer_expires_at = None
    if make_available:
        tanker.status = "available"
        tanker.is_available = True
    db.add(tanker)
    db.flush()
    return tanker


def get_previously_tried_tanker_ids_for_priority_request(db: Session, request_id: int) -> set[int]:
    rows = (
        db.query(JobOffer.tanker_id)
        .filter(
            JobOffer.job_type == "priority",
            JobOffer.request_id == request_id,
        )
        .all()
    )
    return {row[0] for row in rows if row and row[0] is not None}


def get_previously_tried_tanker_ids_for_batch(db: Session, batch_id: int) -> set[int]:
    rows = (
        db.query(JobOffer.tanker_id)
        .filter(
            JobOffer.job_type == "batch",
            JobOffer.batch_id == batch_id,
        )
        .all()
    )
    return {row[0] for row in rows if row and row[0] is not None}


def _filter_ranked_candidates(
    ranked: list[tuple[Tanker, Any]],
    excluded_tanker_ids: Iterable[int] | None = None,
) -> list[tuple[Tanker, Any]]:
    excluded = set(excluded_tanker_ids or [])
    return [(t, b) for t, b in ranked if t.id not in excluded]


def assign_best_tanker_for_priority(
    db: Session,
    *,
    request: LiquidRequest,
    offer_limit: int = 5,
    excluded_tanker_ids: Iterable[int] | None = None,
):
    if request.status in {"completed", "cancelled", "failed", "assignment_failed"}:
        return None

    if has_active_offer_for_priority_request(db, request.id):
        return None

    ranked = rank_tankers_for_job(
        db,
        job_lat=request.latitude,
        job_lon=request.longitude,
        job_type="priority",
    )

    ranked = _filter_ranked_candidates(ranked, excluded_tanker_ids)[:offer_limit]
    if not ranked:
        return None

    tanker, breakdown = ranked[0]

    # OFFER-FIRST FLOW
    tanker.pending_offer_type = "priority"
    tanker.pending_offer_id = request.id
    # tanker.offer_expires_at = datetime.utcnow() + timedelta(seconds=OFFER_TTL_SECONDS)
    tanker.offer_expires_at = datetime.utcnow() + timedelta(seconds=OFFER_ACCEPT_TIMEOUT_SECONDS)
    tanker.status = "available"
    tanker.is_available = False

    request.status = "searching_driver"
    request.last_offer_at = datetime.utcnow()
    request.assignment_started_at = request.assignment_started_at or datetime.utcnow()
    request.assignment_failed_at = None
    request.assignment_failed_reason = None
    request.refund_eligible = False

    offer = create_job_offer(
        db,
        tanker_id=tanker.id,
        job_type="priority",
        request_id=request.id,
        job_lat=request.latitude,
        job_lon=request.longitude,
    )

    db.commit()
    db.refresh(tanker)
    db.refresh(request)

    return {
        "tanker": tanker,
        "offer_id": offer.id,
        "score_breakdown": breakdown,
        "ranked_candidates": [
            {
                "tanker_id": t.id,
                "score": b.final_score,
            }
            for t, b in ranked
        ],
    }


def retry_priority_assignment(
    db: Session,
    request_id: int,
    *,
    excluded_tanker_ids: Iterable[int] | None = None,
    failure_reason: str | None = None,
):
    request = db.query(LiquidRequest).filter(LiquidRequest.id == request_id).first()
    if not request:
        return {"assigned": False, "reason": "request_not_found", "request_id": request_id}

    if request.status in {"completed", "cancelled", "failed", "assignment_failed"}:
        return {"assigned": False, "reason": f"request_in_terminal_status:{request.status}", "request_id": request.id}

    if has_active_offer_for_priority_request(db, request.id):
        return {"assigned": False, "reason": "active_offer_already_exists", "request_id": request.id}

    if request.retry_count >= MAX_PRIORITY_ASSIGNMENT_RETRIES:
        mark_priority_assignment_failed(
            db,
            request,
            reason=failure_reason or "max_retry_limit_reached",
            refund_eligible=True,
        )
        db.commit()
        db.refresh(request)
        return {"assigned": False, "reason": "max_retry_limit_reached", "request_id": request.id, "status": request.status}

    tried_ids = get_previously_tried_tanker_ids_for_priority_request(db, request.id)
    if excluded_tanker_ids:
        tried_ids.update(excluded_tanker_ids)

    request.retry_count += 1
    request.status = "searching_driver"
    request.assignment_started_at = request.assignment_started_at or datetime.utcnow()
    request.assignment_failed_at = None
    request.refund_eligible = False
    db.add(request)
    db.flush()

    result = assign_best_tanker_for_priority(
        db,
        request=request,
        excluded_tanker_ids=tried_ids,
    )
    if result:
        return {
            "assigned": True,
            "request_id": request.id,
            "retry_count": request.retry_count,
            "tanker_id": result["tanker"].id,
            "offer_id": result["offer_id"],
        }

    if request.retry_count >= MAX_PRIORITY_ASSIGNMENT_RETRIES:
        mark_priority_assignment_failed(
            db,
            request,
            reason=failure_reason or "no_more_eligible_tankers",
            refund_eligible=True,
        )
    else:
        request.status = "searching_driver"
        request.assignment_failed_reason = failure_reason or "no_eligible_tankers_available_now"

    db.add(request)
    db.commit()
    db.refresh(request)
    return {
        "assigned": False,
        "request_id": request.id,
        "retry_count": request.retry_count,
        "status": request.status,
        "reason": request.assignment_failed_reason,
    }


def retry_batch_assignment(
    db: Session,
    batch_id: int,
    *,
    excluded_tanker_ids: Iterable[int] | None = None,
):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        return {"assigned": False, "reason": "batch_not_found", "batch_id": batch_id}

    if batch.status in {"completed", "expired", "cancelled", "assignment_failed"}:
        return {"assigned": False, "reason": f"batch_in_terminal_status:{batch.status}", "batch_id": batch.id}

    if has_active_offer_for_batch(db, batch.id):
        return {"assigned": False, "reason": "active_offer_already_exists", "batch_id": batch.id}

    members = (
        db.query(BatchMember)
        .filter(BatchMember.batch_id == batch.id)
        .all()
    )

    tried_ids = get_previously_tried_tanker_ids_for_batch(db, batch.id)
    if excluded_tanker_ids:
        tried_ids.update(excluded_tanker_ids)

    batch.status = "ready_for_assignment"
    batch.assignment_started_at = batch.assignment_started_at or datetime.utcnow()
    db.add(batch)
    db.flush()

    result = assign_best_tanker_for_batch(
        db,
        batch=batch,
        members=members,
        excluded_tanker_ids=tried_ids,
    )

    if result.get("assigned"):
        return result

    db.add(batch)
    db.commit()
    db.refresh(batch)
    result["batch_id"] = batch.id
    return result


def temporarily_blacklist_tanker_after_offer_timeout(tanker: Tanker) -> None:
    tanker.paused_until = datetime.utcnow() + timedelta(
        minutes=OFFER_TIMEOUT_BLACKLIST_MINUTES
    )
    tanker.status = "available"
    tanker.is_available = True


def count_offer_timeouts_for_job(
    db: Session,
    *,
    job_type: str,
    request_id: int | None = None,
    batch_id: int | None = None,
) -> int:
    q = db.query(JobOffer).filter(
        JobOffer.job_type == job_type,
        JobOffer.response_type == "timeout",
    )

    if job_type == "priority":
        q = q.filter(JobOffer.request_id == request_id)

    if job_type == "batch":
        q = q.filter(JobOffer.batch_id == batch_id)

    return q.count()


def maybe_create_offer_expiry_repeated_failure_alert(
    db: Session,
    *,
    job_type: str,
    job_id: int,
    request_id: int | None = None,
    batch_id: int | None = None,
    tanker_id: int | None = None,
    retry_result: dict | None = None,
) -> None:
    timeout_count = count_offer_timeouts_for_job(
        db,
        job_type=job_type,
        request_id=request_id,
        batch_id=batch_id,
    )

    retry_failed = not retry_result or retry_result.get("assigned") is False

    if timeout_count < OFFER_EXPIRY_ALERT_AFTER_FAILURES and not retry_failed:
        return

    create_operation_alert(
        db,
        alert_type="offer_expiry_repeated_failure",
        severity="critical" if timeout_count >= OFFER_EXPIRY_ALERT_AFTER_FAILURES else "warning",
        job_type=job_type,
        job_id=job_id,
        request_id=request_id,
        batch_id=batch_id,
        tanker_id=tanker_id,
        message=(
            f"{job_type.title()} job #{job_id} has offer expiry/retry problems. "
            f"Timeout count: {timeout_count}. "
            f"Latest retry result: {retry_result}"
        ),
    )


def expire_tanker_offer_and_recover(db: Session, tanker: Tanker) -> dict[str, Any]:
    pending_type = tanker.pending_offer_type
    pending_id = tanker.pending_offer_id

    if not pending_type or not pending_id:
        return {"expired": False, "reason": "no_pending_offer", "tanker_id": tanker.id}

    offer = get_open_offer_for_tanker(db, tanker.id)
    if offer:
        mark_offer_timeout(db, offer)

    clear_tanker_offer(db, tanker, make_available=True)
    temporarily_blacklist_tanker_after_offer_timeout(tanker)
    db.add(tanker)
    db.flush()

    retry_result = None

    if pending_type == "priority":
        retry_result = retry_priority_assignment(
            db,
            pending_id,
            excluded_tanker_ids=[tanker.id],
            failure_reason="offer_expired",
        )

        maybe_create_offer_expiry_repeated_failure_alert(
            db,
            job_type="priority",
            job_id=pending_id,
            request_id=pending_id,
            tanker_id=tanker.id,
            retry_result=retry_result,
        )

    elif pending_type == "batch":
        retry_result = retry_batch_assignment(
            db,
            pending_id,
            excluded_tanker_ids=[tanker.id],
        )

        maybe_create_offer_expiry_repeated_failure_alert(
            db,
            job_type="batch",
            job_id=pending_id,
            batch_id=pending_id,
            tanker_id=tanker.id,
            retry_result=retry_result,
        )

    db.commit()

    return {
        "expired": True,
        "tanker_id": tanker.id,
        "expired_offer_type": pending_type,
        "expired_offer_id": pending_id,
        "blacklisted_until": tanker.paused_until.isoformat() if tanker.paused_until else None,
        "retry": retry_result,
    }

def process_expired_offers(db: Session) -> list[dict[str, Any]]:
    now = datetime.utcnow()

    expired_tankers = (
        db.query(Tanker)
        .filter(
            Tanker.pending_offer_type.is_not(None),
            Tanker.pending_offer_id.is_not(None),
            Tanker.offer_expires_at.is_not(None),
            Tanker.offer_expires_at <= now,
        )
        .all()
    )

    results: list[dict[str, Any]] = []

    for tanker in expired_tankers:
        results.append(expire_tanker_offer_and_recover(db, tanker))

    return results


def assign_best_tanker_for_batch(
    db: Session,
    batch: Batch,
    members: list[BatchMember],
    excluded_tanker_ids: Iterable[int] | None = None,
) -> dict[str, Any]:
    current_status = str(getattr(batch, "status", "") or "").lower()
    if current_status in {"assigned", "loading", "delivering", "completed"}:
        return {
            "assigned": False,
            "batch_id": batch.id,
            "reason": f"Batch already in status '{current_status}'",
        }

    if has_active_offer_for_batch(db, batch.id):
        return {
            "assigned": False,
            "batch_id": batch.id,
            "reason": "Batch already has an active offer",
        }

    eligible_tankers = get_eligible_tankers_for_batch(
        db,
        batch,
        excluded_tanker_ids=excluded_tanker_ids,
    )
    if not eligible_tankers:
        return {
            "assigned": False,
            "batch_id": batch.id,
            "reason": "No eligible tankers found",
        }

    ranked = rank_tankers_for_batch(
        db=db,
        batch=batch,
        members=members,
        tankers=eligible_tankers,
    )

    if not ranked:
        return {
            "assigned": False,
            "batch_id": batch.id,
            "reason": "No ranked tanker candidates available",
        }

    best = ranked[0]
    tanker: Tanker = best["tanker"]

    # OFFER-FIRST FOR BATCH
    tanker.pending_offer_type = "batch"
    tanker.pending_offer_id = batch.id
    # tanker.offer_expires_at = datetime.utcnow() + timedelta(seconds=OFFER_TTL_SECONDS)
    tanker.offer_expires_at = datetime.utcnow() + timedelta(seconds=OFFER_ACCEPT_TIMEOUT_SECONDS)
    tanker.status = "available"
    tanker.is_available = False

    batch.status = "ready_for_assignment"
    batch.assignment_started_at = batch.assignment_started_at or datetime.utcnow()
    batch.assignment_failed_at = None

    offer = create_job_offer(
        db,
        tanker_id=tanker.id,
        job_type="batch",
        batch_id=batch.id,
        job_lat=batch.latitude,
        job_lon=batch.longitude,
    )

    db.commit()
    db.refresh(tanker)
    db.refresh(batch)

    return {
        "assigned": True,
        "offered": True,
        "batch_id": batch.id,
        "tanker_id": tanker.id,
        "offer_id": offer.id,
        "tanker_name": getattr(tanker, "driver_name", None),
        "score": best["score"],
        "score_breakdown": best["breakdown"],
        "reason": "Batch offer sent to best tanker",
    }


def get_eligible_tankers_for_batch(
    db: Session,
    batch: Batch,
    excluded_tanker_ids: Iterable[int] | None = None,
) -> list[Tanker]:
    batch_lat = getattr(batch, "latitude", None)
    batch_lon = getattr(batch, "longitude", None)
    configured_radius = float(getattr(batch, "search_radius_km", 0) or 0)
    max_radius_km = max(configured_radius, MIN_BATCH_ASSIGNMENT_RADIUS_KM)
    excluded = set(excluded_tanker_ids or [])

    if batch_lat is None or batch_lon is None:
        return []

    tankers = db.query(Tanker).all()
    eligible: list[Tanker] = []

    for tanker in tankers:
        if tanker.id in excluded:
            continue

        if not _is_assignable_available_tanker(tanker):
            continue

        if not _has_real_coordinates(tanker):
            continue

        if not _has_recent_location(tanker):
            continue

        tanker_lat = getattr(tanker, "latitude", None)
        tanker_lon = getattr(tanker, "longitude", None)

        distance_km = haversine_km(
            tanker_lat,
            tanker_lon,
            batch_lat,
            batch_lon,
        )

        if distance_km > max_radius_km:
            continue

        eligible.append(tanker)

    return eligible

# def get_eligible_tankers_for_batch(
#     db: Session,
#     batch: Batch,
#     excluded_tanker_ids: Iterable[int] | None = None,
# ) -> list[Tanker]:
#     batch_lat = getattr(batch, "latitude", None)
#     batch_lon = getattr(batch, "longitude", None)
#     configured_radius = float(getattr(batch, "search_radius_km", 0) or 0)
#     max_radius_km = max(configured_radius, MIN_BATCH_ASSIGNMENT_RADIUS_KM)
#     excluded = set(excluded_tanker_ids or [])

#     tankers = db.query(Tanker).all()
#     eligible: list[Tanker] = []
#     fallback: list[Tanker] = []

#     for tanker in tankers:
#         if tanker.id in excluded:
#             continue

#         if not _is_assignable_available_tanker(tanker):
#             continue

#         # Strong candidates: real coords + recent location + within radius
#         if (
#             batch_lat is not None
#             and batch_lon is not None
#             and _has_real_coordinates(tanker)
#             and _has_recent_location(tanker)
#         ):
#             tanker_lat = getattr(tanker, "latitude", None)
#             tanker_lon = getattr(tanker, "longitude", None)

#             distance_km = haversine_km(
#                 tanker_lat,
#                 tanker_lon,
#                 batch_lat,
#                 batch_lon,
#             )

#             if distance_km <= max_radius_km:
#                 eligible.append(tanker)
#                 continue
        
#         if not _has_recent_location(tanker):
#             continue
#         # Fallback candidates for MVP:
#         # allow assignable tankers even if location is stale/missing.
#         fallback.append(tanker)

#     return eligible if eligible else fallback


# -------- existing batch ranking helpers remain below --------
def rank_tankers_for_batch(
    db: Session,
    *,
    batch: Batch,
    members: list[BatchMember],
    tankers: list[Tanker],
) -> list[dict[str, Any]]:
    ranked: list[dict[str, Any]] = []

    # for tanker in tankers:
    #     score, breakdown = score_driver_for_batch(
    #         db=db,
    #         tanker=tanker,
    #         batch=batch,
    #         members=members,
    #     )
    #     ranked.append(
    #         {
    #             "tanker": tanker,
    #             "score": score,
    #             "breakdown": breakdown,
    #         }
    #     )

    for tanker in tankers:
        breakdown = score_driver_for_batch(
            db=db,
            tanker=tanker,
            batch=batch,
            members=members,
        )

        score = float(breakdown.get("final_score", 0.0) or 0.0)

        ranked.append(
            {
                "tanker": tanker,
                "score": score,
                "breakdown": breakdown,
            }
        )

    ranked.sort(key=lambda item: item["score"], reverse=True)
    return ranked
