from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.models.batch import Batch
from app.models.DeliveryRecord import DeliveryRecord
from app.models.request import LiquidRequest
from app.models.tanker import Tanker

DELIVERY_TIMEOUT_HOURS = 6
RESOLVED_DELIVERY_STATUSES = {"delivered", "failed", "skipped"}


def _mark_unresolved_deliveries_failed(db: Session, deliveries: list[DeliveryRecord], reason: str) -> int:
    count = 0
    for delivery in deliveries:
        if delivery.delivery_status in RESOLVED_DELIVERY_STATUSES:
            continue
        delivery.delivery_status = "failed"
        delivery.failure_reason = reason
        delivery.notes = reason
        delivery.delivered_at = delivery.delivered_at or datetime.utcnow()
        db.add(delivery)
        count += 1
    return count


def _resolve_batch_timeout(db: Session, batch: Batch) -> dict:
    deliveries = db.query(DeliveryRecord).filter(DeliveryRecord.batch_id == batch.id).all()
    delivered_count = sum(1 for d in deliveries if d.delivery_status == "delivered")
    unresolved_failed = _mark_unresolved_deliveries_failed(db, deliveries, "delivery_timeout")

    tanker = db.query(Tanker).filter(Tanker.id == batch.tanker_id).first() if batch.tanker_id else None

    batch.status = "partially_completed" if delivered_count > 0 else "failed"
    batch.completed_at = datetime.utcnow()
    batch.loading_deadline = None
    batch.tanker_id = None
    db.add(batch)

    if tanker:
        tanker.current_request_id = None
        tanker.pending_offer_type = None
        tanker.pending_offer_id = None
        tanker.offer_expires_at = None
        tanker.status = "available"
        tanker.is_available = True
        db.add(tanker)

    db.commit()
    return {
        "job_type": "batch",
        "job_id": batch.id,
        "new_status": batch.status,
        "unresolved_marked_failed": unresolved_failed,
        "delivered_count": delivered_count,
    }


def _resolve_priority_timeout(db: Session, request: LiquidRequest) -> dict:
    deliveries = db.query(DeliveryRecord).filter(
        DeliveryRecord.job_type == "priority",
        DeliveryRecord.request_id == request.id,
    ).all()
    delivered_count = sum(1 for d in deliveries if d.delivery_status == "delivered")
    unresolved_failed = _mark_unresolved_deliveries_failed(db, deliveries, "delivery_timeout")

    tanker = db.query(Tanker).filter(Tanker.current_request_id == request.id).first()

    request.status = "partially_completed" if delivered_count > 0 else "failed"
    request.completed_at = datetime.utcnow()
    db.add(request)

    if tanker:
        tanker.current_request_id = None
        tanker.pending_offer_type = None
        tanker.pending_offer_id = None
        tanker.offer_expires_at = None
        tanker.status = "available"
        tanker.is_available = True
        db.add(tanker)

    db.commit()
    return {
        "job_type": "priority",
        "job_id": request.id,
        "new_status": request.status,
        "unresolved_marked_failed": unresolved_failed,
        "delivered_count": delivered_count,
    }


def expire_overdue_deliveries(db: Session) -> list[dict]:
    now = datetime.utcnow()
    batch_threshold = now - timedelta(hours=DELIVERY_TIMEOUT_HOURS)
    request_threshold = now - timedelta(hours=DELIVERY_TIMEOUT_HOURS)

    overdue_batches = db.query(Batch).filter(
        Batch.status == "delivering",
        Batch.delivering_started_at.isnot(None),
        Batch.delivering_started_at < batch_threshold,
    ).all()

    overdue_requests = db.query(LiquidRequest).filter(
        LiquidRequest.status == "delivering",
        LiquidRequest.delivering_started_at.isnot(None),
        LiquidRequest.delivering_started_at < request_threshold,
    ).all()

    results = []
    for batch in overdue_batches:
        results.append(_resolve_batch_timeout(db, batch))

    for request in overdue_requests:
        results.append(_resolve_priority_timeout(db, request))

    return results
