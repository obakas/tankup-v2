from __future__ import annotations

TANKER_STATUS_TRANSITIONS = {
    "available": {"assigned"},
    "assigned": {"loading", "available"},
    "loading": {"delivering", "available"},
    "delivering": {"arrived", "available"},
    "arrived": {"completed", "available"},
    "completed": {"available"},
}

BATCH_STATUS_TRANSITIONS = {
    "forming": {"near_ready", "ready_for_assignment", "expired"},
    "near_ready": {"forming", "ready_for_assignment", "expired"},
    "ready_for_assignment": {"assigned", "assignment_failed", "expired"},
    "assigned": {"loading", "ready_for_assignment", "assignment_failed"},
    "loading": {"delivering", "ready_for_assignment", "assignment_failed"},
    "delivering": {"arrived", "partially_completed", "failed"},
    "arrived": {"completed", "partially_completed", "failed"},
    "completed": set(),
    "partially_completed": set(),
    "failed": set(),
    "expired": set(),
    "assignment_failed": set(),
}

REQUEST_STATUS_TRANSITIONS = {
    "pending": {"searching_driver", "cancelled"},
    "searching_driver": {"assigned", "assignment_failed", "cancelled"},
    "assignment_pending": {"assigned", "assignment_failed", "cancelled"},
    "assigned": {"loading", "assignment_failed", "cancelled"},
    "loading": {"delivering", "assignment_failed", "cancelled"},
    "delivering": {"arrived", "completed", "partially_completed", "failed"},
    "arrived": {"completed", "partially_completed", "failed"},
    "completed": set(),
    "partially_completed": set(),
    "failed": set(),
    "assignment_failed": set(),
    "cancelled": set(),
}

DELIVERY_STATUS_TRANSITIONS = {
    "pending": {"en_route", "arrived", "failed", "skipped"},
    "en_route": {"arrived", "failed", "skipped"},
    "arrived": {"measuring", "failed", "skipped"},
    "measuring": {"awaiting_otp", "failed", "skipped"},
    "awaiting_otp": {"delivered", "failed", "skipped"},
    "delivered": set(),
    "failed": set(),
    "skipped": set(),
}


def can_transition(current_status: str, next_status: str, transitions: dict[str, set[str]]) -> bool:
    if current_status == next_status:
        return True
    return next_status in transitions.get(current_status, set())



def ensure_valid_transition(
    current_status: str,
    next_status: str,
    transitions: dict[str, set[str]],
    entity_name: str = "Entity",
) -> None:
    if can_transition(current_status, next_status, transitions):
        return
    allowed = sorted(transitions.get(current_status, set()))
    raise ValueError(
        f"{entity_name} cannot move from '{current_status}' to '{next_status}'. "
        f"Allowed next states: {allowed if allowed else 'none'}"
    )
