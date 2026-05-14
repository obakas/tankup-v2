from __future__ import annotations

from datetime import datetime, timedelta
import json
from typing import Any

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.admin_audit_log import AdminAuditLog
from app.models.batch import Batch
from app.models.batch_member import BatchMember
from app.models.DeliveryRecord import DeliveryRecord
from app.models.payment import Payment
from app.models.request import LiquidRequest
from app.models.tanker import Tanker
from app.models.user import User
from app.services.batch_service import cleanup_expired_members
from app.services.delivery_service import _finalize_job_if_possible
from app.services.refund_service import execute_member_refund
from app.utils.status_rules import ensure_valid_transition, BATCH_STATUS_TRANSITIONS, TANKER_STATUS_TRANSITIONS
from app.api.deps import require_admin
from app.models.operation_alert import OperationAlert
from app.services.assignment_service import (
    create_job_offer,
    retry_batch_assignment,
    retry_priority_assignment,
    mark_offer_declined,
)
from app.models.job_offer import JobOffer


def require_admin_secret(x_admin_secret: str | None = Header(default=None)) -> str:
    expected = (settings.ADMIN_SECRET or "").strip()
    provided = (x_admin_secret or "").strip()
    if not expected:
        raise HTTPException(status_code=500, detail="ADMIN_SECRET is not configured on the backend")
    if not provided or provided != expected:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin secret")
    return provided


# router = APIRouter(prefix="/admin", tags=["Admin"], dependencies=[Depends(require_admin_secret)])
router = APIRouter(prefix="/admin", tags=["Admin"])

ACTIVE_BATCH_STATUSES = {"forming", "near_ready", "ready_for_assignment", "assigned", "loading", "delivering", "arrived"}
ACTIVE_REQUEST_STATUSES = {"pending", "searching_driver", "assignment_pending", "assigned", "loading", "delivering", "arrived"}
ACTIVE_TANKER_STATUSES = {"available", "assigned", "loading", "delivering", "arrived"}
ACTIVE_DELIVERY_STATUSES = {"pending", "en_route", "arrived", "measuring", "awaiting_otp"}
RESOLVED_DELIVERY_STATUSES = {"delivered", "failed", "skipped"}


class AdminReasonPayload(BaseModel):
    reason: str = Field(..., min_length=3, max_length=255)


class AdminDeliveryCompletePayload(BaseModel):
    notes: str | None = Field(default=None, max_length=255)
    actual_liters_delivered: float | None = Field(default=None, ge=0)


# ---------- helpers ----------

