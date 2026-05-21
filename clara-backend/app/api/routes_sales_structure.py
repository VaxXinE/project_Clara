from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.db.session import get_db
from app.models.user import User
from app.schemas.sales_structure_schema import (
    CreateSalesTeamRequest,
    CreateSalesUnitRequest,
    SalesTeamResponse,
    SalesUnitResponse,
    UpdateSalesTeamRequest,
    UpdateSalesUnitRequest,
)
from app.services.audit_service import create_audit_log
from app.services.sales_structure_service import (
    SalesStructureError,
    create_sales_team,
    create_sales_unit,
    delete_sales_team,
    delete_sales_unit,
    list_sales_teams,
    list_sales_units,
    update_sales_team,
    update_sales_unit,
)

router = APIRouter(prefix="/sales-structure", tags=["sales-structure"])


@router.get("/units", response_model=list[SalesUnitResponse])
def list_sales_units_endpoint(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("head")),
):
    return list_sales_units(db=db, current_user=current_user)


@router.post("/units", response_model=SalesUnitResponse, status_code=status.HTTP_201_CREATED)
def create_sales_unit_endpoint(
    payload: CreateSalesUnitRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("head")),
):
    try:
        unit = create_sales_unit(db=db, payload=payload, current_user=current_user)
    except SalesStructureError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    create_audit_log(
        db=db,
        action="sales_structure.unit.create",
        resource_type="sales_unit",
        resource_id=str(unit.id),
        current_user=current_user,
        request=request,
        metadata={"organization_id": str(unit.organization_id), "code": unit.code},
    )
    return unit


@router.patch("/units/{unit_id}", response_model=SalesUnitResponse)
def update_sales_unit_endpoint(
    unit_id: UUID,
    payload: UpdateSalesUnitRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("head")),
):
    try:
        unit = update_sales_unit(
            db=db,
            unit_id=unit_id,
            payload=payload,
            current_user=current_user,
        )
    except SalesStructureError as exc:
        status_code = status.HTTP_404_NOT_FOUND if "not found" in str(exc).lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc

    create_audit_log(
        db=db,
        action="sales_structure.unit.update",
        resource_type="sales_unit",
        resource_id=str(unit.id),
        current_user=current_user,
        request=request,
        metadata={"organization_id": str(unit.organization_id), "code": unit.code},
    )
    return unit


@router.delete("/units/{unit_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sales_unit_endpoint(
    unit_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("head")),
):
    try:
        delete_sales_unit(db=db, unit_id=unit_id, current_user=current_user)
    except SalesStructureError as exc:
        status_code = status.HTTP_404_NOT_FOUND if "not found" in str(exc).lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc

    create_audit_log(
        db=db,
        action="sales_structure.unit.delete",
        resource_type="sales_unit",
        resource_id=str(unit_id),
        current_user=current_user,
        request=request,
        metadata={},
    )


@router.get("/teams", response_model=list[SalesTeamResponse])
def list_sales_teams_endpoint(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("head")),
):
    return list_sales_teams(db=db, current_user=current_user)


@router.post("/teams", response_model=SalesTeamResponse, status_code=status.HTTP_201_CREATED)
def create_sales_team_endpoint(
    payload: CreateSalesTeamRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("head")),
):
    try:
        team = create_sales_team(db=db, payload=payload, current_user=current_user)
    except SalesStructureError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    create_audit_log(
        db=db,
        action="sales_structure.team.create",
        resource_type="sales_team",
        resource_id=str(team.id),
        current_user=current_user,
        request=request,
        metadata={"organization_id": str(team.organization_id), "code": team.code},
    )
    return team


@router.patch("/teams/{team_id}", response_model=SalesTeamResponse)
def update_sales_team_endpoint(
    team_id: UUID,
    payload: UpdateSalesTeamRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("head")),
):
    try:
        team = update_sales_team(
            db=db,
            team_id=team_id,
            payload=payload,
            current_user=current_user,
        )
    except SalesStructureError as exc:
        status_code = status.HTTP_404_NOT_FOUND if "not found" in str(exc).lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc

    create_audit_log(
        db=db,
        action="sales_structure.team.update",
        resource_type="sales_team",
        resource_id=str(team.id),
        current_user=current_user,
        request=request,
        metadata={"organization_id": str(team.organization_id), "code": team.code},
    )
    return team


@router.delete("/teams/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sales_team_endpoint(
    team_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("head")),
):
    try:
        delete_sales_team(db=db, team_id=team_id, current_user=current_user)
    except SalesStructureError as exc:
        status_code = status.HTTP_404_NOT_FOUND if "not found" in str(exc).lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc

    create_audit_log(
        db=db,
        action="sales_structure.team.delete",
        resource_type="sales_team",
        resource_id=str(team_id),
        current_user=current_user,
        request=request,
        metadata={},
    )
