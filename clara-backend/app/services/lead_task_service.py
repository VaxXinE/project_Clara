from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.lead import Lead
from app.models.lead_task import LeadTask
from app.models.lead_task_event import LeadTaskEvent
from app.models.user import User
from app.schemas.lead_schema import (
    LeadQueueActionRequest,
    LeadTaskCreateRequest,
    LeadTaskEventItem,
    LeadTaskItem,
    LeadTaskUpdateRequest,
)
from app.services.access_control_service import (
    can_access_all_conversations,
    get_accessible_sales_user_ids,
)
from app.services.role_service import is_superadmin_like
from app.services.lead_activity_service import create_lead_activity_event

VALID_TASK_TYPES = {"manual_follow_up", "scheduled_follow_up", "approval_follow_up"}
VALID_TASK_STATUSES = {"open", "done", "snoozed", "cancelled"}
VALID_QUEUE_ACTIONS = {"done", "snooze", "dismiss", "reopen"}
VALID_SNOOZE_DURATIONS = {"30m", "2h", "tomorrow"}


def build_queue_reason_text(
    *,
    action: str,
    reason_tag: str,
    reason_note: str | None,
    duration: str | None = None,
) -> str:
    parts = [f"queue_action={action}", f"reason_tag={reason_tag.strip()}"]

    if duration:
        parts.append(f"duration={duration}")

    if reason_note and reason_note.strip():
        parts.append(f"reason_note={reason_note.strip()}")

    return " | ".join(parts)


def resolve_snooze_due_at(duration: str) -> datetime:
    now = datetime.now(timezone.utc)

    if duration == "30m":
        return now + timedelta(minutes=30)
    if duration == "2h":
        return now + timedelta(hours=2)
    if duration == "tomorrow":
        tomorrow = now + timedelta(days=1)
        return tomorrow.replace(hour=8, minute=0, second=0, microsecond=0)

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Invalid snooze duration.",
    )


def build_task_item(task: LeadTask) -> LeadTaskItem:
    return LeadTaskItem(
        id=task.id,
        lead_id=task.lead_id,
        organization_id=task.organization_id,
        assigned_user_id=task.assigned_user_id,
        assigned_user_name=task.assigned_user.name if task.assigned_user else None,
        completed_by_user_id=task.completed_by_user_id,
        completed_by_user_name=(
            task.completed_by_user.name if task.completed_by_user else None
        ),
        task_type=task.task_type,
        status=task.status,
        title=task.title,
        description=task.description,
        due_at=task.due_at,
        completed_at=task.completed_at,
        last_status_changed_at=task.last_status_changed_at,
        created_at=task.created_at,
        updated_at=task.updated_at,
    )


def build_task_event_item(event: LeadTaskEvent) -> LeadTaskEventItem:
    return LeadTaskEventItem(
        id=event.id,
        task_id=event.task_id,
        actor_user_id=event.actor_user_id,
        actor_user_name=event.actor_user.name if event.actor_user else None,
        event_type=event.event_type,
        from_status=event.from_status,
        to_status=event.to_status,
        previous_due_at=event.previous_due_at,
        next_due_at=event.next_due_at,
        notes=event.notes,
        created_at=event.created_at,
    )


