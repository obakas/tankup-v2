from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.batch_member import BatchMember
from app.services.payment_service import initiate_payment, confirm_payment

router = APIRouter(prefix="/payments", tags=["Payments"])


@router.post("/initiate")
def start_payment(member_id: int, db: Session = Depends(get_db)):
    payment = initiate_payment(db, member_id)  # only 2 arguments now
    return payment


@router.post("/confirm/{payment_id}")
def complete_payment(payment_id: int, db: Session = Depends(get_db)):
    result = confirm_payment(db, payment_id)
    return result