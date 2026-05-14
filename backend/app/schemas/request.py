from typing import Literal, Optional
from datetime import datetime

from pydantic import BaseModel, model_validator


class RequestCreate(BaseModel):
    user_id: int
    liquid_id: int
    volume_liters: int
    latitude: float
    longitude: float
    delivery_type: Literal["batch", "priority"]
    is_asap: Optional[bool] = None
    scheduled_for: Optional[datetime] = None

    @model_validator(mode="after")
    def validate_request(self):
        if self.delivery_type == "batch":
            # batch requests should not require priority scheduling fields
            self.is_asap = False
            self.scheduled_for = None
            return self

        if self.delivery_type == "priority":
            # ASAP priority
            if self.is_asap is True:
                self.scheduled_for = None
                return self

            # Scheduled priority
            if self.scheduled_for is None:
                raise ValueError(
                    "scheduled_for is required when priority delivery is not ASAP"
                )

            if self.is_asap is None:
                self.is_asap = False

            return self

        raise ValueError("Invalid delivery type")

