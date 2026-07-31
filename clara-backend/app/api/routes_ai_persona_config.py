from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.db.session import get_db
from app.models.ai_persona_config_version import AIPersonaConfigVersion
from app.models.user import User
from app.schemas.ai_persona_config_schema import (
    AIPersonaConfigVersionResponse,
    AIPersonaDraftCreateRequest,
    AIPersonaEffectiveSectionResponse,
    AIPersonaSectionKey,
    AIPersonaVariant,
)
from app.services.ai_persona_config_service import (
    AIPersonaConfigError,
    create_persona_draft,
    list_persona_versions,
    publish_persona_version,
    rollback_persona_version,
)
from app.services.audit_service import create_audit_log
from app.services.clara_playbook_service import load_effective_persona_sections

router = APIRouter(prefix="/ai-persona-config", tags=["ai-persona-config"])


def _handle_persona_error(exc: AIPersonaConfigError) -> HTTPException:
    status_code = (
        status.HTTP_404_NOT_FOUND
        if "not found" in str(exc).lower()
        else status.HTTP_409_CONFLICT
    )
    return HTTPException(status_code=status_code, detail=str(exc))


def _audit_metadata(entry: AIPersonaConfigVersion) -> dict:
    return {
        "variant": entry.variant,
        "section_key": entry.section_key,
        "version_number": entry.version_number,
        "content_sha256": entry.content_sha256,
    }


@router.get(
    "/effective",
    response_model=list[AIPersonaEffectiveSectionResponse],
)
def get_effective_persona_endpoint(
    variant: AIPersonaVariant = Query(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("superadmin")),
):
    return load_effective_persona_sections(db, variant)


@router.get("", response_model=list[AIPersonaConfigVersionResponse])
def list_persona_versions_endpoint(
    variant: AIPersonaVariant | None = Query(default=None),
    section_key: AIPersonaSectionKey | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("superadmin")),
):
    return list_persona_versions(
        db,
        variant=variant,
        section_key=section_key,
    )


@router.post(
    "/{variant}/{section_key}/drafts",
    response_model=AIPersonaConfigVersionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_persona_draft_endpoint(
    variant: AIPersonaVariant,
    section_key: AIPersonaSectionKey,
    payload: AIPersonaDraftCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("superadmin")),
):
    try:
        entry = create_persona_draft(
            db,
            variant=variant,
            section_key=section_key,
            payload=payload,
            current_user=current_user,
        )
    except AIPersonaConfigError as exc:
        raise _handle_persona_error(exc) from exc
    create_audit_log(
        db=db,
        action="ai_persona_config.draft.create",
        resource_type="ai_persona_config_version",
        resource_id=str(entry.id),
        current_user=current_user,
        request=request,
        metadata=_audit_metadata(entry),
    )
    return entry


@router.post(
    "/versions/{version_id}/publish",
    response_model=AIPersonaConfigVersionResponse,
)
def publish_persona_version_endpoint(
    version_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("superadmin")),
):
    try:
        entry = publish_persona_version(
            db,
            version_id=version_id,
            current_user=current_user,
        )
    except AIPersonaConfigError as exc:
        raise _handle_persona_error(exc) from exc
    create_audit_log(
        db=db,
        action="ai_persona_config.publish",
        resource_type="ai_persona_config_version",
        resource_id=str(entry.id),
        current_user=current_user,
        request=request,
        metadata=_audit_metadata(entry),
    )
    return entry


@router.post(
    "/versions/{version_id}/rollback",
    response_model=AIPersonaConfigVersionResponse,
    status_code=status.HTTP_201_CREATED,
)
def rollback_persona_version_endpoint(
    version_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("superadmin")),
):
    try:
        entry = rollback_persona_version(
            db,
            version_id=version_id,
            current_user=current_user,
        )
    except AIPersonaConfigError as exc:
        raise _handle_persona_error(exc) from exc
    metadata = _audit_metadata(entry)
    metadata["source_version_id"] = (
        str(entry.source_version_id) if entry.source_version_id else None
    )
    create_audit_log(
        db=db,
        action="ai_persona_config.rollback",
        resource_type="ai_persona_config_version",
        resource_id=str(entry.id),
        current_user=current_user,
        request=request,
        metadata=metadata,
    )
    return entry
