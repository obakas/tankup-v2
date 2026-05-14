from typing import Optional
from pydantic import BaseModel
from datetime import datetime


class RefundExecuteResponse(BaseModel):
    success: bool
    already_refunded: bool
    refund_status: str
    refund_amount: Optional[float] = None
    refund_reference: Optional[str] = None
    refunded_at: Optional[datetime] = None