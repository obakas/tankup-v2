from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.schemas.request import RequestCreate
from app.services.batch_service import find_or_create_batch
from app.services.priority_service import (
    create_and_assign_priority_request,
    create_scheduled_priority_request,
)
from app.services.request_service import (
    create_batch_request_record,
    get_request_by_id,
)
from app.services.batch_orchestration_service import refresh_batch_state
from app.models.DeliveryRecord import DeliveryRecord
from app.models.tanker import Tanker
from app.models.request import LiquidRequest


def get_priority_request_live_flow(db: Session, request_id: int) -> dict[str, Any]:
    request = get_request_by_id(db, request_id)

    if request.delivery_type != "priority":
        raise HTTPException(status_code=400, detail="Request is not a priority request")

    delivery = (
        db.query(DeliveryRecord)
        .filter(
            DeliveryRecord.request_id == request.id,
            DeliveryRecord.job_type == "priority",
        )
        .order_by(DeliveryRecord.id.desc())
        .first()
    )

    tanker = None
    if delivery and delivery.tanker_id:
        tanker = db.query(Tanker).filter(Tanker.id == delivery.tanker_id).first()

    if not tanker:
        tanker = (
            db.query(Tanker)
            .filter(Tanker.current_request_id == request.id)
            .first()
        )

    return {
        "request_id": request.id,
        "delivery_type": request.delivery_type,
        "request_status": request.status,
        "is_asap": request.is_asap,
        "scheduled_for": request.scheduled_for.isoformat() if request.scheduled_for else None,
        "assignment_failed_reason": getattr(request, "assignment_failed_reason", None),
        "assignment_started_at": request.assignment_started_at.isoformat() if getattr(request, "assignment_started_at", None) else None,
        "assignment_failed_at": request.assignment_failed_at.isoformat() if getattr(request, "assignment_failed_at", None) else None,
        "refund_eligible": getattr(request, "refund_eligible", False),

        "tanker_id": tanker.id if tanker else None,
        "driver_name": tanker.driver_name if tanker else None,
        "tanker_phone": tanker.phone if tanker else None,
        "tanker_status": tanker.status if tanker else None,
        "tanker_latitude": tanker.latitude if tanker else None,
        "tanker_longitude": tanker.longitude if tanker else None,
        "last_location_update_at": tanker.last_location_update_at.isoformat() if tanker and tanker.last_location_update_at else None,

        "customer_latitude": request.latitude,
        "customer_longitude": request.longitude,

        "delivery_id": delivery.id if delivery else None,
        "delivery_status": delivery.delivery_status if delivery else None,
        "otp": delivery.delivery_code if delivery else None,
        "otp_verified": delivery.otp_verified if delivery else False,
        "otp_required": delivery.otp_required if delivery else True,

        "planned_liters": delivery.planned_liters if delivery else float(request.volume_liters),
        "actual_liters_delivered": delivery.actual_liters_delivered if delivery else None,

        "meter_start_reading": delivery.meter_start_reading if delivery else None,
        "meter_end_reading": delivery.meter_end_reading if delivery else None,

        "arrived_at": delivery.arrived_at.isoformat() if delivery and delivery.arrived_at else None,
        "measurement_started_at": delivery.measurement_started_at.isoformat() if delivery and delivery.measurement_started_at else None,
        "measurement_completed_at": delivery.measurement_completed_at.isoformat() if delivery and delivery.measurement_completed_at else None,
        "delivered_at": delivery.delivered_at.isoformat() if delivery and delivery.delivered_at else None,

        "customer_confirmed": delivery.customer_confirmed if delivery else False,
        "failure_reason": delivery.failure_reason if delivery else None,
        "notes": delivery.notes if delivery else None,
    }


def get_active_priority_request_for_user_flow(
    db: Session,
    user_id: int,
) -> dict[str, Any] | None:
    active_statuses = {
        "pending",
        "paid",
        "searching_driver",
        "assigned",
        "loading",
        "delivering",
        "arrived",
        "cancel_requested",
    }

    request = (
        db.query(LiquidRequest)
        .filter(
            LiquidRequest.user_id == user_id,
            LiquidRequest.delivery_type == "priority",
            LiquidRequest.status.in_(active_statuses),
        )
        .order_by(LiquidRequest.created_at.desc())
        .first()
    )

    if not request:
        return None

    return get_priority_request_live_flow(db, request.id)


