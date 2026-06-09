from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import Select, desc, select
from sqlalchemy.orm import Session, selectinload

from app.models.conversation import Conversation
from app.models.knowledge_update_proposal import KnowledgeUpdateProposal
from app.models.product_knowledge import ProductKnowledge
from app.models.user import User
from app.schemas.product_knowledge_schema import (
    KnowledgeUpdateProposalReviewRequest,
    KnowledgeUpdateProposalUpsertRequest,
)
from app.services.access_control_service import (
    AccessDeniedError,
    apply_sales_user_scope_filter,
    ensure_user_has_organization,
    get_accessible_conversation_or_raise,
)
from app.services.role_service import (
    is_manager_like,
    is_superadmin_like,
)


KNOWLEDGE_PROPOSAL_DRAFT_STATUSES = {"draft", "pending_approval"}
KNOWLEDGE_PROPOSAL_REVIEW_STATUSES = {"approved", "rejected"}


class KnowledgeUpdateProposalError(RuntimeError):
    pass


def build_knowledge_update_proposal_item(
    proposal: KnowledgeUpdateProposal,
):
    from app.schemas.dashboard_schema import KnowledgeUpdateProposalItem

    return KnowledgeUpdateProposalItem(
        id=proposal.id,
        organization_id=proposal.organization_id,
        conversation_id=proposal.conversation_id,
        conversation_title=proposal.conversation.title if proposal.conversation else None,
        chat_review_case_id=proposal.chat_review_case_id,
        lead_id=proposal.lead_id,
        proposed_by_user_id=proposal.proposed_by_user_id,
        proposed_by_user_name=proposal.proposed_by_user.name
        if proposal.proposed_by_user
        else None,
        reviewed_by_user_id=proposal.reviewed_by_user_id,
        reviewed_by_user_name=proposal.reviewed_by_user.name
        if proposal.reviewed_by_user
        else None,
        published_product_knowledge_id=proposal.published_product_knowledge_id,
        published_product_knowledge_title=proposal.published_product_knowledge.title
        if proposal.published_product_knowledge
        else None,
        title=proposal.title,
        category=proposal.category,
        proposed_content=proposal.proposed_content,
        source_type=proposal.source_type,
        rationale=proposal.rationale,
        status=proposal.status,
        review_decision_note=proposal.review_decision_note,
        submitted_at=proposal.submitted_at,
        reviewed_at=proposal.reviewed_at,
        published_at=proposal.published_at,
        created_at=proposal.created_at,
        updated_at=proposal.updated_at,
    )


def get_knowledge_update_proposal_statement() -> Select:
    return select(KnowledgeUpdateProposal).options(
        selectinload(KnowledgeUpdateProposal.conversation),
        selectinload(KnowledgeUpdateProposal.chat_review_case),
        selectinload(KnowledgeUpdateProposal.proposed_by_user),
        selectinload(KnowledgeUpdateProposal.reviewed_by_user),
        selectinload(KnowledgeUpdateProposal.published_product_knowledge),
    )


def get_knowledge_update_proposal_for_conversation(
    db: Session,
    *,
    conversation_id: UUID,
) -> KnowledgeUpdateProposal | None:
    return db.scalars(
        get_knowledge_update_proposal_statement().where(
            KnowledgeUpdateProposal.conversation_id == conversation_id
        )
    ).first()


def list_knowledge_update_proposals(
    db: Session,
    *,
    current_user: User,
    status: str | None = None,
    category: str | None = None,
) -> list[KnowledgeUpdateProposal]:
    ensure_user_has_organization(current_user)

    statement = get_knowledge_update_proposal_statement().join(
        Conversation,
        Conversation.id == KnowledgeUpdateProposal.conversation_id,
    )

    if not is_superadmin_like(current_user.role):
        statement = statement.where(
            KnowledgeUpdateProposal.organization_id == current_user.organization_id
        )
        statement = apply_sales_user_scope_filter(
            statement,
            db=db,
            current_user=current_user,
            sales_user_id_column=Conversation.sales_user_id,
        )

    if status:
        statement = statement.where(
            KnowledgeUpdateProposal.status == status.strip().lower()
        )

    if category:
        statement = statement.where(
            KnowledgeUpdateProposal.category == category.strip().lower()
        )

    statement = statement.order_by(
        desc(KnowledgeUpdateProposal.updated_at),
        desc(KnowledgeUpdateProposal.created_at),
    )

    return list(db.scalars(statement).all())


def get_knowledge_update_proposal_or_raise(
    db: Session,
    *,
    proposal_id: UUID,
    current_user: User,
) -> KnowledgeUpdateProposal:
    proposal = db.scalars(
        get_knowledge_update_proposal_statement().where(
            KnowledgeUpdateProposal.id == proposal_id
        )
    ).first()

    if proposal is None:
        raise KnowledgeUpdateProposalError("Knowledge proposal not found.")

    if is_superadmin_like(current_user.role):
        return proposal

    ensure_user_has_organization(current_user)

    if proposal.organization_id != current_user.organization_id:
        raise AccessDeniedError("Knowledge proposal not found.")

    conversation = proposal.conversation or db.get(Conversation, proposal.conversation_id)
    if conversation is None:
        raise KnowledgeUpdateProposalError("Conversation not found.")

    accessible_conversation = get_accessible_conversation_or_raise(
        db=db,
        conversation_id=conversation.id,
        current_user=current_user,
    )
    if accessible_conversation.id != conversation.id:
        raise AccessDeniedError("Knowledge proposal not found.")

    return proposal


