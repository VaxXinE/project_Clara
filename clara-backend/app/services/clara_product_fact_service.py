from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from enum import StrEnum
from hashlib import sha256
from typing import Any
from uuid import UUID

from sqlalchemy import desc, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.product_fact import ProductFact
from app.models.user import User
from app.schemas.product_fact_schema import ProductFactDraftCreateRequest
from app.services.clara_policy_enforcement_service import (
    ClaraEnforcementError,
    ReviewerRequirement,
    assert_user_can_review_requirement,
)
from app.services.role_service import is_superadmin_like, normalize_role


CLARA_PRODUCT_FACT_CONTRACT_VERSION = "1.0"

CANONICAL_PRODUCT_FACT_KEYS = frozenset(
    {
        "account.minimum_opening_amount",
        "account.minimum_lot",
        "account.eligible_products",
        "account.currency",
        "trading.spread",
        "trading.commission",
        "trading.margin",
        "trading.swap",
        "trading.rollover",
        "trading.storage_fee",
        "trading.overnight_requirement",
        "trading.instruments",
        "company.regulatory_status",
        "company.regulator",
        "company.license_reference",
        "process.initial_data",
        "process.kyc_requirements",
        "process.verification_steps",
        "process.activation_steps",
        "process.funding_steps",
        "process.withdrawal_steps",
        "promotion.current_terms",
    }
)


class ProductFactMode(StrEnum):
    LEGACY = "LEGACY"
    SHADOW = "SHADOW"
    REGISTRY = "REGISTRY"


class ResolutionStatus(StrEnum):
    RESOLVED = "RESOLVED"
    MISSING = "MISSING"
    STALE = "STALE"
    EXPIRED = "EXPIRED"
    REVOKED = "REVOKED"
    CONFLICT = "CONFLICT"
    UNAPPROVED = "UNAPPROVED"


class FreshnessStatus(StrEnum):
    FRESH = "FRESH"
    STALE = "STALE"
    UNVERIFIED = "UNVERIFIED"


class ProductFactError(RuntimeError):
    pass


@dataclass(frozen=True)
class ProductFactModeResolution:
    mode: ProductFactMode
    original_value: str | None
    was_normalized: bool


@dataclass(frozen=True)
class ResolvedProductFact:
    fact_key: str
    account_category: str
    value: Any = None
    value_type: str | None = None
    unit: str | None = None
    lifecycle_status: str | None = None
    effective_from: datetime | None = None
    effective_until: datetime | None = None
    last_verified_at: datetime | None = None
    freshness_status: FreshnessStatus = FreshnessStatus.UNVERIFIED
    source_type: str | None = None
    source_reference: str | None = None
    revision: int | None = None
    resolution_status: ResolutionStatus = ResolutionStatus.MISSING
    warnings: tuple[str, ...] = ()
    content_hash: str = ""
    fact_id: UUID | None = None


@dataclass(frozen=True)
class ProductFactPromptComposition:
    content: str
    mode: ProductFactMode
    resolved_fact_keys: tuple[str, ...]
    missing_fact_keys: tuple[str, ...]
    stale_fact_keys: tuple[str, ...]
    conflicting_fact_keys: tuple[str, ...]
    legacy_registry_mismatch_keys: tuple[str, ...]
    fact_revision_ids: tuple[str, ...]
    fact_hashes: dict[str, str]
    registry_injection_used: bool
    fallback_used: bool
    validator_fact_values: dict[str, Any]

    def debug_metadata(self) -> dict[str, object]:
        return {
            "product_fact_contract_version": CLARA_PRODUCT_FACT_CONTRACT_VERSION,
            "product_fact_mode": self.mode.value,
            "resolved_fact_keys": list(self.resolved_fact_keys),
            "missing_fact_keys": list(self.missing_fact_keys),
            "stale_fact_keys": list(self.stale_fact_keys),
            "conflicting_fact_keys": list(self.conflicting_fact_keys),
            "legacy_registry_mismatch_keys": list(self.legacy_registry_mismatch_keys),
            "fact_revision_ids": list(self.fact_revision_ids),
            "fact_hashes": self.fact_hashes,
            "registry_injection_used": self.registry_injection_used,
            "fallback_used": self.fallback_used,
        }


