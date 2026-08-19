import argparse
from hashlib import sha256
import json
import os
import sys
from dataclasses import dataclass
from pathlib import Path

from sqlalchemy import desc, select, update
from sqlalchemy.orm import Session

# Add parent directory to path to resolve app module.
sys.path.insert(0, str(Path(__file__).parent.parent))

import app.models  # noqa: F401
from app.core.config import settings
from app.db.session import SessionLocal
from app.models.product_fact import ProductFact
from app.models.product_knowledge import ProductKnowledge
from app.models.support_knowledge_article import SupportKnowledgeArticle
from app.models.user import User


VARIANT_DIRECTORIES = {
    "mini": "clara_knowledge_mini",
    "regular": "clara_knowledge_regular",
}

KNOWLEDGE_FILES_BY_VARIANT = {
    "mini": (
        "02_solid_prime_faq_answer_library.md",
        "04_solid_prime_product_contract_reference_kb.md",
        "05_solid_prime_website_official_source_kb.md",
        "LEGALITY_KNOWLEDGE.md",
        "MASTER_KNOWLEDGE_V1_8_SAFE.md",
        "PRODUCT_COSTS_KNOWLEDGE.md",
        "PRODUCT_COSTS_KNOWLEDGE_CLARIFICATION_V1_2.md",
    ),
    "regular": (
        "LEGALITY_KNOWLEDGE.md",
        "MASTER_KNOWLEDGE_V1_8_SAFE.md",
        "PRODUCT_COSTS_KNOWLEDGE.md",
        "PRODUCT_COSTS_KNOWLEDGE_CLARIFICATION_V1_2.md",
    ),
}

PRODUCT_COST_FACT_SOURCE = "Knowledge Base Tambahan Biaya v1.2 (30 Jul 2026)"
LEGALITY_FACT_SOURCE = "https://www.sg-berjangka.com/tentang-kami/legalitas-bisnis"
MASTER_KNOWLEDGE_SOURCE = "Master Knowledge Base v1.8 (internal, 2026)"

PRODUCT_COST_FACT_DRAFTS = (
    (
        "account.minimum_opening_amount",
        "integer",
        5_000_000,
        "IDR",
        "MEDIUM_VOLATILITY",
    ),
    ("account.minimum_lot", "decimal", 0.1, "lot", "MEDIUM_VOLATILITY"),
    (
        "account.eligible_products",
        "json",
        ["XUL10", "BCO10_BBJ"],
        None,
        "LOW_VOLATILITY",
    ),
    (
        "account.currency",
        "json",
        {"currency": "IDR", "fixed_rate_per_usd": 10_000},
        None,
        "MEDIUM_VOLATILITY",
    ),
    (
        "trading.spread",
        "json",
        {
            "XUL10": {"minimum": 0.20, "unit": "USD/Troy Ounce/side"},
            "BCO10_BBJ": {"minimum": 0.05, "unit": "USD/pips/barrel/side"},
        },
        None,
        "HIGH_VOLATILITY",
    ),
    (
        "trading.commission",
        "json",
        {"amount_usd": 1, "per_lot": 0.1, "vat_percent": 11},
        None,
        "MEDIUM_VOLATILITY",
    ),
    (
        "trading.margin",
        "json",
        {
            "daytrade_usd_per_lot": 100,
            "maximum_equity_idr": 25_000_000,
            "maximum_warning_equity_idr": 23_000_000,
            "call_margin_level_percent": 70,
            "auto_liquidation_level_percent": 30,
            "auto_liquidation_procedure": ["Locking", "Hold", "Open", "ABS", "FIFO"],
            "clear_by_system_basis": "equity ratio",
        },
        None,
        "MEDIUM_VOLATILITY",
    ),
    (
        "trading.storage_fee",
        "json",
        {
            "XUL10": {
                "buy_usd_per_0_1_lot_per_night": 0.5,
                "sell_usd_per_0_1_lot_per_night": 0.5,
                "vat_percent": 11,
            },
            "BCO10_BBJ": {
                "buy_usd_per_0_1_lot_per_night": 0.5,
                "sell_usd_per_0_1_lot_per_night": 0.5,
                "vat_percent": 11,
            },
        },
        None,
        "MEDIUM_VOLATILITY",
    ),
    (
        "trading.overnight_requirement",
        "text",
        "No overnight call margin (nightrade) according to the draft source document.",
        None,
        "MEDIUM_VOLATILITY",
    ),
    (
        "trading.instruments",
        "json",
        {
            "XUL10": {
                "contract_size": "100 Troy Ounce",
                "trading_days": "Monday-Friday",
                "trading_hours_dst_wib": "06:00-03:30",
                "trading_hours_non_dst_wib": "06:00-04:30",
                "minimum_price_movement": "USD 0.01/Troy Ounce",
                "range_limit_stop_order": "USD 6-USD 20",
                "maximum_net_open_position_lot": 0.9,
            },
            "BCO10_BBJ": {
                "contract_size_source_text": "USD 1.000/Barrel",
                "trading_days": "Monday-Friday",
                "trading_hours_dst_wib": "07:00-03:45",
                "trading_hours_non_dst_wib": "08:00-03:45",
                "minimum_price_movement": "USD 0.01/Barrel",
                "range_limit_stop_order": "USD 1-USD 20",
                "maximum_net_open_position_lot": 0.9,
            },
        },
        None,
        "LOW_VOLATILITY",
    ),
    (
        "process.verification_steps",
        "json",
        {"default_otp_delivery": "email"},
        None,
        "MEDIUM_VOLATILITY",
    ),
)

