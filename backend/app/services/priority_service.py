from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.request import LiquidRequest
from app.models.tanker import Tanker
from app.services.assignment_service import assign_best_tanker_for_priority
from app.services.request_service import create_priority_request_record


def create_and_assign_priority_request(db: Session, data) -> dict[str, Any]:
    """
    For ASAP priority request: create request and send timed offer to best tanker.
    """
    request = create_priority_request_record(db, data)

    assignment_result = assign_best_tanker_for_priority(
        db,
        request=request,
    )

    if not assignment_result:
        request.status = "searching_driver"
        request.assignment_started_at = request.assignment_started_at or datetime.utcnow()
        request.assignment_failed_reason = "no_eligible_tankers_available_now"
        request.refund_eligible = False
        db.commit()
        db.refresh(request)
        return {
            "message": "Priority request created. Searching for a tanker.",
            "request_id": request.id,
            "tanker_id": None,
            "request_status": request.status,
            "tanker_status": None,
            "scheduled_for": request.scheduled_for.isoformat() if request.scheduled_for else None,
            "score_breakdown": None,
            "ranked_candidates": [],
        }

    tanker = assignment_result["tanker"]

    db.refresh(request)
    db.refresh(tanker)

    return {
        "message": "Priority request created and offer sent successfully",
        "request_id": request.id,
        "tanker_id": tanker.id,
        "request_status": request.status,   # should now be searching_driver
        "tanker_status": tanker.status,
        "scheduled_for": request.scheduled_for.isoformat() if request.scheduled_for else None,
        "score_breakdown": assignment_result.get("score_breakdown"),
        "ranked_candidates": assignment_result.get("ranked_candidates", []),
    }


def create_scheduled_priority_request(db: Session, data) -> dict[str, Any]:
    request = create_priority_request_record(db, data)
    request.status = "pending"
    db.commit()
    db.refresh(request)

    return {
        "message": "Scheduled priority request created successfully",
        "request_id": request.id,
        "request_status": request.status,
        "scheduled_for": request.scheduled_for.isoformat() if request.scheduled_for else None,
    }


def activate_scheduled_priority_request(db: Session, request_id: int) -> dict[str, Any]:
    request = db.query(LiquidRequest).filter(LiquidRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Priority request not found")

    if request.delivery_type != "priority":
        raise HTTPException(status_code=400, detail="Request is not priority")

    if request.status not in {"pending"}:
        raise HTTPException(
            status_code=400,
            detail=f"Priority request cannot be activated from status '{request.status}'",
        )

    assignment_result = assign_best_tanker_for_priority(
        db,
        request=request,
    )

    if not assignment_result:
        raise HTTPException(
            status_code=404,
            detail="No available tanker found for scheduled priority delivery",
        )

    tanker = assignment_result["tanker"]

    db.refresh(request)
    db.refresh(tanker)

    return {
        "message": "Scheduled priority request activated and offer sent",
        "request_id": request.id,
        "tanker_id": tanker.id,
        "request_status": request.status,
        "tanker_status": tanker.status,
        "score_breakdown": assignment_result.get("score_breakdown"),
        "ranked_candidates": assignment_result.get("ranked_candidates", []),
    }


def release_priority_tanker(db: Session, tanker_id: int):
    tanker = db.query(Tanker).filter(Tanker.id == tanker_id).first()
    if not tanker:
        raise HTTPException(status_code=404, detail="Tanker not found")

    tanker.status = "available"
    tanker.is_available = True
    tanker.current_request_id = None
    tanker.pending_offer_type = None
    tanker.pending_offer_id = None
    tanker.offer_expires_at = None

    db.commit()
    db.refresh(tanker)
    return tanker


def complete_priority_request(db: Session, request_id: int, tanker_id: int) -> dict[str, Any]:
    request = db.query(LiquidRequest).filter(LiquidRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Priority request not found")

    request.status = "completed"
    db.commit()
    db.refresh(request)

    release_priority_tanker(db, tanker_id)

    return {
        "message": "Priority delivery completed",
        "request_id": request.id,
        "request_status": request.status,
    }


def create_scheduled_priority_request(db: Session, data) -> dict[str, Any]:
    """
    Create a scheduled priority request without immediate tanker assignment.
    """
    request = create_priority_request_record(db, data)
    request.status = "pending"
    db.commit()
    db.refresh(request)

    return {
        "message": "Scheduled priority request created successfully",
        "request_id": request.id,
        "request_status": request.status,
        "scheduled_for": request.scheduled_for.isoformat() if request.scheduled_for else None,
    }


def activate_scheduled_priority_request(db: Session, request_id: int) -> dict[str, Any]:
    """
    Assign a tanker when the scheduled time arrives, using the canonical
    assignment service.
    """
    request = db.query(LiquidRequest).filter(LiquidRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Priority request not found")

    if request.delivery_type != "priority":
        raise HTTPException(status_code=400, detail="Request is not priority")

    if request.status not in {"pending"}:
        raise HTTPException(
            status_code=400,
            detail=f"Priority request cannot be activated from status '{request.status}'",
        )

    assignment_result = assign_best_tanker_for_priority(
        db,
        request=request,
    )

    if not assignment_result:
        request.status = "searching_driver"
        request.assignment_started_at = request.assignment_started_at or datetime.utcnow()
        request.assignment_failed_reason = "no_eligible_tankers_available_now"
        request.refund_eligible = False
        db.commit()
        db.refresh(request)
        return {
            "message": "Scheduled priority request activated. Searching for a tanker.",
            "request_id": request.id,
            "tanker_id": None,
            "request_status": request.status,
            "tanker_status": None,
            "score_breakdown": None,
            "ranked_candidates": [],
        }

    tanker = assignment_result["tanker"]

    request.status = "assigned"
    db.commit()
    db.refresh(request)
    db.refresh(tanker)

    return {
        "message": "Scheduled priority request activated",
        "request_id": request.id,
        "tanker_id": tanker.id,
        "request_status": request.status,
        "tanker_status": tanker.status,
        "score_breakdown": assignment_result.get("score_breakdown"),
        "ranked_candidates": assignment_result.get("ranked_candidates", []),
    }


def get_pending_scheduled_priority_requests(db: Session) -> list[LiquidRequest]:
    return db.query(LiquidRequest).filter(
        LiquidRequest.delivery_type == "priority",
        LiquidRequest.is_asap == False,
        LiquidRequest.status == "pending",
        LiquidRequest.scheduled_for <= datetime.utcnow(),
    ).all()


def release_priority_tanker(db: Session, tanker_id: int):
    tanker = db.query(Tanker).filter(Tanker.id == tanker_id).first()
    if not tanker:
        raise HTTPException(status_code=404, detail="Tanker not found")

    tanker.status = "available"
    tanker.is_available = True
    tanker.current_request_id = None

    db.commit()
    db.refresh(tanker)
    return tanker


def complete_priority_request(db: Session, request_id: int, tanker_id: int) -> dict[str, Any]:
    request = db.query(LiquidRequest).filter(LiquidRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Priority request not found")

    request.status = "completed"
    db.commit()
    db.refresh(request)

    release_priority_tanker(db, tanker_id)

    return {
        "message": "Priority delivery completed",
        "request_id": request.id,
        "request_status": request.status,
    }


