from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.db.session import get_db
from app.models.complaint_case import ComplaintCase, ComplaintCaseEvent
from app.models.support_knowledge_article import SupportKnowledgeArticle
from app.models.user import User
from app.schemas.service_routing_schema import (
    ComplaintAssignRequest,
    ComplaintCaseResponse,
    ComplaintEventResponse,
    ComplaintSafeIntakeRequest,
    ComplaintSeverityRequest,
    ComplaintTransitionRequest,
    SupportArticleCreate,
    SupportArticleResponse,
)
from app.services.audit_service import create_audit_log
from app.services.clara_complaint_service import (
    append_safe_intake,
    assign_complaint_case,
    change_complaint_severity,
    transition_complaint_case,
)
from app.services.clara_support_knowledge_service import (
    SupportKnowledgeError,
    create_support_article_draft,
    transition_support_article_lifecycle,
)
from app.services.role_service import normalize_role


router = APIRouter(tags=["service-routing"])


def _scope(statement, user: User, column):
    return (
        statement
        if normalize_role(user.role) == "superadmin"
        else statement.where(column == user.organization_id)
    )


def _handle_support_error(exc: SupportKnowledgeError) -> HTTPException:
    return HTTPException(
        403 if "authorized" in str(exc).lower() or "scope" in str(exc).lower() else 409,
        str(exc),
    )


@router.get("/support-knowledge", response_model=list[SupportArticleResponse])
def list_support_knowledge(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("sales", "manager", "head", "superadmin")
    ),
):
    stmt = select(SupportKnowledgeArticle)
    if normalize_role(current_user.role) != "superadmin":
        stmt = stmt.where(
            or_(
                SupportKnowledgeArticle.organization_id == current_user.organization_id,
                SupportKnowledgeArticle.organization_id.is_(None),
            )
        )
    stmt = stmt.order_by(SupportKnowledgeArticle.updated_at.desc())
    if normalize_role(current_user.role) == "sales":
        stmt = stmt.where(
            SupportKnowledgeArticle.lifecycle_status == "ACTIVE",
            SupportKnowledgeArticle.customer_safe.is_(True),
        )
    return list(db.scalars(stmt).all())


@router.post(
    "/support-knowledge/drafts",
    response_model=SupportArticleResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_support_draft(
    payload: SupportArticleCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("head", "superadmin")),
):
    organization_id = (
        payload.organization_id
        if normalize_role(current_user.role) == "superadmin"
        else current_user.organization_id
    )
    try:
        article = create_support_article_draft(
            db,
            organization_id=organization_id,
            current_user=current_user,
            **payload.model_dump(exclude={"organization_id"}),
        )
    except SupportKnowledgeError as exc:
        raise _handle_support_error(exc) from exc
    create_audit_log(
        db,
        "support_knowledge.draft.create",
        "support_knowledge_article",
        str(article.id),
        current_user,
        request,
        {
            "topic": article.topic,
            "version": article.version,
            "lifecycle_status": article.lifecycle_status,
            "source_hash": article.source_hash,
        },
    )
    return article


@router.post(
    "/support-knowledge/{article_id}/{action}", response_model=SupportArticleResponse
)
def transition_support_article(
    article_id: UUID,
    action: str,
    request: Request,
    organization_id: UUID | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("manager", "head", "superadmin")),
):
    article = db.get(SupportKnowledgeArticle, article_id)
    if article is None:
        raise HTTPException(404, "Support article not found.")
    if (
        normalize_role(current_user.role) == "superadmin"
        and article.organization_id is not None
        and organization_id != article.organization_id
    ):
        raise HTTPException(403, "Explicit organization scope is required.")
    try:
        transition_support_article_lifecycle(
            db, article=article, action=action, current_user=current_user
        )
    except SupportKnowledgeError as exc:
        raise _handle_support_error(exc) from exc
    create_audit_log(
        db,
        f"support_knowledge.{action}",
        "support_knowledge_article",
        str(article.id),
        current_user,
        request,
        {
            "topic": article.topic,
            "version": article.version,
            "lifecycle_status": article.lifecycle_status,
            "source_hash": article.source_hash,
        },
    )
    return article


@router.get("/complaints", response_model=list[ComplaintCaseResponse])
def list_complaints(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("sales", "manager", "head", "superadmin")
    ),
):
    return list(
        db.scalars(
            _scope(
                select(ComplaintCase), current_user, ComplaintCase.organization_id
            ).order_by(ComplaintCase.last_seen_at.desc())
        ).all()
    )


