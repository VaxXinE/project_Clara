from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from difflib import unified_diff
from hashlib import sha256
import json
import re
from uuid import UUID

from sqlalchemy import desc, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.core.clara_runtime_contract import (
    PersonaAuthorityMode,
    normalize_persona_authority_mode,
)
from app.core.config import settings
from app.models.ai_persona_bundle import AIPersonaBundle, AIPersonaBundleSection
from app.models.ai_persona_config_version import AIPersonaConfigVersion
from app.models.user import User
from app.services.audit_service import add_audit_log


CLARA_PERSONA_BUNDLE_CONTRACT_VERSION = "1.0"
RUNTIME_SECTION_ORDER = (
    "instruction",
    "guardrail",
    "flow",
    "personality_mode",
    "auto_adapt",
)
ROADMAP_REVIEW_ORDER = (
    "guardrail",
    "instruction",
    "flow",
    "personality_mode",
    "auto_adapt",
)
MAX_SECTION_CHARACTERS = 50_000
MAX_DIFF_CHARACTERS = 100_000


class AIPersonaBundleError(RuntimeError):
    pass


@dataclass(frozen=True)
class BundleValidationResult:
    bundle_id: UUID
    variant: str
    complete: bool
    section_results: list[dict]
    blocking_errors: list[dict]
    warnings: list[dict]
    bundle_hash: str
    current_effective_bundle_hash: str | None
    changed_section_keys: list[str]
    unchanged_section_keys: list[str]
    validation_contract_version: str
    validation_report_hash: str
    validated_at: datetime

    def as_dict(self) -> dict:
        return asdict(self)


def _canonical_json_hash(payload: object) -> str:
    encoded = json.dumps(
        payload, sort_keys=True, separators=(",", ":"), default=str
    ).encode("utf-8")
    return sha256(encoded).hexdigest()


def _bundle_hash(bundle: AIPersonaBundle) -> str:
    sections = {section.section_key: section for section in bundle.sections}
    payload = {
        "contract_version": CLARA_PERSONA_BUNDLE_CONTRACT_VERSION,
        "variant": bundle.variant,
        "sections": [
            {
                "section_key": key,
                "version_id": str(sections[key].persona_config_version_id),
                "content_sha256": sections[key].content_sha256,
            }
            for key in RUNTIME_SECTION_ORDER
            if key in sections
        ],
    }
    return _canonical_json_hash(payload)


def _bundle_query():
    return select(AIPersonaBundle).options(
        selectinload(AIPersonaBundle.sections).selectinload(
            AIPersonaBundleSection.persona_config_version
        )
    )


def get_bundle_or_raise(
    db: Session, bundle_id: UUID, *, for_update: bool = False
) -> AIPersonaBundle:
    statement = _bundle_query().where(AIPersonaBundle.id == bundle_id)
    if for_update:
        statement = statement.with_for_update()
    bundle = db.scalars(statement).first()
    if bundle is None:
        raise AIPersonaBundleError("Persona bundle not found.")
    return bundle


def list_bundles(db: Session, *, variant: str = "mini") -> list[AIPersonaBundle]:
    return list(
        db.scalars(
            _bundle_query()
            .where(AIPersonaBundle.variant == variant)
            .order_by(desc(AIPersonaBundle.bundle_version))
        ).all()
    )


def get_published_bundle(
    db: Session, *, variant: str = "mini", for_update: bool = False
) -> AIPersonaBundle | None:
    statement = _bundle_query().where(
        AIPersonaBundle.variant == variant,
        AIPersonaBundle.status == "published",
    )
    if for_update:
        statement = statement.with_for_update()
    return db.scalars(statement).first()


def _next_bundle_version(db: Session, variant: str) -> int:
    value = db.scalar(
        select(func.max(AIPersonaBundle.bundle_version)).where(
            AIPersonaBundle.variant == variant
        )
    )
    return int(value or 0) + 1


