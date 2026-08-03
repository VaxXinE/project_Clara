from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.clara_runtime_contract import runtime_contract_audit_metadata
from app.core.config import settings
from app.core.security import require_roles
from app.db.session import get_db
from app.models.user import User
from app.schemas.reply_suggestion_schema import (
    ApproveReplyRequest,
    RejectReplyRequest,
    ReplySuggestionResponse,
)
from app.services.audit_service import create_audit_log
from app.services.reply_suggestion_service import (
    ReplySuggestionError,
    approve_reply_suggestion,
    create_reply_suggestion,
    list_reply_suggestions,
    reject_reply_suggestion,
)
from app.services.clara_policy_enforcement_service import (
    CLARA_ENFORCEMENT_CONTRACT_VERSION,
    PolicyEnforcementMode,
    normalize_policy_enforcement_mode,
    reviewer_requirement_for_suggestion,
)
from app.services.access_control_service import (
    AccessDeniedError,
    get_accessible_conversation_or_raise,
    get_accessible_reply_suggestion_or_raise,
)
from app.services.clara_rollout_service import (
    RolloutControlMode,
    active_runtime_decision,
    resolve_rollout_decision,
)

router = APIRouter(tags=["reply-suggestions"])


@router.post(
    "/conversations/{conversation_id}/reply-suggestions",
    response_model=ReplySuggestionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_reply_suggestion_endpoint(
    conversation_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("sales", "manager", "head", "superadmin")
    ),
):
    try:
        get_accessible_conversation_or_raise(
            db=db,
            conversation_id=conversation_id,
            current_user=current_user,
        )

        rollout_decision = resolve_rollout_decision(
            db,
            organization_id=current_user.organization_id,
            user=current_user,
        )
        suggestion = create_reply_suggestion(
            db=db,
            conversation_id=conversation_id,
            rollout_decision=active_runtime_decision(rollout_decision),
        )
        enforcement_mode = normalize_policy_enforcement_mode(
            rollout_decision.runtime_profile.get(
                "policy_mode", settings.clara_policy_enforcement_mode
            )
            if rollout_decision.control_mode == RolloutControlMode.GOVERNED.value
            and rollout_decision.plan_id is not None
            else settings.clara_policy_enforcement_mode
        ).mode

        create_audit_log(
            db=db,
            action="reply_suggestion.generate",
            resource_type="reply_suggestion",
            resource_id=str(suggestion.id),
            current_user=current_user,
            request=request,
            metadata={
                **runtime_contract_audit_metadata(),
                "conversation_id": str(suggestion.conversation_id),
                "ai_extraction_id": str(suggestion.ai_extraction_id),
                "approval_status": suggestion.approval_status,
                "risk_level": suggestion.risk_level,
                "action_mode": suggestion.action_mode,
                "suggestion_count": len(suggestion.suggested_replies),
                "policy_reason_count": len(suggestion.policy_reasons),
                "enforcement_contract_version": (
                    CLARA_ENFORCEMENT_CONTRACT_VERSION
                ),
                "enforcement_mode": enforcement_mode.value,
                "applied_action_mode": suggestion.action_mode,
                "reviewer_requirement": reviewer_requirement_for_suggestion(
                    action_mode=suggestion.action_mode,
                    risk_level=suggestion.risk_level,
                    policy_reasons=tuple(suggestion.policy_reasons),
                ).value,
                "enforcement_applied": (
                    enforcement_mode == PolicyEnforcementMode.ENFORCE
                ),
                **rollout_decision.debug_metadata(),
            },
        )

        return suggestion
    except ReplySuggestionError as exc:
        create_audit_log(
            db=db,
            action="reply_suggestion.generate_failed",
            resource_type="conversation",
            resource_id=str(conversation_id),
            current_user=current_user,
            request=request,
            metadata={
                **runtime_contract_audit_metadata(),
                "conversation_id": str(conversation_id),
                "error_type": type(exc).__name__,
                "error_message": str(exc)[:500],
            },
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except AccessDeniedError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.get(
    "/conversations/{conversation_id}/reply-suggestions",
    response_model=list[ReplySuggestionResponse],
)
def list_reply_suggestions_endpoint(
    conversation_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("sales", "manager", "head", "superadmin")
    ),
):
    try:
        get_accessible_conversation_or_raise(
            db=db,
            conversation_id=conversation_id,
            current_user=current_user,
        )
        return list_reply_suggestions(db=db, conversation_id=conversation_id)
    except AccessDeniedError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.post(
    "/reply-suggestions/{reply_suggestion_id}/approve",
    response_model=ReplySuggestionResponse,
)
def approve_reply_suggestion_endpoint(
    reply_suggestion_id: UUID,
    payload: ApproveReplyRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("sales", "manager", "head", "superadmin")
    ),
):
    try:
        get_accessible_reply_suggestion_or_raise(
            db=db,
            reply_suggestion_id=reply_suggestion_id,
            current_user=current_user,
        )
        suggestion = approve_reply_suggestion(
            db=db,
            reply_suggestion_id=reply_suggestion_id,
            payload=payload,
            reviewer_role=current_user.role,
            authenticated_reviewer_name=(
                current_user.name
                if normalize_policy_enforcement_mode(
                    settings.clara_policy_enforcement_mode
                ).mode
                == PolicyEnforcementMode.ENFORCE
                else None
            ),
        )

        create_audit_log(
            db=db,
            action="reply_suggestion.approve",
            resource_type="reply_suggestion",
            resource_id=str(reply_suggestion_id),
            current_user=current_user,
            request=request,
            metadata={
                "enforcement_contract_version": (
                    CLARA_ENFORCEMENT_CONTRACT_VERSION
                ),
                "enforcement_mode": normalize_policy_enforcement_mode(
                    settings.clara_policy_enforcement_mode
                ).mode.value,
                "approval_actor_role": current_user.role,
                "reviewer_requirement": reviewer_requirement_for_suggestion(
                    action_mode=suggestion.action_mode,
                    risk_level=suggestion.risk_level,
                    policy_reasons=tuple(suggestion.policy_reasons),
                ).value,
            },
        )

        return suggestion
    except ReplySuggestionError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except AccessDeniedError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.post(
    "/reply-suggestions/{reply_suggestion_id}/reject",
    response_model=ReplySuggestionResponse,
)
def reject_reply_suggestion_endpoint(
    reply_suggestion_id: UUID,
    payload: RejectReplyRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("sales", "manager", "head", "superadmin")
    ),
):
    try:
        get_accessible_reply_suggestion_or_raise(
            db=db,
            reply_suggestion_id=reply_suggestion_id,
            current_user=current_user,
        )
        suggestion = reject_reply_suggestion(
            db=db,
            reply_suggestion_id=reply_suggestion_id,
            payload=payload,
        )

        create_audit_log(
            db=db,
            action="reply_suggestion.reject",
            resource_type="reply_suggestion",
            resource_id=str(reply_suggestion_id),
            current_user=current_user,
            request=request,
            metadata={"reason": payload.reason},
        )

        return suggestion
    except ReplySuggestionError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except AccessDeniedError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
