from __future__ import annotations

from math import asin, cos, radians, sin, sqrt
from typing import Iterable

from app.models.batch_member import BatchMember
from app.models.tanker import Tanker
from app.services.driver_scoring_service import haversine_km


def calculate_distance_km(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    """
    Haversine formula.
    """
    lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])

    dlon = lon2 - lon1
    dlat = lat2 - lat1

    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    c = 2 * asin(sqrt(a))
    km = 6371 * c
    return km


def is_within_batch_radius(
    batch,
    request_latitude: float,
    request_longitude: float,
    radius_km: float = 1.0,
) -> bool:
    distance_km = calculate_distance_km(
        batch.longitude,
        batch.latitude,
        request_longitude,
        request_latitude,
    )
    return distance_km <= radius_km


def calculate_batch_center(members: list[BatchMember]) -> tuple[float, float]:
    if not members:
        raise ValueError("Cannot calculate center with no members")

    avg_lat = sum(member.latitude for member in members) / len(members)
    avg_lon = sum(member.longitude for member in members) / len(members)
    return avg_lat, avg_lon


def optimize_delivery_order(
    start_lon: float,
    start_lat: float,
    members: list[BatchMember],
) -> list[BatchMember]:
    """
    Greedy nearest-neighbor route.
    """
    unvisited = members.copy()
    route: list[BatchMember] = []

    current_lon, current_lat = start_lon, start_lat

    while unvisited:
        next_member = min(
            unvisited,
            key=lambda member: calculate_distance_km(
                current_lon,
                current_lat,
                member.longitude,
                member.latitude,
            ),
        )
        route.append(next_member)
        current_lon, current_lat = next_member.longitude, next_member.latitude
        unvisited.remove(next_member)

    return route


def sort_members_by_distance_from_tanker(
    tanker: Tanker,
    members: list[BatchMember],
) -> list[BatchMember]:
    if tanker.latitude is None or tanker.longitude is None:
        return members

    return sorted(
        members,
        key=lambda member: calculate_distance_km(
            tanker.longitude,
            tanker.latitude,
            member.longitude,
            member.latitude,
        ),
    )

def plan_batch_delivery_order(batch, members: list) -> list[dict]:
    """
    Greedy nearest-neighbor route starting from batch center.
    """
    remaining = [
        member for member in members
        if getattr(member, "latitude", None) is not None
        and getattr(member, "longitude", None) is not None
    ]

    if not remaining:
        return []

    current_lat = batch.latitude
    current_lon = batch.longitude
    ordered = []

    while remaining:
        next_member = min(
            remaining,
            key=lambda member: haversine_km(
                current_lat,
                current_lon,
                member.latitude,
                member.longitude,
            )
        )

        ordered.append({
            "member_id": next_member.id,
            "request_id": getattr(next_member, "request_id", None),
            "latitude": next_member.latitude,
            "longitude": next_member.longitude,
            "volume_liters": getattr(next_member, "volume_liters", None),
        })

        current_lat = next_member.latitude
        current_lon = next_member.longitude
        remaining.remove(next_member)

    return ordered



def find_closest_tanker_to_location(
    tankers: list[Tanker],
    latitude: float,
    longitude: float,
) -> Tanker | None:
    valid_tankers = [
        t for t in tankers
        if t.latitude is not None and t.longitude is not None
    ]

    if not valid_tankers:
        return None

    return min(
        valid_tankers,
        key=lambda t: calculate_distance_km(
            t.longitude,
            t.latitude,
            longitude,
            latitude,
        ),
    )


def find_closest_tanker_to_batch(tankers: list[Tanker], batch) -> Tanker | None:
    valid_tankers = [
        t for t in tankers
        if t.latitude is not None and t.longitude is not None
    ]

    if not valid_tankers:
        return None

    return min(
        valid_tankers,
        key=lambda t: calculate_distance_km(
            t.longitude,
            t.latitude,
            batch.longitude,
            batch.latitude,
        ),
    )