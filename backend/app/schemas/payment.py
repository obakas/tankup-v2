from pydantic import BaseModel

class PaymentCreate(BaseModel):
    user_id: int
    batch_id: int
    amount: float