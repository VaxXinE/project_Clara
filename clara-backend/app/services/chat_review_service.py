from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.ai_extraction import AIExtraction
from app.models.chat_review_case import ChatReviewCase
from app.models.chat_review_note import ChatReviewNote
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.reply_suggestion import ReplySuggestion
from app.models.sent_message import SentMessage
from app.models.user import User
from app.schemas.dashboard_schema import (
    ChatReviewCaseItem,
    ChatReviewCaseSuggestionResponse,
    ChatReviewCaseUpsertRequest,
    ChatReviewNoteCreateRequest,
    ChatReviewNoteItem,
    ChatReviewerCandidateItem,
)
from app.services.access_control_service import can_access_conversation_in_scope
from app.services.role_service import is_head_like, is_manager_like, normalize_role

CHAT_REVIEW_CASE_STATUSES = {
    "draft",
    "in_review",
    "needs_rework",
    "coaching_done",
    "escalated",
}

CHAT_REVIEW_LABELS = {
    "berhasil",
    "gagal",
    "unik",
    "perlu_eskalasi",
}

CHAT_REVIEW_NOTE_TYPES = {
    "manager_note",
    "coaching_observation",
    "escalation_note",
}


class ChatReviewError(RuntimeError):
    pass


def _get_latest_message(conversation: Conversation) -> Message | None:
    if not conversation.messages:
        return None
    return max(conversation.messages, key=lambda message: message.message_timestamp)


def _get_latest_extraction(conversation: Conversation) -> AIExtraction | None:
    if not conversation.ai_extractions:
        return None
    return max(conversation.ai_extractions, key=lambda extraction: extraction.created_at)


def _get_latest_reply_suggestion(conversation: Conversation) -> ReplySuggestion | None:
    if not conversation.reply_suggestions:
        return None
    return max(conversation.reply_suggestions, key=lambda suggestion: suggestion.created_at)


def _get_latest_sent_message(conversation: Conversation) -> SentMessage | None:
    if not conversation.sent_messages:
        return None
    return max(conversation.sent_messages, key=lambda item: item.sent_at)


def build_chat_review_note_item(note: ChatReviewNote) -> ChatReviewNoteItem:
    return ChatReviewNoteItem(
        id=note.id,
        author_user_id=note.author_user_id,
        author_user_name=note.author_user.name if note.author_user else None,
        note_type=note.note_type,
        body=note.body,
        created_at=note.created_at,
    )


def build_chat_review_case_item(review_case: ChatReviewCase) -> ChatReviewCaseItem:
    return ChatReviewCaseItem(
        id=review_case.id,
        conversation_id=review_case.conversation_id,
        organization_id=review_case.organization_id,
        lead_id=review_case.lead_id,
        submitted_by_user_id=review_case.submitted_by_user_id,
        submitted_by_user_name=(
            review_case.submitted_by_user.name if review_case.submitted_by_user else None
        ),
        reviewer_user_id=review_case.reviewer_user_id,
        reviewer_user_name=(
            review_case.reviewer_user.name if review_case.reviewer_user else None
        ),
        workflow_scope=review_case.workflow_scope,
        feedback_status=review_case.feedback_status,
        status=review_case.status,
        review_label=review_case.review_label,
        review_summary=review_case.review_summary,
        coaching_focus=review_case.coaching_focus,
        recommended_action=review_case.recommended_action,
        reviewed_at=review_case.reviewed_at,
        feedback_sent_at=review_case.feedback_sent_at,
        feedback_acknowledged_at=review_case.feedback_acknowledged_at,
        feedback_resolved_at=review_case.feedback_resolved_at,
        created_at=review_case.created_at,
        updated_at=review_case.updated_at,
        notes=[build_chat_review_note_item(note) for note in review_case.notes],
    )


