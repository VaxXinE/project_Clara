from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.db.session import get_db
from app.models.user import User
from app.services.audit_service import create_audit_log
from app.schemas.organization_schema import (
    CreateOrganizationRequest,
    OrganizationResponse,
    UpdateOrganizationRequest,
)
from app.services.organization_service import (
    OrganizationError,
    create_organization,
    list_organizations,
    update_organization,
)

router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.post(
    "",
    response_model=OrganizationResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_organization_endpoint(
    payload: CreateOrganizationRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("superadmin")),
):
    try:
        organization = create_organization(db=db, payload=payload)
    except OrganizationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    create_audit_log(
        db=db,
        action="organization.create",
        resource_type="organization",
        resource_id=str(organization.id),
        current_user=current_user,
        request=request,
        metadata={"slug": organization.slug},
    )
    return organization


@router.get("", response_model=list[OrganizationResponse])
def list_organizations_endpoint(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("superadmin")),
):
    return list_organizations(db=db)


@router.patch("/{organization_id}", response_model=OrganizationResponse)
def update_organization_endpoint(
    organization_id: UUID,
    payload: UpdateOrganizationRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("superadmin")),
):
    try:
        organization = update_organization(
            db=db,
            organization_id=organization_id,
            payload=payload,
        )
    except OrganizationError as exc:
        status_code = (
            status.HTTP_404_NOT_FOUND
            if "not found" in str(exc).lower()
            else status.HTTP_400_BAD_REQUEST
        )
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc

    create_audit_log(
        db=db,
        action="organization.update",
        resource_type="organization",
        resource_id=str(organization.id),
        current_user=current_user,
        request=request,
        metadata={"slug": organization.slug},
    )
    return organization
