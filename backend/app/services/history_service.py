from collections import defaultdict
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.request import LiquidRequest
from app.models.batch_member import BatchMember
from app.models.batch import Batch
from app.models.DeliveryRecord import DeliveryRecord
from app.models.tanker import Tanker
from app.models.user import User


def get_user_history(db: Session, user_id: int):
    requests = (
        db.query(LiquidRequest)
        .filter(LiquidRequest.user_id == user_id)
        .order_by(LiquidRequest.id.desc())
        .all()
    )

    items = []

    for request in requests:
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
            # Batch records are often linked by member/stop, not always by request_id.
            # Try the most specific batch-member links first, then fallback safely.
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
                            (DeliveryRecord.user_id == user_id) |
                            (DeliveryRecord.request_id == request.id)
                        )
                    )
                )

            if batch_filters:
                delivery = (
                    db.query(DeliveryRecord)
                    .filter(
                        DeliveryRecord.job_type == "batch",
                        or_(*batch_filters),
                    )
                    .order_by(
                        DeliveryRecord.updated_at.desc(),
                        DeliveryRecord.id.desc(),
                    )
                    .first()
                )

        else:
            # Priority history can still use request_id directly
            delivery = (
                db.query(DeliveryRecord)
                .filter(
                    DeliveryRecord.job_type == "priority",
                    DeliveryRecord.request_id == request.id,
                )
                .order_by(
                    DeliveryRecord.updated_at.desc(),
                    DeliveryRecord.id.desc(),
                )
                .first()
            )

            # Extra fallback in case old data was saved without request_id
            if not delivery:
                delivery = (
                    db.query(DeliveryRecord)
                    .filter(
                        DeliveryRecord.job_type == "priority",
                        DeliveryRecord.user_id == user_id,
                    )
                    .order_by(
                        DeliveryRecord.updated_at.desc(),
                        DeliveryRecord.id.desc(),
                    )
                    .first()
                )

        tanker = None
        if delivery and delivery.tanker_id:
            tanker = db.query(Tanker).filter(Tanker.id == delivery.tanker_id).first()
        elif batch and batch.tanker_id:
            tanker = db.query(Tanker).filter(Tanker.id == batch.tanker_id).first()

        # Better fallbacks so order history does not look empty even if one field is missing
        resolved_completed_at = (
            request.completed_at
            or (delivery.delivered_at if delivery else None)
        )

        resolved_delivery_status = (
            delivery.delivery_status
            if delivery
            else (
                "delivered"
                if request.status == "completed"
                else None
            )
        )

        resolved_delivered_liters = None
        if delivery:
            resolved_delivered_liters = (
                delivery.actual_liters_delivered
                if delivery.actual_liters_delivered is not None
                else delivery.planned_liters
            )
        else:
            # For completed requests with no delivery row found, at least show requested volume
            if request.status == "completed":
                resolved_delivered_liters = request.volume_liters

        items.append({
            "request_id": request.id,
            "delivery_type": request.delivery_type,
            "request_status": request.status,
            "volume_liters": request.volume_liters,
            "created_at": getattr(request, "created_at", None),
            "completed_at": resolved_completed_at,
            "assignment_failed_reason": getattr(request, "assignment_failed_reason", None),
            "refund_eligible": getattr(request, "refund_eligible", False),

            "batch_id": member.batch_id if member else None,
            "member_id": member.id if member else None,
            "batch_status": batch.status if batch else None,
            "member_status": member.status if member else None,
            "payment_status": member.payment_status if member else None,
            "refund_status": member.refund_status if member else None,
            "amount_paid": member.amount_paid if member else None,

            "tanker_id": tanker.id if tanker else None,
            "driver_name": tanker.driver_name if tanker else None,

            "delivery_id": delivery.id if delivery else None,
            "delivery_status": resolved_delivery_status,
            "planned_liters": delivery.planned_liters if delivery else request.volume_liters,
            "actual_liters_delivered": resolved_delivered_liters,
            "otp_verified": delivery.otp_verified if delivery else None,
            "delivered_at": delivery.delivered_at if delivery else None,
        })

    return {
        "user_id": user_id,
        "total": len(items),
        "items": items,
    }

def get_tanker_history(db: Session, tanker_id: int):
    deliveries = (
        db.query(DeliveryRecord)
        .filter(DeliveryRecord.tanker_id == tanker_id)
        .order_by(DeliveryRecord.updated_at.desc(), DeliveryRecord.id.desc())
        .all()
    )

    grouped = defaultdict(list)
    for delivery in deliveries:
        job_id = delivery.batch_id if delivery.job_type == "batch" else delivery.request_id
        grouped[(delivery.job_type, job_id)].append(delivery)

    items = []

    for (job_type, job_id), records in grouped.items():
        total_stops = len(records)
        delivered_stops = sum(1 for r in records if r.delivery_status == "delivered")
        failed_stops = sum(1 for r in records if r.delivery_status == "failed")
        skipped_stops = sum(1 for r in records if r.delivery_status == "skipped")

        total_planned_liters = sum(float(r.planned_liters or 0) for r in records)
        total_actual_liters_delivered = sum(float(r.actual_liters_delivered or 0) for r in records)

        started_candidates = [r.dispatched_at for r in records if r.dispatched_at]
        completed_candidates = [r.delivered_at for r in records if r.delivered_at]
        updated_candidates = [r.updated_at for r in records if r.updated_at]

        customer_name = None
        customer_phone = None

        if job_type == "priority":
            record = records[0]
            if record.user_id:
                user = db.query(User).filter(User.id == record.user_id).first()
                if user:
                    customer_name = user.name
                    customer_phone = user.phone

        parent_status = None
        if job_type == "batch":
            batch = db.query(Batch).filter(Batch.id == job_id).first()
            parent_status = batch.status if batch else None
        else:
            request = db.query(LiquidRequest).filter(LiquidRequest.id == job_id).first()
            parent_status = request.status if request else None

        if parent_status:
            job_status = parent_status
        elif delivered_stops == total_stops and total_stops > 0:
            job_status = "completed"
        elif delivered_stops > 0:
            job_status = "partially_completed"
        elif failed_stops == total_stops and total_stops > 0:
            job_status = "failed"
        else:
            job_status = "closed"

        items.append({
            "job_type": job_type,
            "job_id": job_id,
            "tanker_id": tanker_id,
            "tanker_status": None,
            "total_stops": total_stops,
            "delivered_stops": delivered_stops,
            "failed_stops": failed_stops,
            "skipped_stops": skipped_stops,
            "total_planned_liters": total_planned_liters,
            "total_actual_liters_delivered": total_actual_liters_delivered,
            "started_at": min(started_candidates) if started_candidates else None,
            "completed_at": max(completed_candidates) if completed_candidates else None,
            "last_updated_at": max(updated_candidates) if updated_candidates else None,
            "job_status": job_status,
            "customer_name": customer_name,
            "customer_phone": customer_phone,
        })

    items.sort(key=lambda x: x["last_updated_at"] or x["completed_at"] or x["started_at"], reverse=True)

    return {
        "tanker_id": tanker_id,
        "total": len(items),
        "items": items,
    }