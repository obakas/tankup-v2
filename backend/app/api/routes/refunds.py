from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.routes.users import get_user
from app.core.database import get_db
from app.models.batch import Batch
from app.models.batch_member import BatchMember
from app.schemas.refund import RefundExecuteResponse
from app.services.refund_service import execute_member_refund

router = APIRouter(prefix="/refunds", tags=["Refunds"])


@router.post("/batch-members/{member_id}", response_model=RefundExecuteResponse)
def refund_batch_member(
    member_id: int,
    current_user = Depends(get_user),
    db: Session = Depends(get_db)
):
    member = db.query(BatchMember).filter(BatchMember.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Batch member not found")

    # Example ownership check:
    # if member.user_id != current_user.id:
    #     raise HTTPException(status_code=403, detail="Not allowed to refund this member")

    batch = db.query(Batch).filter(Batch.id == member.batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    return execute_member_refund(db, member, batch)