def build_chat_review_case_suggestion(
    conversation: Conversation,
) -> ChatReviewCaseSuggestionResponse:
    latest_message = _get_latest_message(conversation)
    latest_extraction = _get_latest_extraction(conversation)
    latest_reply_suggestion = _get_latest_reply_suggestion(conversation)
    latest_sent_message = _get_latest_sent_message(conversation)

    status = "in_review"
    review_label = "unik"
    confidence_score = 0.48

    if latest_reply_suggestion is not None and latest_reply_suggestion.risk_level == "high":
        review_label = "perlu_eskalasi"
        status = "escalated"
        confidence_score = 0.88
    elif latest_extraction is not None and latest_extraction.risk_level == "high":
        review_label = "perlu_eskalasi"
        status = "in_review"
        confidence_score = 0.84
    elif latest_reply_suggestion is not None and latest_reply_suggestion.approval_status == "rejected":
        review_label = "gagal"
        status = "needs_rework"
        confidence_score = 0.79
    elif latest_sent_message is not None:
        review_label = "berhasil"
        status = "coaching_done"
        confidence_score = 0.72

    summary_parts: list[str] = []
    focus_parts: list[str] = []
    action_parts: list[str] = []

    if latest_extraction is not None:
        if latest_extraction.customer_summary.strip():
            summary_parts.append(latest_extraction.customer_summary.strip())
        if latest_extraction.main_objections:
            focus_parts.append(
                "Fokus utama coaching: " + ", ".join(latest_extraction.main_objections[:3])
            )
        if latest_extraction.risk_level == "high":
            focus_parts.append(
                "Percakapan ini berisiko tinggi dan butuh validasi manusia sebelum diarahkan ke closing."
            )
        if latest_extraction.next_best_action.strip():
            action_parts.append(latest_extraction.next_best_action.strip())

    if latest_reply_suggestion is not None:
        if latest_reply_suggestion.approval_status == "pending":
            action_parts.append(
                "Review draft balasan yang pending, cek tone, fakta, dan arah closing sebelum approve."
            )
        elif latest_reply_suggestion.approval_status == "rejected":
            action_parts.append(
                "Susun ulang draft balasan karena versi sebelumnya belum layak dikirim."
            )

    if latest_message is not None and latest_message.message_text.strip():
        summary_parts.append(f"Chat terbaru: {latest_message.message_text.strip()}")

    if latest_sent_message is not None:
        action_parts.append(
            "Pastikan sales menindaklanjuti hasil kirim sebelumnya dan tidak membiarkan lead menggantung."
        )

    review_summary = " ".join(part for part in summary_parts if part).strip()
    if not review_summary:
        review_summary = (
            "Conversation ini belum punya cukup sinyal AI yang kuat. Manager perlu membaca konteks chat secara manual."
        )

    coaching_focus = " ".join(part for part in focus_parts if part).strip()
    if not coaching_focus:
        coaching_focus = (
            "Fokus coaching: cek kualitas follow-up, ketepatan membaca keberatan customer, dan kejelasan langkah berikutnya."
        )

    recommended_action = " ".join(part for part in action_parts if part).strip()
    if not recommended_action:
        recommended_action = (
            "Buka timeline percakapan penuh, nilai apakah sales perlu rework, lalu tetapkan arahan tindak lanjut yang spesifik."
        )

    source_summary = (
        "Prefill dibuat dari AI extraction, draft balasan, pesan customer terbaru, dan histori sent message."
        if any(
            item is not None
            for item in [latest_extraction, latest_reply_suggestion, latest_message, latest_sent_message]
        )
        else "Prefill dibuat dari state conversation saat ini karena belum ada sinyal AI atau chat terbaru yang cukup kuat."
    )

    return ChatReviewCaseSuggestionResponse(
        status=status,
        review_label=review_label,
        review_summary=review_summary,
        coaching_focus=coaching_focus,
        recommended_action=recommended_action,
        confidence_score=confidence_score,
        source_summary=source_summary,
    )


def _normalize_status(value: str) -> str:
    normalized = value.strip().lower().replace("-", "_")
    if normalized not in CHAT_REVIEW_CASE_STATUSES:
        raise ChatReviewError(
            "Status review tidak valid. Gunakan draft, in_review, needs_rework, coaching_done, atau escalated."
        )
    return normalized


def _normalize_label(value: str) -> str:
    normalized = value.strip().lower().replace("-", "_")
    if normalized not in CHAT_REVIEW_LABELS:
        raise ChatReviewError(
            "Label review tidak valid. Gunakan berhasil, gagal, unik, atau perlu_eskalasi."
        )
    return normalized


def _normalize_note_type(value: str) -> str:
    normalized = value.strip().lower().replace("-", "_")
    if normalized not in CHAT_REVIEW_NOTE_TYPES:
        raise ChatReviewError(
            "Tipe note tidak valid. Gunakan manager_note, coaching_observation, atau escalation_note."
        )
    return normalized


def _normalize_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


