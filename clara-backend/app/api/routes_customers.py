from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.db.session import get_db
from app.models.user import User
from app.schemas.lead_schema import CustomerProfileSummaryItem
from app.services.customer_profile_service import get_customer_profile_for_user

router = APIRouter(prefix="/customers", tags=["customers"])


@router.get("/{customer_profile_id}", response_model=CustomerProfileSummaryItem)
def get_customer_profile(
    customer_profile_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("marketing", "admin")),
) -> CustomerProfileSummaryItem:
    return CustomerProfileSummaryItem(
        **get_customer_profile_for_user(
            db=db,
            customer_profile_id=customer_profile_id,
            current_user=current_user,
        )
    )