def create_task_event(
    db: Session,
    *,
    task: LeadTask,
    event_type: str,
    actor_user_id: UUID | None = None,
    from_status: str | None = None,
    to_status: str | None = None,
    previous_due_at: datetime | None = None,
    next_due_at: datetime | None = None,
    notes: str | None = None,
) -> LeadTaskEvent:
    event = LeadTaskEvent(
        task_id=task.id,
        actor_user_id=actor_user_id,
        event_type=event_type,
        from_status=from_status,
        to_status=to_status,
        previous_due_at=previous_due_at,
        next_due_at=next_due_at,
        notes=notes,
    )
    db.add(event)
    db.flush()
    return event


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
            selectinload(Lead.tasks).selectinload(LeadTask.completed_by_user),
            selectinload(Lead.tasks).selectinload(LeadTask.events).selectinload(LeadTaskEvent.actor_user),
        )
    )
    lead = db.scalars(statement).first()

    if lead is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found.",
        )

    if (
        not is_superadmin_like(current_user.role)
        and (
            current_user.organization_id is None
            or lead.organization_id != current_user.organization_id
        )
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found.",
        )

    accessible_user_ids = get_accessible_sales_user_ids(
        db=db,
        current_user=current_user,
    )
    if accessible_user_ids is not None and lead.assigned_user_id not in accessible_user_ids:
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
        completed_by_user_id=None,
        task_type=payload.task_type,
        status="open",
        title=payload.title.strip(),
        description=payload.description.strip() if payload.description else None,
        due_at=payload.due_at,
    )
    db.add(task)
    db.flush()
    create_task_event(
        db=db,
        task=task,
        event_type="created",
        actor_user_id=current_user.id,
        to_status=task.status,
        next_due_at=task.due_at,
        notes="Task dibuat dari UI lead detail.",
    )
    create_lead_activity_event(
        db=db,
        lead=lead,
        event_type="task_event",
        title="Task manual dibuat",
        description=task.title,
        actor_user_id=current_user.id,
        to_value=task.status,
    )
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

    status_changed = False
    due_changed = False
    assignee_changed = False
    note_messages: list[str] = []
    previous_status = task.status
    previous_due_at = task.due_at
    previous_assigned_user_id = task.assigned_user_id

    if payload.status is not None:
        if payload.status not in VALID_TASK_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid task status.",
            )
        if payload.status != task.status:
            status_changed = True
            task.status = payload.status
            task.last_status_changed_at = datetime.now(timezone.utc)
        if payload.status == "done":
            task.completed_at = datetime.now(timezone.utc)
            task.completed_by_user_id = current_user.id
        else:
            task.completed_at = None
            task.completed_by_user_id = None

    if payload.title is not None:
        task.title = payload.title.strip() or task.title

    if payload.description is not None:
        task.description = payload.description.strip() or None

    if "due_at" in payload.model_fields_set:
        due_changed = task.due_at != payload.due_at
        task.due_at = payload.due_at
        if due_changed and not status_changed:
            task.last_status_changed_at = datetime.now(timezone.utc)

    if "assigned_user_id" in payload.model_fields_set:
        if (
            payload.assigned_user_id is not None
            and not can_access_all_conversations(current_user)
            and payload.assigned_user_id != current_user.id
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only head can reassign tasks.",
            )

        assignee = validate_assignee_for_lead(
            db=db,
            lead=lead,
            assignee_id=payload.assigned_user_id,
        )
        task.assigned_user_id = assignee.id if assignee else None
        assignee_changed = previous_assigned_user_id != task.assigned_user_id

    if payload.notes is not None and payload.notes.strip():
        note_messages.append(payload.notes.strip())

    db.add(task)
    db.flush()

    if status_changed:
        create_task_event(
            db=db,
            task=task,
            event_type="status_changed",
            actor_user_id=current_user.id,
            from_status=previous_status,
            to_status=task.status,
            previous_due_at=previous_due_at,
            next_due_at=task.due_at,
            notes=" ; ".join(note_messages) if note_messages else None,
        )
    elif due_changed:
        create_task_event(
            db=db,
            task=task,
            event_type="rescheduled",
            actor_user_id=current_user.id,
            from_status=task.status,
            to_status=task.status,
            previous_due_at=previous_due_at,
            next_due_at=task.due_at,
            notes=" ; ".join(note_messages) if note_messages else None,
        )

    if assignee_changed:
        create_task_event(
            db=db,
            task=task,
            event_type="reassigned",
            actor_user_id=current_user.id,
            from_status=task.status,
            to_status=task.status,
            previous_due_at=task.due_at,
            next_due_at=task.due_at,
            notes="Assignee task diperbarui.",
        )

    activity_title = "Task follow-up diperbarui"
    if status_changed and task.status == "done":
        activity_title = "Task follow-up selesai"
    elif status_changed and task.status == "snoozed":
        activity_title = "Task follow-up di-snooze"
    elif status_changed and task.status == "open":
        activity_title = "Task follow-up dibuka lagi"
    elif due_changed:
        activity_title = "Jadwal task follow-up diperbarui"
    elif assignee_changed:
        activity_title = "PIC task follow-up diperbarui"

    if status_changed or due_changed or assignee_changed:
        create_lead_activity_event(
            db=db,
            lead=lead,
            event_type="task_event",
            title=activity_title,
            description=payload.notes or task.title,
            actor_user_id=current_user.id,
            from_value=previous_status if status_changed else None,
            to_value=task.status,
        )

    db.commit()
    db.refresh(task)
    return build_task_item(task)


