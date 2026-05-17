from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.lead import Lead
from app.models.lead_task import LeadTask
from app.models.user import User
from app.schemas.lead_schema import (
    LeadTaskCreateRequest,
    LeadTaskItem,
    LeadTaskUpdateRequest,
)
from app.services.access_control_service import can_access_all_conversations

VALID_TASK_TYPES = {"manual_follow_up", "scheduled_follow_up", "approval_follow_up"}
VALID_TASK_STATUSES = {"open", "done", "snoozed", "cancelled"}


def build_task_item(task: LeadTask) -> LeadTaskItem:
    return LeadTaskItem(
        id=task.id,
        lead_id=task.lead_id,
        organization_id=task.organization_id,
        assigned_user_id=task.assigned_user_id,
        assigned_user_name=task.assigned_user.name if task.assigned_user else None,
        task_type=task.task_type,
        status=task.status,
        title=task.title,
        description=task.description,
        due_at=task.due_at,
        completed_at=task.completed_at,
        created_at=task.created_at,
        updated_at=task.updated_at,
    )


def get_accessible_lead(
    db: Session,
    *,
    lead_id: UUID,
    current_user: User,
) -> Lead:
    statement = (
        select(Lead)
        .where(Lead.id == lead_id)
        .options(
            selectinload(Lead.assigned_user),
            selectinload(Lead.tasks).selectinload(LeadTask.assigned_user),
        )
    )
    lead = db.scalars(statement).first()

    if lead is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found.",
        )

    if current_user.organization_id is None or lead.organization_id != current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found.",
        )

    if not can_access_all_conversations(current_user) and lead.assigned_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found.",
        )

    return lead


def validate_assignee_for_lead(
    db: Session,
    *,
    lead: Lead,
    assignee_id: UUID | None,
) -> User | None:
    if assignee_id is None:
        return None

    assignee = db.get(User, assignee_id)
    if assignee is None or not assignee.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assigned user is invalid or inactive.",
        )

    if lead.organization_id is None or assignee.organization_id != lead.organization_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assigned user must belong to the same organization.",
        )

    return assignee


def list_tasks_for_lead(lead: Lead) -> list[LeadTaskItem]:
    ordered_tasks = sorted(
        lead.tasks,
        key=lambda task: (task.due_at or task.created_at, task.created_at),
    )
    return [build_task_item(task) for task in ordered_tasks]


def get_lead_tasks_for_user(
    db: Session,
    *,
    lead_id: UUID,
    current_user: User,
) -> list[LeadTaskItem]:
    lead = get_accessible_lead(db=db, lead_id=lead_id, current_user=current_user)
    return list_tasks_for_lead(lead)


def create_lead_task_for_user(
    db: Session,
    *,
    lead_id: UUID,
    payload: LeadTaskCreateRequest,
    current_user: User,
) -> LeadTaskItem:
    lead = get_accessible_lead(db=db, lead_id=lead_id, current_user=current_user)

    if payload.task_type not in VALID_TASK_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid task type.",
        )

    assigned_user_id = payload.assigned_user_id or lead.assigned_user_id or current_user.id
    assignee = validate_assignee_for_lead(
        db=db,
        lead=lead,
        assignee_id=assigned_user_id,
    )

    task = LeadTask(
        lead_id=lead.id,
        organization_id=lead.organization_id,
        assigned_user_id=assignee.id if assignee else None,
        task_type=payload.task_type,
        status="open",
        title=payload.title.strip(),
        description=payload.description.strip() if payload.description else None,
        due_at=payload.due_at,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return build_task_item(task)


def update_lead_task_for_user(
    db: Session,
    *,
    lead_id: UUID,
    task_id: UUID,
    payload: LeadTaskUpdateRequest,
    current_user: User,
) -> LeadTaskItem:
    lead = get_accessible_lead(db=db, lead_id=lead_id, current_user=current_user)
    task = next((item for item in lead.tasks if item.id == task_id), None)

    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found.",
        )

    if payload.status is not None:
        if payload.status not in VALID_TASK_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid task status.",
            )
        task.status = payload.status
        task.completed_at = (
            datetime.now(timezone.utc) if payload.status == "done" else None
        )

    if payload.title is not None:
        task.title = payload.title.strip() or task.title

    if payload.description is not None:
        task.description = payload.description.strip() or None

    if "due_at" in payload.model_fields_set:
        task.due_at = payload.due_at

    if "assigned_user_id" in payload.model_fields_set:
        if (
            payload.assigned_user_id is not None
            and not can_access_all_conversations(current_user)
            and payload.assigned_user_id != current_user.id
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admin can reassign tasks.",
            )

        assignee = validate_assignee_for_lead(
            db=db,
            lead=lead,
            assignee_id=payload.assigned_user_id,
        )
        task.assigned_user_id = assignee.id if assignee else None

    db.add(task)
    db.commit()
    db.refresh(task)
    return build_task_item(task)


def upsert_follow_up_task_for_lead(
    db: Session,
    *,
    lead: Lead,
) -> LeadTask | None:
    statement = (
        select(LeadTask)
        .where(
            LeadTask.lead_id == lead.id,
            LeadTask.task_type == "scheduled_follow_up",
        )
        .order_by(LeadTask.created_at.desc())
    )
    existing_task = db.scalars(statement).first()

    if lead.next_follow_up_at is None:
        if existing_task is not None and existing_task.status in {"open", "snoozed"}:
            existing_task.status = "cancelled"
            existing_task.completed_at = None
            db.add(existing_task)
            db.flush()
        return existing_task

    if existing_task is not None:
        existing_task.status = "open"
        existing_task.title = "Follow up lead"
        existing_task.description = (
            f"Tindak lanjuti lead {lead.display_name} sesuai jadwal follow-up terbaru."
        )
        existing_task.due_at = lead.next_follow_up_at
        existing_task.completed_at = None
        existing_task.assigned_user_id = lead.assigned_user_id
        db.add(existing_task)
        db.flush()
        return existing_task

    task = LeadTask(
        lead_id=lead.id,
        organization_id=lead.organization_id,
        assigned_user_id=lead.assigned_user_id,
        task_type="scheduled_follow_up",
        status="open",
        title="Follow up lead",
        description=(
            f"Tindak lanjuti lead {lead.display_name} sesuai jadwal follow-up terbaru."
        ),
        due_at=lead.next_follow_up_at,
    )
    db.add(task)
    db.flush()
    return task
