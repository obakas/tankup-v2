from __future__ import annotations

from datetime import datetime
from sqlalchemy.orm import Session

from app.models.tanker import Tanker


def trigger_driver_payout(
    db: Session,
    *,
    tanker_id: int,
    job_type: str,
    job_id: int,
    amount: float,
) -> dict:
    tanker = db.query(Tanker).filter(Tanker.id == tanker_id).first()
    if not tanker:
        raise ValueError("Tanker not found")

    return {
        "tanker_id": tanker_id,
        "job_type": job_type,
        "job_id": job_id,
        "amount": amount,
        "status": "initiated",
        "initiated_at": datetime.utcnow().isoformat(),
    }