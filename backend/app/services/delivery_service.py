from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Optional
import secrets

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.DeliveryRecord import DeliveryRecord
from app.models.batch import Batch
from app.models.batch_member import BatchMember
from app.models.request import LiquidRequest
from app.models.tanker import Tanker
from app.models.user import User
from app.utils.status_rules import ensure_valid_transition, TANKER_STATUS_TRANSITIONS

OTP_WINDOW_MINUTES = 15
ANOMALY_FACTOR = 1.2
RESOLVED_STOP_STATUSES = {"delivered", "failed", "skipped"}
ACTIVE_STOP_STATUSES = {"pending", "en_route", "arrived", "measuring", "awaiting_otp"}


def _generate_delivery_code() -> str:
    return f"{secrets.randbelow(9000) + 1000}"


def _utcnow() -> datetime:
    return datetime.utcnow()


def _apply_tanker_status(tanker: Tanker, next_status: str) -> None:
    ensure_valid_transition(tanker.status, next_status, TANKER_STATUS_TRANSITIONS, "Tanker")
    tanker.status = next_status
    tanker.is_available = next_status == "available"


def get_delivery_by_id(db: Session, delivery_id: int) -> DeliveryRecord:
    delivery = db.query(DeliveryRecord).filter(DeliveryRecord.id == delivery_id).first()
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery record not found")
    return delivery


def get_tanker_by_id(db: Session, tanker_id: int) -> Tanker:
    tanker = db.query(Tanker).filter(Tanker.id == tanker_id).first()
    if not tanker:
        raise HTTPException(status_code=404, detail="Tanker not found")
    return tanker