def create_client_request_flow(db: Session, data: RequestCreate) -> dict[str, Any]:
    """
    Main entry point from route layer.

    IMPORTANT FOR BATCH:
    This flow assumes payment has ALREADY succeeded on the frontend side.
    The user should only hit this endpoint after successful payment.
    """
    if data.delivery_type == "batch":
        return create_batch_request_flow(db, data)

    if data.delivery_type == "priority":
        return create_priority_request_flow(db, data)

    raise HTTPException(status_code=400, detail="Invalid delivery type")


def create_batch_request_flow(db: Session, data: RequestCreate) -> dict[str, Any]:
    """
    Paid-first batch flow:

    1. User has already paid successfully on frontend
    2. Create request record
    3. Find/create compatible batch
    4. Add member as PAID + ACTIVE immediately
    5. Generate OTP immediately
    6. Refresh batch state
    7. Return batch + OTP to frontend

    No unpaid member reservation here.
    """
    request = create_batch_request_record(db, data)
    batch_result = find_or_create_batch(db, request)

    batch = batch_result["batch"]
    member = batch_result["member"]

    snapshot = refresh_batch_state(db, batch.id)

    refreshed_batch = snapshot.get("batch") if isinstance(snapshot, dict) else None
    batch_status = (
        getattr(refreshed_batch, "status", None)
        if refreshed_batch is not None
        else getattr(batch, "status", None)
    )
    current_volume = (
        float(getattr(refreshed_batch, "current_volume", 0) or 0)
        if refreshed_batch is not None
        else float(getattr(batch, "current_volume", 0) or 0)
    )
    target_volume = (
        float(getattr(refreshed_batch, "target_volume", 0) or 0)
        if refreshed_batch is not None
        else float(getattr(batch, "target_volume", 0) or 0)
    )

    return {
        "message": "Batch request created successfully after payment.",
        "request_id": request.id,
        "batch_id": batch.id,
        "member_id": member.id,
        "request_status": request.status,
        "batch_status": batch_status,
        "payment_status": member.payment_status,
        "member_status": member.status,
        "delivery_code": getattr(member, "delivery_code", None),
        "payment_confirmed": True,
        "batch_snapshot": {
            "id": batch.id,
            "status": batch_status,
            "current_volume": current_volume,
            "target_volume": target_volume,
        },
        "orchestration": snapshot,
    }


def create_priority_request_flow(db: Session, data: RequestCreate) -> dict[str, Any]:
    """
    ASAP -> immediate assignment
    Scheduled -> save and wait
    """
    if data.is_asap:
        return create_and_assign_priority_request(db, data)

    return create_scheduled_priority_request(db, data)


def initiate_batch_member_payment_flow(db: Session, member_id: int) -> dict[str, Any]:
    """
    Legacy compatibility helper.

    In the paid-first model, batch members should already be paid before they
    are inserted into the batch. So this function now simply reports state.
    """
    raise HTTPException(
        status_code=400,
        detail="Batch payment is now paid-first. Do not initiate batch-member payment after batch creation.",
    )


def confirm_batch_member_payment_flow(db: Session, payment_id: int) -> dict[str, Any]:
    """
    Legacy compatibility helper.

    In the paid-first model, payment confirmation should happen BEFORE batch creation.
    """
    raise HTTPException(
        status_code=400,
        detail="Batch payment is now paid-first. Do not confirm batch-member payment after batch creation.",
    )


def get_client_request_status_flow(db: Session, request_id: int) -> dict[str, Any]:
    request = get_request_by_id(db, request_id)
    return {
        "request_id": request.id,
        "delivery_type": request.delivery_type,
        "status": request.status,
        "scheduled_for": request.scheduled_for.isoformat() if request.scheduled_for else None,
        "assignment_failed_reason": getattr(request, "assignment_failed_reason", None),
        "assignment_started_at": request.assignment_started_at.isoformat() if getattr(request, "assignment_started_at", None) else None,
        "assignment_failed_at": request.assignment_failed_at.isoformat() if getattr(request, "assignment_failed_at", None) else None,
        "refund_eligible": getattr(request, "refund_eligible", False),
    }


def cancel_client_request_flow(db: Session, request_id: int) -> dict[str, Any]:
    request = get_request_by_id(db, request_id)
    request.status = "cancelled"
    db.commit()
    db.refresh(request)

    return {
        "message": "Request cancelled successfully",
        "request_id": request.id,
        "status": request.status,
    }