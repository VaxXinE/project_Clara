from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.db.session import get_db
from app.models.audit_log import AuditLog
from app.models.user import User
from app.schemas.audit_log_schema import AuditLogResponse

router = APIRouter(prefix="/audit-logs", tags=["audit-logs"])


@router.get("", response_model=list[AuditLogResponse])
def list_audit_logs(
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("head")),
):
    if current_user.organization_id is None:
        return []

    statement = select(AuditLog).where(
        AuditLog.organization_id == str(current_user.organization_id)
    )
    statement = statement.order_by(desc(AuditLog.created_at)).limit(limit)

    return list(db.scalars(statement).all())