def upsert_knowledge_update_proposal_for_conversation(
    db: Session,
    *,
    conversation_id: UUID,
    payload: KnowledgeUpdateProposalUpsertRequest,
    current_user: User,
) -> KnowledgeUpdateProposal:
    if not is_manager_like(current_user.role):
        raise AccessDeniedError(
            "Only manager, head, or superadmin can create knowledge proposals."
        )

    conversation = get_accessible_conversation_or_raise(
        db=db,
        conversation_id=conversation_id,
        current_user=current_user,
    )
    review_case = conversation.chat_review_case

    if review_case is None:
        raise KnowledgeUpdateProposalError(
            "Buat coaching review dulu sebelum mengusulkan update knowledge."
        )

    normalized_status = payload.status.strip().lower()
    if normalized_status not in KNOWLEDGE_PROPOSAL_DRAFT_STATUSES:
        raise KnowledgeUpdateProposalError(
            "Status proposal hanya boleh draft atau pending_approval."
        )

    proposal = get_knowledge_update_proposal_for_conversation(
        db=db,
        conversation_id=conversation.id,
    )

    if proposal is None:
        proposal = KnowledgeUpdateProposal(
            organization_id=conversation.organization_id,
            conversation_id=conversation.id,
            chat_review_case_id=review_case.id,
            lead_id=conversation.lead_id,
            proposed_by_user_id=current_user.id,
            title=payload.title.strip(),
            category=payload.category.strip().lower(),
            proposed_content=payload.proposed_content.strip(),
            source_type=payload.source_type.strip().lower(),
            rationale=payload.rationale.strip() if payload.rationale else None,
            status=normalized_status,
            submitted_at=datetime.now(timezone.utc)
            if normalized_status == "pending_approval"
            else None,
        )
        db.add(proposal)
    else:
        proposal.chat_review_case_id = review_case.id
        proposal.lead_id = conversation.lead_id
        proposal.title = payload.title.strip()
        proposal.category = payload.category.strip().lower()
        proposal.proposed_content = payload.proposed_content.strip()
        proposal.source_type = payload.source_type.strip().lower()
        proposal.rationale = payload.rationale.strip() if payload.rationale else None
        proposal.status = normalized_status
        proposal.proposed_by_user_id = current_user.id
        if normalized_status == "pending_approval":
            proposal.submitted_at = datetime.now(timezone.utc)
        elif normalized_status == "draft":
            proposal.reviewed_by_user_id = None
            proposal.reviewed_at = None
            proposal.review_decision_note = None

    db.commit()
    db.refresh(proposal)

    refreshed = get_knowledge_update_proposal_for_conversation(
        db=db,
        conversation_id=conversation.id,
    )
    return refreshed or proposal


def review_knowledge_update_proposal(
    db: Session,
    *,
    proposal_id: UUID,
    payload: KnowledgeUpdateProposalReviewRequest,
    current_user: User,
) -> KnowledgeUpdateProposal:
    if not is_superadmin_like(current_user.role):
        raise AccessDeniedError(
            "Only superadmin can approve or reject knowledge proposals."
        )

    proposal = get_knowledge_update_proposal_or_raise(
        db=db,
        proposal_id=proposal_id,
        current_user=current_user,
    )
    normalized_status = payload.status.strip().lower()

    if normalized_status not in KNOWLEDGE_PROPOSAL_REVIEW_STATUSES:
        raise KnowledgeUpdateProposalError(
            "Status review hanya boleh approved atau rejected."
        )

    if proposal.status == "approved" and normalized_status == "rejected":
        raise KnowledgeUpdateProposalError(
            "Proposal yang sudah dipublish tidak boleh langsung di-reject. Buat revisi baru kalau perlu."
        )

    proposal.status = normalized_status
    proposal.reviewed_by_user_id = current_user.id
    proposal.reviewed_at = datetime.now(timezone.utc)
    proposal.review_decision_note = (
        payload.review_decision_note.strip()
        if payload.review_decision_note
        else None
    )

    if normalized_status == "approved":
        published_entry = None
        if proposal.published_product_knowledge_id is not None:
            published_entry = db.get(
                ProductKnowledge,
                proposal.published_product_knowledge_id,
            )

        if published_entry is None:
            published_entry = ProductKnowledge(
                organization_id=proposal.organization_id,
                created_by_user_id=current_user.id,
                title=proposal.title,
                category=proposal.category,
                content=proposal.proposed_content,
                source_type=proposal.source_type,
                is_active=True,
            )
            db.add(published_entry)
            db.flush()
            proposal.published_product_knowledge_id = published_entry.id
        else:
            published_entry.organization_id = proposal.organization_id
            published_entry.title = proposal.title
            published_entry.category = proposal.category
            published_entry.content = proposal.proposed_content
            published_entry.source_type = proposal.source_type
            published_entry.is_active = True

        proposal.published_at = datetime.now(timezone.utc)
    else:
        proposal.published_at = None

    db.commit()
    db.refresh(proposal)

    refreshed = get_knowledge_update_proposal_or_raise(
        db=db,
        proposal_id=proposal.id,
        current_user=current_user,
    )
    return refreshed