LEGALITY_FACT_DRAFTS = (
    (
        "company.regulator",
        "text",
        "BAPPEBTI",
        None,
        "MEDIUM_VOLATILITY",
    ),
    (
        "company.regulatory_status",
        "text",
        (
            "PT Solid Gold Berjangka adalah pialang berjangka terdaftar dan "
            "diawasi BAPPEBTI, anggota BBJ dan KBI, serta memiliki persetujuan "
            "OJK dan pendaftaran Bank Indonesia untuk layanan tertentu."
        ),
        None,
        "MEDIUM_VOLATILITY",
    ),
    (
        "company.license_reference",
        "json",
        {
            "documents": [
                {
                    "name": "Akta Pendirian Perseroan Terbatas",
                    "number": "52",
                    "year": 2002,
                },
                {
                    "name": "Pengesahan Departemen Kehakiman dan HAM",
                    "number": "C-05612 HT.01.01.TH.2002",
                    "year": 2002,
                },
                {
                    "name": "Surat Persetujuan Anggota Bursa",
                    "number": "SPAB-047/BBJ/07/02",
                    "year": 2002,
                },
                {
                    "name": "Izin Usaha Pialang Berjangka",
                    "number": "161/BAPPEBTI/SI/IX/2002",
                    "year": 2002,
                },
                {
                    "name": "Keanggotaan Lembaga Kliring Berjangka",
                    "number": "15/AK-KBI/V/2003",
                    "year": 2003,
                },
                {
                    "name": "Kerja sama dengan PT Royal Assetindo",
                    "number": "262/CO-BOD/SGB/VI/2005",
                    "year": 2005,
                },
                {
                    "name": "Persetujuan sebagai Peserta SPA",
                    "number": "1156/BAPPEBTI/SI/3/2007",
                    "year": 2007,
                },
                {
                    "name": "Penerimaan Nasabah Secara Elektronik",
                    "number": "27/BAPPEBTI/KEP-PBK/09/2014",
                    "year": 2014,
                },
                {
                    "name": (
                        "Persetujuan Prinsip Perantara Perdagangan Efek "
                        "Derivatif Keuangan"
                    ),
                    "number": "S-373/PM.02/2025",
                    "authority": "OJK",
                    "year": 2025,
                },
                {
                    "name": "Peserta Sistem Perdagangan Alternatif Derivatif PUVA",
                    "number": "27/663/DPPK/Srt/B",
                    "authority": "Bank Indonesia",
                    "year": 2025,
                },
            ],
            "source_updated_at": "2026-07-15T04:44:12+07:00",
        },
        None,
        "MEDIUM_VOLATILITY",
    ),
)