LEGACY_FACT_VALUES: dict[tuple[str, str], Any] = {
    ("account.minimum_opening_amount", "mini"): 5_000_000,
    ("company.regulator", "global"): "BAPPEBTI",
    (
        "company.regulatory_status",
        "global",
    ): "PT Solid Gold Berjangka diawasi BAPPEBTI.",
}

FACT_LABELS = {
    "account.minimum_lot": "Minimum lot",
    "account.eligible_products": "Produk yang tersedia",
    "account.currency": "Mata uang akun",
    "trading.spread": "Spread",
    "trading.commission": "Komisi",
    "trading.margin": "Margin",
    "trading.swap": "Swap",
    "trading.rollover": "Rollover",
    "trading.storage_fee": "Storage fee",
    "trading.overnight_requirement": "Ketentuan overnight",
    "trading.instruments": "Instrumen yang tersedia",
    "company.license_reference": "Referensi izin perusahaan",
    "process.initial_data": "Data awal yang diperlukan",
    "process.kyc_requirements": "Persyaratan verifikasi identitas",
    "process.verification_steps": "Tahap verifikasi",
    "process.activation_steps": "Tahap aktivasi",
    "process.funding_steps": "Tahap pendanaan",
    "process.withdrawal_steps": "Tahap penarikan",
    "promotion.current_terms": "Ketentuan promosi saat ini",
}


def normalize_product_fact_mode(value: str | None) -> ProductFactModeResolution:
    original = value
    normalized = (value or "").strip().upper()
    if normalized in {mode.value for mode in ProductFactMode}:
        return ProductFactModeResolution(
            ProductFactMode(normalized), original, normalized != (value or "")
        )
    return ProductFactModeResolution(ProductFactMode.LEGACY, original, True)


def _utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _content_hash(value: Any) -> str:
    encoded = json.dumps(
        value, sort_keys=True, ensure_ascii=False, separators=(",", ":"), default=str
    )
    return sha256(encoded.encode("utf-8")).hexdigest()


def freshness_max_age(freshness_class: str) -> timedelta:
    days = {
        "HIGH_VOLATILITY": settings.clara_product_fact_high_volatility_days,
        "MEDIUM_VOLATILITY": settings.clara_product_fact_medium_volatility_days,
        "LOW_VOLATILITY": settings.clara_product_fact_low_volatility_days,
    }.get(freshness_class, 0)
    return timedelta(days=max(days, 0))


def get_freshness_status(
    last_verified_at: datetime | None,
    freshness_class: str,
    *,
    now: datetime | None = None,
) -> FreshnessStatus:
    verified = _utc(last_verified_at)
    if verified is None:
        return FreshnessStatus.UNVERIFIED
    current = _utc(now) or datetime.now(timezone.utc)
    return (
        FreshnessStatus.STALE
        if current - verified > freshness_max_age(freshness_class)
        else FreshnessStatus.FRESH
    )


def _in_effect(fact: ProductFact, now: datetime) -> bool:
    start = _utc(fact.effective_from)
    end = _utc(fact.effective_until)
    return (start is None or start <= now) and (end is None or now < end)


def _result_from_fact(
    fact: ProductFact,
    status: ResolutionStatus,
    freshness: FreshnessStatus,
    warnings: tuple[str, ...] = (),
) -> ResolvedProductFact:
    return ResolvedProductFact(
        fact_id=fact.id,
        fact_key=fact.fact_key,
        account_category=fact.account_category,
        value=fact.value,
        value_type=fact.value_type,
        unit=fact.unit,
        lifecycle_status=fact.lifecycle_status,
        effective_from=fact.effective_from,
        effective_until=fact.effective_until,
        last_verified_at=fact.last_verified_at,
        freshness_status=freshness,
        source_type=fact.source_type,
        source_reference=fact.source_reference,
        revision=fact.revision,
        resolution_status=status,
        warnings=warnings,
        content_hash=_content_hash(fact.value),
    )


