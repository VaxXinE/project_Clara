from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.organization import Organization
from app.models.sales_team import SalesTeam
from app.models.sales_unit import SalesUnit
from app.models.user import User
from app.schemas.sales_structure_schema import (
    CreateSalesTeamRequest,
    CreateSalesUnitRequest,
    SalesTeamResponse,
    SalesUnitResponse,
    UpdateSalesTeamRequest,
    UpdateSalesUnitRequest,
)
from app.services.role_service import is_owner_like
from app.services.role_service import normalize_role


class SalesStructureError(RuntimeError):
    pass


def _normalize_code(value: str) -> str:
    return value.strip().lower().replace(" ", "-").replace("_", "-")


def _ensure_manageable_organization(
    db: Session,
    *,
    current_user: User,
    organization_id: UUID | None,
) -> Organization:
    resolved_org_id = organization_id or current_user.organization_id
    if resolved_org_id is None:
        raise SalesStructureError("Organization wajib dipilih.")

    organization = db.get(Organization, resolved_org_id)
    if organization is None:
        raise SalesStructureError("Organization not found.")

    if is_owner_like(current_user.role):
        return organization

    if current_user.organization_id is None:
        raise SalesStructureError("Admin has no organization assigned.")

    if organization.id != current_user.organization_id:
        raise SalesStructureError("Head hanya boleh mengelola hierarchy di organization sendiri.")

    return organization


def _ensure_unit_access(unit: SalesUnit | None, *, current_user: User) -> SalesUnit:
    if unit is None:
        raise SalesStructureError("Sales unit not found.")

    if is_owner_like(current_user.role):
        return unit

    if current_user.organization_id is None or unit.organization_id != current_user.organization_id:
        raise SalesStructureError("Sales unit not found.")

    return unit


def _ensure_team_access(team: SalesTeam | None, *, current_user: User) -> SalesTeam:
    if team is None:
        raise SalesStructureError("Sales team not found.")

    if is_owner_like(current_user.role):
        return team

    if current_user.organization_id is None or team.organization_id != current_user.organization_id:
        raise SalesStructureError("Sales team not found.")

    return team


def _validate_team_links(
    db: Session,
    *,
    organization_id: UUID,
    unit_id: UUID | None,
    manager_user_id: UUID | None,
) -> tuple[SalesUnit | None, User | None]:
    unit: SalesUnit | None = None
    manager_user: User | None = None

    if unit_id is not None:
        unit = db.get(SalesUnit, unit_id)
        if unit is None or unit.organization_id != organization_id:
            raise SalesStructureError("Sales unit tidak ditemukan di organization tersebut.")

    if manager_user_id is not None:
        manager_user = db.get(User, manager_user_id)
        if manager_user is None or manager_user.organization_id != organization_id:
            raise SalesStructureError("Manager user tidak ditemukan di organization tersebut.")
        if normalize_role(manager_user.role) != "manager":
            raise SalesStructureError("User yang ditunjuk sebagai manager team harus memiliki role manager.")

    return unit, manager_user


def _build_sales_unit_response(db: Session, unit: SalesUnit) -> SalesUnitResponse:
    team_count = db.scalar(
        select(func.count(SalesTeam.id)).where(SalesTeam.unit_id == unit.id)
    )
    return SalesUnitResponse(
        id=unit.id,
        organization_id=unit.organization_id,
        organization_name=unit.organization.name if unit.organization else None,
        name=unit.name,
        code=unit.code,
        created_at=unit.created_at,
        team_count=team_count or 0,
    )


def _build_sales_team_response(db: Session, team: SalesTeam) -> SalesTeamResponse:
    member_count = db.scalar(
        select(func.count(User.id)).where(User.team_id == team.id)
    )
    return SalesTeamResponse(
        id=team.id,
        organization_id=team.organization_id,
        organization_name=team.organization.name if team.organization else None,
        unit_id=team.unit_id,
        unit_name=team.unit.name if team.unit else None,
        manager_user_id=team.manager_user_id,
        manager_user_name=team.manager_user.name if team.manager_user else None,
        name=team.name,
        code=team.code,
        created_at=team.created_at,
        member_count=member_count or 0,
    )


def list_sales_units(db: Session, *, current_user: User) -> list[SalesUnitResponse]:
    statement = select(SalesUnit).options(selectinload(SalesUnit.organization)).order_by(
        SalesUnit.created_at.desc()
    )
    if not is_owner_like(current_user.role):
        if current_user.organization_id is None:
            return []
        statement = statement.where(SalesUnit.organization_id == current_user.organization_id)

    units = db.scalars(statement).all()
    return [_build_sales_unit_response(db, unit) for unit in units]


