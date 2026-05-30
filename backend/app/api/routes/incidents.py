from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_admin
from app.schemas.incident import IncidentCreate, IncidentResolve, IncidentOut
from app.services.incident_service import (
    create_incident,
    get_incident,
    list_incidents,
    update_incident_status,
)

router = APIRouter(prefix="/incidents", tags=["Incidents"])


@router.post("", response_model=IncidentOut)
def submit_incident(payload: IncidentCreate, db: Session = Depends(get_db)):
    return create_incident(db, payload)


@router.get("", response_model=list[IncidentOut])
def fetch_incidents(
    status: Optional[str] = Query(None),
    batch_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    return list_incidents(db, status_filter=status, batch_id=batch_id)


@router.get("/{incident_id}", response_model=IncidentOut)
def fetch_incident(incident_id: int, db: Session = Depends(get_db), _admin=Depends(require_admin)):
    return get_incident(db, incident_id)


@router.patch("/{incident_id}", response_model=IncidentOut)
def resolve_incident(
    incident_id: int,
    payload: IncidentResolve,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    return update_incident_status(db, incident_id, payload)
