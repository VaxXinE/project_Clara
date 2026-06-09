import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.organization import Organization
from app.schemas.organization_schema import (
    CreateOrganizationRequest,
    UpdateOrganizationRequest,
)


class OrganizationError(RuntimeError):
    pass


SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def create_organization(
    db: Session,
    payload: CreateOrganizationRequest,
) -> Organization:
    slug = payload.slug.strip().lower()

    if not SLUG_PATTERN.match(slug):
        raise OrganizationError(
            "Slug must use lowercase letters, numbers, and hyphens only."
        )

    existing = db.scalars(
        select(Organization).where(Organization.slug == slug)
    ).first()

    if existing is not None:
        raise OrganizationError("Organization slug already exists.")

    organization = Organization(
        name=payload.name.strip(),
        slug=slug,
    )

    db.add(organization)
    db.commit()
    db.refresh(organization)

    return organization


def list_organizations(db: Session) -> list[Organization]:
    return list(
        db.scalars(
            select(Organization).order_by(Organization.created_at.desc())
        ).all()
    )


def update_organization(
    db: Session,
    *,
    organization_id,
    payload: UpdateOrganizationRequest,
) -> Organization:
    organization = db.get(Organization, organization_id)
    if organization is None:
        raise OrganizationError("Organization not found.")

    if payload.name is not None:
        organization.name = payload.name.strip()

    if payload.slug is not None:
        slug = payload.slug.strip().lower()
        if not SLUG_PATTERN.match(slug):
            raise OrganizationError(
                "Slug must use lowercase letters, numbers, and hyphens only."
            )

        existing = db.scalars(
            select(Organization).where(
                Organization.slug == slug,
                Organization.id != organization.id,
            )
        ).first()
        if existing is not None:
            raise OrganizationError("Organization slug already exists.")

        organization.slug = slug

    db.add(organization)
    db.commit()
    db.refresh(organization)
    return organization
