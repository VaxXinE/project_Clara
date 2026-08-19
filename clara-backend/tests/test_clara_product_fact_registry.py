from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.api import routes_product_facts
from app.core.config import settings
from app.models.audit_log import AuditLog
from app.models.product_fact import ProductFact
from app.schemas.product_fact_schema import ProductFactDraftCreateRequest
from app.services.audit_service import create_audit_log
from app.services.clara_product_fact_service import (
    FreshnessStatus,
    ProductFactError,
    ProductFactMode,
    ResolutionStatus,
    compose_product_fact_prompt,
    create_product_fact_draft,
    get_freshness_status,
    normalize_product_fact_mode,
    resolve_product_fact,
    transition_product_fact,
)
from app.services.clara_reply_validation_service import (
    ReplyValidationContext,
    evaluate_reply,
)


NOW = datetime(2026, 7, 31, 12, tzinfo=timezone.utc)


def add_fact(
    db: Session,
    *,
    key: str = "account.minimum_opening_amount",
    category: str = "mini",
    value: object = 5_000_000,
    status: str = "ACTIVE",
    revision: int = 1,
    verified_at: datetime | None = NOW,
    effective_from: datetime | None = NOW - timedelta(days=1),
    effective_until: datetime | None = None,
    organization_id=None,
) -> ProductFact:
    fact = ProductFact(
        organization_id=organization_id,
        fact_key=key,
        account_category=category,
        product_code=None,
        value_type="integer" if isinstance(value, int) else "text",
        value=value,
        unit="IDR" if isinstance(value, int) else None,
        lifecycle_status=status,
        effective_from=effective_from,
        effective_until=effective_until,
        last_verified_at=verified_at,
        source_type="test_approved_source",
        source_reference="tests/test_clara_product_fact_registry.py",
        freshness_class=(
            "MEDIUM_VOLATILITY" if isinstance(value, int) else "LOW_VOLATILITY"
        ),
        sensitivity_class="CUSTOMER_SAFE",
        revision=revision,
    )
    db.add(fact)
    db.commit()
    db.refresh(fact)
    return fact


def test_lifecycle_effective_period_and_conflict_fail_closed(
    db_session_factory: sessionmaker,
) -> None:
    db = db_session_factory()
    draft = add_fact(db, status="DRAFT")
    assert (
        resolve_product_fact(
            db,
            fact_key=draft.fact_key,
            account_category="mini",
            organization_id=None,
            now=NOW,
        ).resolution_status
        == ResolutionStatus.UNAPPROVED
    )

    draft.lifecycle_status = "APPROVED"
    draft.effective_from = NOW + timedelta(days=1)
    db.commit()
    assert (
        resolve_product_fact(
            db,
            fact_key=draft.fact_key,
            account_category="mini",
            organization_id=None,
            now=NOW,
        ).resolution_status
        == ResolutionStatus.UNAPPROVED
    )

    draft.lifecycle_status = "EXPIRED"
    db.commit()
    assert (
        resolve_product_fact(
            db,
            fact_key=draft.fact_key,
            account_category="mini",
            organization_id=None,
            now=NOW,
        ).resolution_status
        == ResolutionStatus.EXPIRED
    )

    draft.lifecycle_status = "REVOKED"
    db.commit()
    assert (
        resolve_product_fact(
            db,
            fact_key=draft.fact_key,
            account_category="mini",
            organization_id=None,
            now=NOW,
        ).resolution_status
        == ResolutionStatus.REVOKED
    )

    db.delete(draft)
    db.commit()
    add_fact(db, revision=1)
    add_fact(db, revision=2)
    result = resolve_product_fact(
        db,
        fact_key="account.minimum_opening_amount",
        account_category="mini",
        organization_id=None,
        now=NOW,
    )
    assert result.resolution_status == ResolutionStatus.CONFLICT
    assert result.warnings == ("overlapping_active_revisions",)
    db.close()


def test_freshness_thresholds_and_timezone_boundaries(monkeypatch) -> None:
    monkeypatch.setattr(settings, "clara_product_fact_high_volatility_days", 7)
    monkeypatch.setattr(settings, "clara_product_fact_medium_volatility_days", 30)
    monkeypatch.setattr(settings, "clara_product_fact_low_volatility_days", 90)
    assert (
        get_freshness_status(NOW - timedelta(days=7), "HIGH_VOLATILITY", now=NOW)
        == FreshnessStatus.FRESH
    )
    assert (
        get_freshness_status(NOW - timedelta(days=8), "HIGH_VOLATILITY", now=NOW)
        == FreshnessStatus.STALE
    )
    assert (
        get_freshness_status(NOW - timedelta(days=30), "MEDIUM_VOLATILITY", now=NOW)
        == FreshnessStatus.FRESH
    )
    assert (
        get_freshness_status(NOW - timedelta(days=91), "LOW_VOLATILITY", now=NOW)
        == FreshnessStatus.STALE
    )
    assert (
        get_freshness_status(None, "LOW_VOLATILITY", now=NOW)
        == FreshnessStatus.UNVERIFIED
    )
    naive = NOW.replace(tzinfo=None)
    assert (
        get_freshness_status(naive, "HIGH_VOLATILITY", now=NOW) == FreshnessStatus.FRESH
    )