def _next_section_version(db: Session, variant: str, section_key: str) -> int:
    value = db.scalar(
        select(func.max(AIPersonaConfigVersion.version_number)).where(
            AIPersonaConfigVersion.variant == variant,
            AIPersonaConfigVersion.section_key == section_key,
        )
    )
    return int(value or 0) + 1


def _assert_mutable(bundle: AIPersonaBundle) -> None:
    if bundle.status != "draft":
        raise AIPersonaBundleError("Only a draft bundle can be changed.")


def _attach_version(
    bundle: AIPersonaBundle,
    version: AIPersonaConfigVersion,
    *,
    source_type: str,
    source_identifier: str | None,
) -> None:
    if version.variant != bundle.variant:
        raise AIPersonaBundleError("Section version belongs to the wrong variant.")
    if version.section_key not in RUNTIME_SECTION_ORDER:
        raise AIPersonaBundleError("Unsupported persona section key.")
    existing = next(
        (item for item in bundle.sections if item.section_key == version.section_key),
        None,
    )
    if existing:
        bundle.sections.remove(existing)
    content = version.content.strip()
    bundle.sections.append(
        AIPersonaBundleSection(
            section_key=version.section_key,
            persona_config_version=version,
            position=RUNTIME_SECTION_ORDER.index(version.section_key) + 1,
            content_sha256=version.content_sha256,
            character_count=len(content),
            source_type=source_type,
            source_identifier=source_identifier,
        )
    )
    bundle.validation_status = "pending"
    bundle.validation_report = {}
    bundle.validation_report_hash = None
    bundle.validation_contract_version = None
    bundle.bundle_sha256 = None


def create_bundle_draft(
    db: Session,
    *,
    current_user: User,
    variant: str = "mini",
    section_version_ids: dict[str, UUID] | None = None,
    source_type: str = "manual",
    source_bundle_id: UUID | None = None,
    commit: bool = True,
) -> AIPersonaBundle:
    if variant != "mini":
        raise AIPersonaBundleError("Tahap 7 bundle workspace supports Mini only.")
    bundle = AIPersonaBundle(
        variant=variant,
        bundle_version=_next_bundle_version(db, variant),
        status="draft",
        source_type=source_type,
        source_bundle_id=source_bundle_id,
        validation_status="pending",
        created_by_user_id=current_user.id,
    )
    db.add(bundle)
    db.flush()
    for section_key, version_id in (section_version_ids or {}).items():
        version = db.get(AIPersonaConfigVersion, version_id)
        if version is None or version.section_key != section_key:
            raise AIPersonaBundleError("Broken bundle section reference.")
        _attach_version(
            bundle,
            version,
            source_type="DATABASE_VERSION",
            source_identifier=f"ai_persona_config_versions:{version.id}",
        )
    if commit:
        db.commit()
        db.refresh(bundle)
    return bundle


def import_current_effective_bundle(
    db: Session, *, current_user: User
) -> AIPersonaBundle:
    from app.services.clara_playbook_service import load_effective_system_sections

    bundle = create_bundle_draft(
        db,
        current_user=current_user,
        source_type="import_current_effective",
        commit=False,
    )
    effective = load_effective_system_sections(db, "mini")
    if len(effective) != len(RUNTIME_SECTION_ORDER):
        db.rollback()
        raise AIPersonaBundleError("Current effective Mini source is incomplete.")
    for section in effective:
        if not section.content.strip():
            db.rollback()
            raise AIPersonaBundleError(
                f"Current effective section {section.section_key} is missing."
            )
        version_id = section.provenance.version_id
        version = db.get(AIPersonaConfigVersion, version_id) if version_id else None
        if version is None:
            version = AIPersonaConfigVersion(
                variant="mini",
                section_key=section.section_key,
                version_number=_next_section_version(db, "mini", section.section_key),
                status="draft",
                content=section.content.strip(),
                content_sha256=sha256(section.content.strip().encode()).hexdigest(),
                created_by_user_id=current_user.id,
            )
            db.add(version)
            db.flush()
        _attach_version(
            bundle,
            version,
            source_type=section.provenance.effective_source.value,
            source_identifier=section.provenance.source_identifier,
        )
    db.commit()
    return get_bundle_or_raise(db, bundle.id)


