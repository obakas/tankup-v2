from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.models.batch import Batch
from app.models.batch_member import BatchMember
from app.services.assignment_service import assign_best_tanker_for_batch
from app.services.batch_scoring_service import (
    calculate_batch_health_score,
    get_batch_dispatch_priority,
    is_batch_near_ready,
    is_batch_ready_for_assignment,
    should_expire_batch,
    should_widen_radius,
)
from app.services.batch_service import (
    get_batch_by_id,
    get_batch_members,
    update_batch_center,
    update_batch_current_volume,
    update_batch_status,
)
from app.services.routing_service import plan_batch_delivery_order


def build_batch_state_snapshot(batch: Batch, members: list[BatchMember]) -> dict[str, Any]:
    score = calculate_batch_health_score(batch, members)

    return {
        "batch_id": batch.id,
        "status": getattr(batch, "status", None),
        "current_volume": getattr(batch, "current_volume", None),
        "target_volume": getattr(batch, "target_volume", None),
        "health_score": score.health_score,
        "fill_ratio": score.fill_ratio,
        "payment_ratio": score.payment_ratio,
        "geo_compactness": score.geo_compactness,
        "wait_urgency": score.wait_urgency,
        "paid_members_count": score.paid_members_count,
        "total_members_count": score.total_members_count,
        "dispatch_priority": get_batch_dispatch_priority(batch, members),
        "should_widen_radius": should_widen_radius(batch, members),
        "is_near_ready": is_batch_near_ready(batch, members),
        "is_ready_for_assignment": is_batch_ready_for_assignment(batch, members),
        "should_expire": should_expire_batch(batch, members),
        "assignment": None,
    }


def determine_next_batch_status(batch: Batch, members: list[BatchMember]) -> str:
    """
    Recommended status ladder:
    - forming
    - near_ready
    - ready_for_assignment
    - assigned
    - loading
    - delivering
    - completed
    - expired

    This function only decides early/mid lifecycle statuses.
    It should not override downstream operational statuses.
    """
    current_status = str(getattr(batch, "status", "forming") or "forming").lower()

    protected_statuses = {
        "assigned",
        "loading",
        "delivering",
        "arrived",
        "completed",
        "expired",
        "cancelled",
        "assignment_failed",
    }
    if current_status in protected_statuses:
        return current_status

    if should_expire_batch(batch, members):
        return "expired"

    if is_batch_ready_for_assignment(batch, members):
        return "ready_for_assignment"

    if is_batch_near_ready(batch, members):
        return "near_ready"

    return "forming"


def refresh_batch_state(db: Session, batch_id: int) -> dict[str, Any]:
    batch = get_batch_by_id(db, batch_id)
    if not batch:
        raise ValueError(f"Batch {batch_id} not found")

    # 1. Recompute paid volume first
    update_batch_current_volume(db, batch.id)
    db.refresh(batch)

    # 2. Recompute center before health scoring
    update_batch_center(db, batch)
    db.refresh(batch)

    # 3. Score and determine status
    members = get_batch_members(db, batch.id)
    next_status = determine_next_batch_status(batch, members)

    if batch.status != next_status:
        batch.status = next_status
        db.add(batch)
        db.commit()
        db.refresh(batch)

    members = get_batch_members(db, batch.id)
    snapshot = build_batch_state_snapshot(batch, members)

    # 4. Auto-attempt assignment when batch is mature enough
    fill_ratio = 0.0
    if batch.target_volume and batch.target_volume > 0:
        fill_ratio = float(batch.current_volume or 0) / float(batch.target_volume)

    should_attempt_assignment = batch.status in {"near_ready", "ready_for_assignment"}

    if should_attempt_assignment and fill_ratio >= 0.9 and not getattr(batch, "tanker_id", None):
        assignment_result = assign_tanker_if_ready(db, batch.id, allow_near_ready=True)

        # refresh after assignment attempt in case status/tanker changed
        db.refresh(batch)
        members = get_batch_members(db, batch.id)
        snapshot = build_batch_state_snapshot(batch, members)
        snapshot["assignment"] = assignment_result

    return snapshot