def get_lead_task_events_for_user(
    db: Session,
    *,
    lead_id: UUID,
    task_id: UUID,
    current_user: User,
) -> list[LeadTaskEventItem]:
    lead = get_accessible_lead(db=db, lead_id=lead_id, current_user=current_user)
    task = next((item for item in lead.tasks if item.id == task_id), None)

    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found.",
        )

    statement = (
        select(LeadTaskEvent)
        .where(LeadTaskEvent.task_id == task.id)
        .options(selectinload(LeadTaskEvent.actor_user))
        .order_by(LeadTaskEvent.created_at.desc())
    )
    return [build_task_event_item(event) for event in db.scalars(statement).all()]


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
            previous_status = existing_task.status
            existing_task.status = "cancelled"
            existing_task.completed_at = None
            existing_task.completed_by_user_id = None
            existing_task.last_status_changed_at = datetime.now(timezone.utc)
            db.add(existing_task)
            db.flush()
            create_task_event(
                db=db,
                task=existing_task,
                event_type="system_sync",
                from_status=previous_status,
                to_status="cancelled",
                previous_due_at=existing_task.due_at,
                next_due_at=None,
                notes="Task follow-up dibatalkan karena lead tidak lagi punya jadwal follow-up.",
            )
            create_lead_activity_event(
                db=db,
                lead=lead,
                event_type="task_event",
                title="Task follow-up otomatis dibatalkan",
                description="Next follow-up lead dihapus sehingga task dijadikan cancelled.",
                from_value=previous_status,
                to_value="cancelled",
            )
        return existing_task

    if existing_task is not None:
        previous_status = existing_task.status
        previous_due_at = existing_task.due_at
        existing_task.status = "open"
        existing_task.title = "Follow up lead"
        existing_task.description = (
            f"Tindak lanjuti lead {lead.display_name} sesuai jadwal follow-up terbaru."
        )
        existing_task.due_at = lead.next_follow_up_at
        existing_task.completed_at = None
        existing_task.completed_by_user_id = None
        existing_task.assigned_user_id = lead.assigned_user_id
        existing_task.last_status_changed_at = datetime.now(timezone.utc)
        db.add(existing_task)
        db.flush()
        create_task_event(
            db=db,
            task=existing_task,
            event_type="system_sync",
            from_status=previous_status,
            to_status="open",
            previous_due_at=previous_due_at,
            next_due_at=existing_task.due_at,
            notes="Task follow-up disinkronkan dari perubahan next follow-up lead.",
        )
        create_lead_activity_event(
            db=db,
            lead=lead,
            event_type="task_event",
            title="Task follow-up disinkronkan",
            description="Jadwal follow-up task diperbarui mengikuti lead.",
            from_value=previous_due_at.isoformat() if previous_due_at else None,
            to_value=existing_task.due_at.isoformat() if existing_task.due_at else None,
        )
        return existing_task

    task = LeadTask(
        lead_id=lead.id,
        organization_id=lead.organization_id,
        assigned_user_id=lead.assigned_user_id,
        completed_by_user_id=None,
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
    create_task_event(
        db=db,
        task=task,
        event_type="system_sync",
        to_status="open",
        next_due_at=task.due_at,
        notes="Task follow-up otomatis dibuat dari next follow-up lead.",
    )
    create_lead_activity_event(
        db=db,
        lead=lead,
        event_type="task_event",
        title="Task follow-up otomatis dibuat",
        description="Clara membuat task follow-up dari jadwal lead.",
        to_value="open",
    )
    return task


def ensure_queue_task_for_lead(
    db: Session,
    *,
    lead: Lead,
) -> LeadTask:
    statement = (
        select(LeadTask)
        .where(
            LeadTask.lead_id == lead.id,
            LeadTask.status.in_({"open", "snoozed"}),
        )
        .order_by(LeadTask.created_at.desc())
    )
    existing_task = db.scalars(statement).first()

    if existing_task is not None:
        return existing_task

    due_at = lead.next_follow_up_at or datetime.now(timezone.utc)
    task = LeadTask(
        lead_id=lead.id,
        organization_id=lead.organization_id,
        assigned_user_id=lead.assigned_user_id,
        completed_by_user_id=None,
        task_type="scheduled_follow_up",
        status="open",
        title="Queue follow up",
        description=(
            f"Task queue otomatis untuk lead {lead.display_name} agar lifecycle action tetap tercatat."
        ),
        due_at=due_at,
    )
    db.add(task)
    db.flush()
    create_task_event(
        db=db,
        task=task,
        event_type="queue_created",
        to_status="open",
        next_due_at=task.due_at,
        notes="Task queue otomatis dibuat saat lead pertama kali dieksekusi dari action center.",
    )
    create_lead_activity_event(
        db=db,
        lead=lead,
        event_type="queue_event",
        title="Queue task otomatis dibuat",
        description="Lead mulai dikelola lewat action center sehingga task queue dipersist ke sistem.",
        to_value="open",
    )
    return task


def execute_queue_action_for_user(
    db: Session,
    *,
    lead_id: UUID,
    payload: LeadQueueActionRequest,
    current_user: User,
) -> LeadTaskItem:
    lead = get_accessible_lead(db=db, lead_id=lead_id, current_user=current_user)
    action = payload.action.strip().lower()

    if action not in VALID_QUEUE_ACTIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid queue action.",
        )

    reason_tag = payload.reason_tag.strip()
    if not reason_tag:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="reason_tag is required.",
        )

    task = ensure_queue_task_for_lead(db=db, lead=lead)
    previous_status = task.status
    previous_due_at = task.due_at
    note_text = build_queue_reason_text(
        action=action,
        reason_tag=reason_tag,
        reason_note=payload.reason_note,
        duration=payload.duration,
    )

    if action == "done":
        task.status = "done"
        task.completed_at = datetime.now(timezone.utc)
        task.completed_by_user_id = current_user.id
        task.last_status_changed_at = datetime.now(timezone.utc)
        event_type = "queue_action_done"
        activity_title = "Queue action: done"
    elif action == "dismiss":
        task.status = "cancelled"
        task.completed_at = None
        task.completed_by_user_id = None
        task.last_status_changed_at = datetime.now(timezone.utc)
        event_type = "queue_action_dismiss"
        activity_title = "Queue action: dismiss"
    elif action == "reopen":
        task.status = "open"
        task.completed_at = None
        task.completed_by_user_id = None
        task.last_status_changed_at = datetime.now(timezone.utc)
        event_type = "queue_action_reopen"
        activity_title = "Queue action: reopen"
    else:
        duration = (payload.duration or "").strip().lower()
        if duration not in VALID_SNOOZE_DURATIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="duration is required for snooze.",
            )
        task.status = "snoozed"
        task.due_at = resolve_snooze_due_at(duration)
        task.completed_at = None
        task.completed_by_user_id = None
        task.last_status_changed_at = datetime.now(timezone.utc)
        event_type = "queue_action_snooze"
        activity_title = "Queue action: snooze"

    db.add(task)
    db.flush()
    create_task_event(
        db=db,
        task=task,
        event_type=event_type,
        actor_user_id=current_user.id,
        from_status=previous_status,
        to_status=task.status,
        previous_due_at=previous_due_at,
        next_due_at=task.due_at,
        notes=note_text,
    )
    create_lead_activity_event(
        db=db,
        lead=lead,
        event_type="queue_event",
        title=activity_title,
        description=note_text,
        actor_user_id=current_user.id,
        from_value=previous_status,
        to_value=task.status,
    )
    db.commit()
    db.refresh(task)
    return build_task_item(task)
