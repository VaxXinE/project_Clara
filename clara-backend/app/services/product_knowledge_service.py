from uuid import UUID

from sqlalchemy import desc, or_, select
from sqlalchemy.orm import Session

from app.models.product_knowledge import ProductKnowledge
from app.models.user import User
from app.schemas.product_knowledge_schema import (
    ProductKnowledgeCreateRequest,
    ProductKnowledgeUpdateRequest,
)
from app.services.access_control_service import AccessDeniedError, ensure_user_has_organization


class ProductKnowledgeError(RuntimeError):
    pass


def list_product_knowledge(
    db: Session,
    current_user: User,
    query: str | None = None,
    category: str | None = None,
    is_active: bool | None = None,
) -> list[ProductKnowledge]:
    ensure_user_has_organization(current_user)

    statement = select(ProductKnowledge).where(
        ProductKnowledge.organization_id == current_user.organization_id
    )

    if query:
        normalized_query = f"%{query.strip()}%"
        statement = statement.where(
            or_(
                ProductKnowledge.title.ilike(normalized_query),
                ProductKnowledge.category.ilike(normalized_query),
                ProductKnowledge.content.ilike(normalized_query),
            )
        )

    if category:
        statement = statement.where(
            ProductKnowledge.category == category.strip().lower()
        )

    if is_active is not None:
        statement = statement.where(ProductKnowledge.is_active.is_(is_active))

    statement = statement.order_by(
        ProductKnowledge.is_active.desc(),
        desc(ProductKnowledge.updated_at),
    )
    return list(db.scalars(statement).all())


def create_product_knowledge(
    db: Session,
    payload: ProductKnowledgeCreateRequest,
    current_user: User,
) -> ProductKnowledge:
    ensure_user_has_organization(current_user)

    entry = ProductKnowledge(
        organization_id=current_user.organization_id,
        title=payload.title.strip(),
        category=payload.category.strip().lower(),
        content=payload.content.strip(),
        source_type=payload.source_type.strip().lower(),
        is_active=payload.is_active,
    )

    db.add(entry)
    db.commit()
    db.refresh(entry)

    return entry


def get_product_knowledge_or_raise(
    db: Session,
    knowledge_id: UUID,
    current_user: User,
) -> ProductKnowledge:
    ensure_user_has_organization(current_user)

    entry = db.get(ProductKnowledge, knowledge_id)

    if entry is None:
        raise ProductKnowledgeError("Product knowledge entry not found.")

    if entry.organization_id != current_user.organization_id:
        raise AccessDeniedError("Product knowledge entry not found.")

    return entry


def update_product_knowledge(
    db: Session,
    knowledge_id: UUID,
    payload: ProductKnowledgeUpdateRequest,
    current_user: User,
) -> ProductKnowledge:
    entry = get_product_knowledge_or_raise(
        db=db,
        knowledge_id=knowledge_id,
        current_user=current_user,
    )

    if payload.title is not None:
        entry.title = payload.title.strip()
    if payload.category is not None:
        entry.category = payload.category.strip().lower()
    if payload.content is not None:
        entry.content = payload.content.strip()
    if payload.source_type is not None:
        entry.source_type = payload.source_type.strip().lower()
    if payload.is_active is not None:
        entry.is_active = payload.is_active

    db.commit()
    db.refresh(entry)

    return entry


def delete_product_knowledge(
    db: Session,
    knowledge_id: UUID,
    current_user: User,
) -> None:
    entry = get_product_knowledge_or_raise(
        db=db,
        knowledge_id=knowledge_id,
        current_user=current_user,
    )

    db.delete(entry)
    db.commit()


def get_active_product_knowledge_for_organization(
    db: Session,
    organization_id: UUID | None,
    limit: int = 20,
) -> list[ProductKnowledge]:
    if organization_id is None:
        return []

    statement = (
        select(ProductKnowledge)
        .where(ProductKnowledge.organization_id == organization_id)
        .where(ProductKnowledge.is_active.is_(True))
        .order_by(desc(ProductKnowledge.updated_at))
        .limit(limit)
    )
    return list(db.scalars(statement).all())
