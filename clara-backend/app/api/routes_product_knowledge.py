from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.db.session import get_db
from app.models.user import User
from app.schemas.product_knowledge_schema import (
    ProductKnowledgeCreateRequest,
    ProductKnowledgeResponse,
    ProductKnowledgeUpdateRequest,
)
from app.services.audit_service import create_audit_log
from app.services.access_control_service import AccessDeniedError
from app.services.product_knowledge_service import (
    ProductKnowledgeError,
    create_product_knowledge,
    delete_product_knowledge,
    list_product_knowledge,
    update_product_knowledge,
)

router = APIRouter(prefix="/product-knowledge", tags=["product-knowledge"])


@router.get("", response_model=list[ProductKnowledgeResponse])
def list_product_knowledge_endpoint(
    q: str | None = Query(default=None, min_length=1, max_length=255),
    category: str | None = Query(default=None, min_length=1, max_length=100),
    is_active: bool | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("marketing", "admin")),
):
    try:
        return list_product_knowledge(
            db=db,
            current_user=current_user,
            query=q,
            category=category,
            is_active=is_active,
        )
    except AccessDeniedError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc


@router.post(
    "",
    response_model=ProductKnowledgeResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_product_knowledge_endpoint(
    payload: ProductKnowledgeCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("owner")),
):
    try:
        entry = create_product_knowledge(
            db=db,
            payload=payload,
            current_user=current_user,
        )
        create_audit_log(
            db=db,
            action="product_knowledge.create",
            resource_type="product_knowledge",
            resource_id=str(entry.id),
            current_user=current_user,
            request=request,
            metadata={
                "title": entry.title,
                "category": entry.category,
                "is_active": entry.is_active,
            },
        )
        return entry
    except AccessDeniedError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc


@router.patch("/{knowledge_id}", response_model=ProductKnowledgeResponse)
def update_product_knowledge_endpoint(
    knowledge_id: UUID,
    payload: ProductKnowledgeUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("owner")),
):
    try:
        entry = update_product_knowledge(
            db=db,
            knowledge_id=knowledge_id,
            payload=payload,
            current_user=current_user,
        )
        create_audit_log(
            db=db,
            action="product_knowledge.update",
            resource_type="product_knowledge",
            resource_id=str(entry.id),
            current_user=current_user,
            request=request,
            metadata={
                "title": entry.title,
                "category": entry.category,
                "is_active": entry.is_active,
            },
        )
        return entry
    except ProductKnowledgeError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except AccessDeniedError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.delete("/{knowledge_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product_knowledge_endpoint(
    knowledge_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("owner")),
) -> Response:
    try:
        delete_product_knowledge(
            db=db,
            knowledge_id=knowledge_id,
            current_user=current_user,
        )
        create_audit_log(
            db=db,
            action="product_knowledge.delete",
            resource_type="product_knowledge",
            resource_id=str(knowledge_id),
            current_user=current_user,
            request=request,
        )
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except ProductKnowledgeError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except AccessDeniedError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
