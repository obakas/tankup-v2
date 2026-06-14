from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.models.request import LiquidRequest
from app.services.batch_service import find_or_create_batch
from app.services.batch_orchestration_service import refresh_batch_state
from app.utils.status_rules import ensure_valid_transition, REQUEST_STATUS_TRANSITIONS


def get_pending_scheduled_batch_requests(db: Session) -> list[LiquidRequest]:
    return db.query(LiquidRequest).filter(
        LiquidRequest.delivery_type == "batch",
        LiquidRequest.status == "scheduled",
        LiquidRequest.scheduled_for <= datetime.utcnow(),
    ).all()


def activate_scheduled_batch_request(db: Session, request: LiquidRequest) -> dict[str, Any]:
    ensure_valid_transition(request.status, "pending", REQUEST_STATUS_TRANSITIONS, "Request")
    request.status = "pending"
    db.commit()
    db.refresh(request)

    batch_result = find_or_create_batch(db, request)
    batch = batch_result["batch"]
    member = batch_result["member"]

    refresh_batch_state(db, batch.id)

    return {
        "request_id": request.id,
        "batch_id": batch.id,
        "member_id": member.id,
        "delivery_code": getattr(member, "delivery_code", None),
    }
