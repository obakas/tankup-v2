from __future__ import annotations

import json
import logging
import os
from datetime import datetime

import requests as http_requests
from sqlalchemy.orm import Session

from app.models.batch_member import BatchMember
from app.models.tanker import Tanker
from app.models.user import User
from app.services.notification_preference_service import is_enabled

logger = logging.getLogger(__name__)

_EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

# Must match the Android notification channel created in mobile/index.js and the
# raw audio resource bundled via mobile/app.json's react-native-notify-kit plugin config.
RING_CHANNEL_ID = "job_offer_ring"
RING_SOUND = "ring_placeholder"

_firebase_app = None


def _get_firebase_app():
    """Lazily initialize the firebase_admin app from FIREBASE_SERVICE_ACCOUNT_JSON.

    Returns None (instead of raising) when the credential isn't configured, so
    local dev/CI/pytest environments without the secret keep working via the
    Expo push fallback in notify_driver_ring.
    """
    global _firebase_app
    if _firebase_app is not None:
        return _firebase_app

    cred_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
    if not cred_json:
        logger.warning("FIREBASE_SERVICE_ACCOUNT_JSON not set in environment — falling back to Expo push for all ring notifications")
        return None

    try:
        import firebase_admin
        from firebase_admin import credentials

        _firebase_app = firebase_admin.initialize_app(credentials.Certificate(json.loads(cred_json)))
    except Exception as exc:
        logger.error("firebase_admin init failed: %s", exc)
        return None

    return _firebase_app


def _build_ring_notifee_options(title: str, body: str, timeout_after_ms: int) -> str:
    """Hand-build the react-native-notify-kit FCM Mode payload blob.

    Mirrors the schema produced by the library's Node-only `buildNotifyKitPayload`
    server SDK (unusable here since this backend is Python) — see
    dist/types/NotificationAndroid.d.ts in the mobile package for the field set.
    The mobile client decodes this via a single `notifee.handleFcmMessage(...)` call.
    """
    return json.dumps({
        "_v": 1,
        "title": title,
        "body": body,
        "android": {
            "channelId": RING_CHANNEL_ID,
            "category": "call",
            "asForegroundService": True,
            "fullScreenAction": {"id": "default"},
            "pressAction": {"id": "default"},
            "sound": RING_SOUND,
            "loopSound": True,
            "actions": [
                {"title": "Accept", "pressAction": {"id": "accept"}},
                {"title": "Decline", "pressAction": {"id": "decline"}},
            ],
            "timeoutAfter": timeout_after_ms,
        },
    })


def _send_fcm_data_message(token: str, data: dict) -> bool:
    app = _get_firebase_app()
    if app is None:
        return False

    try:
        from firebase_admin import messaging as fcm_messaging

        message = fcm_messaging.Message(
            data={str(k): str(v) for k, v in data.items()},
            token=token,
            android=fcm_messaging.AndroidConfig(priority="high"),
        )
        fcm_messaging.send(message, app=app)
        logger.info("fcm data push token=%s data_keys=%s", token[:20], list(data.keys()))
        return True
    except Exception as exc:
        logger.error("fcm push send failed: %s", exc)
        return False


def _send_expo_push(token: str, title: str, body: str, data: dict | None = None) -> bool:
    try:
        payload = {
            "to": token,
            "title": title,
            "body": body,
            "data": data or {},
            "sound": "default",
            "channelId": "default",
        }
        resp = http_requests.post(
            _EXPO_PUSH_URL,
            headers={"Content-Type": "application/json"},
            data=json.dumps(payload),
            timeout=10,
        )
        try:
            body_json = resp.json()
        except Exception:
            body_json = resp.text
        logger.info("push token=%s status=%s response=%s", token[:20], resp.status_code, body_json)
        return resp.status_code == 200
    except Exception as exc:
        logger.error("push send failed: %s", exc)
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
        logger.warning("notify_driver skipped: tanker_id=%s has no push token", tanker_id)
        return
    if not is_enabled(db, "driver", str(tanker_id), "job_offers"):
        return
    _send_expo_push(tanker.expo_push_token, title, body, data)


def notify_driver_ring(
    db: Session,
    tanker_id: int,
    offer_id: int,
    offer_type: str,
    expires_at,
    title: str,
    body: str,
) -> None:
    """Send a call-style ring push for a new job offer.

    Prefers a data-only FCM message (handled natively by the mobile ring UI even
    when the app is backgrounded/killed). Falls back to the existing generic Expo
    push for drivers on an older build without a registered fcm_token.
    """
    tanker = db.query(Tanker).filter(Tanker.id == tanker_id).first()
    if not tanker:
        logger.warning("notify_driver_ring skipped: tanker_id=%s not found", tanker_id)
        return
    if not is_enabled(db, "driver", str(tanker_id), "job_offers"):
        return

    expires_dt = expires_at
    if isinstance(expires_dt, str):
        expires_dt = datetime.fromisoformat(expires_dt)
    timeout_after_ms = max(int((expires_dt - datetime.utcnow()).total_seconds() * 1000), 1000)

    plain_data = {
        "type": "job_offer",
        "offer_id": offer_id,
        "offer_type": offer_type,
        "tanker_id": tanker_id,
        "expires_at": expires_dt.isoformat(),
    }

    logger.info(
        "notify_driver_ring tanker_id=%s fcm_token_present=%s expo_push_token_present=%s",
        tanker_id, bool(tanker.fcm_token), bool(tanker.expo_push_token),
    )

    if tanker.fcm_token:
        fcm_data = dict(plain_data)
        fcm_data["notifee_options"] = _build_ring_notifee_options(title, body, timeout_after_ms)
        if _send_fcm_data_message(tanker.fcm_token, fcm_data):
            return

    if not tanker.expo_push_token:
        logger.warning("notify_driver_ring: tanker_id=%s has no expo_push_token fallback", tanker_id)
        return
    _send_expo_push(tanker.expo_push_token, title, body, plain_data)