def replace_bundle_section(
    db: Session,
    *,
    bundle_id: UUID,
    section_key: str,
    version_id: UUID,
) -> AIPersonaBundle:
    bundle = get_bundle_or_raise(db, bundle_id, for_update=True)
    _assert_mutable(bundle)
    version = db.get(AIPersonaConfigVersion, version_id)
    if version is None or version.section_key != section_key:
        raise AIPersonaBundleError("Broken bundle section reference.")
    _attach_version(
        bundle,
        version,
        source_type="DATABASE_VERSION",
        source_identifier=f"ai_persona_config_versions:{version.id}",
    )
    db.commit()
    return get_bundle_or_raise(db, bundle.id)


def clone_bundle(
    db: Session, *, bundle_id: UUID, current_user: User
) -> AIPersonaBundle:
    source = get_bundle_or_raise(db, bundle_id)
    bundle = create_bundle_draft(
        db,
        current_user=current_user,
        variant=source.variant,
        source_type="clone",
        source_bundle_id=source.id,
        commit=False,
    )
    for item in source.sections:
        _attach_version(
            bundle,
            item.persona_config_version,
            source_type="BUNDLE_CLONE",
            source_identifier=f"ai_persona_bundles:{source.id}",
        )
    db.commit()
    return get_bundle_or_raise(db, bundle.id)


def _issue(code: str, section_key: str | None = None) -> dict:
    return {"code": code, "section_key": section_key}


def _content_warnings(section_key: str, content: str) -> list[dict]:
    patterns = {
        "POSSIBLE_MUTABLE_PRODUCT_FACT": r"(?i)(rp\s?[\d.]|\b\d+[,.]?\d*\s?(lot|%|usd)\b|spread|commission|komisi|swap|rollover|margin|promo|effective date)",
        "POSSIBLE_REGULATOR_IDENTIFIER": r"(?i)(bappebti|spab|license|lisensi|izin\s+[A-Z0-9/-]+)",
        "LEGACY_ACTION_CLOSING_TERMINOLOGY": r"(?i)\bclosing\b",
        "UNAVAILABLE_SYSTEM_ACCESS_REFERENCE": r"(?i)(cek status verifikasi|akses sistem|lihat status akun)",
    }
    warnings = [
        _issue(code, section_key)
        for code, pattern in patterns.items()
        if re.search(pattern, content)
    ]
    if re.search(
        r"(?i)(minimum funding|minimum modal|spread|commission|komisi|swap|rollover|margin|promo|effective date)",
        content,
    ):
        warnings.append(_issue("POSSIBLE_PRODUCT_FACT_DUPLICATION", section_key))
    if section_key != "guardrail" and re.search(
        r"(?i)(dilarang|jangan pernah|wajib compliance|policy)", content
    ):
        warnings.append(_issue("POSSIBLE_POLICY_OUTSIDE_GUARDRAIL", section_key))
    return warnings


