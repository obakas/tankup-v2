from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.history import ClientHistoryResponse, DriverHistoryResponse
from app.services.history_service import get_user_history, get_tanker_history

router = APIRouter(prefix="/history", tags=["history"])


@router.get("/users/{user_id}", response_model=ClientHistoryResponse)
def read_user_history(user_id: int, db: Session = Depends(get_db)):
    try:
        return get_user_history(db, user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch user history: {str(e)}")


@router.get("/tankers/{tanker_id}", response_model=DriverHistoryResponse)
def read_tanker_history(tanker_id: int, db: Session = Depends(get_db)):
    try:
        return get_tanker_history(db, tanker_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch tanker history: {str(e)}")