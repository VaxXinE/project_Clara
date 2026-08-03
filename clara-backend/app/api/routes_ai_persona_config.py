from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.core.clara_runtime_contract import (
    PersonaAuthorityMode,
    normalize_persona_authority_mode,
)
from app.core.config import settings
from app.db.session import get_db
from app.models.ai_persona_config_version import AIPersonaConfigVersion
from app.models.user import User
from app.schemas.ai_persona_config_schema import (
    AIPersonaBundleArchiveRequest,
    AIPersonaBundleCreateRequest,
    AIPersonaBundleDiffRequest,
    AIPersonaBundleDiffResponse,
    AIPersonaBundleEffectiveResponse,
    AIPersonaBundlePreviewResponse,
    AIPersonaBundlePublishRequest,
    AIPersonaBundleResponse,
    AIPersonaBundleSectionUpdateRequest,
    AIPersonaBundleValidationResponse,
    AIPersonaConfigVersionResponse,
    AIPersonaDraftCreateRequest,
    AIPersonaEffectiveSectionResponse,
    AIPersonaSectionKey,
    AIPersonaVariant,
)
from app.services.ai_persona_bundle_service import (
    AIPersonaBundleError,
    clone_bundle,
    create_bundle_draft,
    diff_bundles,
    dispose_bundle,
    get_bundle_or_raise,
    get_published_bundle,
    import_current_effective_bundle,
    list_bundles,
    preview_bundle,
    publish_bundle,
    replace_bundle_section,
    rollback_bundle,
    serialize_bundle,
    validate_bundle,
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


def _handle_bundle_error(exc: AIPersonaBundleError) -> HTTPException:
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


@router.get("/bundles", response_model=list[AIPersonaBundleResponse])
def list_bundles_endpoint(
    variant: AIPersonaVariant = Query(default="mini"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("superadmin")),
):
    return [serialize_bundle(bundle) for bundle in list_bundles(db, variant=variant)]


@router.get(
    "/bundles/effective/current",
    response_model=AIPersonaBundleEffectiveResponse,
)
def current_effective_bundle_endpoint(
    variant: AIPersonaVariant = Query(default="mini"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("superadmin")),
):
    bundle = get_published_bundle(db, variant=variant)
    authority_mode = normalize_persona_authority_mode(
        settings.clara_persona_authority_mode
    ).canonical_value
    return {
        "bundle": serialize_bundle(bundle) if bundle else None,
        "effective_source": (
            "DATABASE_PUBLISHED_BUNDLE"
            if bundle
            else "DATABASE_PUBLISHED_SECTION_LEGACY_OR_MARKDOWN_FALLBACK"
        ),
        "fallback_reason": None if bundle else "NO_PUBLISHED_BUNDLE",
        "persona_authority_mode": authority_mode,
        "legacy_overlay_present": authority_mode == PersonaAuthorityMode.LEGACY,
    }


@router.get("/bundles/{bundle_id}", response_model=AIPersonaBundleResponse)
def get_bundle_endpoint(
    bundle_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("superadmin")),
):
    try:
        return serialize_bundle(get_bundle_or_raise(db, bundle_id))
    except AIPersonaBundleError as exc:
        raise _handle_bundle_error(exc) from exc


@router.post(
    "/bundles",
    response_model=AIPersonaBundleResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_bundle_endpoint(
    payload: AIPersonaBundleCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("superadmin")),
):
    try:
        bundle = create_bundle_draft(
            db,
            current_user=current_user,
            variant=payload.variant,
            section_version_ids=payload.section_version_ids,
        )
    except AIPersonaBundleError as exc:
        raise _handle_bundle_error(exc) from exc
    create_audit_log(
        db=db,
        action="ai_persona_bundle.draft.create",
        resource_type="ai_persona_bundle",
        resource_id=str(bundle.id),
        current_user=current_user,
        request=request,
        metadata={"variant": bundle.variant, "bundle_version": bundle.bundle_version},
    )
    return serialize_bundle(bundle)


@router.post(
    "/bundles/import-current",
    response_model=AIPersonaBundleResponse,
    status_code=status.HTTP_201_CREATED,
)
def import_current_bundle_endpoint(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("superadmin")),
):
    try:
        bundle = import_current_effective_bundle(db, current_user=current_user)
    except AIPersonaBundleError as exc:
        raise _handle_bundle_error(exc) from exc
    create_audit_log(
        db=db,
        action="ai_persona_bundle.import_current",
        resource_type="ai_persona_bundle",
        resource_id=str(bundle.id),
        current_user=current_user,
        request=request,
        metadata={"bundle_version": bundle.bundle_version},
    )
    return serialize_bundle(bundle)


@router.put(
    "/bundles/{bundle_id}/sections/{section_key}",
    response_model=AIPersonaBundleResponse,
)
def update_bundle_section_endpoint(
    bundle_id: UUID,
    section_key: AIPersonaSectionKey,
    payload: AIPersonaBundleSectionUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("superadmin")),
):
    try:
        bundle = replace_bundle_section(
            db,
            bundle_id=bundle_id,
            section_key=section_key,
            version_id=payload.persona_config_version_id,
        )
    except AIPersonaBundleError as exc:
        raise _handle_bundle_error(exc) from exc
    create_audit_log(
        db=db,
        action="ai_persona_bundle.section.select",
        resource_type="ai_persona_bundle",
        resource_id=str(bundle.id),
        current_user=current_user,
        request=request,
        metadata={
            "section_key": section_key,
            "version_id": str(payload.persona_config_version_id),
        },
    )
    return serialize_bundle(bundle)