def resolve_product_fact(
    db: Session,
    *,
    fact_key: str,
    account_category: str,
    organization_id: UUID | None,
    product_code: str | None = None,
    now: datetime | None = None,
) -> ResolvedProductFact:
    current = _utc(now) or datetime.now(timezone.utc)
    raw_category = account_category.strip().lower()
    normalized_category = {
        "reguler": "regular",
        "micro": "mini",
        "mikro": "mini",
    }.get(raw_category, raw_category)
    if normalized_category not in {"mini", "regular", "global"}:
        normalized_category = "global"
    normalized_product = product_code.strip().lower() if product_code else None
    visible_scope = (
        ProductFact.organization_id.is_(None)
        if organization_id is None
        else or_(
            ProductFact.organization_id == organization_id,
            ProductFact.organization_id.is_(None),
        )
    )
    facts = list(
        db.scalars(
            select(ProductFact)
            .where(ProductFact.fact_key == fact_key, visible_scope)
            .order_by(desc(ProductFact.revision), ProductFact.id)
        ).all()
    )

    scope_levels = [
        (organization_id, normalized_category, normalized_product),
        (None, normalized_category, normalized_product),
        (organization_id, "global", normalized_product),
        (None, "global", normalized_product),
    ]
    if normalized_product is not None:
        scope_levels.extend(
            [
                (organization_id, normalized_category, None),
                (None, normalized_category, None),
                (organization_id, "global", None),
                (None, "global", None),
            ]
        )
    seen: set[tuple[UUID | None, str, str | None]] = set()
    selected: list[ProductFact] = []
    highest_priority_history: list[ProductFact] = []
    for scope in scope_levels:
        if scope in seen:
            continue
        seen.add(scope)
        scoped_facts = [
            fact
            for fact in facts
            if fact.organization_id == scope[0]
            and fact.account_category == scope[1]
            and (fact.product_code or None) == scope[2]
        ]
        if not scoped_facts:
            continue
        if not highest_priority_history:
            highest_priority_history = scoped_facts
        if any(
            fact.lifecycle_status == "ACTIVE" and _in_effect(fact, current)
            for fact in scoped_facts
        ):
            selected = scoped_facts
            break

    if not selected:
        selected = highest_priority_history

    if not selected:
        return ResolvedProductFact(
            fact_key=fact_key,
            account_category=normalized_category,
            resolution_status=ResolutionStatus.MISSING,
            warnings=("no_registry_fact",),
        )

    active = [
        fact
        for fact in selected
        if fact.lifecycle_status == "ACTIVE" and _in_effect(fact, current)
    ]
    if len(active) > 1:
        newest = max(active, key=lambda item: (item.revision, str(item.id)))
        return _result_from_fact(
            newest,
            ResolutionStatus.CONFLICT,
            get_freshness_status(
                newest.last_verified_at, newest.freshness_class, now=current
            ),
            ("overlapping_active_revisions",),
        )
    if active:
        fact = active[0]
        freshness = get_freshness_status(
            fact.last_verified_at, fact.freshness_class, now=current
        )
        if freshness != FreshnessStatus.FRESH:
            return _result_from_fact(
                fact, ResolutionStatus.STALE, freshness, ("verification_stale",)
            )
        return _result_from_fact(fact, ResolutionStatus.RESOLVED, freshness)

    newest = selected[0]
    if newest.lifecycle_status == "REVOKED":
        status = ResolutionStatus.REVOKED
    elif newest.lifecycle_status == "EXPIRED" or (
        newest.effective_until and (_utc(newest.effective_until) or current) <= current
    ):
        status = ResolutionStatus.EXPIRED
    else:
        status = ResolutionStatus.UNAPPROVED
    return _result_from_fact(
        newest,
        status,
        get_freshness_status(
            newest.last_verified_at, newest.freshness_class, now=current
        ),
        ("no_effective_active_revision",),
    )


