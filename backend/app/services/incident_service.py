from datetime import datetime
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.incident import Incident
from app.schemas.incident import IncidentCreate, IncidentResolve, VALID_INCIDENT_TYPES, CUSTOMER_INCIDENT_TYPES

VALID_STATUS_TRANSITIONS = {
    "created": {"escalated", "resolved", "closed"},
    "escalated": {"resolved", "closed"},
    "resolved": {"closed"},
    "closed": set(),
}


def create_incident(db: Session, data: IncidentCreate) -> Incident:
    if data.incident_type not in VALID_INCIDENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid incident_type. Must be one of: {', '.join(sorted(VALID_INCIDENT_TYPES))}",
        )
    if data.source == "customer_app" and data.incident_type not in CUSTOMER_INCIDENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Customers may only report: {', '.join(sorted(CUSTOMER_INCIDENT_TYPES))}",
        )
    incident = Incident(**data.model_dump())
    db.add(incident)
    db.commit()
    db.refresh(incident)
    return incident


def get_incident(db: Session, incident_id: int) -> Incident:
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident


def list_incidents(db: Session, status_filter: str | None = None, batch_id: int | None = None):
    q = db.query(Incident)
    if status_filter:
        q = q.filter(Incident.status == status_filter)
    if batch_id:
        q = q.filter(Incident.batch_id == batch_id)
    return q.order_by(Incident.created_at.desc()).all()


def update_incident_status(db: Session, incident_id: int, data: IncidentResolve) -> Incident:
    incident = get_incident(db, incident_id)
    allowed = VALID_STATUS_TRANSITIONS.get(incident.status, set())
    if data.new_status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot transition from '{incident.status}' to '{data.new_status}'",
        )
    incident.status = data.new_status
    if data.resolution_note:
        incident.resolution_note = data.resolution_note
    if data.new_status in ("resolved", "closed"):
        incident.resolved_at = datetime.utcnow()
    db.commit()
    db.refresh(incident)
    return incident
