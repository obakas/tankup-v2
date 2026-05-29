from __future__ import annotations

import json
from datetime import datetime

import requests as http_requests
from sqlalchemy.orm import Session

from app.models.batch import Batch
from app.models.batch_member import BatchMember
from app.models.batch_notification_log import BatchNotificationLog
from app.models.customer_site_profile import CustomerSiteProfile
from app.models.request import LiquidRequest
from app.models.user import User
from app.services.routing_service import calculate_distance_km

_ACTIVE_REQUEST_STATUSES = {
    "pending",
    "searching_driver",
    "assigned",
    "loading",
    "delivering",
    "arrived",
}

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


def _find_eligible_users(db: Session, batch: Batch) -> list[User]:
    if batch.latitude is None or batch.longitude is None:
        return []

    radius_km = float(batch.search_radius_km or 1.0)

    # Users already in this batch
    existing_member_ids: set[int] = {
        row.user_id
        for row in db.query(BatchMember.user_id)
        .filter(BatchMember.batch_id == batch.id)
        .all()
    }

    # Users already notified about this batch
    already_notified_ids: set[int] = {
        row.user_id
        for row in db.query(BatchNotificationLog.user_id)
        .filter(BatchNotificationLog.batch_id == batch.id)
        .all()
    }

    # Users with an active batch request
    users_with_active_request: set[int] = {
        row.user_id
        for row in db.query(LiquidRequest.user_id)
        .filter(
            LiquidRequest.status.in_(_ACTIVE_REQUEST_STATUSES),
            LiquidRequest.delivery_type == "batch",
        )
        .all()
    }

    excluded = existing_member_ids | already_notified_ids | users_with_active_request

    # Fetch all site profiles with tokens, then filter by distance in Python
    # (avoids needing PostGIS; site count is small for MVP)
    sites = (
        db.query(CustomerSiteProfile)
        .join(User, User.id == CustomerSiteProfile.user_id)
        .filter(
            User.expo_push_token.isnot(None),
            CustomerSiteProfile.user_id.notin_(excluded) if excluded else True,
        )
        .all()
    )

    eligible: dict[int, User] = {}
    for site in sites:
        if site.user_id in eligible:
            continue
        dist = calculate_distance_km(
            batch.longitude, batch.latitude,
            site.longitude, site.latitude,
        )
        if dist <= radius_km:
            user = db.query(User).filter(User.id == site.user_id).first()
            if user:
                eligible[site.user_id] = user

    return list(eligible.values())


def process_nearby_batch_notifications(db: Session) -> list[str]:
    near_ready_batches = (
        db.query(Batch).filter(Batch.status == "near_ready").all()
    )

    log: list[str] = []
    for batch in near_ready_batches:
        eligible_users = _find_eligible_users(db, batch)
        if not eligible_users:
            continue

        sent: list[int] = []
        for user in eligible_users:
            ok = _send_expo_push(
                token=user.expo_push_token,
                title="Batch forming near your site!",
                body="A delivery batch nearby is almost full — join before it closes.",
                data={"type": "batch_invite", "batch_id": batch.id},
            )
            if ok:
                db.add(BatchNotificationLog(
                    batch_id=batch.id,
                    user_id=user.id,
                    sent_at=datetime.utcnow(),
                ))
                sent.append(user.id)

        if sent:
            db.commit()
            log.append(
                f"Batch {batch.id}: notified {len(sent)} nearby user(s) {sent}"
            )

    return log