MASTER_PROCESS_FACT_DRAFTS = (
    (
        "process.initial_data",
        "json",
        {
            "assistant_name": "Clara",
            "official_app_name": "SOLID",
            "android_url": (
                "https://play.google.com/store/apps/details?"
                "id=com.solidgoldberjangka.minimicro&hl=id"
            ),
            "ios_url": "https://apps.apple.com/id/app/solid/id6756168987?l=id",
            "internal_registration_channel": "official_mobile_app_only",
            "website_registration_available": False,
            "registration_instruction": (
                "Pendaftaran hanya melalui aplikasi resmi SOLID; pendaftaran "
                "melalui website sudah tidak tersedia."
            ),
        },
        None,
        "HIGH_VOLATILITY",
    ),
    (
        "process.verification_steps",
        "json",
        {
            "demo_transactions_required_before_real_account": 2,
            "verification_role": "Wakil Pialang Berjangka (WPB)",
            "verification_method": "video_call",
            "activation_after_verification": True,
            "review_note": "Internal v1.8 claim; verify against current operating SOP.",
        },
        None,
        "HIGH_VOLATILITY",
    ),
    (
        "process.kyc_requirements",
        "json",
        {
            "agreement_documents": [
                "Aplikasi Perjanjian",
                "Dokumen Pemberitahuan Adanya Risiko (DPAR)",
                "Perjanjian Pemberian Amanat (PPA)",
                "Mekanisme Transaksi / Trading Rules",
            ],
            "identity_documents": "Follow the current official application flow.",
            "chat_safety": "Never request sensitive documents in general chat.",
        },
        None,
        "HIGH_VOLATILITY",
    ),
)

MASTER_SUPPORT_DRAFTS = (
    (
        "SECURITY_CONCERN",
        "Keamanan OTP, password, dan PIN",
        (
            "Demi keamanan, jangan bagikan OTP, password, atau PIN melalui chat. "
            "Saya tidak dapat login atau mengecek akun menggunakan data akses "
            "tersebut. Untuk pengecekan status, saya bantu arahkan ke petugas "
            "yang berwenang tanpa memakai data akses tersebut."
        ),
        "HIGH",
    ),
    (
        "DOCUMENT_PREPARATION_GENERAL",
        "Pengiriman dokumen melalui kanal resmi",
        (
            "Demi keamanan, jangan kirim foto KTP atau buku rekening melalui "
            "chat ini. Gunakan hanya fitur unggah atau kanal resmi yang ditentukan "
            "perusahaan. Saya bisa membantu menjelaskan alur amannya tanpa meminta "
            "dokumen tersebut."
        ),
        "HIGH",
    ),
    (
        "STATUS_REQUEST",
        "Pengecekan status oleh petugas berwenang",
        (
            "Saya tidak memiliki akses untuk melihat status akun Anda. Saya bantu "
            "arahkan ke petugas yang berwenang untuk pengecekan resmi, tanpa "
            "meminta password, PIN, atau OTP."
        ),
        "HIGH",
    ),
    (
        "REGISTRATION_GENERAL",
        "Pendaftaran akun melalui aplikasi SOLID",
        (
            "Aplikasi SOLID adalah aplikasi trading resmi PT Solid Gold Berjangka "
            "dan tersedia di Google Play Store serta App Store. Pendaftaran hanya "
            "dilakukan melalui aplikasi SOLID; pendaftaran melalui website sudah "
            "tidak tersedia."
        ),
        "MEDIUM",
    ),
    (
        "PLATFORM_GENERAL",
        "Aplikasi SOLID resmi",
        (
            "Aplikasi SOLID adalah aplikasi trading resmi PT Solid Gold Berjangka. "
            "Gunakan tautan store resmi dan jangan kirim password, PIN, atau OTP "
            "melalui chat. Jika ada kendala teknis, saya bantu teruskan ke petugas."
        ),
        "LOW",
    ),
    (
        "VERIFICATION_GENERAL",
        "Verifikasi akun — konfirmasi SOP terbaru",
        (
            "Metode dan jadwal verifikasi mengikuti SOP terbaru perusahaan. Jangan "
            "kirim password, PIN, OTP, atau dokumen sensitif melalui chat umum; "
            "saya bantu teruskan ke petugas untuk memastikan langkah resminya."
        ),
        "MEDIUM",
    ),
)


@dataclass(frozen=True)
class KnowledgeImportItem:
    variant: str
    filename: str
    title: str
    category: str
    source_type: str


@dataclass(frozen=True)
class KnowledgeImportResult:
    changed: bool
    message_lines: list[str]


class KnowledgeImportError(RuntimeError):
    pass