def create_sales_unit(
    db: Session,
    *,
    payload: CreateSalesUnitRequest,
    current_user: User,
) -> SalesUnitResponse:
    organization = _ensure_manageable_organization(
        db,
        current_user=current_user,
        organization_id=payload.organization_id,
    )
    unit = SalesUnit(
        organization_id=organization.id,
        name=payload.name.strip(),
        code=_normalize_code(payload.code),
    )
    db.add(unit)
    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise SalesStructureError("Sales unit dengan nama atau kode itu sudah ada.") from exc
    db.refresh(unit)
    return _build_sales_unit_response(db, unit)


def update_sales_unit(
    db: Session,
    *,
    unit_id: UUID,
    payload: UpdateSalesUnitRequest,
    current_user: User,
) -> SalesUnitResponse:
    unit = _ensure_unit_access(db.get(SalesUnit, unit_id), current_user=current_user)
    if payload.name is not None:
        unit.name = payload.name.strip()
    if payload.code is not None:
        unit.code = _normalize_code(payload.code)
    db.add(unit)
    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise SalesStructureError("Sales unit dengan nama atau kode itu sudah ada.") from exc
    db.refresh(unit)
    return _build_sales_unit_response(db, unit)


def delete_sales_unit(
    db: Session,
    *,
    unit_id: UUID,
    current_user: User,
) -> None:
    unit = _ensure_unit_access(db.get(SalesUnit, unit_id), current_user=current_user)
    db.delete(unit)
    db.commit()


def list_sales_teams(db: Session, *, current_user: User) -> list[SalesTeamResponse]:
    statement = (
        select(SalesTeam)
        .options(
            selectinload(SalesTeam.organization),
            selectinload(SalesTeam.unit),
            selectinload(SalesTeam.manager_user),
        )
        .order_by(SalesTeam.created_at.desc())
    )
    if not is_owner_like(current_user.role):
        if current_user.organization_id is None:
            return []
        statement = statement.where(SalesTeam.organization_id == current_user.organization_id)

    teams = db.scalars(statement).all()
    return [_build_sales_team_response(db, team) for team in teams]


def create_sales_team(
    db: Session,
    *,
    payload: CreateSalesTeamRequest,
    current_user: User,
) -> SalesTeamResponse:
    organization = _ensure_manageable_organization(
        db,
        current_user=current_user,
        organization_id=payload.organization_id,
    )
    _validate_team_links(
        db,
        organization_id=organization.id,
        unit_id=payload.unit_id,
        manager_user_id=payload.manager_user_id,
    )
    team = SalesTeam(
        organization_id=organization.id,
        unit_id=payload.unit_id,
        manager_user_id=payload.manager_user_id,
        name=payload.name.strip(),
        code=_normalize_code(payload.code),
    )
    db.add(team)
    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise SalesStructureError("Sales team dengan nama atau kode itu sudah ada.") from exc
    db.refresh(team)
    return _build_sales_team_response(db, team)


def update_sales_team(
    db: Session,
    *,
    team_id: UUID,
    payload: UpdateSalesTeamRequest,
    current_user: User,
) -> SalesTeamResponse:
    team = _ensure_team_access(db.get(SalesTeam, team_id), current_user=current_user)
    unit_id = team.unit_id
    manager_user_id = team.manager_user_id
    if "unit_id" in payload.model_fields_set:
        unit_id = payload.unit_id
    if "manager_user_id" in payload.model_fields_set:
        manager_user_id = payload.manager_user_id
    _validate_team_links(
        db,
        organization_id=team.organization_id,
        unit_id=unit_id,
        manager_user_id=manager_user_id,
    )
    if payload.name is not None:
        team.name = payload.name.strip()
    if payload.code is not None:
        team.code = _normalize_code(payload.code)
    team.unit_id = unit_id
    team.manager_user_id = manager_user_id
    db.add(team)
    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise SalesStructureError("Sales team dengan nama atau kode itu sudah ada.") from exc
    db.refresh(team)
    return _build_sales_team_response(db, team)


def delete_sales_team(
    db: Session,
    *,
    team_id: UUID,
    current_user: User,
) -> None:
    team = _ensure_team_access(db.get(SalesTeam, team_id), current_user=current_user)
    for member in db.scalars(select(User).where(User.team_id == team.id)).all():
        member.team_id = None
        db.add(member)
    db.delete(team)
    db.commit()