def _get_case(
    db: Session, case_id: UUID, user: User, *, mutation_scope: UUID | None = None
) -> ComplaintCase:
    case = db.get(ComplaintCase, case_id)
    if case is None:
        raise HTTPException(404, "Complaint case not found.")
    role = normalize_role(user.role)
    if role != "superadmin" and case.organization_id != user.organization_id:
        raise HTTPException(403, "Organization scope denied.")
    if role == "superadmin" and mutation_scope != case.organization_id:
        raise HTTPException(403, "Explicit organization scope is required.")
    return case


@router.get("/complaints/{case_id}", response_model=ComplaintCaseResponse)
def get_complaint(
    case_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("sales", "manager", "head", "superadmin")
    ),
):
    case = db.get(ComplaintCase, case_id)
    if case is None:
        raise HTTPException(404, "Complaint case not found.")
    if (
        normalize_role(current_user.role) != "superadmin"
        and case.organization_id != current_user.organization_id
    ):
        raise HTTPException(403, "Organization scope denied.")
    return case


@router.get(
    "/complaints/{case_id}/history", response_model=list[ComplaintEventResponse]
)
def complaint_history(
    case_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("sales", "manager", "head", "superadmin")
    ),
):
    get_complaint(case_id, db, current_user)
    return list(
        db.scalars(
            select(ComplaintCaseEvent)
            .where(ComplaintCaseEvent.complaint_case_id == case_id)
            .order_by(ComplaintCaseEvent.created_at)
        ).all()
    )


@router.post(
    "/complaints/{case_id}/status/{new_status}", response_model=ComplaintCaseResponse
)
def update_complaint_status(
    case_id: UUID,
    new_status: str,
    payload: ComplaintTransitionRequest,
    organization_id: UUID | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("manager", "head", "superadmin")),
):
    case = _get_case(db, case_id, current_user, mutation_scope=organization_id)
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
    organization_id: UUID | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("manager", "head", "superadmin")),
):
    case = _get_case(db, case_id, current_user, mutation_scope=organization_id)
    assignee = db.get(User, payload.assigned_user_id)
    if assignee is None or assignee.organization_id != case.organization_id:
        raise HTTPException(409, "Assignee must belong to the complaint organization.")
    try:
        assign_complaint_case(
            db,
            case,
            assigned_user_id=payload.assigned_user_id,
            expected_version=payload.expected_version,
            actor_user_id=current_user.id,
            reason_codes=tuple(payload.reason_codes),
        )
    except ValueError as exc:
        raise HTTPException(409, str(exc)) from exc
    db.commit()
    db.refresh(case)
    return case


@router.post("/complaints/{case_id}/severity", response_model=ComplaintCaseResponse)
def change_severity(
    case_id: UUID,
    payload: ComplaintSeverityRequest,
    organization_id: UUID | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("manager", "head", "superadmin")),
):
    case = _get_case(db, case_id, current_user, mutation_scope=organization_id)
    ranks = {"LOW": 0, "MEDIUM": 1, "HIGH": 2, "CRITICAL": 3}
    if ranks[payload.severity] < ranks[case.severity] and normalize_role(
        current_user.role
    ) not in {"head", "superadmin"}:
        raise HTTPException(403, "Severity downgrade requires head review.")
    try:
        change_complaint_severity(
            db,
            case,
            new_severity=payload.severity,
            expected_version=payload.expected_version,
            actor_user_id=current_user.id,
            reason_codes=tuple(payload.reason_codes),
        )
    except ValueError as exc:
        raise HTTPException(409, str(exc)) from exc
    db.commit()
    db.refresh(case)
    return case


@router.post("/complaints/{case_id}/intake", response_model=ComplaintCaseResponse)
def append_complaint_intake(
    case_id: UUID,
    payload: ComplaintSafeIntakeRequest,
    organization_id: UUID | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("sales", "manager", "head", "superadmin")
    ),
):
    case = _get_case(db, case_id, current_user, mutation_scope=organization_id)
    try:
        append_safe_intake(
            db,
            case,
            expected_version=payload.expected_version,
            actor_user_id=current_user.id,
            reason_codes=tuple(payload.reason_codes),
            safe_metadata=payload.model_dump(
                exclude={"expected_version", "reason_codes"}
            ),
        )
    except ValueError as exc:
        raise HTTPException(409, str(exc)) from exc
    db.commit()
    db.refresh(case)
    return case
