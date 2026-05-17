from __future__ import annotations

from uuid import UUID

from sqlalchemy import desc, select
from sqlalchemy.orm import Session, selectinload

from app.models.lead import Lead
from app.models.lead_activity_event import LeadActivityEvent
from app.schemas.lead_schema import LeadActivityEventItem


def build_lead_activity_event_item(event: LeadActivityEvent) -> LeadActivityEventItem:
    return LeadActivityEventItem(
        id=event.id,
        lead_id=event.lead_id,
        organization_id=event.organization_id,
        actor_user_id=event.actor_user_id,
        actor_user_name=event.actor_user.name if event.actor_user else None,
        event_type=event.event_type,
        title=event.title,
        description=event.description,
        from_value=event.from_value,
        to_value=event.to_value,
        created_at=event.created_at,
    )


def create_lead_activity_event(
    db: Session,
    *,
    lead: Lead,
    event_type: str,
    title: str,
    description: str | None = None,
    actor_user_id: UUID | None = None,
    from_value: str | None = None,
    to_value: str | None = None,
) -> LeadActivityEvent:
    event = LeadActivityEvent(
        lead_id=lead.id,
        organization_id=lead.organization_id,
        actor_user_id=actor_user_id,
        event_type=event_type,
        title=title,
        description=description,
        from_value=from_value,
        to_value=to_value,
    )
    db.add(event)
    db.flush()
    return event


def list_lead_activity_events(*, db: Session, lead_id: UUID) -> list[LeadActivityEventItem]:
    statement = (
        select(LeadActivityEvent)
        .where(LeadActivityEvent.lead_id == lead_id)
        .options(selectinload(LeadActivityEvent.actor_user))
        .order_by(desc(LeadActivityEvent.created_at))
    )
    events = list(db.scalars(statement).all())
    return [build_lead_activity_event_item(event) for event in events]