def _format_fact(result: ResolvedProductFact) -> str:
    if result.fact_key == "account.minimum_opening_amount" and isinstance(
        result.value, int
    ):
        amount = f"{result.value:,}".replace(",", ".")
        return f"- Modal awal Mini: Rp{amount}."
    if result.fact_key == "company.regulator":
        return f"- Regulator perusahaan: {result.value}."
    if result.fact_key == "company.regulatory_status":
        return f"- Status regulasi: {result.value}"
    if result.fact_key == "account.eligible_products" and isinstance(
        result.value, list
    ):
        labels = {
            "XUL10": "XUL10 (Gold/Emas)",
            "BCO10_BBJ": "BCO10_BBJ (Brent Oil)",
        }
        products = [labels.get(str(value), str(value)) for value in result.value]
        return f"- Produk yang tersedia: {', '.join(products)}."
    if result.fact_key == "trading.spread" and isinstance(result.value, dict):
        products = []
        for product_code, details in result.value.items():
            if not isinstance(details, dict) or details.get("minimum") is None:
                continue
            minimum = str(details["minimum"]).replace(".", ",")
            unit = str(details.get("unit", "")).replace("/side", " per sisi")
            products.append(f"{product_code}: minimum {minimum} {unit}".strip())
        if products:
            return f"- Spread: {'; '.join(products)}."
    if result.fact_key == "trading.commission" and isinstance(result.value, dict):
        amount = result.value.get("amount_usd")
        lot = result.value.get("per_lot")
        vat = result.value.get("vat_percent")
        if amount is not None and lot is not None and vat is not None:
            lot_text = str(lot).replace(".", ",")
            return (
                f"- Komisi: USD {amount} per {lot_text} lot + PPN {vat}%. "
                "Kutip komponen ini apa adanya; jangan menghitung total sendiri."
            )
    if result.fact_key == "trading.margin" and isinstance(result.value, dict):
        daytrade = result.value.get("daytrade_usd_per_lot")
        auto_liquidation = result.value.get("auto_liquidation_level_percent")
        details = []
        if daytrade is not None:
            details.append(f"daytrade USD {daytrade} per lot")
        if auto_liquidation is not None:
            details.append(f"auto liquidation pada {auto_liquidation}% equity")
        if details:
            return (
                f"- Margin: {'; '.join(details)}. Margin adalah dana "
                "jaminan dan nilainya bergantung pada produk serta jenis akun."
            )
    if result.fact_key == "trading.storage_fee" and isinstance(result.value, dict):
        products = []
        for product_code, details in result.value.items():
            if not isinstance(details, dict):
                continue
            buy = details.get("buy_usd_per_0_1_lot_per_night")
            sell = details.get("sell_usd_per_0_1_lot_per_night")
            vat = details.get("vat_percent")
            if buy is None or sell is None or vat is None:
                continue
            buy_text = str(buy).replace(".", ",")
            sell_text = str(sell).replace(".", ",")
            fee = (
                f"USD {buy_text}"
                if buy == sell
                else f"buy USD {buy_text}; sell USD {sell_text}"
            )
            products.append(
                f"{product_code}: {fee} per 0,1 lot per malam + PPN {vat}%"
            )
        if products:
            return f"- Storage fee: {'; '.join(products)}."
    label = FACT_LABELS.get(result.fact_key, "Fakta produk terverifikasi")
    return f"- {label}: {json.dumps(result.value, ensure_ascii=False)}"


SAFE_FACT_FALLBACK = (
    "- Detail yang diminta perlu dikonfirmasi dari sumber resmi terbaru sebelum "
    "menyebut angka atau ketentuan tetap. Siapkan sebagai draft untuk ditinjau manusia."
)


