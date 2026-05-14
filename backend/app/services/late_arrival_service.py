# app/services/late_arrival_service.py

from __future__ import annotations

from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.models.batch import Batch
from app.models.request import LiquidRequest
from app.utils.time_policy import LATE_ARRIVAL_ALERT_MINUTES
from app.services.operation_alert_service import create_operation_alert


def flag_late_arrivals(db: Session) -> list[dict]:
    now = datetime.utcnow()
    threshold = now - timedelta(minutes=LATE_ARRIVAL_ALERT_MINUTES)

    results: list[dict] = []

    late_batches = (
        db.query(Batch)
        .filter(
            Batch.status == "delivering",
            Batch.delivering_started_at.isnot(None),
            Batch.delivering_started_at < threshold,
        )
        .all()
    )

    late_priorities = (
        db.query(LiquidRequest)
        .filter(
            LiquidRequest.delivery_type == "priority",
            LiquidRequest.status == "delivering",
            LiquidRequest.delivering_started_at.isnot(None),
            LiquidRequest.delivering_started_at < threshold,
        )
        .all()
    )

    for batch in late_batches:
        results.append({
            "job_type": "batch",
            "job_id": batch.id,
            "status": batch.status,
            "alert": "late_arrival",
            "delivering_started_at": batch.delivering_started_at.isoformat(),
        })
        create_operation_alert(
            db,
            alert_type="late_arrival",
            severity="warning",
            job_type="batch",
            job_id=batch.id,
            batch_id=batch.id,
            tanker_id=batch.tanker_id,
            message=f"Batch #{batch.id} has been delivering for longer than expected.",
        )

    for request in late_priorities:
        results.append({
            "job_type": "priority",
            "job_id": request.id,
            "status": request.status,
            "alert": "late_arrival",
            "delivering_started_at": request.delivering_started_at.isoformat(),
        })
        create_operation_alert(
            db,
            alert_type="late_arrival",
            severity="warning",
            job_type="priority",
            job_id=request.id,
            request_id=request.id,
            tanker_id=request.tanker_id,
            message=f"Priority request #{request.id} has been delivering for longer than expected.",
        )

    db.commit()

    return results