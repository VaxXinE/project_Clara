import re
from datetime import datetime, timezone
from hashlib import sha256
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.support_knowledge_article import SupportKnowledgeArticle
from app.models.user import User
from app.services.role_service import normalize_role


class SupportKnowledgeError(RuntimeError):
    pass


MISSING_SUPPORT_HANDOFF = "Informasi tersebut perlu dicek oleh petugas yang berwenang. Saya bantu teruskan agar ditangani dengan aman, ya."
STATUS_ACCESS_HANDOFF = "Saya tidak memiliki akses untuk melihat status akun Anda. Saya bantu arahkan ke petugas yang berwenang untuk pengecekan resmi, ya."
SECURITY_SUPPORT_HANDOFF = (
    "Demi keamanan, jangan bagikan OTP, password, atau PIN melalui chat. "
    "Saya tidak dapat login atau mengecek akun menggunakan data akses tersebut. "
    "Untuk pengecekan status, saya bantu arahkan ke petugas yang berwenang "
    "tanpa memakai OTP tersebut."
)
DOCUMENT_PREPARATION_SAFE_FALLBACK = (
    "Demi keamanan, jangan kirim foto KTP atau buku rekening melalui chat ini. "
    "Gunakan hanya fitur unggah atau kanal resmi yang ditentukan perusahaan. "
    "Saya bisa membantu menjelaskan alur amannya tanpa meminta dokumen tersebut."
)
REGISTRATION_CHANNEL_SAFE_FALLBACK = (
    "Kanal pendaftaran harus mengikuti Product Fact aktif. Data tersebut belum "
    "tersedia untuk jawaban ini, jadi saya tidak akan menebak prosedurnya."
)
_PRODUCT_FACT_DUPLICATION = re.compile(
    r"\b(?:rp\s?[\d.]|\d+(?:[.,]\d+)?\s*%|spread|komisi|margin|swap|rollover|modal\s+(?:awal|minimum)|minimum\s+deposit)\b",
    re.I,
)


def safe_support_fallback(topic: str) -> str:
    return {
        "STATUS_REQUEST": STATUS_ACCESS_HANDOFF,
        "SECURITY_CONCERN": SECURITY_SUPPORT_HANDOFF,
        "PASSWORD_SAFETY": SECURITY_SUPPORT_HANDOFF,
        "DOCUMENT_PREPARATION_GENERAL": DOCUMENT_PREPARATION_SAFE_FALLBACK,
        "REGISTRATION_GENERAL": REGISTRATION_CHANNEL_SAFE_FALLBACK,
    }.get(topic, MISSING_SUPPORT_HANDOFF)


def resolve_support_article(
    db: Session,
    *,
    topic: str,
    organization_id: UUID | None,
    now: datetime | None = None,
) -> SupportKnowledgeArticle | None:
    current = now or datetime.now(timezone.utc)
    eligible = (
        SupportKnowledgeArticle.topic == topic,
        SupportKnowledgeArticle.lifecycle_status == "ACTIVE",
        SupportKnowledgeArticle.customer_safe.is_(True),
        SupportKnowledgeArticle.last_verified_at.is_not(None),
        or_(
            SupportKnowledgeArticle.effective_from.is_(None),
            SupportKnowledgeArticle.effective_from <= current,
        ),
        or_(
            SupportKnowledgeArticle.effective_until.is_(None),
            SupportKnowledgeArticle.effective_until > current,
        ),
    )
    if organization_id is not None:
        scoped = list(
            db.scalars(
                select(SupportKnowledgeArticle).where(
                    *eligible,
                    SupportKnowledgeArticle.organization_id == organization_id,
                )
            ).all()
        )
        if scoped:
            return scoped[0] if len(scoped) == 1 else None
    global_candidates = list(
        db.scalars(
            select(SupportKnowledgeArticle).where(
                *eligible,
                SupportKnowledgeArticle.organization_id.is_(None),
            )
        ).all()
    )
    return global_candidates[0] if len(global_candidates) == 1 else None