def test_effective_start_is_inclusive_and_end_is_exclusive(
    db_session_factory: sessionmaker,
) -> None:
    db = db_session_factory()
    fact = add_fact(
        db,
        effective_from=NOW,
        effective_until=NOW + timedelta(hours=1),
    )
    at_start = resolve_product_fact(
        db,
        fact_key=fact.fact_key,
        account_category="mini",
        organization_id=None,
        now=NOW,
    )
    at_end = resolve_product_fact(
        db,
        fact_key=fact.fact_key,
        account_category="mini",
        organization_id=None,
        now=NOW + timedelta(hours=1),
    )
    assert at_start.resolution_status == ResolutionStatus.RESOLVED
    assert at_end.resolution_status == ResolutionStatus.EXPIRED
    db.close()


def test_product_fact_draft_can_be_revoked(
    db_session_factory: sessionmaker,
    seeded_data,
) -> None:
    db = db_session_factory()
    fact = add_fact(db, status="DRAFT")

    transition_product_fact(
        db,
        fact_id=fact.id,
        action="revoke",
        current_user=seeded_data["owner"],
        now=NOW,
    )

    assert fact.lifecycle_status == "REVOKED"
    db.close()


def test_resolution_prefers_exact_category_then_global_not_updated_at(
    db_session_factory: sessionmaker,
) -> None:
    db = db_session_factory()
    global_fact = add_fact(db, category="global", value=4_000_000, revision=3)
    exact = add_fact(db, category="mini", value=5_000_000, revision=1)
    exact.updated_at = NOW - timedelta(days=100)
    global_fact.updated_at = NOW
    db.commit()
    result = resolve_product_fact(
        db,
        fact_key="account.minimum_opening_amount",
        account_category="mini",
        organization_id=None,
        now=NOW,
    )
    assert result.resolution_status == ResolutionStatus.RESOLVED
    assert result.fact_id == exact.id
    assert result.value == 5_000_000
    db.close()


def test_resolution_uses_active_global_when_exact_scope_is_only_revoked(
    db_session_factory: sessionmaker,
) -> None:
    db = db_session_factory()
    global_fact = add_fact(
        db,
        key="process.verification_steps",
        category="global",
        value={"verification_method": "video_call"},
        revision=3,
    )
    add_fact(
        db,
        key="process.verification_steps",
        category="mini",
        value={"verification_method": "legacy"},
        status="REVOKED",
        revision=4,
    )

    result = resolve_product_fact(
        db,
        fact_key="process.verification_steps",
        account_category="mini",
        organization_id=None,
        now=NOW,
    )

    assert result.resolution_status == ResolutionStatus.RESOLVED
    assert result.fact_id == global_fact.id
    db.close()


def test_mode_normalization_shadow_and_registry_prompt_behavior(
    db_session_factory: sessionmaker,
) -> None:
    assert normalize_product_fact_mode(None).mode == ProductFactMode.LEGACY
    assert normalize_product_fact_mode("bad").mode == ProductFactMode.LEGACY
    assert normalize_product_fact_mode(" shadow ").mode == ProductFactMode.SHADOW
    db = db_session_factory()
    add_fact(db, value=6_000_000)
    legacy = "LEGACY FACT Rp5.000.000"
    shadow = compose_product_fact_prompt(
        db,
        mode=ProductFactMode.SHADOW,
        account_category="mini",
        organization_id=None,
        legacy_content=legacy,
        fact_keys=("account.minimum_opening_amount",),
        now=NOW,
    )
    assert shadow.content == legacy
    assert shadow.legacy_registry_mismatch_keys == ("account.minimum_opening_amount",)
    assert not shadow.registry_injection_used

    registry = compose_product_fact_prompt(
        db,
        mode=ProductFactMode.REGISTRY,
        account_category="mini",
        organization_id=None,
        legacy_content=legacy,
        fact_keys=("account.minimum_opening_amount",),
        now=NOW,
    )
    assert "Rp6.000.000" in registry.content
    assert "Rp5.000.000" not in registry.content
    assert registry.registry_injection_used
    assert registry.fact_revision_ids
    assert "source_reference" not in registry.content
    db.close()