def compose_product_fact_prompt(
    db: Session | None,
    *,
    mode: ProductFactMode,
    account_category: str | None,
    organization_id: UUID | None,
    legacy_content: str,
    fact_keys: tuple[str, ...] = (
        "account.minimum_opening_amount",
        "company.regulator",
        "company.regulatory_status",
    ),
    now: datetime | None = None,
) -> ProductFactPromptComposition:
    if mode == ProductFactMode.LEGACY or (
        mode == ProductFactMode.SHADOW and db is None
    ):
        return ProductFactPromptComposition(
            legacy_content,
            mode,
            (),
            (),
            (),
            (),
            (),
            (),
            {},
            False,
            False,
            {},
        )

    if db is None:
        return ProductFactPromptComposition(
            content=f"PRODUCT_FACT_REGISTRY\n{SAFE_FACT_FALLBACK}",
            mode=mode,
            resolved_fact_keys=(),
            missing_fact_keys=fact_keys,
            stale_fact_keys=(),
            conflicting_fact_keys=(),
            legacy_registry_mismatch_keys=(),
            fact_revision_ids=(),
            fact_hashes={},
            registry_injection_used=True,
            fallback_used=True,
            validator_fact_values={},
        )

    raw_category = (account_category or "global").strip().lower()
    category = {"reguler": "regular", "micro": "mini", "mikro": "mini"}.get(
        raw_category, raw_category
    )
    if category not in {"mini", "regular", "global"}:
        category = "global"
    results = tuple(
        resolve_product_fact(
            db,
            fact_key=key,
            account_category=category,
            organization_id=organization_id,
            now=now,
        )
        for key in fact_keys
    )
    resolved = tuple(
        result
        for result in results
        if result.resolution_status == ResolutionStatus.RESOLVED
    )
    mismatch = tuple(
        sorted(
            result.fact_key
            for result in resolved
            if (result.fact_key, result.account_category) in LEGACY_FACT_VALUES
            and LEGACY_FACT_VALUES[(result.fact_key, result.account_category)]
            != result.value
        )
    )
    metadata = {
        "resolved_fact_keys": tuple(result.fact_key for result in resolved),
        "missing_fact_keys": tuple(
            result.fact_key
            for result in results
            if result.resolution_status
            in {
                ResolutionStatus.MISSING,
                ResolutionStatus.UNAPPROVED,
                ResolutionStatus.EXPIRED,
                ResolutionStatus.REVOKED,
            }
        ),
        "stale_fact_keys": tuple(
            result.fact_key
            for result in results
            if result.resolution_status == ResolutionStatus.STALE
        ),
        "conflicting_fact_keys": tuple(
            result.fact_key
            for result in results
            if result.resolution_status == ResolutionStatus.CONFLICT
        ),
        "legacy_registry_mismatch_keys": mismatch,
        "fact_revision_ids": tuple(
            str(result.fact_id) for result in resolved if result.fact_id
        ),
        "fact_hashes": {result.fact_key: result.content_hash for result in resolved},
        "validator_fact_values": {result.fact_key: result.value for result in resolved},
    }
    if mode == ProductFactMode.SHADOW:
        return ProductFactPromptComposition(
            content=legacy_content,
            mode=mode,
            registry_injection_used=False,
            fallback_used=False,
            **metadata,
        )

    fallback_used = len(resolved) != len(results)
    content = "\n".join(
        ["PRODUCT_FACT_REGISTRY", *(_format_fact(result) for result in resolved)]
        + ([SAFE_FACT_FALLBACK] if fallback_used else [])
    )
    return ProductFactPromptComposition(
        content=content,
        mode=mode,
        registry_injection_used=True,
        fallback_used=fallback_used,
        **metadata,
    )


def list_product_facts(
    db: Session,
    *,
    current_user: User,
    fact_key: str | None = None,
    lifecycle_status: str | None = None,
) -> list[ProductFact]:
    statement = select(ProductFact)
    if not is_superadmin_like(current_user.role):
        statement = statement.where(
            or_(
                ProductFact.organization_id == current_user.organization_id,
                ProductFact.organization_id.is_(None),
            )
        )
    if normalize_role(current_user.role) == "sales":
        statement = statement.where(
            ProductFact.lifecycle_status == "ACTIVE",
            ProductFact.sensitivity_class == "CUSTOMER_SAFE",
        )
    if fact_key:
        statement = statement.where(ProductFact.fact_key == fact_key)
    if lifecycle_status:
        statement = statement.where(
            ProductFact.lifecycle_status == lifecycle_status.strip().upper()
        )
    return list(
        db.scalars(
            statement.order_by(ProductFact.fact_key, desc(ProductFact.revision))
        ).all()
    )


def _fact_or_raise(db: Session, fact_id: UUID, current_user: User) -> ProductFact:
    fact = db.get(ProductFact, fact_id)
    if fact is None or (
        fact.organization_id is not None
        and fact.organization_id != current_user.organization_id
        and not is_superadmin_like(current_user.role)
    ):
        raise ProductFactError("Product fact not found.")
    return fact


