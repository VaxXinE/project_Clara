from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.db.session import get_db
from app.models.user import User
from app.schemas.lead_schema import (
    CustomerProfileMergeRequest,
    CustomerProfileListItem,
    CustomerProfileSummaryItem,
    CustomerProfileUpdateRequest,
)
from app.services.audit_service import create_audit_log
from app.services.customer_profile_service import (
    get_customer_profile_for_user,
    list_customer_profiles_for_user,
    merge_customer_profiles,
    update_customer_profile_for_user,
)

router = APIRouter(prefix="/customers", tags=["customers"])


@router.get("", response_model=list[CustomerProfileListItem])
def list_customer_profiles(
    q: str | None = Query(default=None),
    status_value: str | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("sales", "manager", "head", "superadmin")),
) -> list[CustomerProfileListItem]:
    return [
        CustomerProfileListItem(**item)
        for item in list_customer_profiles_for_user(
            db=db,
            current_user=current_user,
            query=q,
            status_value=status_value,
        )
    ]


@router.get("/{customer_profile_id}", response_model=CustomerProfileSummaryItem)
def get_customer_profile(
    customer_profile_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("sales", "manager", "head", "superadmin")),
) -> CustomerProfileSummaryItem:
    return CustomerProfileSummaryItem(
        **get_customer_profile_for_user(
            db=db,
            customer_profile_id=customer_profile_id,
            current_user=current_user,
        )
    )


@router.patch("/{customer_profile_id}", response_model=CustomerProfileSummaryItem)
def update_customer_profile(
    customer_profile_id: UUID,
    payload: CustomerProfileUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("sales", "manager", "head", "superadmin")),
) -> CustomerProfileSummaryItem:
    profile = update_customer_profile_for_user(
        db=db,
        customer_profile_id=customer_profile_id,
        display_name=payload.display_name,
        phone=payload.phone,
        email=payload.email,
        address=payload.address,
        status_value=payload.status,
        account_category=payload.account_category,
        current_user=current_user,
    )
    create_audit_log(
        db=db,
        action="customer_profile.update",
        resource_type="customer_profile",
        resource_id=str(customer_profile_id),
        current_user=current_user,
        request=request,
        metadata={
            "status": payload.status,
            "account_category": payload.account_category,
            "has_phone": bool(payload.phone),
            "has_email": bool(payload.email),
            "has_address": bool(payload.address),
        },
    )
    return CustomerProfileSummaryItem(**profile)


@router.post("/merge", response_model=CustomerProfileSummaryItem)
def merge_customer_profile_endpoint(
    payload: CustomerProfileMergeRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("head", "superadmin")),
) -> CustomerProfileSummaryItem:
    try:
        profile = merge_customer_profiles(
            db=db,
            source_profile_id=payload.source_profile_id,
            target_profile_id=payload.target_profile_id,
            merge_notes=payload.merge_notes,
            current_user=current_user,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        ) from error

    create_audit_log(
        db=db,
        action="customer_profile.merge",
        resource_type="customer_profile",
        resource_id=str(payload.target_profile_id),
        current_user=current_user,
        request=request,
        metadata={
            "source_profile_id": str(payload.source_profile_id),
            "target_profile_id": str(payload.target_profile_id),
            "has_merge_notes": bool(payload.merge_notes),
        },
    )
    return CustomerProfileSummaryItem(**profile)