def _iso(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None


def _utcnow() -> datetime:
    return datetime.utcnow()


def _safe_set_batch_status(batch: Batch, next_status: str) -> None:
    current_status = str(getattr(batch, "status", "") or "")
    if current_status != next_status:
        ensure_valid_transition(current_status, next_status, BATCH_STATUS_TRANSITIONS, "Batch")
    batch.status = next_status


def _safe_set_tanker_status(tanker: Tanker, next_status: str) -> None:
    current_status = str(getattr(tanker, "status", "") or "")
    if current_status != next_status:
        ensure_valid_transition(current_status, next_status, TANKER_STATUS_TRANSITIONS, "Tanker")
    tanker.status = next_status


def _build_batch_card(db: Session, batch: Batch) -> dict[str, Any]:
    paid_members = (
        db.query(BatchMember)
        .filter(BatchMember.batch_id == batch.id, BatchMember.payment_status == "paid")
        .count()
    )
    total_members = db.query(BatchMember).filter(BatchMember.batch_id == batch.id).count()
    deliveries_total = db.query(DeliveryRecord).filter(DeliveryRecord.batch_id == batch.id).count()
    deliveries_completed = (
        db.query(DeliveryRecord)
        .filter(DeliveryRecord.batch_id == batch.id, DeliveryRecord.delivery_status == "delivered")
        .count()
    )

    target = float(getattr(batch, "target_volume", 0) or 0)
    current = float(getattr(batch, "current_volume", 0) or 0)
    fill_percent = round((current / target) * 100, 1) if target > 0 else 0.0

    return {
        "id": batch.id,
        "status": batch.status,
        "current_volume": current,
        "target_volume": target,
        "fill_percent": fill_percent,
        "member_count": total_members,
        "paid_member_count": paid_members,
        "tanker_id": batch.tanker_id,
        "search_radius_km": float(getattr(batch, "search_radius_km", 0) or 0),
        "latitude": batch.latitude,
        "longitude": batch.longitude,
        "created_at": _iso(getattr(batch, "created_at", None)),
        "expires_at": _iso(getattr(batch, "expires_at", None)),
        "loading_deadline": _iso(getattr(batch, "loading_deadline", None)),
        "completed_at": _iso(getattr(batch, "completed_at", None)),
        "deliveries_completed": deliveries_completed,
        "deliveries_total": deliveries_total,
    }


def _build_tanker_card(db: Session, tanker: Tanker) -> dict[str, Any]:
    active_batch = (
        db.query(Batch)
        .filter(Batch.tanker_id == tanker.id, Batch.status.in_(list(ACTIVE_BATCH_STATUSES)))
        .order_by(Batch.id.desc())
        .first()
    )
    active_request = None
    if tanker.current_request_id:
        active_request = db.query(LiquidRequest).filter(LiquidRequest.id == tanker.current_request_id).first()

    return {
        "id": tanker.id,
        "driver_name": tanker.driver_name,
        "phone": tanker.phone,
        "tank_plate_number": tanker.tank_plate_number,
        "status": tanker.status,
        "is_available": tanker.is_available,
        "is_online": getattr(tanker, "is_online", False),
        "current_request_id": tanker.current_request_id,
        "active_batch_id": active_batch.id if active_batch else None,
        "active_request_status": active_request.status if active_request else None,
        "pending_offer_type": tanker.pending_offer_type,
        "pending_offer_id": tanker.pending_offer_id,
        "offer_expires_at": _iso(tanker.offer_expires_at),
        "latitude": tanker.latitude,
        "longitude": tanker.longitude,
        "last_location_update_at": _iso(tanker.last_location_update_at),
        "paused_until": _iso(getattr(tanker, "paused_until", None)),
    }


def _build_delivery_card(db: Session, delivery: DeliveryRecord) -> dict[str, Any]:
    user = db.query(User).filter(User.id == delivery.user_id).first() if delivery.user_id else None
    return {
        "id": delivery.id,
        "job_type": delivery.job_type,
        "batch_id": delivery.batch_id,
        "member_id": delivery.member_id or delivery.batch_member_id,
        "request_id": delivery.request_id,
        "tanker_id": delivery.tanker_id,
        "user_id": delivery.user_id,
        "user_name": user.name if user else None,
        "delivery_status": delivery.delivery_status,
        "stop_order": delivery.stop_order,
        "planned_liters": float(delivery.planned_liters or 0),
        "actual_liters_delivered": float(delivery.actual_liters_delivered or 0) if delivery.actual_liters_delivered is not None else None,
        "measurement_valid": delivery.measurement_valid,
        "otp_verified": delivery.otp_verified,
        "anomaly_flagged": delivery.anomaly_flagged,
        "failure_reason": delivery.failure_reason,
        "skip_reason": delivery.skip_reason,
        "notes": delivery.notes,
        "created_at": _iso(delivery.created_at),
        "updated_at": _iso(delivery.updated_at),
        "arrived_at": _iso(delivery.arrived_at),
        "delivered_at": _iso(delivery.delivered_at),
        "failed_at": _iso(delivery.failed_at),
        "skipped_at": _iso(delivery.skipped_at),
    }



def _resolve_admin_request_status(db: Session, request: LiquidRequest) -> str:
    if request.delivery_type != "batch":
        return request.status

    member = (
        db.query(BatchMember)
        .filter(BatchMember.request_id == request.id)
        .order_by(BatchMember.id.desc())
        .first()
    )

    if not member:
        return request.status

    delivery = (
        db.query(DeliveryRecord)
        .filter(
            DeliveryRecord.job_type == "batch",
            or_(
                DeliveryRecord.member_id == member.id,
                DeliveryRecord.batch_member_id == member.id,
                DeliveryRecord.request_id == request.id,
            ),
        )
        .order_by(DeliveryRecord.updated_at.desc(), DeliveryRecord.id.desc())
        .first()
    )

    if delivery:
        if delivery.delivery_status == "delivered":
            return "completed"
        if delivery.delivery_status == "failed":
            return "failed"
        if delivery.delivery_status == "skipped":
            return "skipped"
        if delivery.delivery_status in {"en_route", "arrived", "measuring", "awaiting_otp"}:
            return delivery.delivery_status

    if member.status == "delivered":
        return "completed"

    if member.status in {"failed", "skipped", "withdrawn", "expired"}:
        return member.status

    batch = db.query(Batch).filter(Batch.id == member.batch_id).first() if member.batch_id else None

    if batch:
        if batch.status == "completed":
            return "completed"
        if batch.status in {"partially_completed", "failed", "expired", "delivering", "arrived", "loading", "assigned"}:
            return batch.status

    return request.status


def _build_request_item(db: Session, item: LiquidRequest) -> dict[str, Any]:
    return {
        "id": item.id,
        "user_id": item.user_id,
        "delivery_type": item.delivery_type,
        "status": _resolve_admin_request_status(db, item),
        "raw_request_status": item.status,
        "volume_liters": item.volume_liters,
        "is_asap": item.is_asap,
        "scheduled_for": _iso(item.scheduled_for),
        "latitude": item.latitude,
        "longitude": item.longitude,
        "retry_count": item.retry_count,
        "assignment_failed_reason": item.assignment_failed_reason,
        "refund_eligible": item.refund_eligible,
        "created_at": _iso(item.created_at),
        "updated_at": _iso(item.updated_at),
    }



def _search_like(value: str) -> str:
    return f"%{value.strip()}%"


def _apply_delivery_resolution_side_effects(db: Session, delivery: DeliveryRecord) -> dict[str, Any]:
    tanker = db.query(Tanker).filter(Tanker.id == delivery.tanker_id).first()

    if delivery.job_type == "batch" and delivery.member_id:
        member = db.query(BatchMember).filter(BatchMember.id == delivery.member_id).first()
        if member:
            if delivery.delivery_status == "delivered":
                member.status = "delivered"
                if hasattr(member, "customer_confirmed"):
                    member.customer_confirmed = True
                if hasattr(member, "customer_confirmed_at"):
                    member.customer_confirmed_at = delivery.delivered_at or _utcnow()
            elif delivery.delivery_status == "failed":
                member.status = "failed"
            elif delivery.delivery_status == "skipped":
                member.status = "skipped"
            db.add(member)

    if delivery.job_type == "priority" and delivery.request_id:
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

    next_stop = None
    if delivery.job_type == "batch" and delivery.batch_id:
        next_stop = (
            db.query(DeliveryRecord)
            .filter(
                DeliveryRecord.job_type == "batch",
                DeliveryRecord.batch_id == delivery.batch_id,
                DeliveryRecord.delivery_status == "pending",
            )
            .order_by(DeliveryRecord.stop_order.asc(), DeliveryRecord.id.asc())
            .first()
        )
    elif delivery.job_type == "priority" and delivery.request_id:
        next_stop = (
            db.query(DeliveryRecord)
            .filter(
                DeliveryRecord.job_type == "priority",
                DeliveryRecord.request_id == delivery.request_id,
                DeliveryRecord.delivery_status == "pending",
            )
            .order_by(DeliveryRecord.stop_order.asc(), DeliveryRecord.id.asc())
            .first()
        )

    if next_stop:
        next_stop.delivery_status = "en_route"
        next_stop.dispatched_at = next_stop.dispatched_at or _utcnow()
        db.add(next_stop)
        if tanker and tanker.status != "delivering":
            tanker.status = "delivering"
            tanker.is_available = False
            db.add(tanker)
    elif tanker:
        tanker.status = "available"
        tanker.is_available = True
        if delivery.job_type == "priority":
            tanker.current_request_id = None
        db.add(tanker)

    db.add(delivery)
    db.commit()
    db.refresh(delivery)
    finalize_result = _finalize_job_if_possible(db, delivery)
    return {"delivery": delivery, "next_stop_id": next_stop.id if next_stop else None, "finalize_result": finalize_result}


def _mark_delivery_status_manually(db: Session, delivery: DeliveryRecord, status_value: str, reason: str | None = None, notes: str | None = None, actual_liters_delivered: float | None = None) -> dict[str, Any]:
    if delivery.delivery_status in RESOLVED_DELIVERY_STATUSES:
        raise HTTPException(status_code=400, detail=f"Delivery already resolved as '{delivery.delivery_status}'")

    now = _utcnow()
    delivery.delivery_status = status_value
    delivery.updated_at = now

    if status_value == "delivered":
        delivered = actual_liters_delivered if actual_liters_delivered is not None else (delivery.actual_liters_delivered or delivery.planned_liters)
        delivery.arrived_at = delivery.arrived_at or now
        delivery.measurement_started_at = delivery.measurement_started_at or now
        delivery.measurement_completed_at = delivery.measurement_completed_at or now
        delivery.delivered_at = delivery.delivered_at or now
        delivery.actual_liters_delivered = delivered
        if delivery.measurement_required:
            delivery.meter_start_reading = delivery.meter_start_reading if delivery.meter_start_reading is not None else 0
            delivery.meter_end_reading = delivery.meter_end_reading if delivery.meter_end_reading is not None else delivered
            delivery.measurement_valid = True
        if delivery.otp_required:
            delivery.otp_verified = True
            delivery.otp_verified_at = delivery.otp_verified_at or now
            delivery.otp_consumed_at = delivery.otp_consumed_at or now
            delivery.delivery_code = None
        delivery.customer_confirmed = True
        delivery.customer_confirmed_at = delivery.customer_confirmed_at or now
        if notes:
            delivery.notes = notes
    elif status_value == "failed":
        delivery.failed_at = delivery.failed_at or now
        delivery.failure_reason = reason
        delivery.notes = notes or reason
    elif status_value == "skipped":
        delivery.skipped_at = delivery.skipped_at or now
        delivery.skip_reason = reason
        delivery.notes = notes or reason

    return _apply_delivery_resolution_side_effects(db, delivery)


# ---------- auth ----------

@router.get("/session")
def admin_session():
    return {"ok": True, "message": "Admin access granted"}


# ---------- read endpoints ----------

@router.get("/overview")
def admin_overview(db: Session = Depends(get_db), current_admin: dict = Depends(require_admin)):
    batch_status_counts = {
        status: count
        for status, count in db.query(Batch.status, func.count(Batch.id)).group_by(Batch.status).all()
    }
    tanker_status_counts = {
        status: count
        for status, count in db.query(Tanker.status, func.count(Tanker.id)).group_by(Tanker.status).all()
    }
    request_status_counts = {
        status: count
        for status, count in db.query(LiquidRequest.status, func.count(LiquidRequest.id)).group_by(LiquidRequest.status).all()
    }
    delivery_status_counts = {
        status: count
        for status, count in db.query(DeliveryRecord.delivery_status, func.count(DeliveryRecord.id)).group_by(DeliveryRecord.delivery_status).all()
    }
    payment_status_counts = {
        status: count
        for status, count in db.query(Payment.status, func.count(Payment.id)).group_by(Payment.status).all()
    }

    total_payment_value = db.query(func.coalesce(func.sum(Payment.amount), 0)).scalar() or 0
    paid_payment_value = db.query(func.coalesce(func.sum(Payment.amount), 0)).filter(Payment.status == "paid").scalar() or 0

    return {
        "generated_at": _iso(_utcnow()),
        "totals": {
            "users": db.query(func.count(User.id)).scalar() or 0,
            "batches": db.query(func.count(Batch.id)).scalar() or 0,
            "priority_requests": db.query(func.count(LiquidRequest.id)).filter(LiquidRequest.delivery_type == "priority").scalar() or 0,
            "tankers": db.query(func.count(Tanker.id)).scalar() or 0,
            "payments": db.query(func.count(Payment.id)).scalar() or 0,
            "delivery_records": db.query(func.count(DeliveryRecord.id)).scalar() or 0,
            "online_tankers": db.query(func.count(Tanker.id)).filter(Tanker.is_online.is_(True)).scalar() or 0,
            "available_tankers": db.query(func.count(Tanker.id)).filter(Tanker.is_available.is_(True), Tanker.status == "available").scalar() or 0,
            "active_batches": db.query(func.count(Batch.id)).filter(Batch.status.in_(list(ACTIVE_BATCH_STATUSES))).scalar() or 0,
            "active_priority_requests": db.query(func.count(LiquidRequest.id)).filter(LiquidRequest.status.in_(list(ACTIVE_REQUEST_STATUSES)), LiquidRequest.delivery_type == "priority").scalar() or 0,
            "active_deliveries": db.query(func.count(DeliveryRecord.id)).filter(DeliveryRecord.delivery_status.in_(list(ACTIVE_DELIVERY_STATUSES))).scalar() or 0,
        },
        "payment_value": {
            "total": float(total_payment_value),
            "paid": float(paid_payment_value),
        },
        "status_breakdown": {
            "batches": batch_status_counts,
            "tankers": tanker_status_counts,
            "requests": request_status_counts,
            "deliveries": delivery_status_counts,
            "payments": payment_status_counts,
        },
    }


@router.get("/live")
def admin_live(limit: int = Query(20, ge=1, le=100), db: Session = Depends(get_db), current_admin: dict = Depends(require_admin)):
    active_batches = (
        db.query(Batch)
        .filter(Batch.status.in_(list(ACTIVE_BATCH_STATUSES)))
        .order_by(Batch.created_at.desc(), Batch.id.desc())
        .limit(limit)
        .all()
    )
    active_tankers = (
        db.query(Tanker)
        .filter((Tanker.status.in_(list(ACTIVE_TANKER_STATUSES))) | (Tanker.pending_offer_type.is_not(None)))
        .order_by(Tanker.id.desc())
        .limit(limit)
        .all()
    )
    active_deliveries = (
        db.query(DeliveryRecord)
        .filter(DeliveryRecord.delivery_status.in_(list(ACTIVE_DELIVERY_STATUSES)))
        .order_by(DeliveryRecord.updated_at.desc(), DeliveryRecord.id.desc())
        .limit(limit)
        .all()
    )
    active_requests = (
        db.query(LiquidRequest)
        .filter(LiquidRequest.delivery_type == "priority", LiquidRequest.status.in_(list(ACTIVE_REQUEST_STATUSES)))
        .order_by(LiquidRequest.updated_at.desc(), LiquidRequest.id.desc())
        .limit(limit)
        .all()
    )

    return {
        "generated_at": _iso(_utcnow()),
        "batches": [_build_batch_card(db, item) for item in active_batches],
        "tankers": [_build_tanker_card(db, item) for item in active_tankers],
        "deliveries": [_build_delivery_card(db, item) for item in active_deliveries],
        # "priority_requests": [_build_request_item(request) for request in active_requests],
        "priority_requests": [_build_request_item(db, request) for request in active_requests],
    }


@router.get("/requests")
def admin_requests(
    limit: int = Query(50, ge=1, le=200),
    delivery_type: str | None = Query(None),
    status: str | None = Query(None),
    search: str | None = Query(None),
    db: Session = Depends(get_db),
    current_admin: dict = Depends(require_admin)
):
    query = db.query(LiquidRequest)
    if delivery_type:
        query = query.filter(LiquidRequest.delivery_type == delivery_type)
    if status:
        query = query.filter(LiquidRequest.status == status)
    if search and search.strip():
        term = _search_like(search)
        query = query.filter(
            or_(
                LiquidRequest.id.like(term),
                LiquidRequest.user_id.like(term),
                LiquidRequest.status.ilike(term),
                LiquidRequest.delivery_type.ilike(term),
            )
        )
    requests = query.order_by(LiquidRequest.created_at.desc(), LiquidRequest.id.desc()).limit(limit).all()
    # return {"items": [_build_request_item(item) for item in requests]}
    return {"items": [_build_request_item(db, item) for item in requests]}


@router.get("/requests/{request_id}")
def admin_request_detail(request_id: int, db: Session = Depends(get_db), current_admin: dict = Depends(require_admin)):
    request = db.query(LiquidRequest).filter(LiquidRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    user = db.query(User).filter(User.id == request.user_id).first()
    member = db.query(BatchMember).filter(BatchMember.request_id == request.id).order_by(BatchMember.id.desc()).first()
    batch = db.query(Batch).filter(Batch.id == member.batch_id).first() if member and member.batch_id else None
    payments = db.query(Payment).filter(or_(Payment.user_id == request.user_id, Payment.member_id == (member.id if member else None), Payment.batch_id == (batch.id if batch else None))).order_by(Payment.id.desc()).all()
    deliveries = db.query(DeliveryRecord).filter(or_(DeliveryRecord.request_id == request.id, DeliveryRecord.member_id == (member.id if member else None), DeliveryRecord.batch_id == (batch.id if batch else None))).order_by(DeliveryRecord.id.asc()).all()
    tanker = db.query(Tanker).filter(Tanker.id == batch.tanker_id).first() if batch and batch.tanker_id else None

    return {
        # "request": _build_request_item(request),
        "request": _build_request_item(db, request),
        "user": {
            "id": user.id,
            "name": user.name,
            "phone": user.phone,
            "address": user.address,
        } if user else None,
        "member": {
            "id": member.id,
            "status": getattr(member, "status", None),
            "payment_status": getattr(member, "payment_status", None),
            "amount_paid": float(getattr(member, "amount_paid", 0) or 0),
            "joined_at": _iso(getattr(member, "created_at", None)),
        } if member else None,
        "batch": _build_batch_card(db, batch) if batch else None,
        "tanker": _build_tanker_card(db, tanker) if tanker else None,
        "payments": [
            {
                "id": p.id,
                "user_id": p.user_id,
                "batch_id": p.batch_id,
                "member_id": p.member_id,
                "amount": float(p.amount or 0),
                "status": p.status,
            }
            for p in payments
        ],
        "deliveries": [_build_delivery_card(db, d) for d in deliveries],
    }


@router.get("/payments")
def admin_payments(limit: int = Query(50, ge=1, le=200), status: str | None = Query(None), search: str | None = Query(None), db: Session = Depends(get_db), current_admin: dict = Depends(require_admin)):
    query = db.query(Payment)
    if status:
        query = query.filter(Payment.status == status)
    if search and search.strip():
        term = _search_like(search)
        query = query.filter(
            or_(
                Payment.status.ilike(term),
                Payment.id.like(term),
                Payment.user_id.like(term),
                Payment.batch_id.like(term),
                Payment.member_id.like(term),
            )
        )
    payments = query.order_by(Payment.id.desc()).limit(limit).all()
    return {
        "items": [
            {
                "id": item.id,
                "user_id": item.user_id,
                "batch_id": item.batch_id,
                "member_id": item.member_id,
                "amount": float(item.amount or 0),
                "status": item.status,
            }
            for item in payments
        ]
    }


@router.get("/tankers")
def admin_tankers(limit: int = Query(50, ge=1, le=200), status: str | None = Query(None), search: str | None = Query(None), db: Session = Depends(get_db), current_admin: dict = Depends(require_admin)):
    query = db.query(Tanker)
    if status:
        query = query.filter(Tanker.status == status)
    if search and search.strip():
        term = _search_like(search)
        query = query.filter(
            or_(
                Tanker.driver_name.ilike(term),
                Tanker.phone.ilike(term),
                Tanker.tank_plate_number.ilike(term),
                Tanker.status.ilike(term),
            )
        )
    tankers = query.order_by(Tanker.id.desc()).limit(limit).all()
    return {"items": [_build_tanker_card(db, item) for item in tankers]}


@router.get("/deliveries")
def admin_deliveries(
    limit: int = Query(50, ge=1, le=200),
    status: str | None = Query(None),
    job_type: str | None = Query(None),
    search: str | None = Query(None),
    db: Session = Depends(get_db),
    current_admin: dict = Depends(require_admin)
):
    query = db.query(DeliveryRecord)
    if status:
        query = query.filter(DeliveryRecord.delivery_status == status)
    if job_type:
        query = query.filter(DeliveryRecord.job_type == job_type)
    if search and search.strip():
        term = _search_like(search)
        query = query.filter(
            or_(
                DeliveryRecord.id.like(term),
                DeliveryRecord.job_type.ilike(term),
                DeliveryRecord.delivery_status.ilike(term),
                DeliveryRecord.request_id.like(term),
                DeliveryRecord.batch_id.like(term),
                DeliveryRecord.member_id.like(term),
                DeliveryRecord.tanker_id.like(term),
                DeliveryRecord.user_id.like(term),
            )
        )
    deliveries = query.order_by(DeliveryRecord.updated_at.desc(), DeliveryRecord.id.desc()).limit(limit).all()
    return {"items": [_build_delivery_card(db, item) for item in deliveries]}


# ---------- write endpoints ----------

@router.post("/maintenance/cleanup-expired")
def trigger_cleanup(db: Session = Depends(get_db), current_admin: dict = Depends(require_admin)):
    cleanup_expired_members(db)
    return {"message": "Expired members cleanup triggered"}


@router.post("/batches/{batch_id}/expire")
def force_expire_batch(batch_id: int, refund_paid_members: bool = True, db: Session = Depends(get_db), current_admin: dict = Depends(require_admin)):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    current_status = str(batch.status or "")
    if current_status in {"completed", "expired", "failed", "partially_completed"}:
        raise HTTPException(status_code=400, detail=f"Batch already resolved as '{current_status}'")

    if current_status != "expired":
        _safe_set_batch_status(batch, "expired")

    batch.completed_at = None
    batch.assignment_failed_at = _utcnow()

    refunds: list[dict[str, Any]] = []
    members = db.query(BatchMember).filter(BatchMember.batch_id == batch.id).all()
    db.add(batch)
    db.commit()
    db.refresh(batch)

    if refund_paid_members:
        for member in members:
            if member.payment_status == "paid" and member.status == "active":
                try:
                    result = execute_member_refund(db, member, batch)
                    refunds.append({"member_id": member.id, "success": True, "result": result})
                except HTTPException as exc:
                    refunds.append({"member_id": member.id, "success": False, "detail": exc.detail})

    return {
        "message": "Batch force-expired successfully",
        "batch_id": batch.id,
        "status": batch.status,
        "refunds": refunds,
    }



@router.post("/requests/{request_id}/cancel")
def admin_cancel_priority_request(
    request_id: int,
    payload: AdminReasonPayload,
    db: Session = Depends(get_db),
    current_admin: dict = Depends(require_admin),
):
    request = db.query(LiquidRequest).filter(LiquidRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    if request.delivery_type != "priority":
        raise HTTPException(status_code=400, detail="Only priority requests can be cancelled here")

    if request.status in {"completed", "cancelled", "failed"}:
        raise HTTPException(status_code=400, detail=f"Request already resolved as '{request.status}'")

    affected_tankers = (
        db.query(Tanker)
        .filter(
            Tanker.pending_offer_type == "priority",
            Tanker.pending_offer_id == request.id,
        )
        .all()
    )

    for tanker in affected_tankers:
        offer = (
            db.query(JobOffer)
            .filter(
                JobOffer.tanker_id == tanker.id,
                JobOffer.job_type == "priority",
                JobOffer.request_id == request.id,
                JobOffer.response_type.is_(None),
            )
            .order_by(JobOffer.id.desc())
            .first()
        )

        if offer:
            mark_offer_declined(
                db,
                offer,
                decline_reason=f"admin_cancelled_request:{payload.reason}",
            )

        tanker.pending_offer_type = None
        tanker.pending_offer_id = None
        tanker.offer_expires_at = None
        tanker.current_request_id = None
        tanker.is_available = True
        tanker.status = "available"
        db.add(tanker)

    request.status = "cancelled"
    request.assignment_failed_reason = f"admin_cancelled:{payload.reason}"
    request.assignment_failed_at = _utcnow()
    request.refund_eligible = True
    db.add(request)

    db.commit()
    db.refresh(request)

    return {
        "message": "Priority request cancelled by admin",
        "request_id": request.id,
        "status": request.status,
        "affected_tanker_ids": [t.id for t in affected_tankers],
    }


@router.post("/requests/{request_id}/offer/{tanker_id}")
def force_offer_priority_to_tanker(
    request_id: int,
    tanker_id: int,
    db: Session = Depends(get_db),
    current_admin: dict = Depends(require_admin),
):
    request = db.query(LiquidRequest).filter(LiquidRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    if request.delivery_type != "priority":
        raise HTTPException(status_code=400, detail="Only priority requests can be force-offered here")

    if request.status in {"completed", "cancelled", "failed"}:
        raise HTTPException(status_code=400, detail=f"Cannot offer resolved request in status '{request.status}'")

    tanker = db.query(Tanker).filter(Tanker.id == tanker_id).first()
    if not tanker:
        raise HTTPException(status_code=404, detail="Tanker not found")

    if tanker.current_request_id is not None:
        raise HTTPException(status_code=400, detail="Tanker already has an active priority request")

    if tanker.pending_offer_type or tanker.pending_offer_id:
        raise HTTPException(status_code=400, detail="Tanker already has a pending offer")

    existing_offer_tanker = (
        db.query(Tanker)
        .filter(
            Tanker.pending_offer_type == "priority",
            Tanker.pending_offer_id == request.id,
        )
        .first()
    )

    if existing_offer_tanker:
        raise HTTPException(
            status_code=400,
            detail=f"Request already has a pending offer with tanker #{existing_offer_tanker.id}",
        )

    tanker.pending_offer_type = "priority"
    tanker.pending_offer_id = request.id
    tanker.offer_expires_at = _utcnow() + timedelta(seconds=60)
    tanker.is_available = False
    tanker.status = "available"

    request.status = "searching_driver"
    request.assignment_started_at = request.assignment_started_at or _utcnow()
    request.last_offer_at = _utcnow()
    request.assignment_failed_reason = None
    request.assignment_failed_at = None
    request.refund_eligible = False

    offer = create_job_offer(
        db,
        tanker_id=tanker.id,
        job_type="priority",
        request_id=request.id,
        job_lat=request.latitude,
        job_lon=request.longitude,
    )

    db.add(tanker)
    db.add(request)
    db.commit()
    db.refresh(tanker)
    db.refresh(request)

    return {
        "message": "Priority offer sent to tanker",
        "request_id": request.id,
        "tanker_id": tanker.id,
        "offer_id": offer.id,
        "offer_expires_at": _iso(tanker.offer_expires_at),
    }

    
@router.post("/batches/{batch_id}/offer/{tanker_id}")
def force_offer_batch_to_tanker(batch_id: int, tanker_id: int, db: Session = Depends(get_db), current_admin: dict = Depends(require_admin)):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    tanker = db.query(Tanker).filter(Tanker.id == tanker_id).first()
    if not tanker:
        raise HTTPException(status_code=404, detail="Tanker not found")

    if tanker.current_request_id is not None:
        raise HTTPException(status_code=400, detail="Tanker already has an active priority request")
    if tanker.pending_offer_type or tanker.pending_offer_id:
        raise HTTPException(status_code=400, detail="Tanker already has a pending offer")
    if batch.status in {"completed", "expired", "failed", "partially_completed"}:
        raise HTTPException(status_code=400, detail=f"Cannot offer resolved batch in status '{batch.status}'")

    tanker.pending_offer_type = "batch"
    tanker.pending_offer_id = batch.id
    tanker.offer_expires_at = _utcnow() + timedelta(seconds=60)
    tanker.is_available = False
    if tanker.status == "completed":
        tanker.status = "available"

    if batch.status in {"forming", "near_ready"}:
        _safe_set_batch_status(batch, "ready_for_assignment")

    batch.assignment_started_at = batch.assignment_started_at or _utcnow()
    batch.assignment_failed_at = None

    offer = create_job_offer(
        db,
        tanker_id=tanker.id,
        job_type="batch",
        batch_id=batch.id,
        job_lat=batch.latitude,
        job_lon=batch.longitude,
    )

    db.add(tanker)
    db.add(batch)
    db.commit()
    db.refresh(tanker)
    db.refresh(batch)

    return {
        "message": "Batch offer sent to tanker",
        "batch_id": batch.id,
        "tanker_id": tanker.id,
        "offer_id": offer.id,
        "offer_expires_at": _iso(tanker.offer_expires_at),
    }


@router.post("/batch-members/{member_id}/refund")
def admin_refund_member(member_id: int, db: Session = Depends(get_db), current_admin: dict = Depends(require_admin)):
    member = db.query(BatchMember).filter(BatchMember.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Batch member not found")

    batch = db.query(Batch).filter(Batch.id == member.batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    return execute_member_refund(db, member, batch)


@router.post("/tankers/{tanker_id}/reset")
def reset_tanker_availability(tanker_id: int, db: Session = Depends(get_db), current_admin: dict = Depends(require_admin)):
    tanker = db.query(Tanker).filter(Tanker.id == tanker_id).first()
    if not tanker:
        raise HTTPException(status_code=404, detail="Tanker not found")

    tanker.pending_offer_type = None
    tanker.pending_offer_id = None
    tanker.offer_expires_at = None
    tanker.current_request_id = None
    tanker.is_available = True
    if tanker.status in {"completed", "available", "assigned"}:
        tanker.status = "available"
    elif tanker.status not in {"loading", "delivering", "arrived"}:
        tanker.status = "available"

    db.add(tanker)
    db.commit()
    db.refresh(tanker)

    return {
        "message": "Tanker reset to available state",
        "tanker_id": tanker.id,
        "status": tanker.status,
        "is_available": tanker.is_available,
    }


@router.post("/deliveries/{delivery_id}/complete-manual")
def admin_complete_delivery_manually(delivery_id: int, payload: AdminDeliveryCompletePayload = Body(default=AdminDeliveryCompletePayload()), db: Session = Depends(get_db), current_admin: dict = Depends(require_admin)):
    delivery = db.query(DeliveryRecord).filter(DeliveryRecord.id == delivery_id).first()
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")
    result = _mark_delivery_status_manually(
        db,
        delivery,
        "delivered",
        notes=payload.notes or "Manually completed by admin",
        actual_liters_delivered=payload.actual_liters_delivered,
    )
    return {
        "message": "Delivery manually completed",
        "delivery": _build_delivery_card(db, result["delivery"]),
        "next_stop_id": result["next_stop_id"],
        "finalize_result": result["finalize_result"],
    }


@router.post("/deliveries/{delivery_id}/fail-manual")
def admin_fail_delivery_manually(delivery_id: int, payload: AdminReasonPayload, db: Session = Depends(get_db), current_admin: dict = Depends(require_admin)):
    delivery = db.query(DeliveryRecord).filter(DeliveryRecord.id == delivery_id).first()
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")
    result = _mark_delivery_status_manually(db, delivery, "failed", reason=payload.reason, notes=payload.reason)
    return {
        "message": "Delivery manually marked as failed",
        "delivery": _build_delivery_card(db, result["delivery"]),
        "next_stop_id": result["next_stop_id"],
        "finalize_result": result["finalize_result"],
    }


@router.post("/deliveries/{delivery_id}/skip-manual")
def admin_skip_delivery_manually(delivery_id: int, payload: AdminReasonPayload, db: Session = Depends(get_db), current_admin: dict = Depends(require_admin)):
    delivery = db.query(DeliveryRecord).filter(DeliveryRecord.id == delivery_id).first()
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")
    result = _mark_delivery_status_manually(db, delivery, "skipped", reason=payload.reason, notes=payload.reason)
    return {
        "message": "Delivery manually skipped",
        "delivery": _build_delivery_card(db, result["delivery"]),
        "next_stop_id": result["next_stop_id"],
        "finalize_result": result["finalize_result"],
    }



def require_admin(x_admin_secret: str | None = Header(default=None)):
    if x_admin_secret != settings.ADMIN_SECRET:
        raise HTTPException(status_code=401, detail="Invalid admin secret")
    return True


@router.get("/audit-logs", dependencies=[Depends(require_admin)])
def list_admin_audit_logs(
    action: str | None = Query(default=None),
    entity_type: str | None = Query(default=None),
    entity_id: int | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_admin: dict = Depends(require_admin)
):
    q = db.query(AdminAuditLog)

    if action:
        q = q.filter(AdminAuditLog.action == action)
    if entity_type:
        q = q.filter(AdminAuditLog.entity_type == entity_type)
    if entity_id is not None:
        q = q.filter(AdminAuditLog.entity_id == entity_id)

    rows = q.order_by(AdminAuditLog.created_at.desc()).limit(limit).all()

    return [
        {
            "id": row.id,
            "action": row.action,
            "entity_type": row.entity_type,
            "entity_id": row.entity_id,
            "admin_identifier": row.admin_identifier,
            "reason": row.reason,
            "metadata": json.loads(row.metadata_json or "{}"),
            "created_at": row.created_at.isoformat(),
        }
        for row in rows
    ]


@router.get("/session", dependencies=[Depends(require_admin)])
def admin_session():
    return {"ok": True}


@router.get("/operation-alerts", dependencies=[Depends(require_admin)])
def get_operation_alerts(
    status_filter: str | None = Query(default="open", alias="status"),
    severity: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=300),
    db: Session = Depends(get_db),
):
    query = db.query(OperationAlert)

    if status_filter:
        query = query.filter(OperationAlert.status == status_filter)

    if severity:
        query = query.filter(OperationAlert.severity == severity)

    alerts = (
        query.order_by(OperationAlert.created_at.desc())
        .limit(limit)
        .all()
    )

    return {
        "items": [
            {
                "id": alert.id,
                "alert_type": alert.alert_type,
                "severity": alert.severity,
                "job_type": alert.job_type,
                "job_id": alert.job_id,
                "request_id": alert.request_id,
                "batch_id": alert.batch_id,
                "tanker_id": alert.tanker_id,
                "message": alert.message,
                "status": alert.status,
                "created_at": alert.created_at.isoformat() if alert.created_at else None,
                "resolved_at": alert.resolved_at.isoformat() if alert.resolved_at else None,
            }
            for alert in alerts
        ]
    }

@router.post("/operation-alerts/{alert_id}/reassign", dependencies=[Depends(require_admin)])
def admin_reassign_from_operation_alert(
    alert_id: int,
    db: Session = Depends(get_db),
):
    alert = db.query(OperationAlert).filter(OperationAlert.id == alert_id).first()

    if not alert:
        raise HTTPException(status_code=404, detail="Operation alert not found")

    if alert.alert_type not in {"loading_timeout", "offer_expiry_repeated_failure"}:
        raise HTTPException(
            status_code=400,
            detail="Only loading_timeout and offer_expiry_repeated_failure alerts support reassignment",
        )

    excluded_tanker_ids = [alert.tanker_id] if alert.tanker_id else []

    if alert.job_type == "batch":
        if not alert.batch_id:
            raise HTTPException(status_code=400, detail="Alert has no batch_id")

        result = retry_batch_assignment(
            db,
            alert.batch_id,
            excluded_tanker_ids=excluded_tanker_ids,
        )

    elif alert.job_type == "priority":
        if not alert.request_id:
            raise HTTPException(status_code=400, detail="Alert has no request_id")

        result = retry_priority_assignment(
            db,
            alert.request_id,
            excluded_tanker_ids=excluded_tanker_ids,
            failure_reason=f"manual_admin_reassign_after_{alert.alert_type}",
        )

    else:
        raise HTTPException(status_code=400, detail=f"Unsupported job_type: {alert.job_type}")

    return {
        "success": True,
        "alert_id": alert.id,
        "message": "Manual reassignment attempt completed",
        "result": result,
    }