from datetime import datetime, timezone
from hashlib import sha256
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.support_knowledge_article import SupportKnowledgeArticle


def resolve_support_article(
    db: Session,
    *,
    topic: str,
    organization_id: UUID | None,
    now: datetime | None = None,
) -> SupportKnowledgeArticle | None:
    current = now or datetime.now(timezone.utc)
    candidates = db.scalars(
        select(SupportKnowledgeArticle)
        .where(
            SupportKnowledgeArticle.topic == topic,
            SupportKnowledgeArticle.lifecycle_status == "ACTIVE",
            SupportKnowledgeArticle.customer_safe.is_(True),
            SupportKnowledgeArticle.last_verified_at.is_not(None),
            or_(
                SupportKnowledgeArticle.organization_id == organization_id,
                SupportKnowledgeArticle.organization_id.is_(None),
            ),
            or_(
                SupportKnowledgeArticle.effective_from.is_(None),
                SupportKnowledgeArticle.effective_from <= current,
            ),
            or_(
                SupportKnowledgeArticle.effective_until.is_(None),
                SupportKnowledgeArticle.effective_until > current,
            ),
        )
        .order_by(
            SupportKnowledgeArticle.organization_id.desc().nullslast(),
            SupportKnowledgeArticle.version.desc(),
        )
    ).all()
    return candidates[0] if candidates else None


def content_hash(content: str) -> str:
    return sha256(content.encode()).hexdigest()


MISSING_SUPPORT_HANDOFF = "Informasi tersebut perlu dicek oleh petugas yang berwenang. Saya bantu teruskan agar ditangani dengan aman, ya."
STATUS_ACCESS_HANDOFF = "Saya tidak memiliki akses untuk melihat status akun Anda. Saya bantu arahkan ke petugas yang berwenang untuk pengecekan resmi, ya."
