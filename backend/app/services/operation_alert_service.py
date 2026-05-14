from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.operation_alert import OperationAlert


def create_operation_alert(
    db: Session,
    *,
    alert_type: str,
    severity: str = "warning",
    job_type: str,
    job_id: int,
    message: str,
    request_id: int | None = None,
    batch_id: int | None = None,
    tanker_id: int | None = None,
) -> OperationAlert:
    existing = (
        db.query(OperationAlert)
        .filter(
            OperationAlert.alert_type == alert_type,
            OperationAlert.job_type == job_type,
            OperationAlert.job_id == job_id,
            OperationAlert.status == "open",
        )
        .first()
    )

    if existing:
        return existing

    alert = OperationAlert(
        alert_type=alert_type,
        severity=severity,
        job_type=job_type,
        job_id=job_id,
        request_id=request_id,
        batch_id=batch_id,
        tanker_id=tanker_id,
        message=message,
        status="open",
    )

    db.add(alert)
    db.flush()
    return alert