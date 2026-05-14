from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.notification_subscription import NotificationSubscription

router = APIRouter(prefix="/notifications", tags=["notifications"])


class PushKeysIn(BaseModel):
    p256dh: str
    auth: str


class PushSubscriptionIn(BaseModel):
    user_type: Literal["client", "driver", "admin"]
    user_id: Optional[int] = None
    endpoint: str = Field(..., min_length=10)
    keys: PushKeysIn


class PushSubscriptionOut(BaseModel):
    ok: bool
    subscription_id: int
    message: str


@router.post("/subscribe", response_model=PushSubscriptionOut)
def subscribe_to_push(payload: PushSubscriptionIn, db: Session = Depends(get_db)):
    existing = (
        db.query(NotificationSubscription)
        .filter(NotificationSubscription.endpoint == payload.endpoint)
        .first()
    )

    if existing:
        existing.user_type = payload.user_type
        existing.user_id = payload.user_id
        existing.p256dh = payload.keys.p256dh
        existing.auth = payload.keys.auth
        existing.is_active = True

        db.commit()
        db.refresh(existing)

        return PushSubscriptionOut(
            ok=True,
            subscription_id=existing.id,
            message="Push subscription updated.",
        )

    subscription = NotificationSubscription(
        user_type=payload.user_type,
        user_id=payload.user_id,
        endpoint=payload.endpoint,
        p256dh=payload.keys.p256dh,
        auth=payload.keys.auth,
        is_active=True,
    )

    db.add(subscription)
    db.commit()
    db.refresh(subscription)

    return PushSubscriptionOut(
        ok=True,
        subscription_id=subscription.id,
        message="Push subscription saved.",
    )


class UnsubscribeIn(BaseModel):
    endpoint: str = Field(..., min_length=10)


@router.post("/unsubscribe")
def unsubscribe_from_push(payload: UnsubscribeIn, db: Session = Depends(get_db)):
    subscription = (
        db.query(NotificationSubscription)
        .filter(NotificationSubscription.endpoint == payload.endpoint)
        .first()
    )

    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found.")

    subscription.is_active = False
    db.commit()

    return {"ok": True, "message": "Push subscription disabled."}