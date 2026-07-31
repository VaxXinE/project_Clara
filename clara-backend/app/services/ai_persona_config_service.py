from datetime import datetime, timezone
from hashlib import sha256
from uuid import UUID

from sqlalchemy import desc, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.ai_persona_config_version import AIPersonaConfigVersion
from app.models.user import User
from app.schemas.ai_persona_config_schema import (
    AIPersonaDraftCreateRequest,
    AIPersonaSectionKey,
    AIPersonaVariant,
)


class AIPersonaConfigError(RuntimeError):
    pass


def list_persona_versions(
    db: Session,
    *,
    variant: AIPersonaVariant | None = None,
    section_key: AIPersonaSectionKey | None = None,
) -> list[AIPersonaConfigVersion]:
    statement = select(AIPersonaConfigVersion)
    if variant:
        statement = statement.where(AIPersonaConfigVersion.variant == variant)
    if section_key:
        statement = statement.where(
            AIPersonaConfigVersion.section_key == section_key
        )
    statement = statement.order_by(
        AIPersonaConfigVersion.variant,
        AIPersonaConfigVersion.section_key,
        desc(AIPersonaConfigVersion.version_number),
    )
    return list(db.scalars(statement).all())


def get_persona_version_or_raise(
    db: Session,
    version_id: UUID,
    *,
    for_update: bool = False,
) -> AIPersonaConfigVersion:
    statement = select(AIPersonaConfigVersion).where(
        AIPersonaConfigVersion.id == version_id
    )
    if for_update:
        statement = statement.with_for_update()
    entry = db.scalars(statement).first()
    if entry is None:
        raise AIPersonaConfigError("Persona config version not found.")
    return entry


def _next_version_number(
    db: Session,
    *,
    variant: AIPersonaVariant,
    section_key: AIPersonaSectionKey,
) -> int:
    latest = db.scalar(
        select(func.max(AIPersonaConfigVersion.version_number)).where(
            AIPersonaConfigVersion.variant == variant,
            AIPersonaConfigVersion.section_key == section_key,
        )
    )
    return int(latest or 0) + 1


def create_persona_draft(
    db: Session,
    *,
    variant: AIPersonaVariant,
    section_key: AIPersonaSectionKey,
    payload: AIPersonaDraftCreateRequest,
    current_user: User,
) -> AIPersonaConfigVersion:
    content = payload.content.strip()
    if not content:
        raise AIPersonaConfigError("Persona content cannot be blank.")
    content_sha256 = sha256(content.encode("utf-8")).hexdigest()
    existing_draft = db.scalars(
        select(AIPersonaConfigVersion)
        .where(
            AIPersonaConfigVersion.variant == variant,
            AIPersonaConfigVersion.section_key == section_key,
            AIPersonaConfigVersion.status == "draft",
            AIPersonaConfigVersion.content_sha256 == content_sha256,
        )
        .order_by(desc(AIPersonaConfigVersion.version_number))
    ).first()
    if existing_draft:
        return existing_draft

    entry = AIPersonaConfigVersion(
        variant=variant,
        section_key=section_key,
        version_number=_next_version_number(
            db,
            variant=variant,
            section_key=section_key,
        ),
        status="draft",
        content=content,
        content_sha256=content_sha256,
        created_by_user_id=current_user.id,
    )
    db.add(entry)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise AIPersonaConfigError(
            "Persona draft changed concurrently. Reload and try again."
        ) from exc
    db.refresh(entry)
    return entry


def _archive_current_published(
    db: Session,
    *,
    variant: str,
    section_key: str,
    exclude_id: UUID | None = None,
) -> None:
    statement = (
        select(AIPersonaConfigVersion)
        .where(
            AIPersonaConfigVersion.variant == variant,
            AIPersonaConfigVersion.section_key == section_key,
            AIPersonaConfigVersion.status == "published",
        )
        .with_for_update()
    )
    if exclude_id:
        statement = statement.where(AIPersonaConfigVersion.id != exclude_id)
    for entry in db.scalars(statement).all():
        entry.status = "archived"


def publish_persona_version(
    db: Session,
    *,
    version_id: UUID,
    current_user: User,
) -> AIPersonaConfigVersion:
    entry = get_persona_version_or_raise(db, version_id, for_update=True)
    if entry.status == "published":
        return entry

    _archive_current_published(
        db,
        variant=entry.variant,
        section_key=entry.section_key,
        exclude_id=entry.id,
    )
    try:
        db.flush()
        entry.status = "published"
        entry.published_by_user_id = current_user.id
        entry.published_at = datetime.now(timezone.utc)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise AIPersonaConfigError(
            "Persona publish conflicted with another request. Reload and try again."
        ) from exc
    db.refresh(entry)
    return entry


def rollback_persona_version(
    db: Session,
    *,
    version_id: UUID,
    current_user: User,
) -> AIPersonaConfigVersion:
    source = get_persona_version_or_raise(db, version_id, for_update=True)
    if source.status == "published":
        return source

    _archive_current_published(
        db,
        variant=source.variant,
        section_key=source.section_key,
    )
    entry = AIPersonaConfigVersion(
        variant=source.variant,
        section_key=source.section_key,
        version_number=_next_version_number(
            db,
            variant=source.variant,
            section_key=source.section_key,
        ),
        status="published",
        content=source.content,
        content_sha256=source.content_sha256,
        created_by_user_id=current_user.id,
        published_by_user_id=current_user.id,
        source_version_id=source.id,
        published_at=datetime.now(timezone.utc),
    )
    try:
        db.flush()
        db.add(entry)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise AIPersonaConfigError(
            "Persona rollback conflicted with another request. Reload and try again."
        ) from exc
    db.refresh(entry)
    return entry
