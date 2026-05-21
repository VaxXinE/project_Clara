from uuid import UUID

from sqlalchemy import desc, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.product_knowledge import ProductKnowledge
from app.models.user import User
from app.schemas.product_knowledge_schema import (
    ProductKnowledgeCreateRequest,
    ProductKnowledgeUpdateRequest,
)
from app.services.access_control_service import AccessDeniedError, ensure_user_has_organization
from app.services.role_service import is_owner_like


class ProductKnowledgeError(RuntimeError):
    pass


def list_product_knowledge(
    db: Session,
    current_user: User,
    query: str | None = None,
    category: str | None = None,
    is_active: bool | None = None,
) -> list[ProductKnowledge]:
    if not is_owner_like(current_user.role):
        ensure_user_has_organization(current_user)

    statement = select(ProductKnowledge).options(
        selectinload(ProductKnowledge.created_by_user)
    )

    if is_owner_like(current_user.role):
        pass
    else:
        statement = statement.where(
            or_(
                ProductKnowledge.organization_id == current_user.organization_id,
                ProductKnowledge.organization_id.is_(None),
            )
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
    if not is_owner_like(current_user.role):
        raise AccessDeniedError("Only superadmin can create product knowledge.")

    entry = ProductKnowledge(
        organization_id=None,
        created_by_user_id=current_user.id,
        title=payload.title.strip(),
        category=payload.category.strip().lower(),
        content=payload.content.strip(),
        source_type=payload.source_type.strip().lower(),
        is_active=payload.is_active,
    )

    db.add(entry)
    db.commit()
    db.refresh(entry)
    entry = (
        db.scalars(
            select(ProductKnowledge)
            .options(selectinload(ProductKnowledge.created_by_user))
            .where(ProductKnowledge.id == entry.id)
        ).first()
        or entry
    )

    return entry


def get_product_knowledge_or_raise(
    db: Session,
    knowledge_id: UUID,
    current_user: User,
) -> ProductKnowledge:
    if not is_owner_like(current_user.role):
        ensure_user_has_organization(current_user)

    entry = (
        db.scalars(
            select(ProductKnowledge)
            .options(selectinload(ProductKnowledge.created_by_user))
            .where(ProductKnowledge.id == knowledge_id)
        ).first()
    )

    if entry is None:
        raise ProductKnowledgeError("Product knowledge entry not found.")

    if is_owner_like(current_user.role):
        return entry

    if (
        entry.organization_id is not None
        and entry.organization_id == current_user.organization_id
    ):
        return entry

    if entry.organization_id is None:
        return entry

    raise AccessDeniedError("Product knowledge entry not found.")


def ensure_can_modify_product_knowledge(
    entry: ProductKnowledge,
    current_user: User,
) -> None:
    if not is_owner_like(current_user.role):
        raise AccessDeniedError("Only superadmin can modify product knowledge.")


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
    ensure_can_modify_product_knowledge(entry=entry, current_user=current_user)

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
    entry = (
        db.scalars(
            select(ProductKnowledge)
            .options(selectinload(ProductKnowledge.created_by_user))
            .where(ProductKnowledge.id == entry.id)
        ).first()
        or entry
    )

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
    ensure_can_modify_product_knowledge(entry=entry, current_user=current_user)

    db.delete(entry)
    db.commit()


def get_active_product_knowledge_for_organization(
    db: Session,
    organization_id: UUID | None,
    limit: int = 20,
) -> list[ProductKnowledge]:
    statement = (
        select(ProductKnowledge)
        .where(
            or_(
                ProductKnowledge.organization_id == organization_id,
                ProductKnowledge.organization_id.is_(None),
            )
        )
        .where(ProductKnowledge.is_active.is_(True))
        .order_by(desc(ProductKnowledge.updated_at))
        .limit(limit)
    )
    return list(db.scalars(statement).all())
