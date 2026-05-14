from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.batch import Batch
from app.models.batch_member import BatchMember
from app.services.batch_monitor_service import refresh_batch_after_member_change


ALLOWED_LEAVE_BATCH_STATUSES = {
    "forming",
    "near_ready",
    "ready_for_assignment",
    "assigned",
    "loading",
    "delivering",
    "arrived",
}


def leave_batch_member(db: Session, member_id: int) -> dict:
    member = db.query(BatchMember).filter(BatchMember.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Batch member not found")

    batch = db.query(Batch).filter(Batch.id == member.batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    if batch.status not in ALLOWED_LEAVE_BATCH_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot leave batch while batch status is '{batch.status}'"
        )

    if member.status in {"withdrawn", "delivered"}:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot leave batch because member status is '{member.status}'"
        )

    if member.payment_status != "paid":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot leave batch because payment status is '{member.payment_status}'"
        )

    member.status = "withdrawn"
    member.refund_status = "forfeited"
    member.refund_failure_reason = "User voluntarily left batch after payment"
    member.delivery_eligible = False  # only if this field exists
    # member.withdrawn_at = datetime.utcnow()  # if you have this field

    db.add(member)
    db.commit()
    db.refresh(member)

    batch = refresh_batch_after_member_change(db, batch.id)

    return {
        "message": "You left the batch successfully. Your payment was forfeited and your delivery slot was released.",
        "member_id": member.id,
        "batch_id": batch.id,
        "member_status": member.status,
        "payment_status": member.payment_status,
        "refund_status": member.refund_status,
        "batch_status": batch.status,
        "current_volume": batch.current_volume,
        "target_volume": batch.target_volume,
    }

# from enum import member

# from fastapi import HTTPException
# from sqlalchemy.orm import Session

# from app.models.batch import Batch
# from app.models.batch_member import BatchMember
# from app.services.batch_monitor_service import refresh_batch_after_member_change


# ALLOWED_LEAVE_BATCH_STATUSES = {"forming", "near_ready", "ready_for_assignment"}


# def leave_batch_member(db: Session, member_id: int) -> dict:
#     member = db.query(BatchMember).filter(BatchMember.id == member_id).first()
#     if not member:
#         raise HTTPException(status_code=404, detail="Batch member not found")

#     batch = db.query(Batch).filter(Batch.id == member.batch_id).first()
#     if not batch:
#         raise HTTPException(status_code=404, detail="Batch not found")

#     if batch.status not in ALLOWED_LEAVE_BATCH_STATUSES:
#         raise HTTPException(
#             status_code=400,
#             detail=f"Cannot leave batch while batch status is '{batch.status}'"
#         )

#     # if member.status != "active":
#     if member.status != "confirmed":
#         raise HTTPException(
#             status_code=400,
#             detail=f"Cannot leave batch because member status is '{member.status}'"
#         )

#     if member.payment_status != "paid":
#         raise HTTPException(
#             status_code=400,
#             detail=f"Cannot leave batch because payment status is '{member.payment_status}'"
#         )

#     member.status = "left"
#     member.refund_status = "forfeited"
#     member.refund_failure_reason = "User left batch after payment"

#     db.add(member)
#     db.commit()
#     db.refresh(member)

#     batch = refresh_batch_after_member_change(db, batch.id)

#     return {
#         "message": "Member left batch successfully",
#         "member_id": member.id,
#         "batch_id": batch.id,
#         "member_status": member.status,
#         "payment_status": member.payment_status,
#         "batch_status": batch.status,
#         "current_volume": batch.current_volume,
#         "target_volume": batch.target_volume,
#     }