def handle_batch_member_join(
    db: Session,
    batch_id: int,
) -> dict[str, Any]:
    """
    Call this after a member has been added into a batch.
    """
    return refresh_batch_state(db, batch_id)


def handle_batch_payment_confirmed(
    db: Session,
    batch_id: int,
    member_id: int,
) -> dict[str, Any]:
    member = (
        db.query(BatchMember)
        .filter(
            BatchMember.id == member_id,
            BatchMember.batch_id == batch_id,
        )
        .first()
    )

    if not member:
        raise ValueError(f"Batch member {member_id} not found in batch {batch_id}")

    batch = get_batch_by_id(db, batch_id)
    if not batch:
        raise ValueError(f"Batch {batch_id} not found")

    # Normalize member state after payment confirmation
    member_status = str(getattr(member, "status", "") or "").lower()
    payment_status = str(getattr(member, "payment_status", "") or "").lower()

    if payment_status == "paid" and member_status in {"pending", "confirmed", "reserved", ""}:
        member.status = "active"
        db.add(member)
        db.commit()
        db.refresh(member)

    snapshot = refresh_batch_state(db, batch_id)
    return snapshot


def assign_tanker_if_ready(
    db: Session,
    batch_id: int,
    allow_near_ready: bool = False,
) -> dict[str, Any]:
    batch = get_batch_by_id(db, batch_id)
    if not batch:
        raise ValueError(f"Batch {batch_id} not found")

    members = get_batch_members(db, batch_id)

    fill_ratio = 0.0
    if batch.target_volume and batch.target_volume > 0:
        fill_ratio = float(batch.current_volume or 0) / float(batch.target_volume)

    ready = is_batch_ready_for_assignment(batch, members)
    near_ready_enough = allow_near_ready and fill_ratio >= 0.9

    if not ready and not near_ready_enough:
        return {
            "assigned": False,
            "reason": "Batch is not ready for assignment",
            "batch_id": batch_id,
        }

    current_status = str(getattr(batch, "status", "") or "").lower()
    if current_status in {"assigned", "loading", "delivering", "arrived", "completed"}:
        return {
            "assigned": False,
            "reason": f"Batch already in operational status '{current_status}'",
            "batch_id": batch_id,
        }

    if getattr(batch, "tanker_id", None):
        return {
            "assigned": False,
            "reason": "Batch already has a tanker assigned",
            "batch_id": batch_id,
        }

    result = assign_best_tanker_for_batch(db=db, batch=batch, members=members)

    if result.get("assigned"):
        db.refresh(batch)

    return result


def prepare_batch_for_delivery(db: Session, batch_id: int) -> dict[str, Any]:
    """
    Builds an ordered stop plan once the batch has a tanker and is about to deliver.
    """
    batch = get_batch_by_id(db, batch_id)
    if not batch:
        raise ValueError(f"Batch {batch_id} not found")

    members = get_batch_members(db, batch_id)

    if batch.status not in {"assigned", "loading"}:
        return {"error": "Batch not ready for delivery planning"}

    ordered_stops = plan_batch_delivery_order(batch=batch, members=members)

    return {
        "batch_id": batch_id,
        "delivery_plan": ordered_stops,
        "stop_count": len(ordered_stops),
    }


def handle_stale_batch(db: Session, batch_id: int) -> dict[str, Any]:
    """
    This can be called by admin tools, scheduled jobs, or manual refresh logic.
    """
    batch = get_batch_by_id(db, batch_id)
    if not batch:
        raise ValueError(f"Batch {batch_id} not found")

    members = get_batch_members(db, batch_id)

    if should_expire_batch(batch, members):
        update_batch_status(db, batch, "expired")
        db.refresh(batch)

        return {
            "batch_id": batch_id,
            "expired": True,
            "status": batch.status,
            "reason": "Batch expired due to age and weak formation",
        }

    return {
        "batch_id": batch_id,
        "expired": False,
        "status": getattr(batch, "status", None),
        "reason": "Batch did not meet expiration rule",
    }