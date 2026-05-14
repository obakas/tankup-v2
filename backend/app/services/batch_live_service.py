from sqlalchemy.orm import Session
from app.services.batch_service import get_batch_by_id, get_batch_members
from app.models.DeliveryRecord import DeliveryRecord


def build_next_action_hint(status: str, remaining_volume: float) -> str:
    if status == "forming":
        return f"Waiting for more members to join. {remaining_volume:.0f}L remaining."
    if status == "near_ready":
        return f"Batch is close to dispatch. {remaining_volume:.0f}L remaining."
    if status == "ready_for_assignment":
        return "Batch is ready and waiting for tanker assignment."
    if status == "assigned":
        return "A tanker has been assigned to this batch."
    if status == "loading":
        return "Driver is loading water."
    if status == "delivering":
        return "Driver is delivering this batch."
    if status == "completed":
        return "Batch delivery completed."
    if status == "partially_completed":
        return "Batch finished, but some stops were not completed successfully."
    if status == "failed":
        return "Batch delivery failed during execution."
    if status == "assignment_failed":
        return "Batch was filled, but no driver could be secured in time."
    if status == "expired":
        return "Batch expired before dispatch."
    return "Batch updated."


def get_batch_live_snapshot(db: Session, batch_id: int, member_id: int | None = None) -> dict:
    batch = get_batch_by_id(db, batch_id)
    if not batch:
        raise ValueError(f"Batch {batch_id} not found")

    members = get_batch_members(db, batch_id) or []

    member = None
    if member_id is not None:
        member = next((m for m in members if m.id == member_id), None)
        if not member:
            raise ValueError(f"Member {member_id} not found in batch {batch_id}")

    active_members = [
        m for m in members
        if getattr(m, "status", None) == "active"
        and getattr(m, "payment_status", None) == "paid"
    ]

    tanker = getattr(batch, "tanker", None)
    if tanker is None and getattr(batch, "tanker_id", None):
        from app.models.tanker import Tanker
        tanker = db.query(Tanker).filter(Tanker.id == batch.tanker_id).first()

    refund_eligible = False
    if member:
        from app.services.refund_service import is_member_eligible_for_refund
        refund_eligible = is_member_eligible_for_refund(member, batch)

    member_delivery = None
    if member is not None:
        member_delivery = (
            db.query(DeliveryRecord)
            .filter(
                DeliveryRecord.job_type == "batch",
                DeliveryRecord.batch_id == batch.id,
                DeliveryRecord.member_id == member.id,
            )
            .order_by(DeliveryRecord.id.desc())
            .first()
        )

    current_volume = float(getattr(batch, "current_volume", 0) or 0)
    target_volume = float(getattr(batch, "target_volume", 0) or 0)

    progress_percent = (
        (current_volume / target_volume) * 100 if target_volume > 0 else 0
    )

    return {
        "batch_id": batch.id,
        "status": batch.status,
        "current_volume": current_volume,
        "target_volume": target_volume,
        "progress_percent": progress_percent,
        "member_count": len(active_members),

        "tanker_id": tanker.id if tanker else None,
        "driver_name": tanker.driver_name if tanker else None,
        "tanker_plate_number": tanker.tank_plate_number if tanker else None,

        "tanker_status": tanker.status if tanker else None,
        "tanker_phone": tanker.phone if tanker else None,
        "tanker_latitude": tanker.latitude if tanker else None,
        "tanker_longitude": tanker.longitude if tanker else None,
        "last_location_update_at": tanker.last_location_update_at if tanker else None,

        # for client-side map: use the logged-in member's own stop if available
        "customer_latitude": getattr(member, "latitude", None) if member else None,
        "customer_longitude": getattr(member, "longitude", None) if member else None,

        "otp": (
            getattr(member_delivery, "delivery_code", None)
            if member_delivery is not None
            else getattr(member, "delivery_code", None) if member else None
        ),
        "member_delivery_id": getattr(member_delivery, "id", None) if member_delivery else None,
        "member_delivery_status": getattr(member_delivery, "delivery_status", None) if member_delivery else None,
        "member_delivery_code": getattr(member_delivery, "delivery_code", None) if member_delivery else None,
        "otp_verified": getattr(member_delivery, "otp_verified", False) if member_delivery else False,
        "otp_required": getattr(member_delivery, "otp_required", True) if member_delivery else True,
        "actual_liters_delivered": getattr(member_delivery, "actual_liters_delivered", None) if member_delivery else None,
        "planned_liters": getattr(member_delivery, "planned_liters", None) if member_delivery else (getattr(member, "volume_liters", None) if member else None),
        "meter_start_reading": getattr(member_delivery, "meter_start_reading", None) if member_delivery else None,
        "meter_end_reading": getattr(member_delivery, "meter_end_reading", None) if member_delivery else None,
        "arrived_at": getattr(member_delivery, "arrived_at", None) if member_delivery else None,
        "measurement_started_at": getattr(member_delivery, "measurement_started_at", None) if member_delivery else None,
        "measurement_completed_at": getattr(member_delivery, "measurement_completed_at", None) if member_delivery else None,
        "delivered_at": getattr(member_delivery, "delivered_at", None) if member_delivery else None,
        "failure_reason": getattr(member_delivery, "failure_reason", None) if member_delivery else None,
        "notes": getattr(member_delivery, "notes", None) if member_delivery else None,
        "is_member_active": (
            getattr(member, "status", None) == "active"
            and getattr(member, "payment_status", None) == "paid"
        ) if member else None,
        "refund_eligible": refund_eligible,
        "member_id": member.id if member else None,
        "member_status": getattr(member, "status", None) if member else None,
        "member_payment_status": getattr(member, "payment_status", None) if member else None,
        "refund_status": getattr(member, "refund_status", None) if member else None,
        "refund_amount": getattr(member, "refund_amount", None) if member else None,
        "refunded_at": getattr(member, "refunded_at", None) if member else None,
        "refund_reference": getattr(member, "refund_reference", None) if member else None,
    }