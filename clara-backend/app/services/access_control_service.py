from uuid import UUID

from sqlalchemy import Select, or_, select
from sqlalchemy.orm import Session

from app.models.conversation import Conversation
from app.models.reply_suggestion import ReplySuggestion
from app.models.sales_team import SalesTeam
from app.models.user import User
from app.services.role_service import (
    is_head_like,
    is_manager_like,
    is_sales_like,
    is_superadmin_like,
    is_platform_super_admin as is_platform_super_admin_role,
)


class AccessDeniedError(RuntimeError):
    pass


def is_platform_super_admin(user: User) -> bool:
    return is_platform_super_admin_role(user.role)


def can_access_all_conversations(user: User) -> bool:
    return is_head_like(user.role)


def can_access_marketing_insights(user: User) -> bool:
    return is_manager_like(user.role) or is_sales_like(user.role)


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

    if not is_sales_like(user.role):
        return False

    return conversation.sales_user_id == user.id


def get_accessible_sales_user_ids(
    db: Session,
    *,
    current_user: User,
) -> set[UUID] | None:
    if is_platform_super_admin(current_user):
        return None

    if is_superadmin_like(current_user.role):
        return None

    ensure_user_has_organization(current_user)

    if is_head_like(current_user.role):
        return None

    if is_sales_like(current_user.role):
        return {current_user.id}

    if not is_manager_like(current_user.role):
        return {current_user.id}

    scoped_team_ids: set[UUID] = set()
    scoped_unit_ids: set[UUID] = set()

    if current_user.team_id is not None:
        scoped_team_ids.add(current_user.team_id)

    managed_teams = db.scalars(
        select(SalesTeam).where(
            SalesTeam.organization_id == current_user.organization_id,
            SalesTeam.manager_user_id == current_user.id,
        )
    ).all()

    for team in managed_teams:
        scoped_team_ids.add(team.id)
        if team.unit_id is not None:
            scoped_unit_ids.add(team.unit_id)

    if not scoped_team_ids and not scoped_unit_ids:
        return None

    statement = select(User.id).where(
        User.organization_id == current_user.organization_id,
    )

    team_filters = []
    if scoped_team_ids:
        team_filters.append(User.team_id.in_(scoped_team_ids))
    if scoped_unit_ids:
        unit_team_ids = select(SalesTeam.id).where(
            SalesTeam.organization_id == current_user.organization_id,
            SalesTeam.unit_id.in_(scoped_unit_ids),
        )
        team_filters.append(User.team_id.in_(unit_team_ids))

    if team_filters:
        statement = statement.where(or_(*team_filters))

    accessible_user_ids = set(db.scalars(statement).all())
    accessible_user_ids.add(current_user.id)
    return accessible_user_ids


def apply_sales_user_scope_filter(
    statement: Select,
    *,
    db: Session,
    current_user: User,
    sales_user_id_column,
) -> Select:
    accessible_user_ids = get_accessible_sales_user_ids(
        db=db,
        current_user=current_user,
    )
    if accessible_user_ids is None:
        return statement
    return statement.where(sales_user_id_column.in_(accessible_user_ids))


def can_access_conversation_in_scope(
    db: Session,
    *,
    current_user: User,
    conversation: Conversation,
) -> bool:
    if is_platform_super_admin(current_user):
        return True

    if not same_organization(current_user, conversation):
        return False

    accessible_user_ids = get_accessible_sales_user_ids(
        db=db,
        current_user=current_user,
    )
    if accessible_user_ids is None:
        return True
    return conversation.sales_user_id in accessible_user_ids


def get_accessible_conversation_or_raise(
    db: Session,
    conversation_id: UUID,
    current_user: User,
) -> Conversation:
    ensure_user_has_organization(current_user)

    conversation = db.get(Conversation, conversation_id)

    if conversation is None:
        raise AccessDeniedError("Conversation not found.")

    if not can_access_conversation_in_scope(
        db=db,
        current_user=current_user,
        conversation=conversation,
    ):
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

    if not can_access_conversation_in_scope(
        db=db,
        current_user=current_user,
        conversation=conversation,
    ):
        raise AccessDeniedError("Reply suggestion not found.")

    return suggestion
