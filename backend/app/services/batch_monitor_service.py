# app/services/batch_monitor_service.py

from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.models.batch import Batch
from app.models.batch_member import BatchMember
from app.services.assignment_service import assign_best_tanker_for_batch, has_active_offer_for_batch, get_eligible_tankers_for_batch
from app.services.batch_orchestration_service import refresh_batch_state
from app.services.batch_scoring_service import (
    is_batch_ready_for_assignment,
    should_widen_radius,
)
from app.services.batch_service import recalculate_batch_volume
from app.services.refund_service import execute_member_refund, is_member_eligible_for_refund
from app.services.routing_service import plan_batch_delivery_order

ACTIVE_BATCH_STATUSES = [
    "forming",
    "near_ready",
    "ready_for_assignment",
    "assigned",
    "loading",
    "delivering",
]

BATCH_FILL_TIMEOUT_MINUTES = 90
BATCH_ASSIGNMENT_TIMEOUT_MINUTES = 45


def refresh_batch_after_member_change(db: Session, batch_id: int) -> Batch:
    batch = recalculate_batch_volume(db, batch_id)

    fill_ratio = 0
    if batch.target_volume > 0:
        fill_ratio = batch.current_volume / batch.target_volume

    if batch.status in {"assigned", "loading", "delivering", "arrived", "completed", "expired"}:
        return batch

    if batch.current_volume <= 0:
        batch.status = "forming"
    elif fill_ratio < 0.8:
        batch.status = "forming"
    elif fill_ratio < 1.0:
        batch.status = "near_ready"
    else:
        batch.status = "ready_for_assignment"

    db.add(batch)
    db.commit()
    db.refresh(batch)
    return batch


def get_active_batches(db: Session) -> list[Batch]:
    return db.query(Batch).filter(Batch.status.in_(ACTIVE_BATCH_STATUSES)).all()


def get_batch_members(db: Session, batch_id: int) -> list[BatchMember]:
    return db.query(BatchMember).filter(BatchMember.batch_id == batch_id).all()


def is_batch_fill_timeout_expired(batch: Batch) -> bool:
    if batch.status not in {"forming", "near_ready"}:
        return False
    if not getattr(batch, "created_at", None):
        return False
    return batch.created_at + timedelta(minutes=BATCH_FILL_TIMEOUT_MINUTES) <= datetime.utcnow()


def expire_batch_and_trigger_refunds(db: Session, batch: Batch, reason: str = "batch_fill_timeout") -> dict:
    members = get_batch_members(db, batch.id)

    batch.status = "expired"
    batch.expires_at = datetime.utcnow()
    batch.tanker_id = None
    batch.loading_deadline = None
    db.add(batch)
    db.commit()
    db.refresh(batch)

    refunds_triggered = 0
    refund_failures: list[str] = []

    for member in members:
        if not is_member_eligible_for_refund(member, batch):
            continue
        try:
            execute_member_refund(db, member, batch)
            refunds_triggered += 1
        except Exception as exc:
            refund_failures.append(f"member_id={member.id}:{exc}")

    return {
        "batch_id": batch.id,
        "expired": True,
        "reason": reason,
        "refunds_triggered": refunds_triggered,
        "refund_failures": refund_failures,
    }




def is_batch_assignment_timeout_expired(batch: Batch) -> bool:
    if batch.status not in {"ready_for_assignment", "assigned"}:
        return False
    started_at = getattr(batch, "assignment_started_at", None)
    if not started_at:
        return False
    return started_at + timedelta(minutes=BATCH_ASSIGNMENT_TIMEOUT_MINUTES) <= datetime.utcnow()


def mark_batch_assignment_failed_and_refund(
    db: Session,
    batch: Batch,
    *,
    reason: str = "no_driver_available_within_timeout",
) -> dict:
    members = get_batch_members(db, batch.id)

    batch.status = "assignment_failed"
    batch.assignment_failed_at = datetime.utcnow()
    batch.tanker_id = None
    batch.loading_deadline = None
    db.add(batch)
    db.commit()
    db.refresh(batch)

    refunds_triggered = 0
    refund_failures: list[str] = []
    for member in members:
        if not is_member_eligible_for_refund(member, batch):
            # assignment_failed should refund paid active members too
            if not (member.status == "active" and member.payment_status == "paid" and member.refund_status in ["none", "failed"]):
                continue
        try:
            execute_member_refund(db, member, batch)
            refunds_triggered += 1
        except Exception as exc:
            refund_failures.append(f"member_id={member.id}:{exc}")

    return {
        "batch_id": batch.id,
        "status": batch.status,
        "reason": reason,
        "refunds_triggered": refunds_triggered,
        "refund_failures": refund_failures,
    }


def process_single_batch(db: Session, batch: Batch) -> dict:
    result = {
        "batch_id": batch.id,
        "previous_status": batch.status,
        "new_status": batch.status,
        "expired": False,
        "radius_widened": False,
        "assigned": False,
        "delivery_plan_updated": False,
        "errors": [],
    }

    try:
        refreshed = refresh_batch_state(db, batch.id)
        batch = refreshed["batch"]
        members = get_batch_members(db, batch.id)

        if is_batch_fill_timeout_expired(batch):
            expiry = expire_batch_and_trigger_refunds(db, batch)
            result["new_status"] = "expired"
            result["expired"] = True
            result["refunds_triggered"] = expiry["refunds_triggered"]
            if expiry["refund_failures"]:
                result["errors"].extend(expiry["refund_failures"])
            return result

        if is_batch_assignment_timeout_expired(batch) and not has_active_offer_for_batch(db, batch.id):
            eligible_now = get_eligible_tankers_for_batch(db, batch)
            if not eligible_now:
                failed = mark_batch_assignment_failed_and_refund(db, batch)
                result["new_status"] = "assignment_failed"
                result["refunds_triggered"] = failed["refunds_triggered"]
                if failed["refund_failures"]:
                    result["errors"].extend(failed["refund_failures"])
                return result

        if should_widen_radius(batch, members):
            batch.search_radius_km = min((batch.search_radius_km or 1) + 1, 5)
            batch.last_radius_expansion_at = datetime.utcnow()
            db.add(batch)
            db.commit()
            db.refresh(batch)
            result["radius_widened"] = True

        fill_ratio = (float(batch.current_volume or 0) / float(batch.target_volume)) if getattr(batch, "target_volume", 0) else 0.0
        if batch.status in ["near_ready", "ready_for_assignment"] and fill_ratio >= 0.9 and not has_active_offer_for_batch(db, batch.id) and not getattr(batch, "tanker_id", None):
            assignment_result = assign_best_tanker_for_batch(
                db,
                batch=batch,
                members=members,
            )
            if assignment_result.get("assigned"):
                result["assigned"] = True
                db.refresh(batch)

        if batch.status in ["assigned", "loading", "delivering"]:
            plan_batch_delivery_order(db, batch.id)
            result["delivery_plan_updated"] = True

        db.refresh(batch)
        result["new_status"] = batch.status

    except Exception as e:
        db.rollback()
        result["errors"].append(str(e))

    return result


def process_all_active_batches(db: Session) -> list[dict]:
    batches = get_active_batches(db)
    return [process_single_batch(db, batch) for batch in batches]