def _normalize_required_text(value: str, *, field_name: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise ChatReviewError(f"{field_name} wajib diisi.")
    return normalized


def _resolve_workflow_scope(current_user: User) -> str:
    if is_head_like(current_user.role):
        return "head_follow_up"
    return "admin_quality_check"


def _resolve_feedback_status(review_status: str) -> str:
    if review_status == "draft":
        return "draft"
    if review_status == "coaching_done":
        return "resolved"
    if review_status == "escalated":
        return "escalated"
    return "sent_to_cs"


def get_reviewable_conversation_or_raise(
    db: Session,
    *,
    conversation_id: UUID,
    current_user: User,
) -> Conversation:
    statement = (
        select(Conversation)
        .where(Conversation.id == conversation_id)
        .options(
            selectinload(Conversation.chat_review_case)
            .selectinload(ChatReviewCase.notes)
            .selectinload(ChatReviewNote.author_user),
            selectinload(Conversation.chat_review_case).selectinload(
                ChatReviewCase.submitted_by_user
            ),
            selectinload(Conversation.chat_review_case).selectinload(
                ChatReviewCase.reviewer_user
            ),
        )
    )
    conversation = db.scalars(statement).first()
    if conversation is None:
        raise ChatReviewError("Conversation tidak ditemukan.")
    if not can_access_conversation_in_scope(
        db=db,
        current_user=current_user,
        conversation=conversation,
    ):
        raise ChatReviewError("Conversation tidak ditemukan.")
    return conversation


def list_chat_reviewer_candidates(
    db: Session,
    *,
    current_user: User,
) -> list[ChatReviewerCandidateItem]:
    if current_user.organization_id is None:
        return []

    statement = (
        select(User)
        .where(User.organization_id == current_user.organization_id)
        .where(User.is_active.is_(True))
        .order_by(User.created_at.desc())
    )
    users = db.scalars(statement).all()

    candidates = [
        ChatReviewerCandidateItem(
            id=user.id,
            name=user.name,
            role=normalize_role(user.role),
        )
        for user in users
        if normalize_role(user.role) in {"manager", "head", "superadmin"}
    ]

    if is_head_like(current_user.role):
        return candidates

    # Manager bisa memilih dirinya sendiri atau head dalam organization yang sama.
    return [
        item
        for item in candidates
        if item.id == current_user.id or item.role in {"head", "superadmin"}
    ]


def upsert_chat_review_case(
    db: Session,
    *,
    conversation: Conversation,
    payload: ChatReviewCaseUpsertRequest,
    current_user: User,
) -> ChatReviewCaseItem:
    if not is_manager_like(current_user.role):
        raise ChatReviewError("Hanya manager, head, atau superadmin yang bisa membuat review case.")

    reviewer_user: User | None = None
    if payload.reviewer_user_id is not None:
        reviewer_user = db.get(User, payload.reviewer_user_id)
        if (
            reviewer_user is None
            or reviewer_user.organization_id != conversation.organization_id
            or normalize_role(reviewer_user.role) not in {"manager", "head", "superadmin"}
        ):
            raise ChatReviewError("Reviewer tidak valid untuk organization conversation ini.")

    review_case = conversation.chat_review_case
    now = datetime.now(timezone.utc)

    if review_case is None:
        review_case = ChatReviewCase(
            conversation_id=conversation.id,
            organization_id=conversation.organization_id,
            lead_id=conversation.lead_id,
            submitted_by_user_id=current_user.id,
        )
        db.add(review_case)

    review_case.reviewer_user_id = payload.reviewer_user_id
    review_case.status = _normalize_status(payload.status)
    review_case.review_label = _normalize_label(payload.review_label)
    review_case.review_summary = _normalize_optional_text(payload.review_summary)
    review_case.coaching_focus = _normalize_optional_text(payload.coaching_focus)
    review_case.recommended_action = _normalize_optional_text(payload.recommended_action)
    review_case.workflow_scope = _resolve_workflow_scope(current_user)
    review_case.feedback_status = _resolve_feedback_status(review_case.status)
    review_case.reviewed_at = (
        now if review_case.status in {"coaching_done", "escalated"} else None
    )
    review_case.feedback_sent_at = (
        now
        if review_case.feedback_status in {"sent_to_cs", "resolved", "escalated"}
        else None
    )
    review_case.feedback_resolved_at = (
        now if review_case.feedback_status == "resolved" else None
    )
    if review_case.feedback_status != "acknowledged_by_cs":
        review_case.feedback_acknowledged_at = None
    review_case.lead_id = conversation.lead_id
    review_case.organization_id = conversation.organization_id

    db.add(review_case)
    db.commit()
    db.refresh(review_case)

    refreshed = db.get(
        ChatReviewCase,
        review_case.id,
        options=[
            selectinload(ChatReviewCase.notes).selectinload(ChatReviewNote.author_user),
            selectinload(ChatReviewCase.submitted_by_user),
            selectinload(ChatReviewCase.reviewer_user),
        ],
    )
    assert refreshed is not None
    return build_chat_review_case_item(refreshed)


def add_chat_review_note(
    db: Session,
    *,
    review_case_id: UUID,
    payload: ChatReviewNoteCreateRequest,
    current_user: User,
) -> ChatReviewCaseItem:
    if not is_manager_like(current_user.role):
        raise ChatReviewError("Hanya manager, head, atau superadmin yang bisa menambah coaching note.")

    statement = (
        select(ChatReviewCase)
        .where(ChatReviewCase.id == review_case_id)
        .options(
            selectinload(ChatReviewCase.notes).selectinload(ChatReviewNote.author_user),
            selectinload(ChatReviewCase.submitted_by_user),
            selectinload(ChatReviewCase.reviewer_user),
        )
    )
    review_case = db.scalars(statement).first()
    if review_case is None:
        raise ChatReviewError("Review case tidak ditemukan.")

    if review_case.organization_id != current_user.organization_id and not is_head_like(
        current_user.role
    ):
        raise ChatReviewError("Review case tidak ditemukan.")

    note = ChatReviewNote(
        review_case_id=review_case.id,
        author_user_id=current_user.id,
        note_type=_normalize_note_type(payload.note_type),
        body=_normalize_required_text(payload.body, field_name="Isi note"),
    )
    db.add(note)

    if review_case.status == "draft":
        review_case.status = "in_review"
        review_case.feedback_status = "sent_to_cs"
        review_case.reviewed_at = None
        review_case.feedback_sent_at = datetime.now(timezone.utc)
        db.add(review_case)

    db.commit()
    db.refresh(review_case)
    return build_chat_review_case_item(review_case)
