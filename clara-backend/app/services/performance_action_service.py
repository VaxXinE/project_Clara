from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import Select, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.performance_action import PerformanceAction
from app.models.sales_team import SalesTeam
from app.models.user import User
from app.schemas.dashboard_schema import (
    PerformanceActionCreateRequest,
    PerformanceActionItem,
    PerformanceActionListResponse,
    PerformanceActionUpdateRequest,
)
from app.services.access_control_service import (
    get_accessible_sales_user_ids,
    get_accessible_team_ids,
)
from app.services.role_service import (
    is_head_like,
    is_manager_like,
    is_sales_like,
    is_superadmin_like,
)

VALID_ACTION_SOURCES = {
    "sales_performance",
    "team_performance",
    "coaching_priority",
    "boundary_alert",
}
VALID_ACTION_TYPES = {
    "coaching",
    "follow_up_recovery",
    "reply_backlog_review",
    "crm_cleanup",
    "weekly_review",
}
VALID_PRIORITY_LABELS = {"urgent", "high", "normal", "low"}
VALID_ACTION_STATUSES = {"open", "in_progress", "done", "skipped"}
VALID_STATUS_TRANSITIONS = {
    "open": {"in_progress", "done", "skipped"},
    "in_progress": {"done", "skipped"},
}


def _ensure_action_manager_role(current_user: User) -> None:
    if not (
        is_manager_like(current_user.role)
        or is_head_like(current_user.role)
        or is_superadmin_like(current_user.role)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Role ini tidak boleh membuat performance action.",
        )


def _normalize_text(value: str, *, field_name: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{field_name} wajib diisi.",
        )
    return normalized


def _get_scope(
    db: Session,
    *,
    current_user: User,
) -> tuple[set[UUID] | None, set[UUID] | None]:
    accessible_sales_user_ids = get_accessible_sales_user_ids(
        db=db,
        current_user=current_user,
    )
    accessible_team_ids = get_accessible_team_ids(
        db=db,
        current_user=current_user,
    )
    return accessible_sales_user_ids, accessible_team_ids


def _validate_assignee(
    db: Session,
    *,
    current_user: User,
    assignee_id: UUID,
    organization_id: UUID | None,
    accessible_sales_user_ids: set[UUID] | None,
) -> User:
    assignee = db.get(User, assignee_id)
    if assignee is None or not assignee.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assigned user invalid atau inactive.",
        )

    if not is_superadmin_like(current_user.role):
        if organization_id is None or assignee.organization_id != organization_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Assigned user harus satu organization.",
            )

    if accessible_sales_user_ids is not None and assignee.id not in accessible_sales_user_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Assigned user di luar scope manager.",
        )

    return assignee


def _validate_sales_user(
    db: Session,
    *,
    current_user: User,
    sales_user_id: UUID | None,
    organization_id: UUID | None,
    accessible_sales_user_ids: set[UUID] | None,
) -> User | None:
    if sales_user_id is None:
        return None

    sales_user = db.get(User, sales_user_id)
    if sales_user is None or not sales_user.is_active or not is_sales_like(sales_user.role):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sales user invalid atau inactive.",
        )

    if not is_superadmin_like(current_user.role):
        if organization_id is None or sales_user.organization_id != organization_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Sales user harus satu organization.",
            )

    if accessible_sales_user_ids is not None and sales_user.id not in accessible_sales_user_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sales user di luar scope manager.",
        )

    return sales_user


def _validate_team(
    db: Session,
    *,
    current_user: User,
    team_id: UUID | None,
    organization_id: UUID | None,
    accessible_team_ids: set[UUID] | None,
) -> SalesTeam | None:
    if team_id is None:
        return None

    team = db.get(SalesTeam, team_id)
    if team is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Team tidak ditemukan.",
        )

    if not is_superadmin_like(current_user.role):
        if organization_id is None or team.organization_id != organization_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Team harus satu organization.",
            )

    if accessible_team_ids is not None and team.id not in accessible_team_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Team di luar scope manager.",
        )

    return team


