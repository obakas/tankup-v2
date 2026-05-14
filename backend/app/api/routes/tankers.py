from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.batch import Batch
from app.models.batch_member import BatchMember
from app.models.DeliveryRecord import DeliveryRecord
from app.models.job_offer import JobOffer
from app.models.request import LiquidRequest
from app.models.tanker import Tanker
from app.models.user import User
from app.schemas.tanker import TankerCreate, TankerOut, TankerUpdate, TankerLocationUpdate,TankerLocationOut
from app.services.assignment_service import (
    clear_tanker_offer,
    mark_offer_accepted,
    mark_offer_declined,
    mark_offer_timeout,
    retry_batch_assignment,
    retry_priority_assignment,
    expire_tanker_offer_and_recover,
)
from app.services.delivery_service import (
    create_delivery_record_for_priority,
    create_delivery_records_for_batch,
)
from app.utils.status_rules import ensure_valid_transition, TANKER_STATUS_TRANSITIONS, BATCH_STATUS_TRANSITIONS, REQUEST_STATUS_TRANSITIONS
from app.utils.time_policy import LOADING_TIMEOUT_MINUTES, OFFER_ACCEPT_TIMEOUT_SECONDS

OFFER_TTL_SECONDS = OFFER_ACCEPT_TIMEOUT_SECONDS
LOADING_WINDOW_MINUTES = LOADING_TIMEOUT_MINUTES

router = APIRouter(prefix="/tankers", tags=["Tankers"])

# OFFER_TTL_SECONDS = 60
# LOADING_WINDOW_MINUTES = 90
ACTIVE_JOB_BATCH_STATUSES = {"assigned", "loading", "delivering", "arrived"}
ACTIVE_JOB_REQUEST_STATUSES = {"assigned", "loading", "delivering", "arrived"}
RESOLVED_DELIVERY_STATUSES = {"delivered", "failed", "skipped"}



@router.post("/{tanker_id}/location", response_model=TankerLocationOut)
def update_tanker_location(
    tanker_id: int,
    payload: TankerLocationUpdate,
    db: Session = Depends(get_db),
):
    tanker = get_tanker_or_404(db, tanker_id)

    tanker.latitude = payload.latitude
    tanker.longitude = payload.longitude
    tanker.last_location_update_at = datetime.utcnow()

    db.add(tanker)
    db.commit()
    db.refresh(tanker)

    return {
        "tanker_id": tanker.id,
        "latitude": tanker.latitude,
        "longitude": tanker.longitude,
        "last_location_update_at": tanker.last_location_update_at,
        "tanker_status": tanker.status,
        "is_available": tanker.is_available,
    }


@router.get("/{tanker_id}/location", response_model=TankerLocationOut)
def get_tanker_location(tanker_id: int, db: Session = Depends(get_db)):
    tanker = get_tanker_or_404(db, tanker_id)
    return {
        "tanker_id": tanker.id,
        "latitude": tanker.latitude,
        "longitude": tanker.longitude,
        "last_location_update_at": tanker.last_location_update_at,
        "tanker_status": tanker.status,
        "is_available": tanker.is_available,
    }

def get_tanker_or_404(db: Session, tanker_id: int) -> Tanker:
    tanker = db.query(Tanker).filter(Tanker.id == tanker_id).first()
    if not tanker:
        raise HTTPException(status_code=404, detail="Tanker not found")
    return tanker

def build_tanker_location_payload(tanker: Tanker) -> dict[str, Any]:
    return {
        "tanker_id": tanker.id,
        "latitude": tanker.latitude,
        "longitude": tanker.longitude,
        "last_location_update_at": tanker.last_location_update_at,
        "tanker_status": tanker.status,
        "is_available": tanker.is_available,
    }


def get_user_or_none(db: Session, user_id: int | None) -> User | None:
    if not user_id:
        return None
    return db.query(User).filter(User.id == user_id).first()


