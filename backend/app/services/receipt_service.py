from collections import defaultdict

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.pricing_constants import (
    BATCH_PRICE_PER_LITER,
    PLATFORM_BATCH_COMMISSION_RATE,
    PLATFORM_PRIORITY_COMMISSION_RATE,
    PRIORITY_FULL_TANKER_PRICE,
)
from app.models.batch import Batch
from app.models.batch_member import BatchMember
from app.models.DeliveryRecord import DeliveryRecord
from app.models.driver_earning import DriverEarning
from app.models.request import LiquidRequest
from app.models.tanker import Tanker
from app.models.user import User


class ReceiptNotFoundError(Exception):
    pass


def calculate_priority_price() -> float:
    # Flat rate — a priority job dedicates a full tanker, not billed per liter.
    # Matches frontend/src/hooks/useClientFlow.ts's priority price calculation.
    return PRIORITY_FULL_TANKER_PRICE + PRIORITY_FULL_TANKER_PRICE * PLATFORM_PRIORITY_COMMISSION_RATE


def calculate_batch_price(volume_liters: float) -> float:
    # Fallback only — real batch price should come from BatchMember.amount_paid.
    # Matches frontend/src/hooks/useClientFlow.ts's batch price calculation.
    volume_liters = volume_liters or 0
    return volume_liters * BATCH_PRICE_PER_LITER + volume_liters * BATCH_PRICE_PER_LITER * PLATFORM_BATCH_COMMISSION_RATE


def build_customer_receipt_data(db: Session, request_id: int) -> dict:
    request = db.query(LiquidRequest).filter(LiquidRequest.id == request_id).first()
    if not request:
        raise ReceiptNotFoundError(f"Request {request_id} not found")

    customer = db.query(User).filter(User.id == request.user_id).first()

    member = (
        db.query(BatchMember)
        .filter(BatchMember.request_id == request.id)
        .first()
    )

    batch = None
    if member and member.batch_id:
        batch = db.query(Batch).filter(Batch.id == member.batch_id).first()

    delivery = None
    if request.delivery_type == "batch":
        batch_filters = []
        if member:
            batch_filters.extend([
                DeliveryRecord.member_id == member.id,
                DeliveryRecord.batch_member_id == member.id,
            ])
        if batch and batch.id:
            batch_filters.append(
                (
                    (DeliveryRecord.batch_id == batch.id) &
                    (
                        (DeliveryRecord.user_id == request.user_id) |
                        (DeliveryRecord.request_id == request.id)
                    )
                )
            )
        if batch_filters:
            delivery = (
                db.query(DeliveryRecord)
                .filter(DeliveryRecord.job_type == "batch", or_(*batch_filters))
                .order_by(DeliveryRecord.updated_at.desc(), DeliveryRecord.id.desc())
                .first()
            )
    else:
        delivery = (
            db.query(DeliveryRecord)
            .filter(DeliveryRecord.job_type == "priority", DeliveryRecord.request_id == request.id)
            .order_by(DeliveryRecord.updated_at.desc(), DeliveryRecord.id.desc())
            .first()
        )
        if not delivery:
            delivery = (
                db.query(DeliveryRecord)
                .filter(DeliveryRecord.job_type == "priority", DeliveryRecord.user_id == request.user_id)
                .order_by(DeliveryRecord.updated_at.desc(), DeliveryRecord.id.desc())
                .first()
            )

    tanker = None
    if delivery and delivery.tanker_id:
        tanker = db.query(Tanker).filter(Tanker.id == delivery.tanker_id).first()
    elif batch and batch.tanker_id:
        tanker = db.query(Tanker).filter(Tanker.id == batch.tanker_id).first()

    planned_liters = (
        delivery.planned_liters if delivery and delivery.planned_liters is not None else request.volume_liters
    )
    actual_liters_delivered = delivery.actual_liters_delivered if delivery else None

    is_batch = request.delivery_type == "batch"

    if is_batch:
        price = member.amount_paid if member and member.amount_paid is not None else calculate_batch_price(planned_liters)
        refund_amount = member.refund_amount if member else None
        refund_status = member.refund_status if member else "none"
    else:
        price = calculate_priority_price()
        refund_pct = request.cancellation_refund_pct
        if refund_pct:
            refund_amount = price * refund_pct
            refund_status = "refunded" if refund_pct >= 1.0 else "partially_refunded"
        else:
            refund_amount = None
            refund_status = "not_eligible"

    failure_reason = (delivery.failure_reason if delivery else None) or request.assignment_failed_reason

    return {
        "request_id": request.id,
        "delivery_type": request.delivery_type,
        "request_status": request.status,
        "created_at": request.created_at,
        "completed_at": request.completed_at or (delivery.delivered_at if delivery else None),

        "customer_name": customer.name if customer else None,
        "customer_phone": customer.phone if customer else None,
        "customer_address": customer.address if customer else None,

        "driver_name": tanker.driver_name if tanker else None,
        "driver_phone": tanker.phone if tanker else None,

        "planned_liters": planned_liters,
        "actual_liters_delivered": actual_liters_delivered,

        "otp": delivery.delivery_code if delivery else None,
        "otp_verified": delivery.otp_verified if delivery else None,

        "dispatched_at": delivery.dispatched_at if delivery else None,
        "arrived_at": delivery.arrived_at if delivery else None,
        "delivered_at": delivery.delivered_at if delivery else None,
        "failed_at": delivery.failed_at if delivery else None,

        "price": price,
        "price_is_estimated": is_batch and (not member or member.amount_paid is None),

        "failure_reason": failure_reason,
        "refund_amount": refund_amount,
        "refund_status": refund_status,
        # priority refund_status/amount above are derived from cancellation_refund_pct,
        # not a stored ground-truth value like the batch case — flagged for the PDF layer.
        "refund_is_derived": not is_batch,
    }


