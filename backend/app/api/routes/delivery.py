from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from app.core.database import get_db
from app.models.batch_member import BatchMember

router = APIRouter(prefix="/delivery", tags=["Delivery"])


@router.post("/confirm/{member_id}")
def confirm_delivery(member_id: int, code: str, db: Session = Depends(get_db)):
    member = db.query(BatchMember).filter(BatchMember.id == member_id).first()

    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    # 🚨 THIS is where your check goes
    if member.delivery_code != code:
        raise HTTPException(status_code=400, detail="Invalid OTP")

    # Mark as delivered
    member.status = "delivered"
    member.delivered_at = datetime.utcnow()

    # Clear OTP so it can't be reused
    member.delivery_code = None

    db.commit()

    return {"message": "Delivery confirmed"}