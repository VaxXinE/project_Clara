from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.db.session import get_db
from app.models.complaint_case import ComplaintCase
from app.models.support_knowledge_article import SupportKnowledgeArticle
from app.models.user import User
from app.schemas.service_routing_schema import (
    ComplaintAssignRequest,
    ComplaintCaseResponse,
    ComplaintTransitionRequest,
    SupportArticleCreate,
    SupportArticleResponse,
)
from app.services.clara_complaint_service import transition_complaint_case
from app.services.clara_support_knowledge_service import content_hash
from app.services.role_service import normalize_role


router = APIRouter(tags=["service-routing"])


def _scope(statement, user: User, column):
    return (
        statement
        if normalize_role(user.role) == "superadmin"
        else statement.where(column == user.organization_id)
    )


@router.get("/support-knowledge", response_model=list[SupportArticleResponse])
def list_support_knowledge(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("sales", "manager", "head", "superadmin")
    ),
):
    stmt = select(SupportKnowledgeArticle).order_by(
        SupportKnowledgeArticle.updated_at.desc()
    )
    stmt = stmt.where(
        or_(
            SupportKnowledgeArticle.organization_id == current_user.organization_id,
            SupportKnowledgeArticle.organization_id.is_(None),
        )
    )
    return list(db.scalars(stmt).all())


@router.post(
    "/support-knowledge/drafts",
    response_model=SupportArticleResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_support_draft(
    payload: SupportArticleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("head", "superadmin")),
):
    role = normalize_role(current_user.role)
    organization_id = (
        payload.organization_id
        if role == "superadmin"
        else current_user.organization_id
    )
    if role != "superadmin" and payload.organization_id not in {
        None,
        current_user.organization_id,
    }:
        raise HTTPException(403, "Organization scope denied.")
    version = (
        db.scalar(
            select(func.max(SupportKnowledgeArticle.version)).where(
                SupportKnowledgeArticle.organization_id == organization_id,
                SupportKnowledgeArticle.topic == payload.topic,
            )
        )
        or 0
    ) + 1
    article = SupportKnowledgeArticle(
        **payload.model_dump(exclude={"organization_id"}),
        organization_id=organization_id,
        source_hash=content_hash(payload.content),
        version=version,
        lifecycle_status="DRAFT",
        created_by_user_id=current_user.id,
    )
    db.add(article)
    db.commit()
    db.refresh(article)
    return article


@router.post(
    "/support-knowledge/{article_id}/{action}", response_model=SupportArticleResponse
)
def transition_support_article(
    article_id: UUID,
    action: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("manager", "head", "superadmin")),
):
    article = db.get(SupportKnowledgeArticle, article_id)
    if article is None:
        raise HTTPException(404, "Support article not found.")
    if (
        normalize_role(current_user.role) != "superadmin"
        and article.organization_id != current_user.organization_id
    ):
        raise HTTPException(403, "Organization scope denied.")
    transitions = {
        "approve": ("DRAFT", "APPROVED"),
        "activate": ("APPROVED", "ACTIVE"),
        "retire": ("ACTIVE", "RETIRED"),
    }
    if action not in transitions or article.lifecycle_status != transitions[action][0]:
        raise HTTPException(409, "Invalid lifecycle transition.")
    article.lifecycle_status = transitions[action][1]
    if action in {"approve", "activate"}:
        article.last_verified_at = datetime.now(timezone.utc)
        article.verified_by_user_id = current_user.id
    db.commit()
    db.refresh(article)
    return article


@router.get("/complaints", response_model=list[ComplaintCaseResponse])
def list_complaints(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("sales", "manager", "head", "superadmin")
    ),
):
    stmt = _scope(
        select(ComplaintCase), current_user, ComplaintCase.organization_id
    ).order_by(ComplaintCase.last_seen_at.desc())
    return list(db.scalars(stmt).all())


def _get_case(db: Session, case_id: UUID, user: User) -> ComplaintCase:
    case = db.get(ComplaintCase, case_id)
    if case is None:
        raise HTTPException(404, "Complaint case not found.")
    if (
        normalize_role(user.role) != "superadmin"
        and case.organization_id != user.organization_id
    ):
        raise HTTPException(403, "Organization scope denied.")
    return case


@router.get("/complaints/{case_id}", response_model=ComplaintCaseResponse)
def get_complaint(
    case_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("sales", "manager", "head", "superadmin")
    ),
):
    return _get_case(db, case_id, current_user)


@router.post(
    "/complaints/{case_id}/status/{new_status}", response_model=ComplaintCaseResponse
)
def update_complaint_status(
    case_id: UUID,
    new_status: str,
    payload: ComplaintTransitionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("manager", "head", "superadmin")),
):
    case = _get_case(db, case_id, current_user)
    if case.severity in {"HIGH", "CRITICAL"} and normalize_role(
        current_user.role
    ) not in {"head", "superadmin"}:
        raise HTTPException(403, "High-risk complaint requires head review.")
    try:
        transition_complaint_case(
            db,
            case,
            new_status=new_status,
            expected_version=payload.expected_version,
            actor_user_id=current_user.id,
            reason_codes=tuple(payload.reason_codes),
        )
    except ValueError as exc:
        raise HTTPException(409, str(exc)) from exc
    db.commit()
    db.refresh(case)
    return case


@router.post("/complaints/{case_id}/assign", response_model=ComplaintCaseResponse)
def assign_complaint(
    case_id: UUID,
    payload: ComplaintAssignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("manager", "head", "superadmin")),
):
    case = _get_case(db, case_id, current_user)
    if case.version != payload.expected_version:
        raise HTTPException(409, "Complaint case changed; refresh and retry.")
    case.assigned_user_id = payload.assigned_user_id
    case.version += 1
    db.commit()
    db.refresh(case)
    return case
