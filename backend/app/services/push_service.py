from __future__ import annotations

import json

import requests as http_requests
from sqlalchemy.orm import Session

from app.models.batch_member import BatchMember
from app.models.tanker import Tanker
from app.models.user import User
from app.services.notification_preference_service import is_enabled

_EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


def _send_expo_push(token: str, title: str, body: str, data: dict | None = None) -> bool:
    try:
        payload = {
            "to": token,
            "title": title,
            "body": body,
            "data": data or {},
            "sound": "default",
        }
        resp = http_requests.post(
            _EXPO_PUSH_URL,
            headers={"Content-Type": "application/json"},
            data=json.dumps(payload),
            timeout=10,
        )
        return resp.status_code == 200
    except Exception:
        return False


def notify_user(db: Session, user_id: int, title: str, body: str, data: dict | None = None) -> None:
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.expo_push_token:
        return
    if not is_enabled(db, "customer", str(user_id), "delivery_progress"):
        return
    _send_expo_push(user.expo_push_token, title, body, data)


def notify_batch_members(db: Session, batch_id: int, title: str, body: str, data: dict | None = None) -> None:
    members = (
        db.query(BatchMember)
        .filter(
            BatchMember.batch_id == batch_id,
            BatchMember.payment_status == "paid",
        )
        .all()
    )
    for member in members:
        if member.user_id:
            notify_user(db, member.user_id, title, body, data)


def notify_driver(db: Session, tanker_id: int, title: str, body: str, data: dict | None = None) -> None:
    tanker = db.query(Tanker).filter(Tanker.id == tanker_id).first()
    if not tanker or not tanker.expo_push_token:
        return
    if not is_enabled(db, "driver", str(tanker_id), "job_offers"):
        return
    _send_expo_push(tanker.expo_push_token, title, body, data)
