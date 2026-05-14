from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User
from app.models.tanker import Tanker
from pydantic import BaseModel

router = APIRouter(prefix="/auth", tags=["Auth"])


class LoginPayload(BaseModel):
    phone: str


class DriverSignupPayload(BaseModel):
    name: str
    phone: str
    tank_plate_number: str
    # latitude: float | None = None
    # longitude: float | None = None


@router.post("/login")
def login(payload: LoginPayload, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.phone == payload.phone.strip()).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "id": user.id,
        "name": user.name,
        "phone": user.phone,
        "address": user.address,
    }


@router.post("/driver-login")
def driver_login(payload: LoginPayload, db: Session = Depends(get_db)):
    phone = payload.phone.strip()

    tanker = db.query(Tanker).filter(Tanker.phone == phone).first()
    if not tanker:
        raise HTTPException(status_code=404, detail="Driver not found")

    tanker.is_online = True

    # If driver has no active job, ensure they are assignable
    if not tanker.current_request_id and tanker.status in {"available", "completed"}:
        tanker.status = "available"
        tanker.is_available = True

    db.commit()
    db.refresh(tanker)

    return {
        "id": tanker.id,
        "name": tanker.driver_name,
        "phone": tanker.phone,
        "tankerId": tanker.id,
        "status": tanker.status,
        "is_available": tanker.is_available,
        "is_online": tanker.is_online,
    }


@router.post("/driver-signup")
def driver_signup(payload: DriverSignupPayload, db: Session = Depends(get_db)):
    phone = payload.phone.strip()
    plate = payload.tank_plate_number.strip().upper()

    existing_phone = db.query(Tanker).filter(Tanker.phone == phone).first()
    if existing_phone:
        raise HTTPException(status_code=400, detail="Driver with this phone already exists")

    existing_plate = db.query(Tanker).filter(Tanker.tank_plate_number == plate).first()
    if existing_plate:
        raise HTTPException(status_code=400, detail="Tanker plate number already exists")

    tanker = Tanker(
        driver_name=payload.name.strip(),
        phone=phone,
        tank_plate_number=plate,
        # latitude=payload.latitude,
        # longitude=payload.longitude,
        status="available",
        is_available=True,
        is_online=True,
        current_request_id=None,
    )

    db.add(tanker)
    db.commit()
    db.refresh(tanker)

    return {
        "id": tanker.id,
        "name": tanker.driver_name,
        "phone": tanker.phone,
        "tankerId": tanker.id,
        "status": tanker.status,
        "is_available": tanker.is_available,
        "is_online": tanker.is_online,
    }


@router.post("/driver-logout/{tanker_id}")
def driver_logout(tanker_id: int, db: Session = Depends(get_db)):
    tanker = db.query(Tanker).filter(Tanker.id == tanker_id).first()
    if not tanker:
        raise HTTPException(status_code=404, detail="Driver not found")

    tanker.is_online = False

    # Only restore availability if there is no active job
    if not tanker.current_request_id and tanker.status in {"available", "completed"}:
        tanker.status = "available"
        tanker.is_available = True

    db.commit()
    db.refresh(tanker)

    return {
        "message": "Driver logged out successfully",
        "tankerId": tanker.id,
        "is_online": tanker.is_online,
    }