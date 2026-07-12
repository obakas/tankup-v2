from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.hub import Hub
from app.services.routing_service import calculate_distance_km


def find_nearest_hub(db: Session, latitude: float, longitude: float) -> Hub | None:
    """
    Pilot-scale nearest-hub lookup: linear scan over active hubs.
    No tie-breaking or max-distance rejection — not meaningful with 1-2 hubs.
    """
    hubs = db.query(Hub).filter(Hub.is_active == True).all()  # noqa: E712
    candidates = [h for h in hubs if h.latitude is not None and h.longitude is not None]

    if not candidates:
        return None

    return min(
        candidates,
        key=lambda hub: calculate_distance_km(hub.longitude, hub.latitude, longitude, latitude),
    )