def get_repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def get_knowledge_root() -> Path:
    custom_dir = (
        os.getenv("CLARA_KNOWLEDGE_DIR") or settings.clara_knowledge_dir or ""
    ).strip()
    if custom_dir:
        return Path(custom_dir).expanduser().resolve()

    return get_repo_root() / "clara_knowledge"


def get_variant_dir(root_dir: Path, variant: str) -> Path:
    directory_name = VARIANT_DIRECTORIES[variant]
    candidate_dir = root_dir / directory_name
    if candidate_dir.exists():
        return candidate_dir

    if root_dir.name == directory_name:
        return root_dir

    raise KnowledgeImportError(
        f"Folder knowledge varian {variant} tidak ditemukan di {candidate_dir}"
    )


def get_owner_by_email(db: Session, email: str) -> User | None:
    normalized_email = email.strip().lower()
    return db.scalars(select(User).where(User.email == normalized_email)).first()


def list_superadmins(db: Session) -> list[User]:
    return db.scalars(
        select(User).where(User.role == "superadmin").order_by(User.created_at.asc())
    ).all()


def resolve_knowledge_owner(
    db: Session,
    *,
    owner_email: str,
) -> User | None:
    normalized_email = owner_email.strip().lower()
    if normalized_email:
        owner = get_owner_by_email(db=db, email=normalized_email)

        if owner is None:
            raise KnowledgeImportError(
                f"Superadmin untuk import knowledge tidak ditemukan: {normalized_email}"
            )

        if owner.role != "superadmin":
            raise KnowledgeImportError(
                f"User {owner.email} ditemukan, tapi rolenya {owner.role}, "
                "bukan superadmin."
            )

        return owner

    superadmins = list_superadmins(db)
    if not superadmins:
        raise KnowledgeImportError(
            "Tidak ada user superadmin di database. "
            "Buat superadmin dulu sebelum import knowledge."
        )

    if len(superadmins) == 1:
        return superadmins[0]

    available_emails = ", ".join(user.email for user in superadmins)
    raise KnowledgeImportError(
        "Ditemukan lebih dari satu superadmin. "
        "Tentukan owner secara eksplisit dengan "
        "`--owner-email` atau env `CLARA_KNOWLEDGE_OWNER_EMAIL`. "
        f"Pilihan yang tersedia: {available_emails}"
    )


def load_file_content(file_path: Path) -> str:
    if not file_path.exists():
        raise KnowledgeImportError(f"File knowledge tidak ditemukan: {file_path}")

    content = file_path.read_text(encoding="utf-8").strip()
    if not content:
        raise KnowledgeImportError(f"File knowledge kosong: {file_path}")

    return content


def derive_category(filename: str) -> str:
    stem = filename.removesuffix(".md").upper()
    if "FAQ" in stem:
        return "faq"
    if "OBJECTION" in stem:
        return "objection_handling"
    if "POSITIONING" in stem:
        return "positioning"
    if "GUARDRAIL" in stem:
        return "guardrail"
    if "COMPLIANCE" in stem or "ESCALATION" in stem:
        return "guardrail"
    if "FLOW" in stem:
        return "workflow"
    if "PERSONALITY" in stem:
        return "personality_mode"
    if "CLOSING" in stem:
        return "closing_engine"
    if "HANDOFF" in stem or "QUALIFICATION" in stem:
        return "handoff"
    if "CONVERSION" in stem:
        return "conversion_engine"
    if "OFFICIAL_SOURCE" in stem or "WEBSITE" in stem:
        return "official_source"
    if "PRODUCT_CONTRACT_REFERENCE" in stem:
        return "product_reference"
    if "PRODUCT_COSTS_KNOWLEDGE" in stem:
        return "product_reference"
    if "LEGALITY_KNOWLEDGE" in stem:
        return "official_legality"
    if "MASTER_KNOWLEDGE" in stem:
        return "general"
    if "CHATBOX_SYSTEM_PROMPT" in stem:
        return "instruction"
    if "TRAINING_DATASET" in stem or "EXAMPLES" in stem:
        return "training_examples"
    if "KB_ADDON" in stem or "SALES_KNOWLEDGE_BRIDGE" in stem:
        return "product_facts"
    if "AUTO_ADAPT" in stem:
        return "auto_adapt"
    if "INSTRUCTION" in stem:
        return "instruction"
    return "general"


