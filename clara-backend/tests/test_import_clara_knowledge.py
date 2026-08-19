import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.models.product_knowledge import ProductKnowledge
from app.models.product_fact import ProductFact
from app.models.support_knowledge_article import SupportKnowledgeArticle
from scripts.import_clara_knowledge import (
    KnowledgeImportItem,
    LEGALITY_FACT_DRAFTS,
    LEGALITY_FACT_SOURCE,
    MASTER_KNOWLEDGE_SOURCE,
    MASTER_PROCESS_FACT_DRAFTS,
    MASTER_SUPPORT_DRAFTS,
    PRODUCT_COST_FACT_DRAFTS,
    PRODUCT_COST_FACT_SOURCE,
    build_import_items,
    deactivate_conflicting_import_titles,
    deactivate_retired_imports,
    derive_category,
    humanize_filename,
    normalize_knowledge_title,
    seed_legality_fact_drafts,
    seed_master_process_fact_drafts,
    seed_master_support_drafts,
    seed_product_cost_fact_drafts,
    upsert_knowledge_entries,
)


def test_derive_category_maps_new_solid_prime_files() -> None:
    assert derive_category("02_solid_prime_faq_answer_library.md") == "faq"
    assert (
        derive_category("03_solid_prime_compliance_guardrail_escalation.md")
        == "guardrail"
    )
    assert (
        derive_category("04_solid_prime_product_contract_reference_kb.md")
        == "product_reference"
    )
    assert (
        derive_category("05_solid_prime_website_official_source_kb.md")
        == "official_source"
    )
    assert (
        derive_category("06_solid_prime_lead_qualification_handoff_kb.md") == "handoff"
    )
    assert (
        derive_category("07_solid_prime_conversation_examples_training_dataset_kb.md")
        == "training_examples"
    )
    assert derive_category("MASTER_KNOWLEDGE_V1_8_SAFE.md") == "general"


def test_master_runtime_knowledge_quarantines_unverified_process_claims() -> None:
    knowledge_root = Path(__file__).resolve().parents[2] / "clara_knowledge"

    for variant in ("mini", "regular"):
        content = (
            knowledge_root
            / f"clara_knowledge_{variant}"
            / "MASTER_KNOWLEDGE_V1_8_SAFE.md"
        ).read_text(encoding="utf-8")

        assert "Product Fact ACTIVE dan fresh" in content
        assert "official_mobile_app_only" in content
        assert "website_registration_available: false" in content
        assert "minimal 2 kali transaksi" not in content
        assert "verifikasi data dilakukan" not in content


def test_build_import_items_only_includes_customer_knowledge_files() -> None:
    knowledge_root = Path(__file__).resolve().parents[2] / "clara_knowledge"

    items = build_import_items(knowledge_root)
    mini_titles = {item.title for item, _ in items if item.variant == "mini"}

    assert "Mini | 01 Solid Prime Chatbox System Prompt" not in mini_titles
    assert "Mini | 05 Solid Prime Website Official Source KB" in mini_titles
    assert (
        "Mini | 07 Solid Prime Conversation Examples Training Dataset KB"
        not in mini_titles
    )
    assert "Mini | Product Costs Knowledge" in mini_titles
    assert "Mini | Legality Knowledge" in mini_titles
    assert "Mini | Master Knowledge V1 8 Safe" in mini_titles
    assert "Mini | Product Costs Knowledge Clarification V1 2" in mini_titles
    assert all(
        item.category not in {"instruction", "training_examples"} for item, _ in items
    )


def test_normalize_knowledge_title_handles_case_and_spacing() -> None:
    assert (
        normalize_knowledge_title("  Mini |   KB Addon Bulletproof Solid Prime  ")
        == "mini | kb addon bulletproof solid prime"
    )


def test_humanize_filename_keeps_kb_uppercase() -> None:
    assert (
        humanize_filename("KB_ADDON_BULLETPROOF_SOLID_PRIME.md")
        == "KB Addon Bulletproof Solid Prime"
    )


