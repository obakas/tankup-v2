from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.models.batch import Batch
from app.models.batch_member import BatchMember
from app.models.operation_alert import OperationAlert
from app.models.request import LiquidRequest
from app.models.tanker import Tanker
from app.models.user import User
from app.services.operation_alert_service import create_operation_alert

_EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

HEARTBEAT_GRACE_MINUTES = 5
ESCALATION_MINUTES = 10
FOLLOWUP_MINUTES = 20

_ACTIVE_DELIVERY_STATUSES = {"delivering", "arrived", "measuring"}


def _send_expo_push(token: str, title: str, body: str, data: dict | None = None) -> bool:
    import json
    import requests as http_requests
    try:
        resp = http_requests.post(
            _EXPO_PUSH_URL,
            headers={"Content-Type": "application/json"},
            data=json.dumps({"to": token, "title": title, "body": body, "data": data or {}, "sound": "default"}),
            timeout=10,
        )
        return resp.status_code == 200
    except Exception:
        return False


def _find_active_job(db: Session, tanker: Tanker) -> tuple[str, Batch | LiquidRequest] | None:
    batch = (
        db.query(Batch)
        .filter(Batch.tanker_id == tanker.id, Batch.status.in_({"delivering", "arrived"}))
        .first()
    )
    if batch:
        return ("batch", batch)

    if tanker.current_request_id:
        req = db.query(LiquidRequest).filter(LiquidRequest.id == tanker.current_request_id).first()
        if req and req.status in {"delivering", "arrived"}:
            return ("priority", req)

    return None


def _get_client_users(db: Session, job_type: str, job: Batch | LiquidRequest) -> list[User]:
    if job_type == "batch":
        members = (
            db.query(BatchMember)
            .filter(BatchMember.batch_id == job.id, BatchMember.status == "active")
            .all()
        )
        user_ids = [m.user_id for m in members if m.user_id]
    else:
        user_ids = [job.user_id] if job.user_id else []  # type: ignore[union-attr]

    if not user_ids:
        return []

    return db.query(User).filter(User.id.in_(user_ids), User.expo_push_token.isnot(None)).all()


def _notify_clients(
    db: Session,
    tanker: Tanker,
    job_type: str,
    job: Batch | LiquidRequest,
    phase: str,
    outcome: str | None = None,
) -> int:
    users = _get_client_users(db, job_type, job)
    if not users:
        return 0

    if phase == "delay":
        title = "Delivery Update"
        body = (
            "Your delivery driver lost connection. We're trying to reach them now. "
            "We'll update you in the next few minutes."
        )
    elif phase == "escalated":
        title = "Delivery Update"
        body = (
            "Your delivery has been delayed. We've escalated to your fleet head who is actively "
            "working to resolve this. We'll follow up with them in 10 minutes and update you on the outcome."
        )
    elif phase == "followup":
        if outcome == "resolved":
            title = "Delivery Update"
            body = (
                "Update: Your fleet head has stepped in and is handling your delivery directly. "
                "You'll receive a final update once it's resolved."
            )
        else:
            title = "Delivery Update"
            body = "Our team is still working to resolve your delivery. We appreciate your patience and will keep you updated."
    elif phase == "resolved":
        title = "Delivery Resumed"
        body = "Your driver is back online. Delivery continues as scheduled."
    else:
        return 0

    sent = 0
    for user in users:
        ok = _send_expo_push(
            token=user.expo_push_token,
            title=title,
            body=body,
            data={"type": "driver_offline_update", "phase": phase},
        )
        if ok:
            sent += 1

    return sent


def _escalate_to_fleet_head(
    db: Session,
    tanker: Tanker,
    job_type: str,
    job: Batch | LiquidRequest,
    minutes_offline: int,
) -> OperationAlert:
    batch_id = job.id if job_type == "batch" else None
    request_id = job.id if job_type == "priority" else None

    alert = create_operation_alert(
        db,
        alert_type="driver_offline_escalation",
        severity="critical",
        job_type=job_type,
        job_id=job.id,
        tanker_id=tanker.id,
        batch_id=batch_id,
        request_id=request_id,
        message=(
            f"Driver {tanker.driver_name} (tanker #{tanker.id}) has been offline for "
            f"{minutes_offline} minutes during an active delivery. Fleet head intervention required."
        ),
    )
    return alert


def _check_fleet_head_outcome(db: Session, tanker: Tanker) -> str:
    alert = (
        db.query(OperationAlert)
        .filter(
            OperationAlert.alert_type == "driver_offline_escalation",
            OperationAlert.tanker_id == tanker.id,
            OperationAlert.status != "open",
        )
        .order_by(OperationAlert.created_at.desc())
        .first()
    )
    return "resolved" if alert else "pending"


def _send_fleet_head_reminder(db: Session, tanker: Tanker, job: Batch | LiquidRequest) -> None:
    create_operation_alert(
        db,
        alert_type="driver_offline_escalation_reminder",
        severity="critical",
        job_type="tanker",
        job_id=tanker.id,
        tanker_id=tanker.id,
        message=(
            f"REMINDER: Driver {tanker.driver_name} (tanker #{tanker.id}) offline incident from "
            f"20 minutes ago is still unresolved. Immediate action required."
        ),
    )


def process_offline_drivers(db: Session) -> list[str]:
    now = datetime.utcnow()
    log: list[str] = []

    # Find tankers that are mid-delivery AND heartbeat has gone stale (or never existed)
    stale_cutoff = now - timedelta(minutes=HEARTBEAT_GRACE_MINUTES)
    candidates = (
        db.query(Tanker)
        .filter(
            Tanker.status.in_(_ACTIVE_DELIVERY_STATUSES),
            Tanker.is_online == True,  # noqa: E712
        )
        .all()
    )

    for tanker in candidates:
        heartbeat_stale = (
            tanker.last_heartbeat_at is None or tanker.last_heartbeat_at < stale_cutoff
        )
        if not heartbeat_stale:
            continue

        job_info = _find_active_job(db, tanker)
        if not job_info:
            continue
        job_type, job = job_info

        if not tanker.offline_grace_started_at:
            tanker.offline_grace_started_at = now
            db.commit()
            log.append(f"Tanker {tanker.id}: grace period started")
            continue

        elapsed = int((now - tanker.offline_grace_started_at).total_seconds() / 60)

        if elapsed >= FOLLOWUP_MINUTES and not tanker.offline_followup_sent_at:
            outcome = _check_fleet_head_outcome(db, tanker)
            _notify_clients(db, tanker, job_type, job, phase="followup", outcome=outcome)
            if outcome == "pending":
                _send_fleet_head_reminder(db, tanker, job)
            tanker.offline_followup_sent_at = now
            db.commit()
            log.append(f"Tanker {tanker.id}: 20-min follow-up sent (outcome={outcome})")

        elif elapsed >= ESCALATION_MINUTES and not tanker.offline_escalated_at:
            _escalate_to_fleet_head(db, tanker, job_type, job, elapsed)
            _notify_clients(db, tanker, job_type, job, phase="escalated")
            tanker.offline_escalated_at = now
            db.commit()
            log.append(f"Tanker {tanker.id}: escalated to fleet head at {elapsed} min")

        elif elapsed >= HEARTBEAT_GRACE_MINUTES and not tanker.offline_notified_at:
            _notify_clients(db, tanker, job_type, job, phase="delay")
            tanker.offline_notified_at = now
            db.commit()
            log.append(f"Tanker {tanker.id}: clients notified of delay at {elapsed} min")

    # Clear grace for drivers who reconnected (heartbeat is fresh again)
    reconnected = (
        db.query(Tanker)
        .filter(
            Tanker.offline_grace_started_at.isnot(None),
            Tanker.last_heartbeat_at >= now - timedelta(seconds=90),
        )
        .all()
    )
    for tanker in reconnected:
        job_info = _find_active_job(db, tanker)
        if job_info:
            job_type, job = job_info
            _notify_clients(db, tanker, job_type, job, phase="resolved")
        tanker.offline_grace_started_at = None
        tanker.offline_notified_at = None
        tanker.offline_escalated_at = None
        tanker.offline_followup_sent_at = None
        log.append(f"Tanker {tanker.id}: driver reconnected, grace cleared")

    if reconnected:
        db.commit()

    return log