def humanize_filename(filename: str) -> str:
    stem = filename.removesuffix(".md").replace("_", " ").strip().title()
    return (
        stem.replace("Kb ", "KB ", 1)
        .replace(" Kb ", " KB ")
        .replace(" Kb", " KB")
        .replace("Faq", "FAQ")
        .replace("Ai ", "AI ")
    )


def normalize_knowledge_title(title: str) -> str:
    return " ".join(title.strip().lower().split())


def build_import_items(knowledge_root: Path) -> list[tuple[KnowledgeImportItem, Path]]:
    items: list[tuple[KnowledgeImportItem, Path]] = []
    for variant in ("mini", "regular"):
        variant_dir = get_variant_dir(knowledge_root, variant)
        filenames = {path.name for path in variant_dir.glob("*.md")}
        ordered = [
            name for name in KNOWLEDGE_FILES_BY_VARIANT[variant] if name in filenames
        ]

        for filename in ordered:
            source_type = f"markdown_import_{variant}"
            item = KnowledgeImportItem(
                variant=variant,
                filename=filename,
                title=f"{variant.title()} | {humanize_filename(filename)}",
                category=derive_category(filename),
                source_type=source_type,
            )
            items.append((item, variant_dir / filename))

    return items


def deactivate_legacy_imports(db: Session) -> int:
    result = db.execute(
        update(ProductKnowledge)
        .where(
            ProductKnowledge.organization_id.is_(None),
            ProductKnowledge.source_type == "markdown_import",
            ProductKnowledge.is_active.is_(True),
        )
        .values(is_active=False)
    )
    return int(result.rowcount or 0)


def deactivate_conflicting_import_titles(
    db: Session,
    items: list[tuple[KnowledgeImportItem, Path]],
) -> int:
    if not items:
        return 0

    source_types = sorted({item.source_type for item, _ in items})
    canonical_title_by_key = {
        (normalize_knowledge_title(item.title), item.source_type): item.title
        for item, _ in items
    }
    rows = db.scalars(
        select(ProductKnowledge).where(
            ProductKnowledge.organization_id.is_(None),
            ProductKnowledge.source_type.in_(source_types),
            ProductKnowledge.is_active.is_(True),
        )
    ).all()

    deactivated_count = 0
    for row in rows:
        normalized_key = (normalize_knowledge_title(row.title), row.source_type)
        canonical_title = canonical_title_by_key.get(normalized_key)
        if canonical_title is None:
            continue
        if row.title == canonical_title:
            continue

        row.is_active = False
        db.add(row)
        deactivated_count += 1

    return deactivated_count


def deactivate_retired_imports(
    db: Session,
    items: list[tuple[KnowledgeImportItem, Path]],
) -> int:
    active_titles_by_source = {
        source_type: {
            item.title for item, _ in items if item.source_type == source_type
        }
        for source_type in (
            "markdown_import_mini",
            "markdown_import_regular",
        )
    }
    rows = db.scalars(
        select(ProductKnowledge).where(
            ProductKnowledge.organization_id.is_(None),
            ProductKnowledge.source_type.in_(active_titles_by_source),
            ProductKnowledge.is_active.is_(True),
        )
    ).all()
    retired = 0
    for row in rows:
        if row.title in active_titles_by_source[row.source_type]:
            continue
        row.is_active = False
        db.add(row)
        retired += 1
    return retired


def get_existing_entries(
    db: Session,
    items: list[tuple[KnowledgeImportItem, Path]],
) -> dict[tuple[str, str], ProductKnowledge]:
    if not items:
        return {}

    titles = [item.title for item, _ in items]
    source_types = sorted({item.source_type for item, _ in items})
    entries = db.scalars(
        select(ProductKnowledge).where(
            ProductKnowledge.organization_id.is_(None),
            ProductKnowledge.title.in_(titles),
            ProductKnowledge.source_type.in_(source_types),
        )
    ).all()
    return {(entry.title, entry.source_type): entry for entry in entries}


def upsert_knowledge_entries(
    db: Session,
    *,
    items: list[tuple[KnowledgeImportItem, Path]],
    created_by_user_id,
) -> list[str]:
    existing_entries = get_existing_entries(db=db, items=items)
    results: list[str] = []

    for item, file_path in items:
        existing_entry = existing_entries.get((item.title, item.source_type))

        if existing_entry is None:
            content = load_file_content(file_path)
            db.add(
                ProductKnowledge(
                    organization_id=None,
                    created_by_user_id=created_by_user_id,
                    title=item.title,
                    category=item.category,
                    content=content,
                    source_type=item.source_type,
                    is_active=True,
                )
            )
            results.append(f"created: {item.title}")
            continue

        results.append(f"preserved: {item.title}")

    return results


