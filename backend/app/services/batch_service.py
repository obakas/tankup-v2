from __future__ import annotations

from datetime import datetime
import secrets
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.batch import Batch
from app.models.batch_member import BatchMember
from app.models.request import LiquidRequest
from app.models.tanker import Tanker
from app.services.routing_service import calculate_distance_km

RADIUS_KM = 3.0
TARGET_BATCH_VOLUME = 10000.0


def get_batch_by_id(db: Session, batch_id: int) -> Batch:
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return batch


def get_batch_members(db: Session, batch_id: int) -> list[BatchMember]:
    return db.query(BatchMember).filter(BatchMember.batch_id == batch_id).all()


def update_batch_status(db: Session, batch: Batch, status: str) -> Batch:
    batch.status = status
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return batch


def _generate_delivery_code(member_id: int) -> str:
    # Random 4-digit OTP. We keep the signature for compatibility even though
    # the member id is no longer used to derive the code.
    return f"{secrets.randbelow(9000) + 1000}"


def _create_paid_active_member(db: Session, batch: Batch, request: LiquidRequest) -> BatchMember:
    """
    Insert a user into the batch only AFTER payment has succeeded.

    This is the correct rule for your product:
    - no unpaid batch members
    - no reservation slot for unpaid users
    - user enters the batch as committed / paid
    """
    existing_member = (
        db.query(BatchMember)
        .filter(
            BatchMember.batch_id == batch.id,
            BatchMember.request_id == request.id,
        )
        .first()
    )
    if existing_member:
        return existing_member

    member = BatchMember(
        batch_id=batch.id,
        request_id=request.id,
        user_id=request.user_id,
        volume_liters=request.volume_liters,
        requested_volume=request.volume_liters,
        status="active",
        payment_status="paid",
        latitude=request.latitude,
        longitude=request.longitude,
    )
    db.add(member)
    db.flush()

    member.delivery_code = _generate_delivery_code(member.id)
    db.add(member)
    db.flush()

    return member


def create_new_batch_with_request(db: Session, request: LiquidRequest) -> dict[str, Any]:
    """
    Create a new batch and add the first PAID member immediately.
    """
    batch = Batch(
        liquid_id=request.liquid_id,
        current_volume=0,
        target_volume=TARGET_BATCH_VOLUME,
        latitude=request.latitude,
        longitude=request.longitude,
        status="forming",
        search_radius_km=RADIUS_KM,
    )

    db.add(batch)
    db.flush()

    member = _create_paid_active_member(db, batch, request)

    db.commit()
    db.refresh(batch)
    db.refresh(member)

    return {"batch": batch, "member": member}


def attach_request_to_batch(db: Session, batch: Batch, request: LiquidRequest) -> dict[str, Any]:
    """
    Attach a PAID request to an existing batch.
    """
    member = _create_paid_active_member(db, batch, request)
    db.commit()
    db.refresh(batch)
    db.refresh(member)
    return {"batch": batch, "member": member}


def _joinable_batch_statuses() -> set[str]:
    """
    Batches that are still open for additional paid members.
    """
    return {"forming", "near_ready", "ready_for_assignment"}


def _get_committed_volume_for_batch(db: Session, batch_id: int) -> float:
    """
    Committed volume should reflect actual paid members occupying capacity.

    We count only members that are still effectively in the batch.
    Exclude:
    - withdrawn
    - expired
    - refunded
    - forfeited
    - cancelled
    """
    members = (
        db.query(BatchMember)
        .filter(BatchMember.batch_id == batch_id)
        .all()
    )

    valid_statuses = {"active", "delivered"}
    valid_payment_statuses = {"paid"}

    committed_members = [
        m for m in members
        if str(getattr(m, "status", "") or "").lower() in valid_statuses
        and str(getattr(m, "payment_status", "") or "").lower() in valid_payment_statuses
    ]

    return sum(float(getattr(m, "volume_liters", 0) or 0) for m in committed_members)


def _batch_can_accept_request(db: Session, batch: Batch, request: LiquidRequest) -> bool:
    committed_volume = _get_committed_volume_for_batch(db, batch.id)
    target_volume = float(getattr(batch, "target_volume", 0) or 0)
    requested_volume = float(getattr(request, "volume_liters", 0) or 0)

    if target_volume <= 0:
        return False

    if requested_volume <= 0:
        return False

    if committed_volume + requested_volume > target_volume:
        return False

    batch_lat = getattr(batch, "latitude", None)
    batch_lon = getattr(batch, "longitude", None)
    req_lat = getattr(request, "latitude", None)
    req_lon = getattr(request, "longitude", None)

    if None in {batch_lat, batch_lon, req_lat, req_lon}:
        return False

    radius_km = float(getattr(batch, "search_radius_km", None) or RADIUS_KM)
    distance_km = calculate_distance_km(
        batch.longitude,
        batch.latitude,
        request.longitude,
        request.latitude,
    )

    return distance_km <= radius_km


