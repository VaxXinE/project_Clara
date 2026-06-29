from fastapi import Request
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.user import User


def create_audit_log(
    db: Session,
    action: str,
    resource_type: str,
    resource_id: str | None = None,
    current_user: User | None = None,
    request: Request | None = None,
    metadata: dict | None = None,
) -> AuditLog:
    ip_address = None
    user_agent = None
    metadata_payload = metadata or {}

    if request is not None:
        ip_address = request.client.host if request.client else None
        user_agent = request.headers.get("User-Agent")

    audit_log = AuditLog(
        organization_id=(
            str(current_user.organization_id)
            if current_user and current_user.organization_id is not None
            else None
        ),
        actor_user_id=str(current_user.id) if current_user else None,
        actor_email=current_user.email if current_user else None,
        actor_role=current_user.role if current_user else None,
        channel=metadata_payload.get("channel"),
        provider=metadata_payload.get("provider"),
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        ip_address=ip_address,
        user_agent=user_agent,
        metadata_json=metadata_payload,
    )

    db.add(audit_log)
    db.commit()
    db.refresh(audit_log)

    return audit_log
