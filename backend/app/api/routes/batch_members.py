from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.batch_member import BatchMember
from app.services.batch_member_service import leave_batch_member
from app.services.batch_orchestration_service import (
    refresh_batch_state,
    # maybe_assign_tanker_to_batch,
    assign_tanker_if_ready
)

router = APIRouter(prefix="/batch-members", tags=["Batch Members"])


@router.post("/{member_id}/leave")
def leave_batch_member_route(member_id: int, db: Session = Depends(get_db)):
    return leave_batch_member(db, member_id)


@router.post("/{member_id}/confirm-payment")
def confirm_batch_member_payment(member_id: int, db: Session = Depends(get_db)):
    member = db.query(BatchMember).filter(BatchMember.id == member_id).first()

    if not member:
        raise HTTPException(status_code=404, detail="Batch member not found")

    member.payment_status = "paid"
    member.status = "active"

    if hasattr(member, "is_active"):
        member.is_active = True

    db.add(member)
    db.commit()
    db.refresh(member)

    snapshot = refresh_batch_state(db, member.batch_id)

    return {
        "message": "Batch member payment confirmed successfully.",
        "member_id": member.id,
        "batch_id": member.batch_id,
        "snapshot": snapshot,
    }