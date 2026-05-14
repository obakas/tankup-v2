from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.services.tanker_service import (
    accept_batch_job,
    complete_batch_delivery,
    complete_priority_delivery,
    get_current_job,
    mark_arrived,
    mark_loaded_and_departed,
    mark_loading,
    release_tanker,
)


def get_driver_current_job_flow(db: Session, tanker_id: int) -> dict[str, Any]:
    return get_current_job(db, tanker_id)


def accept_batch_job_flow(db: Session, tanker_id: int, batch_id: int) -> dict[str, Any]:
    return accept_batch_job(db, tanker_id, batch_id)


def mark_loading_flow(db: Session, tanker_id: int, batch_id: int) -> dict[str, Any]:
    return mark_loading(db, tanker_id, batch_id)


def mark_departed_flow(db: Session, tanker_id: int, batch_id: int) -> dict[str, Any]:
    return mark_loaded_and_departed(db, tanker_id, batch_id)


def mark_arrived_flow(db: Session, tanker_id: int, batch_id: int) -> dict[str, Any]:
    return mark_arrived(db, tanker_id, batch_id)


def complete_batch_delivery_flow(db: Session, tanker_id: int, batch_id: int) -> dict[str, Any]:
    return complete_batch_delivery(db, tanker_id, batch_id)


def complete_priority_delivery_flow(db: Session, tanker_id: int, request_id: int) -> dict[str, Any]:
    return complete_priority_delivery(db, tanker_id, request_id)


def release_driver_after_completion_flow(db: Session, tanker_id: int) -> dict[str, Any]:
    tanker = release_tanker(db, tanker_id)
    return {
        "message": "Driver released for next assignment",
        "tanker_id": tanker.id,
        "status": tanker.status,
    }