def _seed_product_fact_drafts(
    db: Session,
    *,
    created_by_user_id,
    account_category: str,
    source_type: str,
    source_reference: str,
    drafts,
) -> list[str]:
    existing_keys = set(
        db.execute(
            select(
                ProductFact.fact_key,
                ProductFact.account_category,
                ProductFact.product_code,
            ).where(ProductFact.source_reference == source_reference)
        ).all()
    )
    results: list[str] = []

    for fact_key, value_type, value, unit, freshness_class in drafts:
        scope = (fact_key, account_category, None)
        if scope in existing_keys:
            results.append(f"preserved product fact draft: {fact_key}")
            continue

        latest = db.scalars(
            select(ProductFact)
            .where(
                ProductFact.organization_id.is_(None),
                ProductFact.fact_key == fact_key,
                ProductFact.account_category == account_category,
                ProductFact.product_code.is_(None),
            )
            .order_by(desc(ProductFact.revision))
        ).first()
        encoded_value = json.dumps(
            value, ensure_ascii=False, sort_keys=True, separators=(",", ":")
        )
        db.add(
            ProductFact(
                organization_id=None,
                fact_key=fact_key,
                account_category=account_category,
                product_code=None,
                value_type=value_type,
                value=value,
                unit=unit,
                lifecycle_status="DRAFT",
                effective_from=None,
                effective_until=None,
                last_verified_at=None,
                verified_by_user_id=None,
                source_type=source_type,
                source_reference=source_reference,
                source_hash=sha256(encoded_value.encode("utf-8")).hexdigest(),
                freshness_class=freshness_class,
                sensitivity_class="CUSTOMER_SAFE",
                revision=(latest.revision + 1 if latest else 1),
                supersedes_fact_id=latest.id if latest else None,
                created_by_user_id=created_by_user_id,
            )
        )
        results.append(f"created product fact draft: {fact_key}")

    return results


def seed_product_cost_fact_drafts(
    db: Session,
    *,
    created_by_user_id,
) -> list[str]:
    return _seed_product_fact_drafts(
        db,
        created_by_user_id=created_by_user_id,
        account_category="mini",
        source_type="document_draft",
        source_reference=PRODUCT_COST_FACT_SOURCE,
        drafts=PRODUCT_COST_FACT_DRAFTS,
    )


def seed_legality_fact_drafts(
    db: Session,
    *,
    created_by_user_id,
) -> list[str]:
    return _seed_product_fact_drafts(
        db,
        created_by_user_id=created_by_user_id,
        account_category="global",
        source_type="official_website_import",
        source_reference=LEGALITY_FACT_SOURCE,
        drafts=LEGALITY_FACT_DRAFTS,
    )


def seed_master_process_fact_drafts(
    db: Session,
    *,
    created_by_user_id,
) -> list[str]:
    results: list[str] = []
    for account_category in ("mini", "regular"):
        results.extend(
            _seed_product_fact_drafts(
                db,
                created_by_user_id=created_by_user_id,
                account_category=account_category,
                source_type="document_draft",
                source_reference=MASTER_KNOWLEDGE_SOURCE,
                drafts=MASTER_PROCESS_FACT_DRAFTS,
            )
        )
    return results


def seed_master_support_drafts(
    db: Session,
    *,
    created_by_user_id,
) -> list[str]:
    existing_topics = set(
        db.scalars(
            select(SupportKnowledgeArticle.topic).where(
                SupportKnowledgeArticle.source_reference == MASTER_KNOWLEDGE_SOURCE
            )
        ).all()
    )
    results: list[str] = []
    for topic, title, content, risk_class in MASTER_SUPPORT_DRAFTS:
        if topic in existing_topics:
            results.append(f"preserved support knowledge draft: {topic}")
            continue
        latest_version = (
            db.scalar(
                select(SupportKnowledgeArticle.version)
                .where(
                    SupportKnowledgeArticle.organization_id.is_(None),
                    SupportKnowledgeArticle.topic == topic,
                )
                .order_by(desc(SupportKnowledgeArticle.version))
            )
            or 0
        )
        db.add(
            SupportKnowledgeArticle(
                organization_id=None,
                title=title,
                topic=topic,
                support_level="LEVEL_1",
                content=content,
                customer_safe=True,
                lifecycle_status="DRAFT",
                source="internal_master_kb",
                source_reference=MASTER_KNOWLEDGE_SOURCE,
                source_hash=sha256(content.encode("utf-8")).hexdigest(),
                version=latest_version + 1,
                risk_class=risk_class,
                created_by_user_id=created_by_user_id,
            )
        )
        results.append(f"created support knowledge draft: {topic}")
    return results


