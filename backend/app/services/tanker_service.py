from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.batch import Batch
from app.models.batch_member import BatchMember
from app.models.request import LiquidRequest
from app.models.tanker import Tanker
from app.services.batch_service import (
    get_batch_by_id,
    mark_batch_arrived,
    mark_batch_assigned,
    mark_batch_completed,
    mark_batch_delivering,
    mark_batch_loading,
)
from app.services.routing_service import (
    find_closest_tanker_to_batch,
    sort_members_by_distance_from_tanker,
)

LOADING_WINDOW_MINUTES = 45


def get_tanker_by_id(db: Session, tanker_id: int) -> Tanker:
    tanker = db.query(Tanker).filter(Tanker.id == tanker_id).first()
    if not tanker:
        raise HTTPException(status_code=404, detail="Tanker not found")
    return tanker


def get_current_job(db: Session, tanker_id: int) -> dict[str, Any]:
    tanker = get_tanker_by_id(db, tanker_id)

    batch = db.query(Batch).filter(Batch.tanker_id == tanker.id, Batch.status != "completed").first()
    if batch:
        return {
            "job_type": "batch",
            "batch_id": batch.id,
            "status": batch.status,
        }

    if tanker.current_request_id:
        request = db.query(LiquidRequest).filter(LiquidRequest.id == tanker.current_request_id).first()
        if request and request.status != "completed":
            return {
                "job_type": "priority",
                "request_id": request.id,
                "status": request.status,
            }

    return {"job_type": None, "message": "No current job assigned"}


def accept_batch_job(db: Session, tanker_id: int, batch_id: int) -> dict[str, Any]:
    tanker = get_tanker_by_id(db, tanker_id)
    batch = get_batch_by_id(db, batch_id)

    if batch.tanker_id != tanker.id:
        raise HTTPException(status_code=403, detail="This batch is not assigned to this tanker")

    tanker.status = "assigned"
    batch.status = "assigned"

    db.commit()
    return {"message": "Batch job accepted", "batch_id": batch.id, "tanker_id": tanker.id}


def mark_loading(db: Session, tanker_id: int, batch_id: int) -> dict[str, Any]:
    tanker = get_tanker_by_id(db, tanker_id)
    batch = get_batch_by_id(db, batch_id)

    if batch.tanker_id != tanker.id:
        raise HTTPException(status_code=403, detail="Unauthorized tanker for batch")

    tanker.status = "loading"
    mark_batch_loading(db, batch_id)

    db.commit()
    db.refresh(tanker)

    return {"message": "Tanker is loading", "tanker_status": tanker.status, "batch_status": batch.status}


def mark_loaded_and_departed(db: Session, tanker_id: int, batch_id: int) -> dict[str, Any]:
    tanker = get_tanker_by_id(db, tanker_id)
    batch = get_batch_by_id(db, batch_id)

    if batch.tanker_id != tanker.id:
        raise HTTPException(status_code=403, detail="Unauthorized tanker for batch")

    tanker.status = "delivering"
    mark_batch_delivering(db, batch_id)

    db.commit()
    db.refresh(tanker)

    return {"message": "Tanker departed for delivery", "tanker_status": tanker.status}


def mark_arrived(db: Session, tanker_id: int, batch_id: int) -> dict[str, Any]:
    tanker = get_tanker_by_id(db, tanker_id)
    batch = get_batch_by_id(db, batch_id)

    if batch.tanker_id != tanker.id:
        raise HTTPException(status_code=403, detail="Unauthorized tanker for batch")

    tanker.status = "arrived"
    mark_batch_arrived(db, batch_id)

    db.commit()
    db.refresh(tanker)

    return {"message": "Tanker arrived", "tanker_status": tanker.status}


def mark_tanker_available(db: Session, tanker_id: int) -> Tanker:
    tanker = get_tanker_by_id(db, tanker_id)
    tanker.status = "available"
    tanker.is_available = True
    tanker.current_request_id = None
    db.commit()
    db.refresh(tanker)
    return tanker


def release_tanker(db: Session, tanker_id: int) -> Tanker:
    return mark_tanker_available(db, tanker_id)


def complete_batch_delivery(db: Session, tanker_id: int, batch_id: int) -> dict[str, Any]:
    tanker = get_tanker_by_id(db, tanker_id)
    batch = get_batch_by_id(db, batch_id)

    if batch.tanker_id != tanker.id:
        raise HTTPException(status_code=403, detail="Unauthorized tanker for batch")

    members = db.query(BatchMember).filter(
        BatchMember.batch_id == batch.id,
        BatchMember.status == "active",
    ).all()

    for member in members:
        member.status = "delivered"

    mark_batch_completed(db, batch.id)
    tanker_payment = pay_tanker_internal(db, tanker.id)
    release_tanker(db, tanker.id)

    return {
        "message": "Batch delivery completed",
        "batch_id": batch.id,
        "tanker_payment": tanker_payment,
    }


def complete_priority_delivery(db: Session, tanker_id: int, request_id: int) -> dict[str, Any]:
    tanker = get_tanker_by_id(db, tanker_id)

    request = db.query(LiquidRequest).filter(LiquidRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Priority request not found")

    if tanker.current_request_id != request.id:
        raise HTTPException(status_code=403, detail="This priority request is not assigned to this tanker")

    request.status = "completed"
    db.commit()

    release_tanker(db, tanker.id)

    return {
        "message": "Priority delivery completed",
        "request_id": request.id,
    }


def pay_tanker_internal(db: Session, tanker_id: int) -> dict[str, Any]:
    tanker = get_tanker_by_id(db, tanker_id)

    delivered_members = db.query(BatchMember).filter(
        BatchMember.status == "delivered",
        BatchMember.batch.has(tanker_id=tanker_id),
    ).all()

    total_volume = sum(m.volume_liters for m in delivered_members)
    rate_per_liter = 1.5
    payment_amount = total_volume * rate_per_liter

    return {
        "tanker_id": tanker.id,
        "total_volume": total_volume,
        "payment_amount": payment_amount,
        "status": "paid",
    }


def pay_tanker(db: Session, tanker_id: int) -> dict[str, Any]:
    payment = pay_tanker_internal(db, tanker_id)
    release_tanker(db, tanker_id)
    return payment

def get_available_tankers(db: Session, liquid_id: int | None = None) -> list[Tanker]:
    query = db.query(Tanker).filter(Tanker.status == "available", Tanker.is_available == True)

    if liquid_id is not None:
        query = query.filter(Tanker.liquid_id == liquid_id)

    return query.all()