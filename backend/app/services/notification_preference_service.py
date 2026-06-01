from __future__ import annotations

from typing import Literal

from sqlalchemy.orm import Session

from app.models.notification_preference import NotificationPreference

ActorType = Literal["customer", "driver", "fleet_head", "admin"]

# All categories per actor type with their default state (True = on).
# Missing categories in a stored record also default to True.
DEFAULT_CATEGORIES: dict[ActorType, dict[str, bool]] = {
    "customer": {
        "batch_nearby": True,
        "driver_updates": True,
        "delivery_progress": True,
        "payment_updates": True,
    },
    "driver": {
        "job_offers": True,
        "delivery_reminders": True,
        "account_alerts": True,
    },
    "fleet_head": {
        "driver_issues": True,
        "loading_timeouts": True,
        "late_arrivals": True,
        "assignment_failures": True,
    },
    "admin": {
        "driver_issues": True,
        "loading_timeouts": True,
        "late_arrivals": True,
        "assignment_failures": True,
        "system_alerts": True,
    },
}


def _get_record(db: Session, actor_type: str, actor_id: str) -> NotificationPreference | None:
    return (
        db.query(NotificationPreference)
        .filter(
            NotificationPreference.actor_type == actor_type,
            NotificationPreference.actor_id == actor_id,
        )
        .first()
    )


def get_preferences(db: Session, actor_type: str, actor_id: str) -> dict[str, bool]:
    """Return the full preferences dict, merging defaults for any missing keys."""
    defaults = DEFAULT_CATEGORIES.get(actor_type, {})
    record = _get_record(db, actor_type, actor_id)
    stored = dict(record.preferences) if record and record.preferences else {}
    return {**defaults, **stored}


def update_preferences(
    db: Session,
    actor_type: str,
    actor_id: str,
    updates: dict[str, bool],
) -> dict[str, bool]:
    """Merge `updates` into stored preferences, upsert the record, return full prefs."""
    defaults = DEFAULT_CATEGORIES.get(actor_type, {})
    valid_keys = set(defaults.keys())

    record = _get_record(db, actor_type, actor_id)

    if record:
        current = dict(record.preferences) if record.preferences else {}
        merged = {**defaults, **current, **{k: v for k, v in updates.items() if k in valid_keys}}
        record.preferences = merged
    else:
        merged = {**defaults, **{k: v for k, v in updates.items() if k in valid_keys}}
        record = NotificationPreference(
            actor_type=actor_type,
            actor_id=actor_id,
            preferences=merged,
        )
        db.add(record)

    db.commit()
    db.refresh(record)
    return dict(record.preferences)


def is_enabled(db: Session, actor_type: str, actor_id: str, category: str) -> bool:
    """Check a single category. Returns True if no record exists (opt-out model)."""
    record = _get_record(db, actor_type, actor_id)
    if not record or not record.preferences:
        return True
    return bool(record.preferences.get(category, True))