def run_import(
    db: Session | None = None,
    *,
    owner_email: str | None = None,
) -> KnowledgeImportResult:
    knowledge_root = get_knowledge_root()

    if not knowledge_root.exists():
        raise KnowledgeImportError(
            f"Folder knowledge tidak ditemukan di {knowledge_root}"
        )

    resolved_owner_email = (
        owner_email
        or os.getenv("CLARA_KNOWLEDGE_OWNER_EMAIL")
        or settings.clara_knowledge_owner_email
        or ""
    ).strip()
    created_by_user_id = None
    owns_session = db is None
    session = db or SessionLocal()

    try:
        owner = resolve_knowledge_owner(
            db=session,
            owner_email=resolved_owner_email,
        )
        created_by_user_id = owner.id

        imported_items = build_import_items(knowledge_root)
        legacy_deactivated_count = deactivate_legacy_imports(session)
        conflicting_title_deactivated_count = deactivate_conflicting_import_titles(
            session,
            imported_items,
        )
        retired_import_deactivated_count = deactivate_retired_imports(
            session,
            imported_items,
        )
        results = upsert_knowledge_entries(
            session,
            items=imported_items,
            created_by_user_id=created_by_user_id,
        )
        fact_results = seed_product_cost_fact_drafts(
            session,
            created_by_user_id=created_by_user_id,
        )
        fact_results.extend(
            seed_legality_fact_drafts(
                session,
                created_by_user_id=created_by_user_id,
            )
        )
        fact_results.extend(
            seed_master_process_fact_drafts(
                session,
                created_by_user_id=created_by_user_id,
            )
        )
        support_results = seed_master_support_drafts(
            session,
            created_by_user_id=created_by_user_id,
        )
        session.commit()

        message_lines = ["Import Clara knowledge selesai:"]
        if legacy_deactivated_count:
            message_lines.append(
                f"- legacy markdown_import dinonaktifkan: {legacy_deactivated_count}"
            )
        if conflicting_title_deactivated_count:
            message_lines.append(
                "- knowledge duplikat title konflik dinonaktifkan: "
                f"{conflicting_title_deactivated_count}"
            )
        if retired_import_deactivated_count:
            message_lines.append(
                "- import non-knowledge dinonaktifkan: "
                f"{retired_import_deactivated_count}"
            )
        message_lines.extend(f"- {result}" for result in results)
        message_lines.extend(f"- {result}" for result in fact_results)
        message_lines.extend(f"- {result}" for result in support_results)

        return KnowledgeImportResult(
            changed=bool(
                legacy_deactivated_count
                or conflicting_title_deactivated_count
                or retired_import_deactivated_count
                or any(result.startswith("created:") for result in results)
                or any(
                    result.startswith("created product fact draft:")
                    for result in fact_results
                )
                or any(
                    result.startswith("created support knowledge draft:")
                    for result in support_results
                )
            ),
            message_lines=message_lines,
        )
    except KnowledgeImportError:
        session.rollback()
        raise
    finally:
        if owns_session:
            session.close()


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Import Clara knowledge markdown ke tabel product_knowledge."
    )
    parser.add_argument(
        "--owner-email",
        help=(
            "Email superadmin yang akan dicatat sebagai pembuat knowledge. "
            "Kalau tidak diisi, script akan pakai env "
            "CLARA_KNOWLEDGE_OWNER_EMAIL atau auto-detect bila hanya ada satu "
            "superadmin di database."
        ),
    )
    args = parser.parse_args()

    try:
        result = run_import(owner_email=args.owner_email)
    except KnowledgeImportError as exc:
        print(f"Import gagal: {exc}")
        return 1

    for line in result.message_lines:
        print(line)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