@router.post(
    "/bundles/{bundle_id}/clone",
    response_model=AIPersonaBundleResponse,
    status_code=status.HTTP_201_CREATED,
)
def clone_bundle_endpoint(
    bundle_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("superadmin")),
):
    try:
        bundle = clone_bundle(db, bundle_id=bundle_id, current_user=current_user)
    except AIPersonaBundleError as exc:
        raise _handle_bundle_error(exc) from exc
    create_audit_log(
        db=db,
        action="ai_persona_bundle.clone",
        resource_type="ai_persona_bundle",
        resource_id=str(bundle.id),
        current_user=current_user,
        request=request,
        metadata={"source_bundle_id": str(bundle_id)},
    )
    return serialize_bundle(bundle)


@router.post(
    "/bundles/{bundle_id}/validate",
    response_model=AIPersonaBundleValidationResponse,
)
def validate_bundle_endpoint(
    bundle_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("superadmin")),
):
    try:
        report = validate_bundle(db, bundle_id=bundle_id, current_user=current_user)
    except AIPersonaBundleError as exc:
        raise _handle_bundle_error(exc) from exc
    create_audit_log(
        db=db,
        action="ai_persona_bundle.validate",
        resource_type="ai_persona_bundle",
        resource_id=str(bundle_id),
        current_user=current_user,
        request=request,
        metadata={
            "bundle_sha256": report.bundle_hash,
            "validation_report_hash": report.validation_report_hash,
            "blocking_error_count": len(report.blocking_errors),
            "warning_codes": sorted({item["code"] for item in report.warnings}),
        },
    )
    return report.as_dict()


@router.get(
    "/bundles/{bundle_id}/preview",
    response_model=AIPersonaBundlePreviewResponse,
)
def preview_bundle_endpoint(
    bundle_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("superadmin")),
):
    try:
        return preview_bundle(db, bundle_id=bundle_id)
    except AIPersonaBundleError as exc:
        raise _handle_bundle_error(exc) from exc


@router.post("/bundles/diff", response_model=AIPersonaBundleDiffResponse)
def diff_bundle_endpoint(
    payload: AIPersonaBundleDiffRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("superadmin")),
):
    try:
        result = diff_bundles(
            db,
            new_bundle_id=payload.new_bundle_id,
            old_bundle_id=payload.old_bundle_id,
        )
    except AIPersonaBundleError as exc:
        raise _handle_bundle_error(exc) from exc
    create_audit_log(
        db=db,
        action="ai_persona_bundle.diff",
        resource_type="ai_persona_bundle",
        resource_id=str(payload.new_bundle_id),
        current_user=current_user,
        request=request,
        metadata={
            "old_bundle_id": str(result["old_bundle_id"]) if result["old_bundle_id"] else None,
            "new_bundle_id": str(result["new_bundle_id"]),
            "old_bundle_hash": result["old_bundle_hash"],
            "new_bundle_hash": result["new_bundle_hash"],
            "changed_section_keys": result["changed_section_keys"],
            "section_counts": {
                item["section_key"]: {
                    "added": item["added_lines"],
                    "removed": item["removed_lines"],
                    "unchanged": item["unchanged_lines"],
                }
                for item in result["sections"]
            },
        },
    )
    return result


@router.post(
    "/bundles/{bundle_id}/publish",
    response_model=AIPersonaBundleResponse,
)
def publish_bundle_endpoint(
    bundle_id: UUID,
    payload: AIPersonaBundlePublishRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("superadmin")),
):
    try:
        bundle = publish_bundle(
            db,
            bundle_id=bundle_id,
            current_user=current_user,
            expected_current_bundle_hash=payload.expected_current_bundle_hash,
            acknowledged_warning_codes=payload.acknowledged_warning_codes,
        )
    except AIPersonaBundleError as exc:
        raise _handle_bundle_error(exc) from exc
    return serialize_bundle(bundle)


@router.post(
    "/bundles/{bundle_id}/rollback",
    response_model=AIPersonaBundleResponse,
    status_code=status.HTTP_201_CREATED,
)
def rollback_bundle_endpoint(
    bundle_id: UUID,
    payload: AIPersonaBundlePublishRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("superadmin")),
):
    try:
        bundle = rollback_bundle(
            db,
            source_bundle_id=bundle_id,
            current_user=current_user,
            expected_current_bundle_hash=payload.expected_current_bundle_hash,
            acknowledged_warning_codes=payload.acknowledged_warning_codes,
        )
    except AIPersonaBundleError as exc:
        raise _handle_bundle_error(exc) from exc
    return serialize_bundle(bundle)


@router.post(
    "/bundles/{bundle_id}/dispose",
    response_model=AIPersonaBundleResponse,
)
def dispose_bundle_endpoint(
    bundle_id: UUID,
    payload: AIPersonaBundleArchiveRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("superadmin")),
):
    try:
        bundle = dispose_bundle(
            db, bundle_id=bundle_id, disposition=payload.disposition
        )
    except AIPersonaBundleError as exc:
        raise _handle_bundle_error(exc) from exc
    create_audit_log(
        db=db,
        action=f"ai_persona_bundle.{payload.disposition}",
        resource_type="ai_persona_bundle",
        resource_id=str(bundle.id),
        current_user=current_user,
        request=request,
        metadata={"bundle_version": bundle.bundle_version},
    )
    return serialize_bundle(bundle)