def build_performance_action_item(action: PerformanceAction) -> PerformanceActionItem:
    return PerformanceActionItem(
        id=action.id,
        organization_id=action.organization_id,
        created_by_user_id=action.created_by_user_id,
        created_by_user_name=action.created_by_user.name if action.created_by_user else None,
        assigned_to_user_id=action.assigned_to_user_id,
        assigned_to_user_name=(
            action.assigned_to_user.name if action.assigned_to_user else None
        ),
        team_id=action.team_id,
        team_name=action.team.name if action.team else None,
        sales_user_id=action.sales_user_id,
        sales_name=action.sales_user.name if action.sales_user else None,
        source_type=action.source_type,
        source_reference_id=action.source_reference_id,
        title=action.title,
        description=action.description,
        action_type=action.action_type,
        status=action.status,
        priority_label=action.priority_label,
        due_at=action.due_at,
        resolution_note=action.resolution_note,
        completed_at=action.completed_at,
        created_at=action.created_at,
        updated_at=action.updated_at,
    )


def _base_action_statement() -> Select:
    return select(PerformanceAction).options(
        selectinload(PerformanceAction.created_by_user),
        selectinload(PerformanceAction.assigned_to_user),
        selectinload(PerformanceAction.team),
        selectinload(PerformanceAction.sales_user),
    )


def list_performance_actions(
    db: Session,
    *,
    current_user: User,
) -> PerformanceActionListResponse:
    statement = _base_action_statement()

    if not is_superadmin_like(current_user.role):
        if current_user.organization_id is None:
            return PerformanceActionListResponse(
                generated_at=datetime.now(timezone.utc),
                open_count=0,
                in_progress_count=0,
                done_count=0,
                skipped_count=0,
                items=[],
            )
        statement = statement.where(
            PerformanceAction.organization_id == current_user.organization_id
        )

    if is_sales_like(current_user.role):
        statement = statement.where(PerformanceAction.assigned_to_user_id == current_user.id)
    else:
        accessible_sales_user_ids, accessible_team_ids = _get_scope(
            db=db,
            current_user=current_user,
        )
        if accessible_sales_user_ids is not None or accessible_team_ids is not None:
            filters = []
            if accessible_sales_user_ids:
                filters.append(
                    or_(
                        PerformanceAction.sales_user_id.in_(accessible_sales_user_ids),
                        PerformanceAction.assigned_to_user_id.in_(accessible_sales_user_ids),
                        PerformanceAction.created_by_user_id.in_(accessible_sales_user_ids),
                    )
                )
            if accessible_team_ids:
                filters.append(PerformanceAction.team_id.in_(accessible_team_ids))
            if filters:
                statement = statement.where(or_(*filters))

    items = list(
        db.scalars(
            statement.order_by(
                PerformanceAction.status.asc(),
                PerformanceAction.priority_label.asc(),
                PerformanceAction.created_at.desc(),
            )
        ).all()
    )
    payload_items = [build_performance_action_item(item) for item in items]

    return PerformanceActionListResponse(
        generated_at=datetime.now(timezone.utc),
        open_count=sum(item.status == "open" for item in items),
        in_progress_count=sum(item.status == "in_progress" for item in items),
        done_count=sum(item.status == "done" for item in items),
        skipped_count=sum(item.status == "skipped" for item in items),
        items=payload_items,
    )


