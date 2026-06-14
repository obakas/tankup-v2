from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

from app.models.batch import Batch
from app.models.batch_member import BatchMember
from app.models.batch_notification_log import BatchNotificationLog
from app.models.customer_site_profile import CustomerSiteProfile
from app.models.request import LiquidRequest
from app.models.user import User
from app.services.routing_service import calculate_distance_km
from app.services.notification_preference_service import is_enabled
from app.services.push_service import _send_expo_push

_ACTIVE_REQUEST_STATUSES = {
    "pending",
    "searching_driver",
    "assigned",
    "loading",
    "delivering",
    "arrived",
}


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


_BATCH_NOTIFY_MESSAGES: dict[str, tuple[str, str]] = {
    "forming": (
        "Water delivery forming near you",
        "A shared batch is forming near your site. Join now to lock in the lower rate.",
    ),
    "near_ready": (
        "Batch forming near your site!",
        "A delivery batch nearby is almost full — join before it closes.",
    ),
}


def process_nearby_batch_notifications(db: Session) -> list[str]:
    batches = (
        db.query(Batch)
        .filter(Batch.status.in_(["forming", "near_ready"]))
        .all()
    )

    log: list[str] = []
    for batch in batches:
        eligible_users = _find_eligible_users(db, batch)
        if not eligible_users:
            continue

        title, body = _BATCH_NOTIFY_MESSAGES.get(
            batch.status,
            _BATCH_NOTIFY_MESSAGES["near_ready"],
        )

        sent: list[int] = []
        for user in eligible_users:
            if not is_enabled(db, "customer", str(user.id), "batch_nearby"):
                continue
            ok = _send_expo_push(
                token=user.expo_push_token,
                title=title,
                body=body,
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
                f"Batch {batch.id} ({batch.status}): notified {len(sent)} nearby user(s) {sent}"
            )

    return log