def _evaluate_bundle(db: Session, bundle: AIPersonaBundle) -> BundleValidationResult:
    now = datetime.now(timezone.utc)
    blocking: list[dict] = []
    warnings: list[dict] = []
    results: list[dict] = []
    keys = [item.section_key for item in bundle.sections]
    if len(keys) != len(set(keys)):
        blocking.append(_issue("DUPLICATE_SECTION"))
    for key in RUNTIME_SECTION_ORDER:
        if key not in keys:
            blocking.append(_issue("MISSING_SECTION", key))
    if "guardrail" not in keys:
        blocking.append(_issue("MISSING_GUARDRAIL", "guardrail"))
    if len(keys) != 5:
        blocking.append(_issue("INCOMPLETE_BUNDLE"))

    ordered = sorted(bundle.sections, key=lambda item: item.position)
    if [item.section_key for item in ordered] != [
        key for key in RUNTIME_SECTION_ORDER if key in keys
    ]:
        blocking.append(_issue("INVALID_SECTION_ORDER"))

    for item in ordered:
        version = item.persona_config_version
        section_errors: list[str] = []
        if version is None:
            section_errors.append("BROKEN_BUNDLE_REFERENCE")
        else:
            content = version.content.strip()
            actual_hash = sha256(content.encode()).hexdigest()
            if version.variant != bundle.variant or version.section_key != item.section_key:
                section_errors.append("WRONG_VARIANT_OR_SECTION")
            if not content:
                section_errors.append("BLANK_CONTENT")
            if len(content) > MAX_SECTION_CHARACTERS:
                section_errors.append("SECTION_TOO_LARGE")
            if actual_hash != version.content_sha256 or actual_hash != item.content_sha256:
                section_errors.append("SECTION_HASH_MISMATCH")
            if any(marker in content for marker in ("<<<<<<<", "=======", ">>>>>>>")):
                section_errors.append("UNRESOLVED_MERGE_MARKER")
            if re.search(
                r"(?i)(-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:api[_-]?key|password|secret)\s*[:=]\s*\S{8,})",
                content,
            ):
                section_errors.append("OBVIOUS_SECRET_MATERIAL")
            warnings.extend(_content_warnings(item.section_key, content))
        blocking.extend(_issue(code, item.section_key) for code in section_errors)
        results.append(
            {
                "section_key": item.section_key,
                "position": item.position,
                "valid": not section_errors,
                "errors": section_errors,
                "content_sha256": item.content_sha256,
                "character_count": item.character_count,
            }
        )

    source_types = {item.source_type for item in bundle.sections}
    if len(source_types) > 1:
        warnings.append(_issue("MIXED_IMPORT_SOURCES"))

    current = get_published_bundle(db, variant=bundle.variant)
    current_sections = (
        {item.section_key: item.content_sha256 for item in current.sections}
        if current
        else {}
    )
    if current:
        current_by_key = {item.section_key: item for item in current.sections}
        for item in bundle.sections:
            previous = current_by_key.get(item.section_key)
            if previous and previous.character_count:
                ratio = item.character_count / previous.character_count
                if ratio < 0.5 or ratio > 2:
                    warnings.append(
                        _issue("SIGNIFICANT_SECTION_SIZE_CHANGE", item.section_key)
                    )
    changed = [
        key
        for key in RUNTIME_SECTION_ORDER
        if key in keys
        and current_sections.get(key)
        != next(
            item.content_sha256 for item in bundle.sections if item.section_key == key
        )
    ]
    unchanged = [key for key in RUNTIME_SECTION_ORDER if key in keys and key not in changed]
    bundle_hash = _bundle_hash(bundle)
    report_core = {
        "bundle_id": str(bundle.id),
        "variant": bundle.variant,
        "complete": not blocking and set(keys) == set(RUNTIME_SECTION_ORDER),
        "section_results": results,
        "blocking_errors": blocking,
        "warnings": warnings,
        "bundle_hash": bundle_hash,
        "current_effective_bundle_hash": current.bundle_sha256 if current else None,
        "changed_section_keys": changed,
        "unchanged_section_keys": unchanged,
        "validation_contract_version": CLARA_PERSONA_BUNDLE_CONTRACT_VERSION,
    }
    return BundleValidationResult(
        **report_core,
        validation_report_hash=_canonical_json_hash(report_core),
        validated_at=now,
    )


def validate_bundle(
    db: Session, *, bundle_id: UUID, current_user: User
) -> BundleValidationResult:
    bundle = get_bundle_or_raise(db, bundle_id, for_update=True)
    if bundle.status in {"published", "archived"}:
        return _evaluate_bundle(db, bundle)
    if bundle.status != "draft" and bundle.status != "validated":
        raise AIPersonaBundleError("Rejected bundles cannot be validated.")
    report = _evaluate_bundle(db, bundle)
    bundle.validation_status = "valid" if report.complete else "invalid"
    bundle.status = "validated" if report.complete else "draft"
    bundle.bundle_sha256 = report.bundle_hash
    bundle.validation_report = json.loads(json.dumps(report.as_dict(), default=str))
    bundle.validation_report_hash = report.validation_report_hash
    bundle.validation_contract_version = CLARA_PERSONA_BUNDLE_CONTRACT_VERSION
    bundle.validated_by_user_id = current_user.id
    bundle.validated_at = report.validated_at
    db.commit()
    return report


