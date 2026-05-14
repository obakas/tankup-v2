# app/api/routes/batches.py

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.batch import BatchLiveResponse
from app.schemas.batch import BatchLiveResponse
from app.services.batch_live_service import get_batch_live_snapshot
from app.services.batch_member_service import leave_batch_member
from app.services.batch_orchestration_service import (
    handle_stale_batch,
    # maybe_assign_tanker_to_batch,
    assign_tanker_if_ready,
    prepare_batch_for_delivery,
    refresh_batch_state,
)
from app.services.batch_service import get_batch_by_id, get_batch_members
import traceback

router = APIRouter(prefix="/batches", tags=["Batches"])


@router.post("/{batch_id}/force-expire")
def force_expire_batch(batch_id: int, db: Session = Depends(get_db)):
    batch = get_batch_by_id(db, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    batch.status = "expired"
    db.add(batch)
    db.commit()
    db.refresh(batch)

    return {"message": "Batch expired manually", "batch_id": batch.id, "status": batch.status}


@router.get("/{batch_id}")
def get_batch(batch_id: int, db: Session = Depends(get_db)):
    batch = get_batch_by_id(db, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    members = get_batch_members(db, batch_id)

    return {
        "id": batch.id,
        "status": getattr(batch, "status", None),
        "current_volume": getattr(batch, "current_volume", None),
        "target_volume": getattr(batch, "target_volume", None),
        "volume_liters": getattr(batch, "volume_liters", None),
        "latitude": getattr(batch, "latitude", None),
        "longitude": getattr(batch, "longitude", None),
        "liquid_id": getattr(batch, "liquid_id", None),
        "user_id": getattr(batch, "user_id", None),
        "tanker_id": getattr(batch, "tanker_id", None) if hasattr(batch, "tanker_id") else None,
        "member_count": len(members),
    }




@router.get("/{batch_id}/health")
def get_batch_health(batch_id: int, db: Session = Depends(get_db)):
    try:
        result = refresh_batch_state(db, batch_id)
        return result
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/{batch_id}/live", response_model=BatchLiveResponse)
def get_batch_live(
    batch_id: int,
    member_id: int | None = Query(None),
    db: Session = Depends(get_db),
):
    snapshot = get_batch_live_snapshot(db, batch_id, member_id)
    print(f"[BATCH LIVE OK] batch_id={batch_id} member_id={member_id} snapshot={snapshot}")
    return snapshot
    
@router.post("/{batch_id}/refresh")
def refresh_batch(batch_id: int, db: Session = Depends(get_db)):
    try:
        result = refresh_batch_state(db, batch_id)
        return result
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.post("/{batch_id}/assign")
def assign_batch(batch_id: int, db: Session = Depends(get_db)):
    try:
        # result = maybe_assign_tanker_to_batch(db, batch_id)
        result = assign_tanker_if_ready(db, batch_id)
        return result
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/{batch_id}/delivery-plan")
def get_batch_delivery_plan(batch_id: int, db: Session = Depends(get_db)):
    try:
        result = prepare_batch_for_delivery(db, batch_id)
        return result
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.post("/{batch_id}/expire-check")
def expire_check_batch(batch_id: int, db: Session = Depends(get_db)):
    try:
        result = handle_stale_batch(db, batch_id)
        return result
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

