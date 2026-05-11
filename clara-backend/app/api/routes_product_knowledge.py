from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.db.session import get_db
from app.models.user import User
from app.schemas.product_knowledge_schema import (
    ProductKnowledgeCreateRequest,
    ProductKnowledgeResponse,
    ProductKnowledgeUpdateRequest,
)
from app.services.access_control_service import AccessDeniedError
from app.services.product_knowledge_service import (
    ProductKnowledgeError,
    create_product_knowledge,
    list_product_knowledge,
    update_product_knowledge,
)

router = APIRouter(prefix="/product-knowledge", tags=["product-knowledge"])


@router.get("", response_model=list[ProductKnowledgeResponse])
def list_product_knowledge_endpoint(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("marketing", "admin")),
):
    try:
        return list_product_knowledge(db=db, current_user=current_user)
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
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("marketing", "admin")),
):
    try:
        return create_product_knowledge(
            db=db,
            payload=payload,
            current_user=current_user,
        )
    except AccessDeniedError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc


@router.patch("/{knowledge_id}", response_model=ProductKnowledgeResponse)
def update_product_knowledge_endpoint(
    knowledge_id: UUID,
    payload: ProductKnowledgeUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("marketing", "admin")),
):
    try:
        return update_product_knowledge(
            db=db,
            knowledge_id=knowledge_id,
            payload=payload,
            current_user=current_user,
        )
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
