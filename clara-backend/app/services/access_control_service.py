from uuid import UUID

from sqlalchemy.orm import Session

from app.models.reply_suggestion import ReplySuggestion
from app.models.conversation import Conversation
from app.models.user import User


class AccessDeniedError(RuntimeError):
    pass


def is_platform_super_admin(user: User) -> bool:
    return user.role == "super_admin"


def can_access_all_conversations(user: User) -> bool:
    return user.role in {"owner", "admin"}


def can_access_marketing_insights(user: User) -> bool:
    return user.role in {"owner", "admin", "marketing"}


def ensure_user_has_organization(user: User) -> None:
    if user.organization_id is None and not is_platform_super_admin(user):
        raise AccessDeniedError("User has no organization assigned.")


def same_organization(user: User, conversation: Conversation) -> bool:
    if is_platform_super_admin(user):
        return True

    if user.organization_id is None:
        return False

    return conversation.organization_id == user.organization_id


def can_access_conversation(user: User, conversation: Conversation) -> bool:
    if is_platform_super_admin(user):
        return True

    if not same_organization(user, conversation):
        return False

    if can_access_all_conversations(user):
        return True

    if user.role != "sales":
        return False

    return conversation.sales_user_id == user.id


def get_accessible_conversation_or_raise(
    db: Session,
    conversation_id: UUID,
    current_user: User,
) -> Conversation:
    ensure_user_has_organization(current_user)

    conversation = db.get(Conversation, conversation_id)

    if conversation is None:
        raise AccessDeniedError("Conversation not found.")

    if not can_access_conversation(current_user, conversation):
        raise AccessDeniedError("Conversation not found.")

    return conversation


def get_accessible_reply_suggestion_or_raise(
    db: Session,
    reply_suggestion_id: UUID,
    current_user: User,
) -> ReplySuggestion:
    ensure_user_has_organization(current_user)

    suggestion = db.get(ReplySuggestion, reply_suggestion_id)

    if suggestion is None:
        raise AccessDeniedError("Reply suggestion not found.")

    conversation = db.get(Conversation, suggestion.conversation_id)

    if conversation is None:
        raise AccessDeniedError("Conversation not found.")

    if not can_access_conversation(current_user, conversation):
        raise AccessDeniedError("Reply suggestion not found.")

    return suggestion