def serialize_bundle(bundle: AIPersonaBundle) -> dict:
    return {
        "id": bundle.id,
        "variant": bundle.variant,
        "bundle_version": bundle.bundle_version,
        "status": bundle.status,
        "bundle_sha256": bundle.bundle_sha256,
        "source_type": bundle.source_type,
        "source_bundle_id": bundle.source_bundle_id,
        "validation_status": bundle.validation_status,
        "validation_report": bundle.validation_report,
        "validation_report_hash": bundle.validation_report_hash,
        "validation_contract_version": bundle.validation_contract_version,
        "created_by_user_id": bundle.created_by_user_id,
        "validated_by_user_id": bundle.validated_by_user_id,
        "published_by_user_id": bundle.published_by_user_id,
        "created_at": bundle.created_at,
        "validated_at": bundle.validated_at,
        "published_at": bundle.published_at,
        "archived_at": bundle.archived_at,
        "sections": [
            {
                "id": item.id,
                "section_key": item.section_key,
                "persona_config_version_id": item.persona_config_version_id,
                "position": item.position,
                "content_sha256": item.content_sha256,
                "character_count": item.character_count,
                "source_type": item.source_type,
                "source_identifier": item.source_identifier,
                "version_number": item.persona_config_version.version_number,
                "content": item.persona_config_version.content,
                "published_at": item.persona_config_version.published_at,
            }
            for item in sorted(bundle.sections, key=lambda row: row.position)
        ],
    }


def preview_bundle(db: Session, *, bundle_id: UUID) -> dict:
    from app.services.clara_playbook_service import (
        RESPONSE_EXAMPLE_FILES,
        SUPPORTING_PLAYBOOK_FILES,
    )

    bundle = get_bundle_or_raise(db, bundle_id)
    current = get_published_bundle(db, variant=bundle.variant)
    mode = normalize_persona_authority_mode(settings.clara_persona_authority_mode)
    return {
        "bundle": serialize_bundle(bundle),
        "runtime_order": list(RUNTIME_SECTION_ORDER),
        "roadmap_review_order": list(ROADMAP_REVIEW_ORDER),
        "current_effective_bundle_id": current.id if current else None,
        "current_effective_bundle_hash": current.bundle_sha256 if current else None,
        "current_persona_authority_mode": mode.canonical_value,
        "legacy_overlay_present": mode.canonical_value == PersonaAuthorityMode.LEGACY,
        "fallback_reason": None if current else "NO_PUBLISHED_BUNDLE",
        "supporting_knowledge_count": len(SUPPORTING_PLAYBOOK_FILES),
        "response_example_count": len(RESPONSE_EXAMPLE_FILES),
        "authority_boundaries": {
            "behavioral_system_playbooks": "candidate_bundle",
            "structured_runtime_state": "backend_runtime_context",
            "product_facts": "product_fact_registry_or_legacy_mode",
            "supporting_knowledge": "separate_lower_authority",
            "response_examples": "separate_lower_authority",
            "technical_prompt_shell": "backend_runtime_contract",
        },
    }