def build_driver_receipt_data(db: Session, tanker_id: int, job_type: str, job_id: int) -> dict:
    tanker = db.query(Tanker).filter(Tanker.id == tanker_id).first()
    if not tanker:
        raise ReceiptNotFoundError(f"Tanker {tanker_id} not found")

    job_id_column = DeliveryRecord.batch_id if job_type == "batch" else DeliveryRecord.request_id
    records = (
        db.query(DeliveryRecord)
        .filter(
            DeliveryRecord.tanker_id == tanker_id,
            DeliveryRecord.job_type == job_type,
            job_id_column == job_id,
        )
        .order_by(DeliveryRecord.stop_order.asc(), DeliveryRecord.id.asc())
        .all()
    )
    if not records:
        raise ReceiptNotFoundError(f"No deliveries found for tanker {tanker_id}, {job_type} {job_id}")

    earnings = (
        db.query(DriverEarning)
        .filter(
            DriverEarning.tanker_id == tanker_id,
            DriverEarning.job_type == job_type,
            DriverEarning.job_id == job_id,
        )
        .order_by(DriverEarning.stop_order.asc(), DriverEarning.id.asc())
        .all()
    )
    earnings_by_delivery = {e.delivery_record_id: e for e in earnings}

    stops = []
    for record in records:
        customer = db.query(User).filter(User.id == record.user_id).first() if record.user_id else None
        earning = earnings_by_delivery.get(record.id)
        stops.append({
            "stop_order": record.stop_order,
            "customer_name": customer.name if customer else None,
            "customer_address": customer.address if customer else None,
            "planned_liters": record.planned_liters,
            "actual_liters_delivered": record.actual_liters_delivered,
            "delivery_status": record.delivery_status,
            "failure_reason": record.failure_reason,
            "volume_earnings": earning.volume_earnings if earning else 0.0,
            "stop_bonus": earning.stop_bonus if earning else 0.0,
            "site_bonus": earning.site_bonus if earning else 0.0,
            "total_earnings": earning.total_earnings if earning else 0.0,
            "rate_per_liter": earning.rate_per_liter if earning else 0.0,
        })

    total_stops = len(records)
    delivered_stops = sum(1 for r in records if r.delivery_status == "delivered")
    failed_stops = sum(1 for r in records if r.delivery_status == "failed")
    skipped_stops = sum(1 for r in records if r.delivery_status == "skipped")
    total_planned_liters = sum(float(r.planned_liters or 0) for r in records)
    total_actual_liters_delivered = sum(float(r.actual_liters_delivered or 0) for r in records)
    total_job_earnings = sum(s["total_earnings"] or 0.0 for s in stops)

    if job_type == "batch":
        parent = db.query(Batch).filter(Batch.id == job_id).first()
    else:
        parent = db.query(LiquidRequest).filter(LiquidRequest.id == job_id).first()
    job_status = parent.status if parent else None

    return {
        "job_type": job_type,
        "job_id": job_id,
        "tanker_id": tanker_id,
        "driver_name": tanker.driver_name,
        "driver_phone": tanker.phone,
        "job_status": job_status,
        "total_stops": total_stops,
        "delivered_stops": delivered_stops,
        "failed_stops": failed_stops,
        "skipped_stops": skipped_stops,
        "total_planned_liters": total_planned_liters,
        "total_actual_liters_delivered": total_actual_liters_delivered,
        "total_job_earnings": total_job_earnings,
        "stops": stops,
    }
