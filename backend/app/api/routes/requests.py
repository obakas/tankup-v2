from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.request import LiquidRequest
from app.schemas.request import RequestCreate
from app.services.client_flow_service import (
    create_client_request_flow,
    get_client_request_status_flow,
    get_priority_request_live_flow,
    get_scheduled_request_live_flow,
    get_active_priority_request_for_user_flow,
    cancel_priority_mid_delivery_flow,
)

router = APIRouter(prefix="/requests", tags=["requests"])


@router.post("/")
def create_request(payload: RequestCreate, db: Session = Depends(get_db)):
    try:
        return create_client_request_flow(db, payload)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create request: {str(e)}")

@router.get("/users/{user_id}/active-priority")
def get_active_priority_request_for_user(
    user_id: int,
    db: Session = Depends(get_db),
):
    try:
        active_request = get_active_priority_request_for_user_flow(db, user_id)
        return {
            "has_active_priority": active_request is not None,
            "request": active_request,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch active priority request: {str(e)}",
        )
    

@router.get("/{request_id}/status")
def get_request_status(request_id: int, db: Session = Depends(get_db)):
    try:
        return get_client_request_status_flow(db, request_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch request status: {str(e)}")
    

@router.get("/{request_id}/live")
def get_request_live(request_id: int, db: Session = Depends(get_db)):
    try:
        request = db.query(LiquidRequest).filter(LiquidRequest.id == request_id).first()
        if not request:
            raise HTTPException(status_code=404, detail="Request not found")
        if request.delivery_type == "priority":
            return get_priority_request_live_flow(db, request_id)
        return get_scheduled_request_live_flow(db, request_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch live status: {str(e)}")


@router.post("/{request_id}/cancel")
def cancel_priority_request(request_id: int, db: Session = Depends(get_db)):
    try:
        return cancel_priority_mid_delivery_flow(db, request_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to cancel request: {str(e)}")