def test_deactivate_conflicting_import_titles_disables_old_title_variant(
    db_session_factory,
    seeded_data,
) -> None:
    db = db_session_factory()
    owner = seeded_data["owner"]

    old_entry = ProductKnowledge(
        organization_id=None,
        created_by_user_id=owner.id,
        title="Mini | Kb Addon Bulletproof Solid Prime",
        category="product_facts",
        content="old content",
        source_type="markdown_import_mini",
        is_active=True,
    )
    canonical_entry = ProductKnowledge(
        organization_id=None,
        created_by_user_id=owner.id,
        title="Mini | KB Addon Bulletproof Solid Prime",
        category="product_facts",
        content="new content",
        source_type="markdown_import_mini",
        is_active=True,
    )
    db.add_all([old_entry, canonical_entry])
    db.commit()

    items = [
        (
            KnowledgeImportItem(
                variant="mini",
                filename="KB_ADDON_BULLETPROOF_SOLID_PRIME.md",
                title="Mini | KB Addon Bulletproof Solid Prime",
                category="product_facts",
                source_type="markdown_import_mini",
            ),
            Path("dummy.md"),
        ),
    ]

    changed = deactivate_conflicting_import_titles(db, items)
    db.commit()
    db.refresh(old_entry)
    db.refresh(canonical_entry)

    assert changed == 1
    assert old_entry.is_active is False
    assert canonical_entry.is_active is True
    db.close()


def test_legality_facts_are_seeded_as_global_reviewable_drafts(
    db_session_factory,
    seeded_data,
) -> None:
    db = db_session_factory()
    owner = seeded_data["owner"]

    first = seed_legality_fact_drafts(db, created_by_user_id=owner.id)
    db.commit()
    second = seed_legality_fact_drafts(db, created_by_user_id=owner.id)
    db.commit()

    facts = (
        db.query(ProductFact)
        .filter(ProductFact.source_reference == LEGALITY_FACT_SOURCE)
        .all()
    )
    assert len(facts) == len(LEGALITY_FACT_DRAFTS)
    assert all(fact.lifecycle_status == "DRAFT" for fact in facts)
    assert all(fact.account_category == "global" for fact in facts)
    assert all(fact.source_type == "official_website_import" for fact in facts)
    assert all(line.startswith("created product fact draft:") for line in first)
    assert all(line.startswith("preserved product fact draft:") for line in second)
    db.close()


def test_master_process_facts_are_seeded_as_reviewable_drafts(
    db_session_factory,
    seeded_data,
) -> None:
    db = db_session_factory()
    owner = seeded_data["owner"]

    first = seed_master_process_fact_drafts(db, created_by_user_id=owner.id)
    db.commit()
    second = seed_master_process_fact_drafts(db, created_by_user_id=owner.id)
    db.commit()

    facts = (
        db.query(ProductFact)
        .filter(ProductFact.source_reference == MASTER_KNOWLEDGE_SOURCE)
        .all()
    )
    assert len(facts) == len(MASTER_PROCESS_FACT_DRAFTS) * 2
    assert {fact.account_category for fact in facts} == {"mini", "regular"}
    assert all(fact.lifecycle_status == "DRAFT" for fact in facts)
    assert all(fact.source_type == "document_draft" for fact in facts)
    assert all(line.startswith("created product fact draft:") for line in first)
    assert all(line.startswith("preserved product fact draft:") for line in second)
    db.close()


def test_registration_fact_is_activation_ready_and_app_only() -> None:
    registration = next(
        value
        for fact_key, _value_type, value, _unit, _freshness in MASTER_PROCESS_FACT_DRAFTS
        if fact_key == "process.initial_data"
    )

    assert registration["internal_registration_channel"] == "official_mobile_app_only"
    assert registration["website_registration_available"] is False
    assert "public_source_conflict" not in registration


def test_master_support_knowledge_is_seeded_as_idempotent_safe_drafts(
    db_session_factory,
    seeded_data,
) -> None:
    db = db_session_factory()
    owner = seeded_data["owner"]

    first = seed_master_support_drafts(db, created_by_user_id=owner.id)
    db.commit()
    second = seed_master_support_drafts(db, created_by_user_id=owner.id)
    db.commit()

    articles = (
        db.query(SupportKnowledgeArticle)
        .filter(SupportKnowledgeArticle.source_reference == MASTER_KNOWLEDGE_SOURCE)
        .all()
    )
    assert len(articles) == len(MASTER_SUPPORT_DRAFTS)
    assert all(article.lifecycle_status == "DRAFT" for article in articles)
    assert all(article.customer_safe is True for article in articles)
    assert all(line.startswith("created support knowledge draft:") for line in first)
    assert all(line.startswith("preserved support knowledge draft:") for line in second)
    assert {
        "SECURITY_CONCERN",
        "DOCUMENT_PREPARATION_GENERAL",
        "STATUS_REQUEST",
        "REGISTRATION_GENERAL",
        "PLATFORM_GENERAL",
        "VERIFICATION_GENERAL",
    } <= {article.topic for article in articles}
    db.close()