def create_product_fact_draft(
    db: Session,
    *,
    payload: ProductFactDraftCreateRequest,
    current_user: User,
) -> ProductFact:
    if payload.fact_key not in CANONICAL_PRODUCT_FACT_KEYS:
        raise ProductFactError("Unsupported canonical fact key.")
    organization_id = payload.organization_id
    if not is_superadmin_like(current_user.role):
        if organization_id not in {None, current_user.organization_id}:
            raise ProductFactError("Organization scope is not allowed.")
        organization_id = current_user.organization_id
    latest = db.scalars(
        select(ProductFact)
        .where(
            ProductFact.organization_id == organization_id,
            ProductFact.fact_key == payload.fact_key,
            ProductFact.account_category == payload.account_category,
            ProductFact.product_code == payload.product_code,
        )
        .order_by(desc(ProductFact.revision))
    ).first()
    entry = ProductFact(
        **payload.model_dump(exclude={"organization_id"}),
        organization_id=organization_id,
        lifecycle_status="DRAFT",
        revision=(latest.revision + 1 if latest else 1),
        supersedes_fact_id=latest.id if latest else None,
        created_by_user_id=current_user.id,
    )
    if entry.source_hash is None:
        entry.source_hash = sha256(
            f"{entry.source_reference}\n{_content_hash(entry.value)}".encode("utf-8")
        ).hexdigest()
    db.add(entry)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ProductFactError(
            "Product fact revision changed concurrently. Reload and retry."
        ) from exc
    db.refresh(entry)
    return entry


def transition_product_fact(
    db: Session,
    *,
    fact_id: UUID,
    action: str,
    current_user: User,
    now: datetime | None = None,
) -> ProductFact:
    try:
        assert_user_can_review_requirement(
            current_user.role, ReviewerRequirement.COMPLIANCE_REVIEW
        )
    except ClaraEnforcementError as exc:
        raise ProductFactError(str(exc)) from exc
    fact = _fact_or_raise(db, fact_id, current_user)
    current = _utc(now) or datetime.now(timezone.utc)
    target_by_action = {
        "approve": "APPROVED",
        "activate": "ACTIVE",
        "expire": "EXPIRED",
        "revoke": "REVOKED",
    }
    target = target_by_action.get(action)
    if target is None:
        raise ProductFactError("Unsupported lifecycle action.")
    allowed_from = {
        "approve": {"DRAFT"},
        "activate": {"APPROVED"},
        "expire": {"APPROVED", "ACTIVE"},
        "revoke": {"DRAFT", "APPROVED", "ACTIVE"},
    }[action]
    if fact.lifecycle_status not in allowed_from:
        raise ProductFactError(
            f"Cannot {action} a {fact.lifecycle_status} product fact."
        )
    if action == "activate":
        if fact.fact_key.startswith("process.") and isinstance(fact.value, dict) and any(
            fact.value.get(field)
            for field in ("public_source_conflict", "review_note")
        ):
            raise ProductFactError(
                "Unresolved process fact cannot be activated. Remove review/conflict "
                "markers in a verified revision first."
            )
        if fact.effective_until and (_utc(fact.effective_until) or current) <= current:
            raise ProductFactError("Expired effective period cannot be activated.")
        overlap_conditions = [
            ProductFact.id != fact.id,
            ProductFact.organization_id == fact.organization_id,
            ProductFact.fact_key == fact.fact_key,
            ProductFact.account_category == fact.account_category,
            ProductFact.product_code == fact.product_code,
            ProductFact.lifecycle_status == "ACTIVE",
        ]
        if fact.effective_from is not None:
            overlap_conditions.append(
                or_(
                    ProductFact.effective_until.is_(None),
                    ProductFact.effective_until > fact.effective_from,
                )
            )
        if fact.effective_until is not None:
            overlap_conditions.append(
                or_(
                    ProductFact.effective_from.is_(None),
                    ProductFact.effective_from < fact.effective_until,
                )
            )
        overlap = db.scalars(select(ProductFact).where(*overlap_conditions)).first()
        if overlap:
            raise ProductFactError(
                "Active effective period conflicts with another revision."
            )
    fact.lifecycle_status = target
    if action == "approve":
        fact.verified_by_user_id = current_user.id
        fact.last_verified_at = fact.last_verified_at or current
    db.commit()
    db.refresh(fact)
    return fact