def test_active_storage_fact_is_rendered_without_missing_fact_fallback(
    db_session_factory: sessionmaker,
) -> None:
    db = db_session_factory()
    add_fact(
        db,
        key="trading.storage_fee",
        value={
            "XUL10": {
                "buy_usd_per_0_1_lot_per_night": 0.5,
                "sell_usd_per_0_1_lot_per_night": 0.5,
                "vat_percent": 11,
            }
        },
    )

    composition = compose_product_fact_prompt(
        db,
        mode=ProductFactMode.REGISTRY,
        account_category="mini",
        organization_id=None,
        legacy_content="legacy",
        fact_keys=("trading.storage_fee",),
        now=NOW,
    )

    assert composition.resolved_fact_keys == ("trading.storage_fee",)
    assert not composition.fallback_used
    assert "USD 0,5 per 0,1 lot per malam + PPN 11%" in composition.content
    db.close()


def test_active_auto_liquidation_level_is_rendered_from_margin_fact(
    db_session_factory: sessionmaker,
) -> None:
    db = db_session_factory()
    add_fact(
        db,
        key="trading.margin",
        value={"auto_liquidation_level_percent": 30},
    )

    composition = compose_product_fact_prompt(
        db,
        mode=ProductFactMode.REGISTRY,
        account_category="mini",
        organization_id=None,
        legacy_content="legacy",
        fact_keys=("trading.margin",),
        now=NOW,
    )

    assert "auto liquidation pada 30% equity" in composition.content
    db.close()


def test_registry_excludes_stale_fact_and_uses_deterministic_safe_fallback(
    db_session_factory: sessionmaker,
) -> None:
    db = db_session_factory()
    add_fact(db, verified_at=NOW - timedelta(days=31))
    first = compose_product_fact_prompt(
        db,
        mode=ProductFactMode.REGISTRY,
        account_category="mini",
        organization_id=None,
        legacy_content="Rp5.000.000",
        fact_keys=("account.minimum_opening_amount",),
        now=NOW,
    )
    second = compose_product_fact_prompt(
        db,
        mode=ProductFactMode.REGISTRY,
        account_category="mini",
        organization_id=None,
        legacy_content="different legacy",
        fact_keys=("account.minimum_opening_amount",),
        now=NOW,
    )
    assert first.content == second.content
    assert "Rp5.000.000" not in first.content
    assert first.stale_fact_keys == ("account.minimum_opening_amount",)
    assert first.fallback_used
    db.close()


def test_registry_without_database_never_falls_back_to_legacy_value() -> None:
    composition = compose_product_fact_prompt(
        None,
        mode=ProductFactMode.REGISTRY,
        account_category="mini",
        organization_id=None,
        legacy_content="Modal Mini Rp5.000.000",
        fact_keys=("account.minimum_opening_amount",),
        now=NOW,
    )
    assert "Rp5.000.000" not in composition.content
    assert composition.missing_fact_keys == ("account.minimum_opening_amount",)
    assert composition.fallback_used