def diff_bundles(
    db: Session, *, new_bundle_id: UUID, old_bundle_id: UUID | None = None
) -> dict:
    new = get_bundle_or_raise(db, new_bundle_id)
    old = (
        get_bundle_or_raise(db, old_bundle_id)
        if old_bundle_id
        else get_published_bundle(db, variant=new.variant)
    )
    old_by_key = {item.section_key: item for item in old.sections} if old else {}
    new_by_key = {item.section_key: item for item in new.sections}
    sections: list[dict] = []
    changed: list[str] = []
    used = 0
    truncated = False
    for key in RUNTIME_SECTION_ORDER:
        old_item = old_by_key.get(key)
        new_item = new_by_key.get(key)
        old_content = old_item.persona_config_version.content if old_item else ""
        new_content = new_item.persona_config_version.content if new_item else ""
        diff_lines = list(
            unified_diff(
                old_content.splitlines(),
                new_content.splitlines(),
                fromfile=f"old/{key}",
                tofile=f"new/{key}",
                lineterm="",
            )
        )
        text = "\n".join(diff_lines)
        remaining = MAX_DIFF_CHARACTERS - used
        if len(text) > remaining:
            text = text[: max(remaining, 0)]
            truncated = True
        used += len(text)
        is_changed = bool(diff_lines)
        if is_changed:
            changed.append(key)
        sections.append(
            {
                "section_key": key,
                "changed": is_changed,
                "added_lines": sum(line.startswith("+") and not line.startswith("+++") for line in diff_lines),
                "removed_lines": sum(line.startswith("-") and not line.startswith("---") for line in diff_lines),
                "unchanged_lines": sum(line.startswith(" ") for line in diff_lines),
                "diff": text,
                "old_hash": old_item.content_sha256 if old_item else None,
                "new_hash": new_item.content_sha256 if new_item else None,
                "old_character_count": old_item.character_count if old_item else 0,
                "new_character_count": new_item.character_count if new_item else 0,
            }
        )
    return {
        "old_bundle_id": old.id if old else None,
        "new_bundle_id": new.id,
        "old_bundle_hash": old.bundle_sha256 if old else None,
        "new_bundle_hash": new.bundle_sha256 or _bundle_hash(new),
        "changed_section_keys": changed,
        "sections": sections,
        "truncated": truncated,
    }


def _publish_in_transaction(
    db: Session,
    *,
    bundle: AIPersonaBundle,
    current_user: User,
    expected_current_bundle_hash: str | None,
    acknowledged_warning_codes: list[str],
    audit_action: str,
) -> None:
    if bundle.status != "validated" or bundle.validation_status != "valid":
        raise AIPersonaBundleError("Bundle must be validated before publication.")
    from app.services.clara_evaluation_service import (
        ClaraEvaluationError,
        assert_bundle_certified_for_publication,
    )

    try:
        assert_bundle_certified_for_publication(db, bundle)
    except ClaraEvaluationError as exc:
        raise AIPersonaBundleError(str(exc)) from exc
    current = get_published_bundle(db, variant=bundle.variant, for_update=True)
    actual_current_hash = current.bundle_sha256 if current else None
    if expected_current_bundle_hash != actual_current_hash:
        raise AIPersonaBundleError("Published bundle changed. Reload and validate again.")
    report = _evaluate_bundle(db, bundle)
    if (
        not report.complete
        or report.bundle_hash != bundle.bundle_sha256
        or report.validation_report_hash != bundle.validation_report_hash
    ):
        raise AIPersonaBundleError("Bundle validation report no longer matches.")
    required_warnings = {item["code"] for item in report.warnings}
    if not required_warnings.issubset(set(acknowledged_warning_codes)):
        raise AIPersonaBundleError("All validation warnings must be acknowledged.")

    now = datetime.now(timezone.utc)
    if current and current.id != bundle.id:
        current.status = "archived"
        current.archived_at = now
    published_sections = list(
        db.scalars(
            select(AIPersonaConfigVersion)
            .where(
                AIPersonaConfigVersion.variant == bundle.variant,
                AIPersonaConfigVersion.status == "published",
            )
            .with_for_update()
        ).all()
    )
    selected_ids = {item.persona_config_version_id for item in bundle.sections}
    for version in published_sections:
        if version.id not in selected_ids:
            version.status = "archived"
    db.flush()
    for item in bundle.sections:
        version = item.persona_config_version
        version.status = "published"
        version.published_by_user_id = current_user.id
        version.published_at = now
    bundle.status = "published"
    bundle.published_by_user_id = current_user.id
    bundle.published_at = now
    add_audit_log(
        db,
        action=audit_action,
        resource_type="ai_persona_bundle",
        resource_id=str(bundle.id),
        current_user=current_user,
        metadata={
            "variant": bundle.variant,
            "bundle_version": bundle.bundle_version,
            "bundle_sha256": bundle.bundle_sha256,
            "source_bundle_id": str(bundle.source_bundle_id) if bundle.source_bundle_id else None,
            "review_order": list(ROADMAP_REVIEW_ORDER),
            "section_version_ids": [str(item.persona_config_version_id) for item in bundle.sections],
            "warning_codes": sorted(required_warnings),
        },
    )


