from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.history import ClientHistoryResponse, DriverHistoryResponse
from app.services.history_service import get_user_history, get_tanker_history
from app.services.pdf.receipt_pdf import render_customer_receipt, render_driver_receipt
from app.services.receipt_service import (
    ReceiptNotFoundError,
    build_customer_receipt_data,
    build_driver_receipt_data,
)

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


@router.get("/receipts/{request_id}")
def download_customer_receipt(request_id: int, db: Session = Depends(get_db)):
    try:
        data = build_customer_receipt_data(db, request_id)
    except ReceiptNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    pdf_bytes = render_customer_receipt(data)
    filename = f"tankup-receipt-{request_id}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/tankers/{tanker_id}/receipts/{job_type}/{job_id}")
def download_driver_receipt(tanker_id: int, job_type: str, job_id: int, db: Session = Depends(get_db)):
    if job_type not in ("batch", "priority"):
        raise HTTPException(status_code=400, detail="job_type must be 'batch' or 'priority'")
    try:
        data = build_driver_receipt_data(db, tanker_id, job_type, job_id)
    except ReceiptNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    pdf_bytes = render_driver_receipt(data)
    filename = f"tankup-driver-receipt-{job_type}-{job_id}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )