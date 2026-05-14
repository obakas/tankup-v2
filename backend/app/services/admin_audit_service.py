import json
import logging
from typing import Any

from sqlalchemy.orm import Session

from app.models.admin_audit_log import AdminAuditLog

logger = logging.getLogger("app.admin")


def create_admin_audit_log(
    db: Session,
    *,
    action: str,
    entity_type: str,
    entity_id: int,
    admin_identifier: str = "admin",
    reason: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> AdminAuditLog:
    row = AdminAuditLog(
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        admin_identifier=admin_identifier,
        reason=reason,
        metadata_json=json.dumps(metadata or {}, default=str),
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    logger.info(
        "admin_audit_logged",
        extra={
            "admin_action": action,
            "reason": reason,
        },
    )

    return row