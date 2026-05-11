from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.db.session import get_db
from app.models.user import User
from app.schemas.organization_schema import (
    CreateOrganizationRequest,
    OrganizationResponse,
)
from app.services.organization_service import (
    OrganizationError,
    create_organization,
    list_organizations,
)

router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.post(
    "",
    response_model=OrganizationResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_organization_endpoint(
    payload: CreateOrganizationRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("owner", "admin")),
):
    try:
        return create_organization(db=db, payload=payload)
    except OrganizationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.get("", response_model=list[OrganizationResponse])
def list_organizations_endpoint(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("owner", "admin")),
):
    return list_organizations(db=db)