def _resolve_request(db: Session, request_or_id: LiquidRequest | int | None) -> LiquidRequest:
    if isinstance(request_or_id, LiquidRequest):
        return request_or_id
    if request_or_id is None:
        raise HTTPException(status_code=400, detail="Request is required")
    request = db.query(LiquidRequest).filter(LiquidRequest.id == request_or_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Priority request not found")
    return request


def _resolve_tanker(db: Session, tanker_or_id: Tanker | int | None) -> Tanker:
    if isinstance(tanker_or_id, Tanker):
        return tanker_or_id
    if tanker_or_id is None:
        raise HTTPException(status_code=400, detail="Tanker is required")
    return get_tanker_by_id(db, tanker_or_id)


def _resolve_batch(db: Session, batch_or_id: Batch | int | None) -> Batch:
    if isinstance(batch_or_id, Batch):
        return batch_or_id
    if batch_or_id is None:
        raise HTTPException(status_code=400, detail="Batch is required")
    batch = db.query(Batch).filter(Batch.id == batch_or_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return batch


def create_delivery_record_for_priority(
    db: Session,
    *,
    request: LiquidRequest | int | None = None,
    request_id: int | None = None,
    tanker: Tanker | int | None = None,
    tanker_id: int | None = None,
) -> DeliveryRecord:
    request_obj = _resolve_request(db, request if request is not None else request_id)
    tanker_obj = _resolve_tanker(db, tanker if tanker is not None else tanker_id)

    existing = (
        db.query(DeliveryRecord)
        .filter(
            DeliveryRecord.job_type == "priority",
            DeliveryRecord.request_id == request_obj.id,
        )
        .first()
    )
    if existing:
        if existing.tanker_id != tanker_obj.id:
            raise HTTPException(status_code=409, detail="Priority request already has a delivery record for another tanker")
        return existing

    delivery = DeliveryRecord(
        job_type="priority",
        request_id=request_obj.id,
        tanker_id=tanker_obj.id,
        user_id=request_obj.user_id,
        planned_liters=request_obj.volume_liters,
        delivery_status="pending",
        stop_order=1,
        measurement_required=True,
        measurement_valid=False,
        anomaly_flagged=False,
        otp_required=True,
        otp_verified=False,
        otp_invalid_attempts=0,
        delivery_code=_generate_delivery_code(),
        latitude=request_obj.latitude,
        longitude=request_obj.longitude,
    )
    db.add(delivery)
    db.flush()
    return delivery


def create_delivery_records_for_batch(
    db: Session,
    *,
    batch: Batch | int | None = None,
    batch_id: int | None = None,
    tanker: Tanker | int | None = None,
    tanker_id: int | None = None,
    members: list[BatchMember] | None = None,
) -> list[DeliveryRecord]:
    batch_obj = _resolve_batch(db, batch if batch is not None else batch_id)
    tanker_obj = _resolve_tanker(db, tanker if tanker is not None else tanker_id)

    existing = (
        db.query(DeliveryRecord)
        .filter(DeliveryRecord.job_type == "batch", DeliveryRecord.batch_id == batch_obj.id)
        .order_by(DeliveryRecord.stop_order.asc(), DeliveryRecord.id.asc())
        .all()
    )
    if existing:
        mismatched = [d.id for d in existing if d.tanker_id != tanker_obj.id]
        if mismatched:
            raise HTTPException(status_code=409, detail="Batch already has delivery records for another tanker")
        return existing

    if members is None:
        members = (
            db.query(BatchMember)
            .filter(
                BatchMember.batch_id == batch_obj.id,
                BatchMember.status == "active",
                BatchMember.payment_status == "paid",
            )
            .order_by(BatchMember.id.asc())
            .all()
        )
    if not members:
        raise HTTPException(status_code=400, detail="Batch members required")

    deliveries: list[DeliveryRecord] = []
    for index, member in enumerate(members, start=1):
        delivery = DeliveryRecord(
            job_type="batch",
            batch_id=batch_obj.id,
            member_id=member.id,
            tanker_id=tanker_obj.id,
            user_id=member.user_id,
            planned_liters=member.volume_liters,
            delivery_status="pending",
            stop_order=index,
            measurement_required=True,
            measurement_valid=False,
            anomaly_flagged=False,
            otp_required=True,
            otp_verified=False,
            otp_invalid_attempts=0,
            delivery_code=member.delivery_code,
            latitude=member.latitude,
            longitude=member.longitude,
        )
        deliveries.append(delivery)
        db.add(delivery)
    db.flush()
    return deliveries


def _ensure_delivery_owned_by_tanker(delivery: DeliveryRecord, tanker_id: int) -> None:
    if delivery.tanker_id != tanker_id:
        raise HTTPException(status_code=403, detail="This tanker is not assigned to this delivery record")


def _ensure_not_resolved(delivery: DeliveryRecord) -> None:
    if delivery.delivery_status in RESOLVED_STOP_STATUSES:
        raise HTTPException(status_code=400, detail=f"Delivery already resolved as '{delivery.delivery_status}'")


def _sync_customer_state_for_stop(db: Session, delivery: DeliveryRecord) -> None:
    if delivery.job_type == "batch" and delivery.member_id:
        member = db.query(BatchMember).filter(BatchMember.id == delivery.member_id).first()
        if member:
            if delivery.delivery_status == "delivered":
                if hasattr(member, "status"):
                    member.status = "delivered"
                if hasattr(member, "customer_confirmed"):
                    member.customer_confirmed = True
                if hasattr(member, "customer_confirmed_at"):
                    member.customer_confirmed_at = delivery.delivered_at or _utcnow()
            elif delivery.delivery_status == "failed" and hasattr(member, "status"):
                member.status = "failed"
            elif delivery.delivery_status == "skipped" and hasattr(member, "status"):
                member.status = "skipped"
            db.add(member)
    elif delivery.job_type == "priority" and delivery.request_id:
        request = db.query(LiquidRequest).filter(LiquidRequest.id == delivery.request_id).first()
        if request:
            if delivery.delivery_status == "delivered":
                request.status = "completed"
                request.completed_at = delivery.delivered_at or _utcnow()
            elif delivery.delivery_status == "failed":
                request.status = "failed"
            elif delivery.delivery_status == "skipped":
                request.status = "partially_completed"
            db.add(request)


def _get_job_stops(db: Session, delivery: DeliveryRecord) -> list[DeliveryRecord]:
    if delivery.job_type == "batch":
        if not delivery.batch_id:
            return [delivery]
        return (
            db.query(DeliveryRecord)
            .filter(DeliveryRecord.job_type == "batch", DeliveryRecord.batch_id == delivery.batch_id)
            .order_by(DeliveryRecord.stop_order.asc(), DeliveryRecord.id.asc())
            .all()
        )
    if delivery.job_type == "priority":
        if not delivery.request_id:
            return [delivery]
        return (
            db.query(DeliveryRecord)
            .filter(DeliveryRecord.job_type == "priority", DeliveryRecord.request_id == delivery.request_id)
            .order_by(DeliveryRecord.stop_order.asc(), DeliveryRecord.id.asc())
            .all()
        )
    return [delivery]


def _allowed_action_list(delivery: DeliveryRecord) -> list[str]:
    status = delivery.delivery_status
    actions: list[str] = []
    if status == "en_route" or (status == "pending" and bool(delivery.dispatched_at)):
        actions.append("arrive")
    if status == "arrived":
        actions.append("start_measurement")
    if status == "measuring":
        actions.append("finish_measurement")
    if status == "awaiting_otp":
        actions.append("confirm_otp")
        if bool(delivery.otp_verified):
            actions.append("complete")
    if status not in RESOLVED_STOP_STATUSES:
        actions.extend(["fail", "skip"])
    return actions


def _build_job_meta(db: Session, current: DeliveryRecord) -> dict[str, Any]:
    stops = _get_job_stops(db, current)
    total_stops = len(stops)
    completed_stops = sum(1 for stop in stops if stop.delivery_status in RESOLVED_STOP_STATUSES)
    remaining_stops = total_stops - completed_stops
    if current.job_type == "batch":
        batch = db.query(Batch).filter(Batch.id == current.batch_id).first() if current.batch_id else None
        return {
            "job_type": "batch",
            "job_id": current.batch_id,
            "job_status": batch.status if batch else current.delivery_status,
            "total_stops": total_stops,
            "completed_stops": completed_stops,
            "remaining_stops": remaining_stops,
        }
    request = db.query(LiquidRequest).filter(LiquidRequest.id == current.request_id).first() if current.request_id else None
    return {
        "job_type": "priority",
        "job_id": current.request_id,
        "job_status": request.status if request else current.delivery_status,
        "total_stops": total_stops,
        "completed_stops": completed_stops,
        "remaining_stops": remaining_stops,
    }


def _build_stop_summary(db: Session, current: DeliveryRecord) -> list[dict[str, Any]]:
    summaries = []
    for stop in _get_job_stops(db, current):
        customer_name = None
        phone = None
        address = None
        if stop.job_type == "batch" and stop.member_id:
            member = db.query(BatchMember).filter(BatchMember.id == stop.member_id).first()
            user_id = member.user_id if member else stop.user_id
        else:
            user_id = stop.user_id
        user = None
        if user_id:
            from app.models.user import User
            user = db.query(User).filter(User.id == user_id).first()
        if user:
            customer_name = getattr(user, "name", None)
            phone = getattr(user, "phone", None)
            address = getattr(user, "address", None)
        summaries.append({
            "delivery_id": stop.id,
            "stop_order": stop.stop_order,
            "customer_name": customer_name,
            "phone": phone,
            "address": address,
            "planned_liters": stop.planned_liters,
            "delivery_status": stop.delivery_status,
        })
    return summaries




def _activate_next_open_stop(db: Session, delivery: DeliveryRecord) -> DeliveryRecord | None:
    stops = _get_job_stops(db, delivery)
    next_stop = next((s for s in stops if s.delivery_status == "pending"), None)
    if not next_stop:
        return None
    next_stop.delivery_status = "en_route"
    next_stop.dispatched_at = next_stop.dispatched_at or _utcnow()
    db.add(next_stop)
    return next_stop

def _finalize_job_if_possible(db: Session, delivery: DeliveryRecord) -> dict[str, Any]:
    stops = _get_job_stops(db, delivery)
    unresolved = [s for s in stops if s.delivery_status not in RESOLVED_STOP_STATUSES]
    if unresolved:
        return {"job_resolved": False, "message": "Job still has unresolved delivery stops"}

    delivered_count = sum(1 for s in stops if s.delivery_status == "delivered")
    failed_count = sum(1 for s in stops if s.delivery_status == "failed")
    skipped_count = sum(1 for s in stops if s.delivery_status == "skipped")
    final_status = "failed"
    if delivered_count == len(stops):
        final_status = "completed"
    elif delivered_count > 0:
        final_status = "partially_completed"

    tanker = db.query(Tanker).filter(Tanker.id == delivery.tanker_id).first()
    if delivery.job_type == "batch" and delivery.batch_id:
        batch = db.query(Batch).filter(Batch.id == delivery.batch_id).first()
        if batch:
            batch.status = final_status
            if final_status in {"completed", "partially_completed", "failed"}:
                batch.completed_at = _utcnow()
            db.add(batch)
    if delivery.job_type == "priority" and delivery.request_id:
        request = db.query(LiquidRequest).filter(LiquidRequest.id == delivery.request_id).first()
        if request:
            request.status = final_status
            if final_status == "completed":
                request.completed_at = _utcnow()
            db.add(request)
    if tanker:
        tanker.current_request_id = None if delivery.job_type == "priority" else tanker.current_request_id
        tanker.status = "available"
        tanker.is_available = True
        db.add(tanker)
    db.commit()
    return {
        "job_resolved": True,
        "final_status": final_status,
        "delivered_count": delivered_count,
        "failed_count": failed_count,
        "skipped_count": skipped_count,
    }


def get_current_delivery_for_tanker(db: Session, tanker_id: int) -> dict[str, Any]:
    tanker = get_tanker_by_id(db, tanker_id)

    if getattr(tanker, "status", None) not in {"delivering", "arrived"}:
        return {
            "tanker": {
                "id": tanker.id,
                "driver_name": getattr(tanker, "driver_name", ""),
                "phone": getattr(tanker, "phone", ""),
                "tank_plate_number": getattr(tanker, "tank_plate_number", ""),
                "status": getattr(tanker, "status", None),
                "is_available": getattr(tanker, "is_available", False),
            },
            "job": None,
            "current_stop": None,
            "allowed_actions": [],
            "stops_summary": [],
            "message": "No active stop found",
        }

    current = (
        db.query(DeliveryRecord)
        .filter(
            DeliveryRecord.tanker_id == tanker_id,
            DeliveryRecord.delivery_status.in_(list(ACTIVE_STOP_STATUSES)),
        )
        .order_by(DeliveryRecord.stop_order.asc(), DeliveryRecord.id.asc())
        .first()
    )

    if not current:
        return {
            "tanker": {
                "id": tanker.id,
                "driver_name": getattr(tanker, "driver_name", ""),
                "phone": getattr(tanker, "phone", ""),
                "tank_plate_number": getattr(tanker, "tank_plate_number", ""),
                "status": getattr(tanker, "status", None),
                "is_available": getattr(tanker, "is_available", False),
            },
            "job": None,
            "current_stop": None,
            "allowed_actions": [],
            "stops_summary": [],
            "message": "No active stop found",
        }

    user = None
    if current.user_id:
        user = db.query(User).filter(User.id == current.user_id).first()

    customer_name = "Customer"
    customer_phone = None
    customer_address = None

    if user:
        customer_name = getattr(user, "name", None) or "Customer"
        customer_phone = getattr(user, "phone", None)
        customer_address = getattr(user, "address", None)

    return {
        "tanker": {
            "id": tanker.id,
            "driver_name": getattr(tanker, "driver_name", ""),
            "phone": getattr(tanker, "phone", ""),
            "tank_plate_number": getattr(tanker, "tank_plate_number", ""),
            "status": getattr(tanker, "status", None),
            "is_available": getattr(tanker, "is_available", False),
        },
        "job": _build_job_meta(db, current),
        "current_stop": {
            "delivery_id": current.id,
            "stop_order": current.stop_order,
            "delivery_status": current.delivery_status,
            "planned_liters": current.planned_liters,
            "actual_liters_delivered": current.actual_liters_delivered,
            "meter_start_reading": current.meter_start_reading,
            "meter_end_reading": current.meter_end_reading,
            "otp_required": current.otp_required,
            "otp_verified": current.otp_verified,
            "delivery_code": current.delivery_code,
            "customer_confirmed": current.customer_confirmed,
            "customer": {
                "user_id": current.user_id,
                "name": customer_name,
                "phone": customer_phone,
                "address": customer_address,
            },
            "location": {
                "latitude": current.latitude,
                "longitude": current.longitude,
            },
            "timestamps": {
                "dispatched_at": current.dispatched_at,
                "arrived_at": current.arrived_at,
                "measurement_started_at": current.measurement_started_at,
                "measurement_completed_at": current.measurement_completed_at,
                "delivered_at": current.delivered_at,
            },
            "notes": current.notes,
            "failure_reason": current.failure_reason,
        },
        "allowed_actions": _allowed_action_list(current),
        "stops_summary": _build_stop_summary(db, current),
        "message": None,
    }


def arrive_delivery_stop(db: Session, *, tanker_id: int, delivery_id: int) -> DeliveryRecord:
    delivery = get_delivery_by_id(db, delivery_id)
    _ensure_delivery_owned_by_tanker(delivery, tanker_id)
    if delivery.delivery_status == "arrived":
        return delivery
    _ensure_not_resolved(delivery)
    if delivery.delivery_status not in {"pending", "en_route"}:
        raise HTTPException(status_code=400, detail=f"Cannot arrive from status '{delivery.delivery_status}'")
    delivery.delivery_status = "arrived"
    delivery.arrived_at = _utcnow()
    tanker = get_tanker_by_id(db, tanker_id)
    if tanker.status != "arrived":
        ensure_valid_transition(tanker.status, "arrived", TANKER_STATUS_TRANSITIONS, "Tanker")
        tanker.status = "arrived"
    db.add(delivery)
    db.add(tanker)
    db.commit()
    db.refresh(delivery)
    return delivery


def start_measurement(db: Session, *, tanker_id: int, delivery_id: int, meter_start_reading: float) -> DeliveryRecord:
    delivery = get_delivery_by_id(db, delivery_id)
    _ensure_delivery_owned_by_tanker(delivery, tanker_id)
    if delivery.delivery_status == "measuring" and delivery.meter_start_reading == meter_start_reading:
        return delivery
    _ensure_not_resolved(delivery)
    if delivery.delivery_status != "arrived":
        raise HTTPException(status_code=400, detail=f"Cannot start measurement from status '{delivery.delivery_status}'")
    if meter_start_reading is None or meter_start_reading < 0:
        raise HTTPException(status_code=400, detail="Meter start reading must be zero or greater")
    delivery.meter_start_reading = meter_start_reading
    delivery.measurement_started_at = delivery.measurement_started_at or _utcnow()
    delivery.delivery_status = "measuring"
    delivery.measurement_valid = False
    delivery.actual_liters_delivered = None
    delivery.meter_end_reading = None
    delivery.otp_verified = False
    delivery.otp_verified_at = None
    delivery.otp_expires_at = None
    delivery.otp_consumed_at = None
    delivery.otp_invalid_attempts = 0
    delivery.anomaly_flagged = False
    delivery.anomaly_reason = None
    delivery.customer_confirmed = False
    delivery.customer_confirmed_at = None
    # tanker = get_tanker_by_id(db, tanker_id)
    # if tanker.status != "delivering":
    #     ensure_valid_transition(tanker.status, "delivering", TANKER_STATUS_TRANSITIONS, "Tanker")
    #     tanker.status = "delivering"
    tanker = get_tanker_by_id(db, tanker_id)
    if tanker.status == "delivering":
        ensure_valid_transition(tanker.status, "arrived", TANKER_STATUS_TRANSITIONS, "Tanker")
        tanker.status = "arrived"
    elif tanker.status != "arrived":
        raise HTTPException(
            status_code=400,
            detail=f"Tanker must be at the stop before measurement can begin. Current tanker status: '{tanker.status}'",
        )
    db.add(delivery)
    db.add(tanker)
    db.commit()
    db.refresh(delivery)
    return delivery


def finish_measurement(db: Session, *, tanker_id: int, delivery_id: int, meter_end_reading: float, notes: Optional[str] = None) -> DeliveryRecord:
    delivery = get_delivery_by_id(db, delivery_id)
    _ensure_delivery_owned_by_tanker(delivery, tanker_id)
    if delivery.delivery_status == "awaiting_otp":
        return delivery
    _ensure_not_resolved(delivery)
    if delivery.delivery_status != "measuring":
        raise HTTPException(status_code=400, detail=f"Cannot finish measurement from status '{delivery.delivery_status}'")
    if delivery.measurement_started_at is None or delivery.meter_start_reading is None:
        raise HTTPException(status_code=400, detail="Measurement has not been started")
    if meter_end_reading is None or meter_end_reading <= delivery.meter_start_reading:
        raise HTTPException(status_code=400, detail="Meter end reading must be greater than meter start reading")
    actual_liters = meter_end_reading - delivery.meter_start_reading
    delivery.meter_end_reading = meter_end_reading
    delivery.actual_liters_delivered = actual_liters
    delivery.measurement_completed_at = _utcnow()
    delivery.measurement_valid = True
    delivery.delivery_status = "awaiting_otp"
    delivery.otp_verified = False
    delivery.otp_verified_at = None
    delivery.otp_consumed_at = None
    delivery.otp_expires_at = _utcnow() + timedelta(minutes=OTP_WINDOW_MINUTES)
    if notes is not None:
        delivery.notes = notes
    if actual_liters > (delivery.planned_liters * ANOMALY_FACTOR):
        delivery.anomaly_flagged = True
        delivery.anomaly_reason = f"Measured liters {actual_liters:.2f} exceed planned liters {delivery.planned_liters:.2f} by more than 20%"
    else:
        delivery.anomaly_flagged = False
        delivery.anomaly_reason = None
    db.add(delivery)
    db.commit()
    db.refresh(delivery)
    return delivery


def confirm_delivery_otp(db: Session, *, tanker_id: int, delivery_id: int, otp_code: str) -> DeliveryRecord:
    delivery = get_delivery_by_id(db, delivery_id)
    _ensure_delivery_owned_by_tanker(delivery, tanker_id)
    if delivery.otp_verified:
        return delivery
    _ensure_not_resolved(delivery)
    if delivery.delivery_status != "awaiting_otp":
        raise HTTPException(status_code=400, detail=f"Cannot confirm OTP from status '{delivery.delivery_status}'")
    if delivery.measurement_required and not delivery.measurement_valid:
        raise HTTPException(status_code=400, detail="Measurement must be completed and validated before OTP confirmation")
    if delivery.otp_expires_at and _utcnow() > delivery.otp_expires_at:
        raise HTTPException(status_code=400, detail="OTP has expired for this delivery stop")
    expected_code = delivery.delivery_code or ""
    if (otp_code or "") != expected_code:
        delivery.otp_invalid_attempts = (delivery.otp_invalid_attempts or 0) + 1
        db.add(delivery)
        db.commit()
        raise HTTPException(status_code=400, detail="Invalid OTP code")
    delivery.otp_verified = True
    delivery.otp_verified_at = _utcnow()
    delivery.otp_consumed_at = _utcnow()
    delivery.delivery_code = None
    delivery.customer_confirmed = True
    delivery.customer_confirmed_at = _utcnow()
    db.add(delivery)
    db.commit()
    db.refresh(delivery)
    return delivery


def complete_delivery_stop(db: Session, *, tanker_id: int, delivery_id: int, auto_finalize_job: bool = True) -> dict[str, Any]:
    delivery = get_delivery_by_id(db, delivery_id)
    _ensure_delivery_owned_by_tanker(delivery, tanker_id)
    if delivery.delivery_status == "delivered":
        return {"message": "Delivery stop already completed", "delivery": delivery, "finalize_result": _finalize_job_if_possible(db, delivery) if auto_finalize_job else None}
    _ensure_not_resolved(delivery)
    if delivery.delivery_status != "awaiting_otp":
        raise HTTPException(status_code=400, detail=f"Cannot complete delivery from status '{delivery.delivery_status}'")
    if delivery.measurement_required and (not delivery.measurement_valid or delivery.meter_start_reading is None or delivery.meter_end_reading is None or (delivery.actual_liters_delivered or 0) <= 0):
        raise HTTPException(status_code=400, detail="Measurement must be completed before delivery completion")
    if delivery.otp_required and not delivery.otp_verified:
        raise HTTPException(status_code=400, detail="OTP must be verified before completing this stop")
    if delivery.otp_required and delivery.otp_consumed_at is None:
        raise HTTPException(status_code=400, detail="OTP verification record is missing")
    delivery.delivery_status = "delivered"
    delivery.delivered_at = delivery.delivered_at or _utcnow()
    _sync_customer_state_for_stop(db, delivery)
    tanker = get_tanker_by_id(db, tanker_id)
    if tanker.status != "delivering":
        tanker.status = "delivering"
    db.add(delivery)
    db.add(tanker)
    next_stop = _activate_next_open_stop(db, delivery)
    db.commit()
    db.refresh(delivery)
    if next_stop is not None:
        db.refresh(next_stop)
    finalize_result = _finalize_job_if_possible(db, delivery) if auto_finalize_job else None
    return {
        "message": "Delivery stop completed successfully",
        "delivery": delivery,
        "next_stop": next_stop,
        "finalize_result": finalize_result,
    }


def fail_delivery_stop(db: Session, *, tanker_id: int, delivery_id: int, reason: str) -> dict[str, Any]:
    delivery = get_delivery_by_id(db, delivery_id)
    _ensure_delivery_owned_by_tanker(delivery, tanker_id)
    if delivery.delivery_status == "failed":
        return {"message": "Delivery stop already marked as failed", "delivery": delivery, "finalize_result": _finalize_job_if_possible(db, delivery)}
    _ensure_not_resolved(delivery)
    clean_reason = (reason or "").strip()
    if not clean_reason:
        raise HTTPException(status_code=400, detail="Failure reason is required")
    delivery.delivery_status = "failed"
    delivery.failure_reason = clean_reason
    delivery.notes = clean_reason
    delivery.failed_at = delivery.failed_at or _utcnow()
    _sync_customer_state_for_stop(db, delivery)
    next_stop = _activate_next_open_stop(db, delivery)
    db.add(delivery)
    db.commit()
    db.refresh(delivery)
    if next_stop is not None:
        db.refresh(next_stop)
    return {
        "message": "Delivery stop marked as failed",
        "delivery": delivery,
        "next_stop": next_stop,
        "finalize_result": _finalize_job_if_possible(db, delivery),
    }


def skip_delivery_stop(db: Session, *, tanker_id: int, delivery_id: int, reason: str) -> dict[str, Any]:
    delivery = get_delivery_by_id(db, delivery_id)
    _ensure_delivery_owned_by_tanker(delivery, tanker_id)
    if delivery.delivery_status == "skipped":
        return {"message": "Delivery stop already skipped", "delivery": delivery, "finalize_result": _finalize_job_if_possible(db, delivery)}
    _ensure_not_resolved(delivery)
    clean_reason = (reason or "").strip()
    if not clean_reason:
        raise HTTPException(status_code=400, detail="Skip reason is required")
    delivery.delivery_status = "skipped"
    delivery.skip_reason = clean_reason
    delivery.notes = clean_reason
    delivery.skipped_at = delivery.skipped_at or _utcnow()
    _sync_customer_state_for_stop(db, delivery)
    next_stop = _activate_next_open_stop(db, delivery)
    db.add(delivery)
    db.commit()
    db.refresh(delivery)
    if next_stop is not None:
        db.refresh(next_stop)
    return {
        "message": "Delivery stop skipped",
        "delivery": delivery,
        "next_stop": next_stop,
        "finalize_result": _finalize_job_if_possible(db, delivery),
    }