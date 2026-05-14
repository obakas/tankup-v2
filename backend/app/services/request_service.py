from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.request import LiquidRequest
from app.schemas.request import RequestCreate

ASAP_BUFFER_MINUTES = 90


def resolve_priority_scheduled_for(data: RequestCreate) -> datetime:
    """
    Resolve the final scheduled datetime for a priority request.
    - ASAP: current time + buffer
    - Scheduled: use provided scheduled_for
    """
    if data.is_asap:
        return datetime.utcnow() + timedelta(minutes=ASAP_BUFFER_MINUTES)

    if data.scheduled_for is None:
        raise HTTPException(
            status_code=400,
            detail="scheduled_for is required for scheduled priority delivery",
        )

    return data.scheduled_for


def build_batch_request(data: RequestCreate) -> LiquidRequest:
    """
    Create an unsaved batch request model instance.
    """
    return LiquidRequest(
        user_id=data.user_id,
        liquid_id=data.liquid_id,
        volume_liters=data.volume_liters,
        latitude=data.latitude,
        longitude=data.longitude,
        delivery_type="batch",
        is_asap=False,
        scheduled_for=None,
        status="pending",
    )


def build_priority_request(data: RequestCreate) -> LiquidRequest:
    """
    Create an unsaved priority request model instance.
    """
    final_scheduled_for = resolve_priority_scheduled_for(data)

    # For ASAP, you may choose assigned later in flow.
    # For scheduled, keep it pending until activation.
    initial_status = "pending"

    return LiquidRequest(
        user_id=data.user_id,
        liquid_id=data.liquid_id,
        volume_liters=data.volume_liters,
        latitude=data.latitude,
        longitude=data.longitude,
        delivery_type="priority",
        is_asap=data.is_asap,
        scheduled_for=final_scheduled_for,
        status=initial_status,
    )


def save_request(db: Session, request: LiquidRequest) -> LiquidRequest:
    """
    Persist request and return refreshed object.
    """
    db.add(request)
    db.flush()
    db.commit()
    db.refresh(request)
    return request


def create_batch_request_record(db: Session, data: RequestCreate) -> LiquidRequest:
    """
    Build + save a batch request.
    """
    request = build_batch_request(data)
    return save_request(db, request)


def create_priority_request_record(db: Session, data: RequestCreate) -> LiquidRequest:
    """
    Build + save a priority request.
    """
    request = build_priority_request(data)
    return save_request(db, request)


def get_request_by_id(db: Session, request_id: int) -> LiquidRequest:
    request = db.query(LiquidRequest).filter(LiquidRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    return request


def update_request_status(db: Session, request_id: int, status: str) -> LiquidRequest:
    request = get_request_by_id(db, request_id)
    request.status = status
    db.commit()
    db.refresh(request)
    return request


def assign_request_to_tanker(db: Session, request_id: int, tanker_id: int) -> LiquidRequest:
    """
    Optional helper if your request model stores tanker_id/current assignment later.
    """
    request = get_request_by_id(db, request_id)
    request.status = "assigned"
    # request.tanker_id = tanker_id  # Uncomment if your model supports it
    db.commit()
    db.refresh(request)
    return request


def mark_request_completed(db: Session, request_id: int) -> LiquidRequest:
    request = get_request_by_id(db, request_id)
    request.status = "completed"
    db.commit()
    db.refresh(request)
    return request


def cancel_request(db: Session, request_id: int) -> LiquidRequest:
    request = get_request_by_id(db, request_id)
    request.status = "cancelled"
    db.commit()
    db.refresh(request)
    return request

