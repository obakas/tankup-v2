from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.schemas.request import RequestCreate
from app.models.customer_site_profile import CustomerSiteProfile
from app.services.batch_service import find_or_create_batch
from app.services.routing_service import calculate_distance_km
from app.services.priority_service import (
    create_and_assign_priority_request,
    create_scheduled_priority_request,
)
from app.services.request_service import (
    create_batch_request_record,
    get_request_by_id,
)
from app.services.batch_orchestration_service import refresh_batch_state
from app.services.operation_alert_service import create_operation_alert
from app.models.DeliveryRecord import DeliveryRecord
from app.models.tanker import Tanker
from app.models.request import LiquidRequest
from app.models.batch_member import BatchMember
from app.models.batch import Batch
from app.utils.status_rules import (
    ensure_valid_transition,
    REQUEST_STATUS_TRANSITIONS,
    TANKER_STATUS_TRANSITIONS,
)
from app.services import push_service

_BATCH_TERMINAL_STATUSES = {
    "completed", "partially_completed", "failed", "expired",
    "assignment_failed", "cancelled",
}


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
        "eta_minutes": (
            max(round((calculate_distance_km(
                tanker.longitude, tanker.latitude,
                request.longitude, request.latitude,
            ) * 1.3) / 25.0 * 60), 1)
            if tanker and tanker.latitude and tanker.longitude
            and request.latitude and request.longitude
            else None
        ),

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
        "scheduled",
        "pending",
        "paid",
        "searching_driver",
        "assigned",
        "queued",
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


def _get_tank_capacity_warning(db: Session, data: RequestCreate) -> str | None:
    if not data.site_profile_id:
        return None
    site = db.query(CustomerSiteProfile).filter(CustomerSiteProfile.id == data.site_profile_id).first()
    if not site or not site.tank_capacity_liters:
        return None
    if data.volume_liters > site.tank_capacity_liters:
        return (
            f"Requested volume ({data.volume_liters}L) exceeds the registered tank "
            f"capacity ({site.tank_capacity_liters}L) for the selected site."
        )
    return None


def create_client_request_flow(db: Session, data: RequestCreate) -> dict[str, Any]:
    """
    Main entry point from route layer.

    IMPORTANT FOR BATCH:
    This flow assumes payment has ALREADY succeeded on the frontend side.
    The user should only hit this endpoint after successful payment.
    """
    warning = _get_tank_capacity_warning(db, data)

    if data.delivery_type == "batch":
        if not settings.BATCH_DELIVERY_ENABLED:
            raise HTTPException(status_code=400, detail="Batch delivery is currently unavailable")
        result = create_batch_request_flow(db, data)
    elif data.delivery_type == "priority":
        result = create_priority_request_flow(db, data)
    else:
        raise HTTPException(status_code=400, detail="Invalid delivery type")

    if warning:
        result["warning"] = warning
        request_id = result.get("request_id")
        if request_id:
            create_operation_alert(
                db=db,
                alert_type="request_exceeds_tank_capacity",
                severity="warning",
                job_type=data.delivery_type,
                job_id=request_id,
                request_id=request_id,
                message=warning,
            )
    return result


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
    # Key-based idempotency: if the client sends the same UUID on a retry
    # (network error, double-tap), return the cached response without creating
    # a new request or new batch member.
    if data.idempotency_key:
        cached = (
            db.query(LiquidRequest)
            .filter(
                LiquidRequest.idempotency_key == data.idempotency_key,
                LiquidRequest.user_id == data.user_id,
            )
            .first()
        )
        if cached:
            if cached.status == "scheduled":
                return {
                    "message": "Active scheduled batch request already exists.",
                    "request_id": cached.id,
                    "delivery_type": cached.delivery_type,
                    "request_status": cached.status,
                    "scheduled_for": cached.scheduled_for.isoformat() if cached.scheduled_for else None,
                }
            member = (
                db.query(BatchMember)
                .filter(BatchMember.request_id == cached.id)
                .first()
            )
            if member:
                batch = db.query(Batch).filter(Batch.id == member.batch_id).first()
                batch_status = getattr(batch, "status", None)
                member_status = getattr(member, "status", None)
                return {
                    "message": "Batch request already exists (idempotent).",
                    "request_id": cached.id,
                    "delivery_type": cached.delivery_type,
                    "batch_id": member.batch_id,
                    "member_id": member.id,
                    "request_status": cached.status,
                    "batch_status": batch_status,
                    "payment_status": member.payment_status,
                    "member_status": member_status,
                    "delivery_code": getattr(member, "delivery_code", None),
                    "payment_confirmed": True,
                    "batch_snapshot": {
                        "id": member.batch_id,
                        "status": batch_status,
                        "current_volume": float(getattr(batch, "current_volume", 0) or 0),
                        "target_volume": float(getattr(batch, "target_volume", 0) or 0),
                    },
                    "orchestration": None,
                }

    if data.scheduled_for:
        request = create_batch_request_record(db, data)
        request.status = "scheduled"
        if data.idempotency_key:
            request.idempotency_key = data.idempotency_key
        db.commit()
        db.refresh(request)
        return {
            "message": "Scheduled batch request created successfully.",
            "request_id": request.id,
            "delivery_type": request.delivery_type,
            "request_status": request.status,
            "scheduled_for": request.scheduled_for.isoformat(),
        }

    request = create_batch_request_record(db, data)
    if data.idempotency_key:
        request.idempotency_key = data.idempotency_key
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
        "delivery_type": request.delivery_type,
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