def publish_bundle(
    db: Session,
    *,
    bundle_id: UUID,
    current_user: User,
    expected_current_bundle_hash: str | None,
    acknowledged_warning_codes: list[str],
) -> AIPersonaBundle:
    bundle = get_bundle_or_raise(db, bundle_id, for_update=True)
    try:
        _publish_in_transaction(
            db,
            bundle=bundle,
            current_user=current_user,
            expected_current_bundle_hash=expected_current_bundle_hash,
            acknowledged_warning_codes=acknowledged_warning_codes,
            audit_action="ai_persona_bundle.publish",
        )
        db.commit()
    except (IntegrityError, AIPersonaBundleError) as exc:
        db.rollback()
        if isinstance(exc, AIPersonaBundleError):
            raise
        raise AIPersonaBundleError("Concurrent bundle publication conflict.") from exc
    return get_bundle_or_raise(db, bundle.id)


def rollback_bundle(
    db: Session,
    *,
    source_bundle_id: UUID,
    current_user: User,
    expected_current_bundle_hash: str | None,
    acknowledged_warning_codes: list[str],
) -> AIPersonaBundle:
    source = get_bundle_or_raise(db, source_bundle_id)
    if len(source.sections) != 5:
        raise AIPersonaBundleError("Rollback requires a complete historical bundle.")
    try:
        bundle = create_bundle_draft(
            db,
            current_user=current_user,
            variant=source.variant,
            source_type="rollback",
            source_bundle_id=source.id,
            commit=False,
        )
        for item in source.sections:
            source_version = item.persona_config_version
            _attach_version(
                bundle,
                source_version,
                source_type="BUNDLE_ROLLBACK",
                source_identifier=f"ai_persona_bundles:{source.id}",
            )
        report = _evaluate_bundle(db, bundle)
        if not report.complete:
            codes = ", ".join(item["code"] for item in report.blocking_errors)
            raise AIPersonaBundleError(
                f"Historical bundle no longer validates: {codes}."
            )
        bundle.status = "validated"
        bundle.validation_status = "valid"
        bundle.bundle_sha256 = report.bundle_hash
        bundle.validation_report = json.loads(json.dumps(report.as_dict(), default=str))
        bundle.validation_report_hash = report.validation_report_hash
        bundle.validation_contract_version = CLARA_PERSONA_BUNDLE_CONTRACT_VERSION
        bundle.validated_by_user_id = current_user.id
        bundle.validated_at = report.validated_at
        _publish_in_transaction(
            db,
            bundle=bundle,
            current_user=current_user,
            expected_current_bundle_hash=expected_current_bundle_hash,
            acknowledged_warning_codes=acknowledged_warning_codes,
            audit_action="ai_persona_bundle.rollback",
        )
        db.commit()
    except (IntegrityError, AIPersonaBundleError) as exc:
        db.rollback()
        if isinstance(exc, AIPersonaBundleError):
            raise
        raise AIPersonaBundleError("Concurrent bundle rollback conflict.") from exc
    return get_bundle_or_raise(db, bundle.id)


def dispose_bundle(
    db: Session, *, bundle_id: UUID, disposition: str
) -> AIPersonaBundle:
    bundle = get_bundle_or_raise(db, bundle_id, for_update=True)
    if bundle.status not in {"draft", "validated"}:
        raise AIPersonaBundleError("Only draft or validated bundles can be disposed.")
    bundle.status = disposition
    bundle.archived_at = datetime.now(timezone.utc)
    db.commit()
    return get_bundle_or_raise(db, bundle.id)