def create_support_article_draft(
    db: Session,
    *,
    organization_id: UUID | None,
    title: str,
    topic: str,
    support_level: str,
    content: str,
    customer_safe: bool,
    source: str,
    source_reference: str,
    risk_class: str,
    effective_from: datetime | None,
    effective_until: datetime | None,
    current_user: User,
) -> SupportKnowledgeArticle:
    role = normalize_role(current_user.role)
    if role not in {"head", "superadmin"}:
        raise SupportKnowledgeError(
            "Role is not authorized to create support knowledge."
        )
    if role != "superadmin" and organization_id != current_user.organization_id:
        raise SupportKnowledgeError("Organization scope denied.")
    if _PRODUCT_FACT_DUPLICATION.search(content):
        raise SupportKnowledgeError(
            "Support content must not duplicate mutable product facts."
        )
    version = (
        db.scalar(
            select(func.max(SupportKnowledgeArticle.version)).where(
                SupportKnowledgeArticle.organization_id == organization_id,
                SupportKnowledgeArticle.topic == topic,
            )
        )
        or 0
    ) + 1
    if effective_from and effective_until and effective_until <= effective_from:
        raise SupportKnowledgeError("Effective-until must be after effective-from.")
    article = SupportKnowledgeArticle(
        organization_id=organization_id,
        title=title,
        topic=topic,
        support_level=support_level,
        content=content,
        customer_safe=customer_safe,
        lifecycle_status="DRAFT",
        source=source,
        source_reference=source_reference,
        source_hash=content_hash(content),
        version=version,
        risk_class=risk_class,
        effective_from=effective_from,
        effective_until=effective_until,
        created_by_user_id=current_user.id,
    )
    db.add(article)
    db.flush()
    return article


def transition_support_article_lifecycle(
    db: Session,
    *,
    article: SupportKnowledgeArticle,
    action: str,
    current_user: User,
    now: datetime | None = None,
) -> SupportKnowledgeArticle:
    role = normalize_role(current_user.role)
    if role == "sales":
        raise SupportKnowledgeError("Sales cannot govern support knowledge lifecycle.")
    if role != "superadmin" and article.organization_id != current_user.organization_id:
        raise SupportKnowledgeError("Organization scope denied.")
    target_by_action = {
        "approve": "APPROVED",
        "activate": "ACTIVE",
        "retire": "RETIRED",
    }
    allowed_from = {
        "approve": {"DRAFT"},
        "activate": {"APPROVED"},
        "retire": {"DRAFT", "APPROVED", "ACTIVE"},
    }
    if action not in target_by_action or article.lifecycle_status not in allowed_from[action]:
        raise SupportKnowledgeError("Invalid support knowledge lifecycle transition.")
    if action in {"activate", "retire"} and role not in {"head", "superadmin"}:
        raise SupportKnowledgeError(
            "Head review is required for this lifecycle action."
        )
    current = now or datetime.now(timezone.utc)
    if action == "activate":
        if not article.customer_safe or article.last_verified_at is None:
            raise SupportKnowledgeError(
                "Active support knowledge must be verified and customer-safe."
            )
        if article.effective_from and article.effective_from > current:
            raise SupportKnowledgeError("Support article is not effective yet.")
        if article.effective_until and article.effective_until <= current:
            raise SupportKnowledgeError("Support article is expired.")
        conflict = db.scalar(
            select(SupportKnowledgeArticle.id).where(
                SupportKnowledgeArticle.id != article.id,
                SupportKnowledgeArticle.organization_id == article.organization_id,
                SupportKnowledgeArticle.topic == article.topic,
                SupportKnowledgeArticle.lifecycle_status == "ACTIVE",
            )
        )
        if conflict:
            raise SupportKnowledgeError("Conflicting active support article exists.")
    article.lifecycle_status = target_by_action[action]
    if action == "approve":
        article.last_verified_at = current
        article.verified_by_user_id = current_user.id
    db.flush()
    return article


def content_hash(content: str) -> str:
    return sha256(content.encode()).hexdigest()