def test_revision_creation_and_lifecycle_are_deterministic(
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    db = db_session_factory()
    payload = ProductFactDraftCreateRequest(
        fact_key="company.regulator",
        account_category="global",
        value_type="text",
        value="BAPPEBTI",
        source_type="manual_verified",
        source_reference="approved/source",
        freshness_class="LOW_VOLATILITY",
        organization_id=seeded_data["org_a"].id,
    )
    first = create_product_fact_draft(
        db, payload=payload, current_user=seeded_data["admin_a"]
    )
    second = create_product_fact_draft(
        db, payload=payload, current_user=seeded_data["admin_a"]
    )
    assert (first.revision, second.revision) == (1, 2)
    assert second.supersedes_fact_id == first.id
    approved = transition_product_fact(
        db,
        fact_id=first.id,
        action="approve",
        current_user=seeded_data["admin_a"],
        now=NOW,
    )
    assert approved.lifecycle_status == "APPROVED"
    assert approved.last_verified_at.replace(tzinfo=timezone.utc) == NOW
    active = transition_product_fact(
        db,
        fact_id=first.id,
        action="activate",
        current_user=seeded_data["admin_a"],
        now=NOW,
    )
    assert active.lifecycle_status == "ACTIVE"
    db.close()


@pytest.mark.parametrize("marker", ["public_source_conflict", "review_note"])
def test_unresolved_process_fact_cannot_be_activated(
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
    marker: str,
) -> None:
    db = db_session_factory()
    payload = ProductFactDraftCreateRequest(
        fact_key="process.verification_steps",
        account_category="mini",
        value_type="json",
        value={marker: "Needs official review."},
        source_type="internal_draft",
        source_reference="unverified-process-source",
        freshness_class="HIGH_VOLATILITY",
        organization_id=seeded_data["org_a"].id,
    )
    fact = create_product_fact_draft(
        db, payload=payload, current_user=seeded_data["admin_a"]
    )
    transition_product_fact(
        db,
        fact_id=fact.id,
        action="approve",
        current_user=seeded_data["admin_a"],
        now=NOW,
    )

    with pytest.raises(ProductFactError, match="Unresolved process fact"):
        transition_product_fact(
            db,
            fact_id=fact.id,
            action="activate",
            current_user=seeded_data["admin_a"],
            now=NOW,
        )

    db.close()


def test_registry_validator_follows_registry_value_and_shadow_only_records() -> None:
    registry = evaluate_reply(
        "Untuk Mini, modal awalnya Rp6.000.000.",
        ReplyValidationContext(
            latest_customer_intent="minimum_capital",
            product_fact_mode="REGISTRY",
            allowed_minimum_opening_amounts=(6_000_000,),
        ),
    )
    fixed = next(
        item
        for item in registry.validator_results
        if item.validator_id == "unsupported_fixed_sensitive_number"
    )
    assert fixed.passed

    shadow = evaluate_reply(
        "Untuk Mini, modal awalnya Rp6.000.000.",
        ReplyValidationContext(
            latest_customer_intent="minimum_capital",
            product_fact_mode="SHADOW",
            allowed_minimum_opening_amounts=(6_000_000,),
        ),
    )
    fixed = next(
        item
        for item in shadow.validator_results
        if item.validator_id == "unsupported_fixed_sensitive_number"
    )
    assert not fixed.passed
    assert fixed.diagnostic_metadata["legacy_registry_disagreement"] is True


def login(client: TestClient, email: str, password: str) -> None:
    response = client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text


def csrf(client: TestClient) -> dict[str, str]:
    token = client.cookies.get(settings.csrf_cookie_name)
    assert token
    return {"X-CSRF-Token": token}


def draft_payload(organization_id=None) -> dict[str, object]:
    return {
        "fact_key": "company.regulator",
        "account_category": "global",
        "product_code": None,
        "value_type": "text",
        "value": "BAPPEBTI",
        "unit": None,
        "effective_from": None,
        "effective_until": None,
        "last_verified_at": None,
        "source_type": "manual_verified",
        "source_reference": "approved/source",
        "source_hash": None,
        "freshness_class": "LOW_VOLATILITY",
        "sensitivity_class": "CUSTOMER_SAFE",
        "organization_id": str(organization_id) if organization_id else None,
    }


def test_api_authorization_scope_and_lifecycle_audit(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    login(client, seeded_data["marketing_a"].email, "MarketingPass123!")
    denied = client.post(
        "/product-facts/drafts",
        json=draft_payload(),
        headers=csrf(client),
    )
    assert denied.status_code == 403

    client.post("/auth/logout", headers=csrf(client))
    login(client, seeded_data["admin_a"].email, "AdminPass123!")
    wrong_scope = client.post(
        "/product-facts/drafts",
        json=draft_payload(seeded_data["org_b"].id),
        headers=csrf(client),
    )
    assert wrong_scope.status_code == 403

    monkeypatch.setattr(routes_product_facts, "create_audit_log", create_audit_log)
    created = client.post(
        "/product-facts/drafts",
        json=draft_payload(seeded_data["org_a"].id),
        headers=csrf(client),
    )
    assert created.status_code == 201, created.text
    approved = client.post(
        f"/product-facts/{created.json()['id']}/approve",
        headers=csrf(client),
    )
    assert approved.status_code == 200, approved.text
    activated = client.post(
        f"/product-facts/{created.json()['id']}/activate",
        headers=csrf(client),
    )
    assert activated.status_code == 200, activated.text

    db = db_session_factory()
    actions = set(
        db.scalars(
            select(AuditLog.action).where(AuditLog.resource_type == "product_fact")
        ).all()
    )
    assert {
        "product_fact.draft.create",
        "product_fact.approve",
        "product_fact.activate",
    }.issubset(actions)
    db.close()


def test_safe_defaults_remain_unchanged() -> None:
    assert settings.clara_persona_authority_mode == "LEGACY"
    assert settings.clara_semantic_revalidation_mode == "OFF"
    assert settings.clara_policy_enforcement_mode == "OBSERVE"
    assert settings.clara_product_fact_mode == "REGISTRY"