def get_scheduled_request_live_flow(db: Session, request_id: int) -> dict[str, Any]:
    request = get_request_by_id(db, request_id)

    base = {
        "request_id": request.id,
        "delivery_type": request.delivery_type,
        "request_status": request.status,
        "scheduled_for": request.scheduled_for.isoformat() if request.scheduled_for else None,
    }

    if request.status == "scheduled":
        return base

    member = (
        db.query(BatchMember)
        .filter(BatchMember.request_id == request_id)
        .order_by(BatchMember.id.desc())
        .first()
    )

    return {
        **base,
        "batch_id": member.batch_id if member else None,
        "member_id": member.id if member else None,
        "delivery_code": member.delivery_code if member else None,
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


def _compute_cancellation(
    request: LiquidRequest,
    delivery: DeliveryRecord | None,
) -> tuple[str, float]:
    """
    Return (stage_label, refund_pct) for a priority cancellation.
    stage_label: pre_loading | en_route | arrived | partial_delivery
    refund_pct:  0.0–1.0 fraction of the full price to refund
    Raises HTTPException(409) if cancellation is no longer allowed.
    """
    dr_status = delivery.delivery_status if delivery else None

    if dr_status in ("awaiting_otp", "delivered"):
        raise HTTPException(
            status_code=409,
            detail="Cancellation not allowed — water has already been fully pumped.",
        )

    # Pre-loading / loading: tanker hasn't departed yet — full refund.
    if request.status in ("assigned", "queued", "loading") and dr_status in (None, "pending"):
        return "pre_loading", 1.0

    # Measuring with both meter readings: prorate by liters actually delivered
    if dr_status == "measuring" and delivery:
        if (
            delivery.meter_start_reading is not None
            and delivery.meter_end_reading is not None
            and delivery.planned_liters > 0
        ):
            actual = delivery.meter_end_reading - delivery.meter_start_reading
            refund_frac = max(0.0, 1.0 - actual / delivery.planned_liters)
            return "partial_delivery", round(refund_frac, 4)

    # All other stages: tanker committed, full forfeit
    if dr_status in ("arrived", "measuring"):
        return "arrived", 0.0

    # Tanker is already en route — no refund, and cancellation is blocked entirely.
    if dr_status == "en_route":
        raise HTTPException(
            status_code=409,
            detail="Cancellation not allowed — the tanker is already en route.",
        )

    return "en_route", 0.0


def cancel_priority_mid_delivery_flow(db: Session, request_id: int) -> dict[str, Any]:
    request = get_request_by_id(db, request_id)

    if request.delivery_type != "priority":
        raise HTTPException(status_code=400, detail="Only priority requests support mid-delivery cancellation.")

    terminal = {"completed", "partially_completed", "failed", "cancelled", "assignment_failed"}
    if request.status in terminal:
        raise HTTPException(status_code=409, detail=f"Cannot cancel a request in status '{request.status}'.")

    delivery = (
        db.query(DeliveryRecord)
        .filter(
            DeliveryRecord.request_id == request_id,
            DeliveryRecord.job_type == "priority",
        )
        .order_by(DeliveryRecord.id.desc())
        .first()
    )

    stage, refund_pct = _compute_cancellation(request, delivery)

    ensure_valid_transition(request.status, "cancelled", REQUEST_STATUS_TRANSITIONS, "Request")
    request.status = "cancelled"
    request.cancelled_at = datetime.utcnow()
    request.cancellation_stage = stage
    request.cancellation_refund_pct = refund_pct

    if delivery and delivery.delivery_status not in ("delivered", "failed", "skipped"):
        delivery.delivery_status = "failed"
        delivery.failure_reason = "client_cancelled"
        delivery.failed_at = datetime.utcnow()

    if refund_pct > 0:
        tanker = db.query(Tanker).filter(Tanker.current_request_id == request.id).first()
        if tanker:
            ensure_valid_transition(tanker.status, "available", TANKER_STATUS_TRANSITIONS, "Tanker")
            tanker.status = "available"
            tanker.is_available = True
            tanker.current_request_id = None
            tanker.pending_offer_type = None
            tanker.pending_offer_id = None
            tanker.offer_expires_at = None
            db.add(tanker)

    db.commit()
    db.refresh(request)

    if refund_pct > 0 and tanker:
        push_service.notify_driver(
            db, tanker.id,
            title="Delivery cancelled",
            body="This delivery was cancelled by the customer. You're free for a new job.",
            data={"type": "job_cancelled", "request_id": request.id},
        )

    return {
        "message": "Priority delivery cancelled.",
        "request_id": request.id,
        "status": request.status,
        "cancellation_stage": stage,
        "refund_percentage": refund_pct,
        "refund_eligible": refund_pct > 0,
    }