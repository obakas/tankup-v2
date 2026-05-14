# app/api/routes/customers.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from app.core.database import get_db
from app.models.batch_member import BatchMember

router = APIRouter(prefix="/customers", tags=["Customers"])

@router.post("/confirm_delivery/{member_id}")
def confirm_delivery(member_id: int, db: Session = Depends(get_db)):
    member = db.query(BatchMember).filter(BatchMember.id == member_id).first()
    
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    if member.status != "delivered_pending":
        raise HTTPException(status_code=400, detail="Delivery not pending confirmation")

    member.customer_confirmed = True
    member.customer_confirmed_at = datetime.utcnow()
    member.status = "delivered"

    db.commit()

    return {"message": "Delivery confirmed by customer"}