def test_deactivate_retired_imports_disables_old_behavior_documents(
    db_session_factory,
    seeded_data,
) -> None:
    db = db_session_factory()
    owner = seeded_data["owner"]
    retired_entry = ProductKnowledge(
        organization_id=None,
        created_by_user_id=owner.id,
        title="Mini | 01 Solid Prime Chatbox System Prompt",
        category="instruction",
        content="old prompt",
        source_type="markdown_import_mini",
        is_active=True,
    )
    retained_entry = ProductKnowledge(
        organization_id=None,
        created_by_user_id=owner.id,
        title="Mini | Product Costs Knowledge",
        category="product_reference",
        content="safe knowledge",
        source_type="markdown_import_mini",
        is_active=True,
    )
    db.add_all([retired_entry, retained_entry])
    db.commit()

    items = [
        (
            KnowledgeImportItem(
                variant="mini",
                filename="PRODUCT_COSTS_KNOWLEDGE.md",
                title="Mini | Product Costs Knowledge",
                category="product_reference",
                source_type="markdown_import_mini",
            ),
            Path("dummy.md"),
        )
    ]

    assert deactivate_retired_imports(db, items) == 1
    db.commit()
    db.refresh(retired_entry)
    db.refresh(retained_entry)
    assert retired_entry.is_active is False
    assert retained_entry.is_active is True
    db.close()


def test_import_preserves_superadmin_content_and_inactive_state(
    db_session_factory,
    seeded_data,
    tmp_path,
) -> None:
    db = db_session_factory()
    owner = seeded_data["owner"]
    entry = ProductKnowledge(
        organization_id=None,
        created_by_user_id=owner.id,
        title="Mini | Product Costs Knowledge",
        category="product_reference",
        content="Isi yang sudah diedit lewat UI.",
        source_type="markdown_import_mini",
        is_active=False,
    )
    db.add(entry)
    db.commit()
    source = tmp_path / "PRODUCT_COSTS_KNOWLEDGE.md"
    source.write_text("Isi file deploy yang tidak boleh menimpa UI.", encoding="utf-8")
    item = KnowledgeImportItem(
        variant="mini",
        filename=source.name,
        title=entry.title,
        category=entry.category,
        source_type=entry.source_type,
    )

    results = upsert_knowledge_entries(
        db,
        items=[(item, source)],
        created_by_user_id=owner.id,
    )
    db.commit()
    db.refresh(entry)

    assert results == ["preserved: Mini | Product Costs Knowledge"]
    assert entry.content == "Isi yang sudah diedit lewat UI."
    assert entry.is_active is False
    db.close()


def test_product_cost_facts_are_seeded_as_idempotent_unapproved_drafts(
    db_session_factory,
    seeded_data,
) -> None:
    db = db_session_factory()
    owner = seeded_data["owner"]

    first = seed_product_cost_fact_drafts(db, created_by_user_id=owner.id)
    db.commit()
    second = seed_product_cost_fact_drafts(db, created_by_user_id=owner.id)
    db.commit()

    facts = (
        db.query(ProductFact)
        .filter(ProductFact.source_reference == PRODUCT_COST_FACT_SOURCE)
        .all()
    )
    assert len(facts) == len(PRODUCT_COST_FACT_DRAFTS)
    assert all(fact.lifecycle_status == "DRAFT" for fact in facts)
    assert all(fact.last_verified_at is None for fact in facts)
    assert all(fact.account_category == "mini" for fact in facts)
    assert all(fact.source_type == "document_draft" for fact in facts)
    assert all(line.startswith("created product fact draft:") for line in first)
    assert all(line.startswith("preserved product fact draft:") for line in second)
    db.close()
