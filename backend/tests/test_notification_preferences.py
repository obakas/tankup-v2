import os

os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")

from app.core.database import SessionLocal
from app.services.notification_preference_service import is_enabled, update_preferences


def test_arrival_ring_defaults_off_with_no_record():
    db = SessionLocal()
    try:
        assert is_enabled(db, "customer", "no-such-actor-arrival-ring", "arrival_ring") is False
    finally:
        db.close()


def test_delivery_progress_still_defaults_on_with_no_record():
    db = SessionLocal()
    try:
        assert is_enabled(db, "customer", "no-such-actor-delivery-progress", "delivery_progress") is True
    finally:
        db.close()


def test_arrival_ring_can_be_explicitly_opted_in():
    db = SessionLocal()
    try:
        actor_id = "opted-in-arrival-ring-actor"
        update_preferences(db, "customer", actor_id, {"arrival_ring": True})
        assert is_enabled(db, "customer", actor_id, "arrival_ring") is True
    finally:
        db.close()