def get_request_or_404(db: Session, request_id: int) -> LiquidRequest:
    request = db.query(LiquidRequest).filter(LiquidRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Priority request not found")
    return request


def get_batch_or_404(db: Session, batch_id: int) -> Batch:
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return batch


def validate_transition_or_400(current_status: str, next_status: str, transitions: dict[str, set[str]], entity_name: str) -> None:
    try:
        ensure_valid_transition(current_status, next_status, transitions, entity_name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


def get_open_offer_for_tanker(db: Session, tanker: Tanker) -> JobOffer | None:
    return (
        db.query(JobOffer)
        .filter(JobOffer.tanker_id == tanker.id, JobOffer.response_type.is_(None))
        .order_by(JobOffer.id.desc())
        .first()
    )


def get_active_batch_for_tanker(db: Session, tanker: Tanker) -> Batch | None:
    return (
        db.query(Batch)
        .filter(Batch.tanker_id == tanker.id, Batch.status.in_(list(ACTIVE_JOB_BATCH_STATUSES)))
        .order_by(Batch.id.desc())
        .first()
    )


def get_active_priority_for_tanker(db: Session, tanker: Tanker) -> LiquidRequest | None:
    if tanker.current_request_id:
        request = db.query(LiquidRequest).filter(LiquidRequest.id == tanker.current_request_id).first()
        if request and request.status in ACTIVE_JOB_REQUEST_STATUSES:
            return request
    return (
        db.query(LiquidRequest)
        .filter(LiquidRequest.status.in_(list(ACTIVE_JOB_REQUEST_STATUSES)))
        .filter(LiquidRequest.id == tanker.current_request_id)
        .first()
    )


def ensure_one_active_job_rule(db: Session, tanker: Tanker, *, expected_batch_id: int | None = None, expected_request_id: int | None = None) -> None:
    active_batch = get_active_batch_for_tanker(db, tanker)
    active_request = get_active_priority_for_tanker(db, tanker)
    if active_batch and active_request:
        raise HTTPException(status_code=409, detail="Tanker integrity violation: multiple active jobs detected")
    if active_batch and expected_batch_id is not None and active_batch.id != expected_batch_id:
        raise HTTPException(status_code=409, detail=f"Tanker already has another active batch ({active_batch.id})")
    if active_request and expected_request_id is not None and active_request.id != expected_request_id:
        raise HTTPException(status_code=409, detail=f"Tanker already has another active priority request ({active_request.id})")
    if expected_batch_id is None and expected_request_id is None and (active_batch or active_request):
        raise HTTPException(status_code=409, detail="Tanker already has an active job")


# def expire_pending_offer(db: Session, tanker: Tanker) -> None:
#     pending_type = tanker.pending_offer_type
#     pending_id = tanker.pending_offer_id
#     offer = get_open_offer_for_tanker(db, tanker)
#     if offer:
#         mark_offer_timeout(db, offer)
#     clear_tanker_offer(db, tanker, make_available=True)
#     if pending_type == "priority" and pending_id:
#         retry_priority_assignment(db, pending_id, excluded_tanker_ids=[tanker.id], failure_reason="offer_expired")
#         return
#     if pending_type == "batch" and pending_id:
#         retry_batch_assignment(db, pending_id, excluded_tanker_ids=[tanker.id])
#         return
#     db.commit()

def expire_pending_offer(db: Session, tanker: Tanker) -> None:
    expire_tanker_offer_and_recover(db, tanker)


def build_priority_offer_payload(db: Session, request: LiquidRequest, seconds_left: int) -> dict[str, Any]:
    return {
        "type": "priority",
        "id": request.id,
        "request_id": request.id,
        "expires_in_seconds": seconds_left,
        "volume_liters": request.volume_liters,
        "latitude": request.latitude,
        "longitude": request.longitude,
        "delivery_type": request.delivery_type,
        "scheduled_for": request.scheduled_for.isoformat() if request.scheduled_for else None,
    }


def build_batch_offer_payload(db: Session, batch: Batch, seconds_left: int) -> dict[str, Any]:
    members = db.query(BatchMember).filter(BatchMember.batch_id == batch.id, BatchMember.status == "active", BatchMember.payment_status == "paid").all()
    total_volume = int(sum(member.volume_liters for member in members)) if members else int(batch.current_volume or 0)
    return {
        "type": "batch",
        "id": batch.id,
        "batch_id": batch.id,
        "expires_in_seconds": seconds_left,
        "total_volume": total_volume,
        "member_count": len(members),
        "latitude": batch.latitude,
        "longitude": batch.longitude,
    }


def ensure_priority_delivery_record(db: Session, request_id: int, tanker_id: int) -> DeliveryRecord:
    return create_delivery_record_for_priority(db, request_id=request_id, tanker_id=tanker_id)


def ensure_batch_delivery_records(db: Session, batch_id: int, tanker_id: int) -> list[DeliveryRecord]:
    return create_delivery_records_for_batch(db, batch_id=batch_id, tanker_id=tanker_id)


def move_first_open_delivery_to_en_route(db: Session, tanker_id: int, *, batch_id: int | None = None, request_id: int | None = None, commit: bool = True) -> DeliveryRecord | None:
    query = db.query(DeliveryRecord).filter(DeliveryRecord.tanker_id == tanker_id, DeliveryRecord.delivery_status.notin_(list(RESOLVED_DELIVERY_STATUSES)))
    if batch_id is not None:
        query = query.filter(DeliveryRecord.batch_id == batch_id)
    if request_id is not None:
        query = query.filter(DeliveryRecord.request_id == request_id, DeliveryRecord.job_type == "priority")
    delivery = query.order_by(DeliveryRecord.stop_order.asc(), DeliveryRecord.id.asc()).first()
    if not delivery:
        return None
    if delivery.delivery_status == "pending":
        delivery.delivery_status = "en_route"
    if not delivery.dispatched_at:
        delivery.dispatched_at = datetime.utcnow()
    db.add(delivery)
    if commit:
        db.commit()
        db.refresh(delivery)
    return delivery


def build_batch_members_payload(db: Session, batch_id: int) -> list[dict[str, Any]]:
    members = db.query(BatchMember).filter(BatchMember.batch_id == batch_id, BatchMember.status.in_(["active", "delivered", "failed", "skipped"])).order_by(BatchMember.id.asc()).all()
    payload: list[dict[str, Any]] = []
    for member in members:
        user = get_user_or_none(db, member.user_id)
        payload.append({
            "id": member.id,
            "request_id": member.request_id,
            "user_id": member.user_id,
            "name": user.name if user else "Customer",
            "phone": user.phone if user else None,
            "address": getattr(user, "address", None) if user else None,
            "volume_liters": member.volume_liters,
            "latitude": member.latitude,
            "longitude": member.longitude,
            "delivery_code": member.delivery_code,
            "status": member.status,
            "payment_status": member.payment_status,
        })
    return payload


def build_priority_customer_payload(db: Session, request: LiquidRequest, delivery_record: DeliveryRecord | None = None) -> dict[str, Any]:
    user = get_user_or_none(db, request.user_id)
    return {
        "user_id": request.user_id,
        "name": user.name if user else "Priority Customer",
        "phone": user.phone if user else None,
        "address": getattr(user, "address", None) if user else None,
        "latitude": request.latitude,
        "longitude": request.longitude,
        "volume_liters": request.volume_liters,
        "delivery_code": delivery_record.delivery_code if delivery_record else None,
    }


def build_current_job_response(db: Session, tanker: Tanker) -> dict[str, Any]:
    batch = get_active_batch_for_tanker(db, tanker)
    if batch:
        members = build_batch_members_payload(db, batch.id)
        total_volume = int(sum(member["volume_liters"] for member in members)) if members else int(batch.current_volume or 0)

        current_stop = None
        open_delivery = (
            db.query(DeliveryRecord)
            .filter(
                DeliveryRecord.tanker_id == tanker.id,
                DeliveryRecord.batch_id == batch.id,
                DeliveryRecord.delivery_status.notin_(list(RESOLVED_DELIVERY_STATUSES)),
            )
            .order_by(DeliveryRecord.stop_order.asc(), DeliveryRecord.id.asc())
            .first()
        )
        if open_delivery:
            current_stop = {
                "delivery_id": open_delivery.id,
                "member_id": open_delivery.batch_member_id,
                "latitude": open_delivery.latitude,
                "longitude": open_delivery.longitude,
                "delivery_status": open_delivery.delivery_status,
                "stop_order": open_delivery.stop_order,
            }

        return {
            "tanker_id": tanker.id,
            "tanker_status": tanker.status,
            "tanker_available": tanker.is_available,
            "tanker_location": build_tanker_location_payload(tanker),
            "assignment_type": "batch",
            "active_job": {
                "batch_id": batch.id,
                "status": batch.status,
                "scheduled_for": None,
                "total_stops": len(members),
                "total_volume": total_volume,
                "members": members,
                "current_stop": current_stop,
            },
            "message": "Job in progress.",
        }

    request = get_active_priority_for_tanker(db, tanker)
    if request:
        delivery_record = (
            db.query(DeliveryRecord)
            .filter(
                DeliveryRecord.job_type == "priority",
                DeliveryRecord.request_id == request.id,
            )
            .first()
        )

        return {
            "tanker_id": tanker.id,
            "tanker_status": tanker.status,
            "tanker_available": tanker.is_available,
            "tanker_location": build_tanker_location_payload(tanker),
            "assignment_type": "priority",
            "active_job": {
                "request_id": request.id,
                "status": request.status,
                "scheduled_for": request.scheduled_for.isoformat() if request.scheduled_for else None,
                "total_stops": 1,
                "total_volume": request.volume_liters,
                "customer": build_priority_customer_payload(db, request, delivery_record),
                "current_stop": {
                    "delivery_id": delivery_record.id if delivery_record else None,
                    "latitude": request.latitude,
                    "longitude": request.longitude,
                    "delivery_status": delivery_record.delivery_status if delivery_record else None,
                },
            },
            "message": "Job in progress.",
        }

    return {
        "tanker_id": tanker.id,
        "tanker_status": tanker.status,
        "tanker_available": tanker.is_available,
        "tanker_location": build_tanker_location_payload(tanker),
        "assignment_type": None,
        "active_job": None,
        "message": "No active job found",
    }


@router.get("/{tanker_id}/incoming-offer")
def get_incoming_offer(tanker_id: int, db: Session = Depends(get_db)):
    tanker = get_tanker_or_404(db, tanker_id)
    if not tanker.pending_offer_type or not tanker.pending_offer_id or not tanker.offer_expires_at:
        return {"has_offer": False, "offer": None}
    if tanker.offer_expires_at <= datetime.utcnow():
        expire_pending_offer(db, tanker)
        return {"has_offer": False, "offer": None}
    seconds_left = max(int((tanker.offer_expires_at - datetime.utcnow()).total_seconds()), 0)
    if tanker.pending_offer_type == "priority":
        request = db.query(LiquidRequest).filter(LiquidRequest.id == tanker.pending_offer_id).first()
        if not request:
            expire_pending_offer(db, tanker)
            return {"has_offer": False, "offer": None}
        return {"has_offer": True, "offer": build_priority_offer_payload(db, request, seconds_left)}
    if tanker.pending_offer_type == "batch":
        batch = db.query(Batch).filter(Batch.id == tanker.pending_offer_id).first()
        if not batch:
            expire_pending_offer(db, tanker)
            return {"has_offer": False, "offer": None}
        return {"has_offer": True, "offer": build_batch_offer_payload(db, batch, seconds_left)}
    return {"has_offer": False, "offer": None}


@router.post("/{tanker_id}/offers/accept")
def accept_offer(tanker_id: int, db: Session = Depends(get_db)):
    tanker = get_tanker_or_404(db, tanker_id)

    active_batch = get_active_batch_for_tanker(db, tanker)
    active_request = get_active_priority_for_tanker(db, tanker)

    if not tanker.pending_offer_type or not tanker.pending_offer_id or not tanker.offer_expires_at:
        if active_batch or active_request:
            current = build_current_job_response(db, tanker)
            return {"message": "Offer already accepted", **current}
        raise HTTPException(status_code=404, detail="No pending offer found")

    if tanker.offer_expires_at <= datetime.utcnow():
        expire_pending_offer(db, tanker)
        raise HTTPException(status_code=400, detail="Offer has expired")

    offer = get_open_offer_for_tanker(db, tanker)
    if offer:
        response_seconds = (datetime.utcnow() - offer.offered_at).total_seconds()
        mark_offer_accepted(db, offer, response_seconds=response_seconds)

    if tanker.pending_offer_type == "priority":
        request = get_request_or_404(db, tanker.pending_offer_id)
        ensure_one_active_job_rule(db, tanker, expected_request_id=request.id)

        # idempotent replay
        if tanker.current_request_id == request.id and tanker.status in {"assigned", "loading", "delivering", "arrived"}:
            clear_tanker_offer(db, tanker, make_available=False)
            db.commit()
            return {
                "message": "Offer already accepted.",
                "tanker_id": tanker.id,
                "request_id": request.id,
                "status": tanker.status,
            }

        validate_transition_or_400(tanker.status, "assigned", TANKER_STATUS_TRANSITIONS, "Tanker")
        validate_transition_or_400(request.status, "assigned", REQUEST_STATUS_TRANSITIONS, "Priority request")

        tanker.current_request_id = request.id
        tanker.status = "assigned"
        tanker.is_available = False

        request.status = "assigned"
        request.accepted_at = request.accepted_at or datetime.utcnow()

        tanker.pending_offer_type = None
        tanker.pending_offer_id = None
        tanker.offer_expires_at = None

        db.commit()
        db.refresh(tanker)
        db.refresh(request)

        return {
            "message": "Offer accepted. Start loading when ready.",
            "tanker_id": tanker.id,
            "request_id": request.id,
            "status": tanker.status,
        }

    if tanker.pending_offer_type == "batch":
        batch = get_batch_or_404(db, tanker.pending_offer_id)
        ensure_one_active_job_rule(db, tanker, expected_batch_id=batch.id)

        # idempotent replay
        if batch.tanker_id == tanker.id and tanker.status in {"assigned", "loading", "delivering", "arrived"}:
            clear_tanker_offer(db, tanker, make_available=False)
            db.commit()
            return {
                "message": "Batch already accepted.",
                "tanker_id": tanker.id,
                "batch_id": batch.id,
                "status": tanker.status,
            }

        validate_transition_or_400(tanker.status, "assigned", TANKER_STATUS_TRANSITIONS, "Tanker")
        validate_transition_or_400(batch.status, "assigned", BATCH_STATUS_TRANSITIONS, "Batch")

        batch.tanker_id = tanker.id
        batch.status = "assigned"
        batch.assigned_at = batch.assigned_at or datetime.utcnow()

        tanker.status = "assigned"
        tanker.is_available = False

        tanker.pending_offer_type = None
        tanker.pending_offer_id = None
        tanker.offer_expires_at = None

        db.commit()
        db.refresh(tanker)
        db.refresh(batch)

        return {
            "message": "Batch accepted. Start loading when ready.",
            "tanker_id": tanker.id,
            "batch_id": batch.id,
            "status": tanker.status,
        }

    raise HTTPException(status_code=400, detail="Unsupported offer type")


@router.post("/{tanker_id}/offers/reject")
def reject_offer(tanker_id: int, db: Session = Depends(get_db)):
    tanker = get_tanker_or_404(db, tanker_id)
    if not tanker.pending_offer_type or not tanker.pending_offer_id:
        raise HTTPException(status_code=404, detail="No pending offer found")
    pending_type = tanker.pending_offer_type
    pending_id = tanker.pending_offer_id
    offer = get_open_offer_for_tanker(db, tanker)
    if offer:
        response_seconds = (datetime.utcnow() - offer.offered_at).total_seconds()
        mark_offer_declined(db, offer, decline_reason="driver_rejected", response_seconds=response_seconds)
    clear_tanker_offer(db, tanker, make_available=True)
    retry_result = None
    if pending_type == "priority" and pending_id:
        retry_result = retry_priority_assignment(db, pending_id, excluded_tanker_ids=[tanker.id], failure_reason="driver_rejected")
    elif pending_type == "batch" and pending_id:
        batch = db.query(Batch).filter(Batch.id == pending_id).first()
        if batch:
            batch.status = "ready_for_assignment"
            batch.tanker_id = None
            db.add(batch)
            db.flush()
        retry_result = retry_batch_assignment(db, pending_id, excluded_tanker_ids=[tanker.id])
    else:
        db.commit()
    return {"message": "Offer rejected successfully", "tanker_id": tanker.id, "retry": retry_result}


@router.get("/{tanker_id}/current-job")
def get_current_job(tanker_id: int, db: Session = Depends(get_db)):
    return build_current_job_response(db, get_tanker_or_404(db, tanker_id))


@router.post("/{tanker_id}/accept/{batch_id}")
def accept_batch_job_legacy(tanker_id: int, batch_id: int, db: Session = Depends(get_db)):
    tanker = get_tanker_or_404(db, tanker_id)
    batch = get_batch_or_404(db, batch_id)

    if batch.tanker_id != tanker.id:
        raise HTTPException(status_code=403, detail="This batch is not assigned to this tanker")

    if batch.status == "loading" and tanker.status == "loading":
        return {
            "message": "Batch already moved to loading.",
            "tanker_id": tanker.id,
            "batch_id": batch.id,
            "status": tanker.status,
            "loading_deadline": batch.loading_deadline.isoformat() if batch.loading_deadline else None,
        }

    validate_transition_or_400(tanker.status, "loading", TANKER_STATUS_TRANSITIONS, "Tanker")
    validate_transition_or_400(batch.status, "loading", BATCH_STATUS_TRANSITIONS, "Batch")

    batch.status = "loading"
    batch.loading_deadline = batch.loading_deadline or (datetime.utcnow() + timedelta(minutes=LOADING_WINDOW_MINUTES))

    tanker.status = "loading"
    tanker.is_available = False

    db.commit()
    db.refresh(tanker)
    db.refresh(batch)

    return {
        "message": "Batch moved to loading.",
        "tanker_id": tanker.id,
        "batch_id": batch.id,
        "status": tanker.status,
        "loading_deadline": batch.loading_deadline.isoformat() if batch.loading_deadline else None,
    }


@router.post("/{tanker_id}/accept-priority/{request_id}")
def accept_priority_job_legacy(tanker_id: int, request_id: int, db: Session = Depends(get_db)):
    tanker = get_tanker_or_404(db, tanker_id)
    request = get_request_or_404(db, request_id)

    # Recovery path:
    # If the request is already in assigned state and the tanker is assigned,
    # but current_request_id was not persisted correctly, heal it here.
    if tanker.current_request_id is None and request.status == "assigned" and tanker.status == "assigned":
        tanker.current_request_id = request.id
        db.add(tanker)
        db.commit()
        db.refresh(tanker)

    # Idempotent / healing path:
    # If tanker already points to this request and is already loading, return success
    if tanker.current_request_id == request.id and request.status == "loading" and tanker.status == "loading":
        return {
            "message": "Priority request already moved to loading.",
            "tanker_id": tanker.id,
            "request_id": request.id,
            "status": tanker.status,
            "loading_deadline": request.loading_deadline.isoformat() if request.loading_deadline else None,
        }

    # Still not linked? Then reject.
    if tanker.current_request_id != request.id:
        raise HTTPException(status_code=403, detail="This priority request is not assigned to this tanker")

    validate_transition_or_400(tanker.status, "loading", TANKER_STATUS_TRANSITIONS, "Tanker")
    validate_transition_or_400(request.status, "loading", REQUEST_STATUS_TRANSITIONS, "Priority request")

    tanker.status = "loading"
    tanker.is_available = False

    request.status = "loading"
    request.loading_deadline = request.loading_deadline or (
        datetime.utcnow() + timedelta(minutes=LOADING_WINDOW_MINUTES)
    )
    request.accepted_at = request.accepted_at or datetime.utcnow()

    db.commit()
    db.refresh(tanker)
    db.refresh(request)

    return {
        "message": "Priority request moved to loading.",
        "tanker_id": tanker.id,
        "request_id": request.id,
        "status": tanker.status,
        "loading_deadline": request.loading_deadline.isoformat() if request.loading_deadline else None,
    }


@router.post("/{tanker_id}/loaded/{batch_id}")
def mark_batch_loaded(tanker_id: int, batch_id: int, db: Session = Depends(get_db)):
    tanker = get_tanker_or_404(db, tanker_id)
    batch = get_batch_or_404(db, batch_id)
    if batch.tanker_id != tanker.id:
        raise HTTPException(status_code=403, detail="This batch is not assigned to this tanker")
    if batch.status == "delivering" and tanker.status == "delivering":
        move_first_open_delivery_to_en_route(db, tanker.id, batch_id=batch.id)
        return {"message": "Tanker already marked as loaded. Delivery details are available.", "tanker_id": tanker.id, "batch_id": batch.id, "tanker_status": tanker.status, "batch_status": batch.status}
    ensure_one_active_job_rule(db, tanker, expected_batch_id=batch.id)
    validate_transition_or_400(tanker.status, "delivering", TANKER_STATUS_TRANSITIONS, "Tanker")
    validate_transition_or_400(batch.status, "delivering", BATCH_STATUS_TRANSITIONS, "Batch")
    ensure_batch_delivery_records(db, batch.id, tanker.id)
    tanker.status = "delivering"
    tanker.is_available = False
    batch.status = "delivering"
    batch.delivering_started_at = batch.delivering_started_at or datetime.utcnow()
    batch.loading_deadline = None
    move_first_open_delivery_to_en_route(db, tanker.id, batch_id=batch.id, commit=False)
    db.add(tanker)
    db.add(batch)
    db.commit()
    db.refresh(tanker)
    db.refresh(batch)
    return {"message": "Tanker marked as loaded. Delivery details are now available.", "tanker_id": tanker.id, "batch_id": batch.id, "tanker_status": tanker.status, "batch_status": batch.status}


@router.post("/{tanker_id}/loaded-priority/{request_id}")
def mark_priority_loaded(tanker_id: int, request_id: int, db: Session = Depends(get_db)):
    tanker = get_tanker_or_404(db, tanker_id)
    request = get_request_or_404(db, request_id)
    if tanker.current_request_id != request.id:
        raise HTTPException(status_code=403, detail="This priority request is not assigned to this tanker")
    if request.status == "delivering" and tanker.status == "delivering":
        move_first_open_delivery_to_en_route(db, tanker.id, request_id=request.id)
        return {"message": "Priority tanker already marked as loaded. Delivery details are available.", "tanker_id": tanker.id, "request_id": request.id, "tanker_status": tanker.status, "request_status": request.status}
    ensure_one_active_job_rule(db, tanker, expected_request_id=request.id)
    validate_transition_or_400(tanker.status, "delivering", TANKER_STATUS_TRANSITIONS, "Tanker")
    validate_transition_or_400(request.status, "delivering", REQUEST_STATUS_TRANSITIONS, "Priority request")
    ensure_priority_delivery_record(db, request.id, tanker.id)
    tanker.status = "delivering"
    tanker.is_available = False
    request.status = "delivering"
    request.loading_deadline = None
    request.delivering_started_at = request.delivering_started_at or datetime.utcnow()
    move_first_open_delivery_to_en_route(db, tanker.id, request_id=request.id, commit=False)
    db.add(tanker)
    db.add(request)
    db.commit()
    db.refresh(tanker)
    db.refresh(request)
    return {"message": "Priority tanker marked as loaded. Delivery details are now available.", "tanker_id": tanker.id, "request_id": request.id, "tanker_status": tanker.status, "request_status": request.status}


@router.post("/", response_model=TankerOut)
def create_tanker(payload: TankerCreate, db: Session = Depends(get_db)):
    normalized_plate = payload.tank_plate_number.upper().strip()
    existing = db.query(Tanker).filter(Tanker.tank_plate_number == normalized_plate).first()
    if existing:
        raise HTTPException(status_code=400, detail="Tank plate number already exists")
    tanker = Tanker(driver_name=payload.driver_name, phone=payload.phone, tank_plate_number=normalized_plate, latitude=payload.latitude, longitude=payload.longitude, status="available", is_available=True, current_request_id=None, is_online=True)
    db.add(tanker)
    db.commit()
    db.refresh(tanker)
    return tanker


@router.get("/", response_model=list[TankerOut])
def list_tankers(db: Session = Depends(get_db)):
    return db.query(Tanker).all()


@router.get("/{tanker_id}", response_model=TankerOut)
def get_tanker(tanker_id: int, db: Session = Depends(get_db)):
    return get_tanker_or_404(db, tanker_id)


@router.put("/{tanker_id}", response_model=TankerOut)
def update_tanker(tanker_id: int, payload: TankerUpdate, db: Session = Depends(get_db)):
    tanker = get_tanker_or_404(db, tanker_id)
    updates = payload.dict(exclude_unset=True)
    if "status" in updates:
        raise HTTPException(status_code=400, detail="Status cannot be updated from this endpoint. Use action routes instead.")
    if "tank_plate_number" in updates and updates["tank_plate_number"]:
        normalized_plate = updates["tank_plate_number"].upper().strip()
        existing = db.query(Tanker).filter(Tanker.tank_plate_number == normalized_plate, Tanker.id != tanker.id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Tank plate number already exists")
        updates["tank_plate_number"] = normalized_plate
    for key, value in updates.items():
        setattr(tanker, key, value)
    db.commit()
    db.refresh(tanker)
    return tanker


@router.post("/{tanker_id}/arrived/{batch_id}")
def tanker_arrived(tanker_id: int, batch_id: int, db: Session = Depends(get_db)):
    tanker = get_tanker_or_404(db, tanker_id)
    batch = get_batch_or_404(db, batch_id)
    if batch.tanker_id != tanker.id:
        raise HTTPException(status_code=403, detail="This tanker is not assigned to the batch")
    if batch.status == "arrived" and tanker.status == "arrived":
        return {"message": "Tanker already arrived at the delivery area", "tanker_id": tanker.id, "batch_id": batch.id, "tanker_status": tanker.status, "batch_status": batch.status}
    validate_transition_or_400(batch.status, "arrived", BATCH_STATUS_TRANSITIONS, "Batch")
    validate_transition_or_400(tanker.status, "arrived", TANKER_STATUS_TRANSITIONS, "Tanker")
    batch.status = "arrived"
    tanker.status = "arrived"
    tanker.is_available = False
    db.commit()
    db.refresh(batch)
    db.refresh(tanker)
    return {"message": "Tanker has arrived at the delivery area", "tanker_id": tanker.id, "batch_id": batch.id, "tanker_status": tanker.status, "batch_status": batch.status}


@router.post("/{tanker_id}/complete/{batch_id}")
def complete_batch_delivery(tanker_id: int, batch_id: int, db: Session = Depends(get_db)):
    tanker = get_tanker_or_404(db, tanker_id)
    batch = get_batch_or_404(db, batch_id)
    if batch.tanker_id != tanker.id:
        raise HTTPException(status_code=403, detail="This tanker is not assigned to the batch")
    unresolved = db.query(DeliveryRecord).filter(DeliveryRecord.batch_id == batch.id, DeliveryRecord.delivery_status.notin_(list(RESOLVED_DELIVERY_STATUSES))).count()
    if batch.status == "completed" and tanker.status == "available":
        return {"message": "Batch delivery already completed", "tanker_id": tanker.id, "batch_id": batch.id, "tanker_status": tanker.status, "batch_status": batch.status, "completed_at": batch.completed_at}
    if unresolved > 0:
        raise HTTPException(status_code=400, detail="Cannot complete batch while delivery stops are still unresolved")
    if batch.status != "completed":
        validate_transition_or_400(batch.status, "completed", BATCH_STATUS_TRANSITIONS, "Batch")
        validate_transition_or_400(tanker.status, "completed", TANKER_STATUS_TRANSITIONS, "Tanker")
        batch.status = "completed"
        batch.completed_at = batch.completed_at or datetime.utcnow()
        tanker.status = "completed"
        tanker.is_available = False
        db.commit()
        db.refresh(batch)
        db.refresh(tanker)
    validate_transition_or_400(tanker.status, "available", TANKER_STATUS_TRANSITIONS, "Tanker")
    tanker.status = "available"
    tanker.is_available = True
    tanker.current_request_id = None
    db.commit()
    db.refresh(tanker)
    return {"message": "Batch delivery completed successfully", "tanker_id": tanker.id, "batch_id": batch.id, "tanker_status": tanker.status, "batch_status": batch.status, "completed_at": batch.completed_at}


@router.post("/{tanker_id}/complete-priority")
def complete_priority_delivery(tanker_id: int, db: Session = Depends(get_db)):
    tanker = get_tanker_or_404(db, tanker_id)
    if not tanker.current_request_id:
        if tanker.status == "available":
            return {"message": "Priority delivery already completed", "tanker_id": tanker.id, "request_id": None, "tanker_status": tanker.status, "request_status": "completed"}
        raise HTTPException(status_code=400, detail="This tanker has no active priority request")
    request = db.query(LiquidRequest).filter(LiquidRequest.id == tanker.current_request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Active priority request not found")
    unresolved = db.query(DeliveryRecord).filter(DeliveryRecord.request_id == request.id, DeliveryRecord.delivery_status.notin_(list(RESOLVED_DELIVERY_STATUSES))).count()
    if request.status == "completed" and tanker.status == "available":
        return {"message": "Priority delivery already completed", "tanker_id": tanker.id, "request_id": request.id, "tanker_status": tanker.status, "request_status": request.status}
    if unresolved > 0:
        raise HTTPException(status_code=400, detail="Cannot complete priority delivery while delivery stops are still unresolved")
    if request.status != "completed":
        validate_transition_or_400(tanker.status, "completed", TANKER_STATUS_TRANSITIONS, "Tanker")
        request.status = "completed"
        request.completed_at = request.completed_at or datetime.utcnow()
        tanker.status = "completed"
        tanker.is_available = False
        db.commit()
        db.refresh(tanker)
        db.refresh(request)
    validate_transition_or_400(tanker.status, "available", TANKER_STATUS_TRANSITIONS, "Tanker")
    tanker.current_request_id = None
    tanker.status = "available"
    tanker.is_available = True
    db.commit()
    db.refresh(tanker)
    return {"message": "Priority delivery completed successfully", "tanker_id": tanker.id, "request_id": request.id, "tanker_status": tanker.status, "request_status": request.status}
