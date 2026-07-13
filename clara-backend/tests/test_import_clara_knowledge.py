import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.models.product_knowledge import ProductKnowledge
from scripts.import_clara_knowledge import (
    KnowledgeImportItem,
    build_import_items,
    deactivate_conflicting_import_titles,
    derive_category,
    humanize_filename,
    normalize_knowledge_title,
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
        derive_category("06_solid_prime_lead_qualification_handoff_kb.md")
        == "handoff"
    )
    assert (
        derive_category("07_solid_prime_conversation_examples_training_dataset_kb.md")
        == "training_examples"
    )


def test_build_import_items_includes_new_mini_knowledge_files() -> None:
    knowledge_root = Path(__file__).resolve().parents[2] / "clara_knowledge"

    items = build_import_items(knowledge_root)
    mini_titles = {
        item.title
        for item, _ in items
        if item.variant == "mini"
    }

    assert "Mini | 01 Solid Prime Chatbox System Prompt" in mini_titles
    assert "Mini | 05 Solid Prime Website Official Source KB" in mini_titles
    assert "Mini | 07 Solid Prime Conversation Examples Training Dataset KB" in mini_titles


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