def find_or_create_batch(db: Session, request: LiquidRequest) -> dict[str, Any]:
    """
    Find a nearby joinable batch within radius and remaining capacity;
    otherwise create a new one.

    Return contract is ALWAYS:
    {
        "batch": Batch,
        "member": BatchMember
    }
    """
    batches = (
        db.query(Batch)
        .filter(
            Batch.liquid_id == request.liquid_id,
            Batch.status.in_(list(_joinable_batch_statuses())),
        )
        .order_by(Batch.created_at.asc())
        .all()
    )

    # best_batch: Batch | None = None
    # best_distance: float | None = None

    # for batch in batches:
    #     if not _batch_can_accept_request(db, batch, request):
    #         continue

    #     distance_km = calculate_distance_km(
    #         batch.longitude,
    #         batch.latitude,
    #         request.longitude,
    #         request.latitude,
    #     )

    #     if best_batch is None or distance_km < (best_distance or float("inf")):
    #         best_batch = batch
    #         best_distance = distance_km

    best_batch: Batch | None = None
    best_score: float | None = None

    for batch in batches:
        if not _batch_can_accept_request(db, batch, request):
            continue

        committed_volume = _get_committed_volume_for_batch(db, batch.id)

        distance_km = calculate_distance_km(
            batch.longitude,
            batch.latitude,
            request.longitude,
            request.latitude,
        )

        # 🎯 SCORING STRATEGY
        # prioritize fill first, distance second
        score = committed_volume - (distance_km * 10)

        if best_batch is None or score > (best_score or float("-inf")):
            best_batch = batch
            best_score = score

    if best_batch:
        return attach_request_to_batch(db, best_batch, request)

    return create_new_batch_with_request(db, request)


def update_batch_center(db: Session, batch: Batch) -> Batch:
    """
    Recompute batch center using committed paid members still in the batch.
    """
    members = db.query(BatchMember).filter(BatchMember.batch_id == batch.id).all()

    source_members = [
        m for m in members
        if str(getattr(m, "status", "") or "").lower() in {"active", "delivered", "pending"}
        and str(getattr(m, "payment_status", "") or "").lower() == "paid"
        and getattr(m, "latitude", None) is not None
        and getattr(m, "longitude", None) is not None
    ]

    if not source_members:
        return batch

    avg_lat = sum(float(m.latitude) for m in source_members) / len(source_members)
    avg_lon = sum(float(m.longitude) for m in source_members) / len(source_members)

    batch.latitude = avg_lat
    batch.longitude = avg_lon
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return batch


def update_batch_current_volume(db: Session, batch_id: int) -> float:
    batch = get_batch_by_id(db, batch_id)

    members = get_batch_members(db, batch_id) or []

    paid_members = [
        m for m in members
        if str(getattr(m, "status", "") or "").lower() in {"active", "delivered", "pending"}
        and str(getattr(m, "payment_status", "") or "").lower() == "paid"
    ]

    batch.current_volume = sum(
        float(getattr(m, "volume_liters", 0) or 0)
        for m in paid_members
    )

    db.add(batch)
    db.commit()
    db.refresh(batch)

    return float(batch.current_volume or 0)


def recalculate_batch_volume(db: Session, batch_id: int) -> Batch:
    """
    Set batch.current_volume from committed paid members.
    """
    batch = get_batch_by_id(db, batch_id)
    update_batch_current_volume(db, batch_id)
    db.refresh(batch)
    return batch


def mark_batch_ready(db: Session, batch_id: int) -> Batch:
    batch = get_batch_by_id(db, batch_id)
    batch.status = "ready_for_assignment"
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return batch


def mark_batch_assigned(db: Session, batch_id: int, tanker_id: int) -> Batch:
    batch = get_batch_by_id(db, batch_id)
    batch.status = "assigned"
    batch.tanker_id = tanker_id
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return batch


def mark_batch_loading(db: Session, batch_id: int) -> Batch:
    batch = get_batch_by_id(db, batch_id)
    batch.status = "loading"
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return batch


def mark_batch_delivering(db: Session, batch_id: int) -> Batch:
    batch = get_batch_by_id(db, batch_id)
    batch.status = "delivering"
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return batch


def mark_batch_arrived(db: Session, batch_id: int) -> Batch:
    batch = get_batch_by_id(db, batch_id)
    batch.status = "arrived"
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return batch


def mark_batch_completed(db: Session, batch_id: int) -> Batch:
    batch = get_batch_by_id(db, batch_id)
    batch.status = "completed"
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return batch


def cleanup_expired_members(db: Session) -> int:
    """
    Legacy cleanup for older pending/unpaid rows if they still exist from old tests.
    In the paid-first model, this should normally do little or nothing.
    """
    expired_members = db.query(BatchMember).filter(
        BatchMember.status == "pending",
        BatchMember.payment_status.in_(["unpaid", "pending"]),
    ).all()

    count = 0
    for member in expired_members:
        member.status = "expired"
        member.payment_status = "expired"
        count += 1

    db.commit()
    return count


# def cleanup_unaccepted_batches(db: Session) -> int:
#     """
#     If tanker did not respond before loading_deadline, release tanker and reset batch.
#     """
#     expired_batches = db.query(Batch).filter(
#         Batch.status == "assigned",
#         Batch.loading_deadline < getattr(__import__("datetime"), "datetime").utcnow(),
#     ).all()

#     count = 0
#     for batch in expired_batches:
#         tanker = db.query(Tanker).filter(Tanker.id == batch.tanker_id).first()

#         if tanker:
#             tanker.status = "available"
#             tanker.is_available = True

#         batch.status = "ready_for_assignment"
#         batch.tanker_id = None
#         batch.loading_deadline = None
#         count += 1

#     db.commit()
#     return count

def cleanup_unaccepted_batches(db: Session) -> int:
    """
    If tanker did not respond before loading_deadline, release tanker and reset batch.
    """
    expired_batches = db.query(Batch).filter(
        Batch.status == "assigned",
        Batch.loading_deadline < datetime.utcnow(),
    ).all()

    count = 0
    for batch in expired_batches:
        tanker = db.query(Tanker).filter(Tanker.id == batch.tanker_id).first()

        if tanker:
            tanker.status = "available"
            tanker.is_available = True

        batch.status = "ready_for_assignment"
        batch.tanker_id = None
        batch.loading_deadline = None
        count += 1

    db.commit()
    return count