def create_performance_action(
    db: Session,
    *,
    payload: PerformanceActionCreateRequest,
    current_user: User,
) -> PerformanceActionItem:
    _ensure_action_manager_role(current_user)

    if payload.source_type not in VALID_ACTION_SOURCES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Source type tidak valid.",
        )
    if payload.action_type not in VALID_ACTION_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Action type tidak valid.",
        )
    if payload.priority_label not in VALID_PRIORITY_LABELS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Priority label tidak valid.",
        )

    accessible_sales_user_ids, accessible_team_ids = _get_scope(
        db=db,
        current_user=current_user,
    )
    organization_id = current_user.organization_id
    team = _validate_team(
        db=db,
        current_user=current_user,
        team_id=payload.team_id,
        organization_id=organization_id,
        accessible_team_ids=accessible_team_ids,
    )
    sales_user = _validate_sales_user(
        db=db,
        current_user=current_user,
        sales_user_id=payload.sales_user_id,
        organization_id=organization_id,
        accessible_sales_user_ids=accessible_sales_user_ids,
    )
    assignee = _validate_assignee(
        db=db,
        current_user=current_user,
        assignee_id=payload.assigned_to_user_id,
        organization_id=organization_id,
        accessible_sales_user_ids=accessible_sales_user_ids,
    )

    if payload.team_id is None and sales_user is not None and sales_user.team_id is not None:
        team = _validate_team(
            db=db,
            current_user=current_user,
            team_id=sales_user.team_id,
            organization_id=organization_id,
            accessible_team_ids=accessible_team_ids,
        )

    if team is None and sales_user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Action harus terkait sales atau team.",
        )

    action = PerformanceAction(
        organization_id=organization_id,
        created_by_user_id=current_user.id,
        assigned_to_user_id=assignee.id,
        team_id=team.id if team else None,
        sales_user_id=sales_user.id if sales_user else None,
        source_type=payload.source_type,
        source_reference_id=payload.source_reference_id,
        title=_normalize_text(payload.title, field_name="Title"),
        description=_normalize_text(payload.description, field_name="Description"),
        action_type=payload.action_type,
        status="open",
        priority_label=payload.priority_label,
        due_at=payload.due_at,
    )
    db.add(action)
    db.commit()
    db.refresh(action)
    return build_performance_action_item(action)


def _get_action_or_raise(
    db: Session,
    *,
    action_id: UUID,
    current_user: User,
) -> PerformanceAction:
    action = db.scalar(
        _base_action_statement().where(PerformanceAction.id == action_id)
    )
    if action is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Performance action tidak ditemukan.",
        )

    if not is_superadmin_like(current_user.role):
        if current_user.organization_id is None or action.organization_id != current_user.organization_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Performance action tidak ditemukan.",
            )

    if is_sales_like(current_user.role):
        if action.assigned_to_user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Performance action tidak ditemukan.",
            )
        return action

    accessible_sales_user_ids, accessible_team_ids = _get_scope(
        db=db,
        current_user=current_user,
    )
    if accessible_sales_user_ids is None and accessible_team_ids is None:
        return action

    if action.team_id is not None and accessible_team_ids and action.team_id in accessible_team_ids:
        return action
    if action.sales_user_id is not None and accessible_sales_user_ids and action.sales_user_id in accessible_sales_user_ids:
        return action
    if (
        action.assigned_to_user_id is not None
        and accessible_sales_user_ids
        and action.assigned_to_user_id in accessible_sales_user_ids
    ):
        return action
    if action.created_by_user_id == current_user.id:
        return action

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Performance action tidak ditemukan.",
    )


def update_performance_action_status(
    db: Session,
    *,
    action_id: UUID,
    payload: PerformanceActionUpdateRequest,
    current_user: User,
) -> PerformanceActionItem:
    _ensure_action_manager_role(current_user)

    if payload.status not in VALID_ACTION_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Status action tidak valid.",
        )

    action = _get_action_or_raise(db=db, action_id=action_id, current_user=current_user)

    if action.status == payload.status:
        return build_performance_action_item(action)

    allowed_statuses = VALID_STATUS_TRANSITIONS.get(action.status, set())
    if payload.status not in allowed_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Transisi status action tidak valid.",
        )

    resolution_note = payload.resolution_note.strip() if payload.resolution_note else None
    if payload.status == "skipped" and not resolution_note:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Resolution note wajib saat skip action.",
        )

    action.status = payload.status
    action.resolution_note = resolution_note
    action.completed_at = (
        datetime.now(timezone.utc) if payload.status == "done" else None
    )
    db.add(action)
    db.commit()
    db.refresh(action)
    return build_performance_action_item(action)
