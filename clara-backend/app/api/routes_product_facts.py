from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.db.session import get_db
from app.models.product_fact import ProductFact
from app.models.user import User
from app.schemas.product_fact_schema import (
    ProductFactDraftCreateRequest,
    ProductFactResponse,
)
from app.services.audit_service import create_audit_log
from app.services.clara_product_fact_service import (
    ProductFactError,
    ProductFactMode,
    ResolutionStatus,
    compose_product_fact_prompt,
    create_product_fact_draft,
    get_freshness_status,
    list_product_facts,
    resolve_product_fact,
    transition_product_fact,
)
from app.services.role_service import normalize_role


router = APIRouter(prefix="/product-facts", tags=["product-facts"])


def _response(db: Session, fact: ProductFact) -> ProductFactResponse:
    resolution_status: str | None = None
    warnings: list[str] = []
    if fact.lifecycle_status == "ACTIVE":
        result = resolve_product_fact(
            db,
            fact_key=fact.fact_key,
            account_category=fact.account_category,
            organization_id=fact.organization_id,
            product_code=fact.product_code,
        )
        if (
            result.fact_id == fact.id
            or result.resolution_status == ResolutionStatus.CONFLICT
        ):
            resolution_status = result.resolution_status.value
            warnings = list(result.warnings)
    elif fact.lifecycle_status == "EXPIRED":
        resolution_status = ResolutionStatus.EXPIRED.value
    elif fact.lifecycle_status == "REVOKED":
        resolution_status = ResolutionStatus.REVOKED.value
    else:
        resolution_status = ResolutionStatus.UNAPPROVED.value
    return ProductFactResponse.model_validate(
        {
            **fact.__dict__,
            "freshness_status": get_freshness_status(
                fact.last_verified_at, fact.freshness_class
            ).value,
            "resolution_status": resolution_status,
            "warnings": warnings,
        }
    )


def _handle_error(exc: ProductFactError) -> HTTPException:
    lowered = str(exc).lower()
    if "not found" in lowered:
        code = status.HTTP_404_NOT_FOUND
    elif "authorized" in lowered or "scope" in lowered:
        code = status.HTTP_403_FORBIDDEN
    else:
        code = status.HTTP_409_CONFLICT
    return HTTPException(status_code=code, detail=str(exc))


@router.get("/shadow-mismatches")
def view_shadow_mismatches_endpoint(
    account_category: str = Query(default="mini", pattern="^(mini|regular|global)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("manager", "head", "superadmin")),
):
    composition = compose_product_fact_prompt(
        db,
        mode=ProductFactMode.SHADOW,
        account_category=account_category,
        organization_id=current_user.organization_id,
        legacy_content="",
    )
    return composition.debug_metadata()


@router.get("", response_model=list[ProductFactResponse])
def list_product_facts_endpoint(
    fact_key: str | None = Query(default=None, max_length=120),
    lifecycle_status: str | None = Query(default=None, max_length=20),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("sales", "manager", "head", "superadmin")
    ),
):
    facts = list_product_facts(
        db,
        current_user=current_user,
        fact_key=fact_key,
        lifecycle_status=lifecycle_status,
    )
    responses = [_response(db, fact) for fact in facts]
    if normalize_role(current_user.role) == "sales":
        responses = [item for item in responses if item.resolution_status == "RESOLVED"]
    return responses


@router.get("/{fact_id}", response_model=ProductFactResponse)
def get_product_fact_endpoint(
    fact_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("sales", "manager", "head", "superadmin")
    ),
):
    facts = list_product_facts(db, current_user=current_user)
    fact = next((item for item in facts if item.id == fact_id), None)
    if fact is None:
        raise HTTPException(status_code=404, detail="Product fact not found.")
    return _response(db, fact)


@router.post(
    "/drafts",
    response_model=ProductFactResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_product_fact_draft_endpoint(
    payload: ProductFactDraftCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("head", "superadmin")),
):
    try:
        fact = create_product_fact_draft(db, payload=payload, current_user=current_user)
    except ProductFactError as exc:
        raise _handle_error(exc) from exc
    create_audit_log(
        db=db,
        action="product_fact.draft.create",
        resource_type="product_fact",
        resource_id=str(fact.id),
        current_user=current_user,
        request=request,
        metadata={
            "fact_key": fact.fact_key,
            "revision": fact.revision,
            "lifecycle_status": fact.lifecycle_status,
            "source_hash": fact.source_hash,
        },
    )
    return _response(db, fact)


@router.post("/{fact_id}/{action}", response_model=ProductFactResponse)
def transition_product_fact_endpoint(
    fact_id: UUID,
    action: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("manager", "head", "superadmin")),
):
    if action not in {"approve", "activate", "expire", "revoke"}:
        raise HTTPException(status_code=404, detail="Lifecycle action not found.")
    try:
        fact = transition_product_fact(
            db,
            fact_id=fact_id,
            action=action,
            current_user=current_user,
        )
    except ProductFactError as exc:
        raise _handle_error(exc) from exc
    create_audit_log(
        db=db,
        action=f"product_fact.{action}",
        resource_type="product_fact",
        resource_id=str(fact.id),
        current_user=current_user,
        request=request,
        metadata={
            "fact_key": fact.fact_key,
            "revision": fact.revision,
            "lifecycle_status": fact.lifecycle_status,
            "source_hash": fact.source_hash,
        },
    )
    return _response(db, fact)
