import sys
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings
from app.models.user import User


def login(client: TestClient, *, email: str, password: str) -> None:
    response = client.post(
        "/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200, response.text


def csrf_headers(client: TestClient) -> dict[str, str]:
    csrf_token = client.cookies.get(settings.csrf_cookie_name)
    assert csrf_token
    return {"X-CSRF-Token": csrf_token}


def test_head_can_create_unit_team_and_assign_user(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    admin_a = seeded_data["admin_a"]
    manager_a = seeded_data["manager_a"]
    marketing_a = seeded_data["marketing_a"]

    login(client, email=admin_a.email, password="AdminPass123!")

    unit_response = client.post(
        "/sales-structure/units",
        json={
            "name": "Jakarta Timur",
            "code": "jkt-timur",
            "organization_id": str(admin_a.organization_id),
        },
        headers=csrf_headers(client),
    )
    assert unit_response.status_code == 201, unit_response.text
    unit_payload = unit_response.json()

    team_response = client.post(
        "/sales-structure/teams",
        json={
            "name": "Team Anggrek",
            "code": "team-anggrek",
            "organization_id": str(admin_a.organization_id),
            "unit_id": unit_payload["id"],
            "manager_user_id": str(manager_a.id),
        },
        headers=csrf_headers(client),
    )
    assert team_response.status_code == 201, team_response.text
    team_payload = team_response.json()
    assert team_payload["unit_name"] == "Jakarta Timur"
    assert team_payload["manager_user_name"] == manager_a.name

    update_response = client.patch(
        f"/auth/users/{marketing_a.id}",
        json={"team_id": team_payload["id"]},
        headers=csrf_headers(client),
    )
    assert update_response.status_code == 200, update_response.text
    user_payload = update_response.json()
    assert user_payload["team_name"] == "Team Anggrek"
    assert user_payload["unit_name"] == "Jakarta Timur"

    db = db_session_factory()
    refreshed_user = db.get(User, marketing_a.id)
    assert refreshed_user is not None
    assert str(refreshed_user.team_id) == team_payload["id"]


def test_head_cannot_manage_sales_structure_in_other_organization(
    client: TestClient,
    seeded_data: dict[str, object],
) -> None:
    admin_a = seeded_data["admin_a"]
    org_b = seeded_data["org_b"]

    login(client, email=admin_a.email, password="AdminPass123!")

    response = client.post(
        "/sales-structure/units",
        json={
            "name": "Bandung",
            "code": "bdg",
            "organization_id": str(org_b.id),
        },
        headers=csrf_headers(client),
    )

    assert response.status_code == 400
    assert (
        response.json()["detail"]
        == "Head hanya boleh mengelola hierarchy di organization sendiri."
    )


def test_superadmin_can_list_cross_org_units(
    client: TestClient,
    seeded_data: dict[str, object],
) -> None:
    owner = seeded_data["owner"]
    org_a = seeded_data["org_a"]
    org_b = seeded_data["org_b"]

    login(client, email=owner.email, password="OwnerPass123!")

    unit_a = client.post(
        "/sales-structure/units",
        json={"name": "Unit A", "code": "unit-a", "organization_id": str(org_a.id)},
        headers=csrf_headers(client),
    )
    assert unit_a.status_code == 201, unit_a.text

    unit_b = client.post(
        "/sales-structure/units",
        json={"name": "Unit B", "code": "unit-b", "organization_id": str(org_b.id)},
        headers=csrf_headers(client),
    )
    assert unit_b.status_code == 201, unit_b.text

    units_response = client.get("/sales-structure/units")
    assert units_response.status_code == 200, units_response.text
    units_payload = units_response.json()
    returned_org_ids = {item["organization_id"] for item in units_payload}
    assert str(org_a.id) in returned_org_ids
    assert str(org_b.id) in returned_org_ids


def test_head_cannot_assign_non_manager_as_team_manager(
    client: TestClient,
    seeded_data: dict[str, object],
) -> None:
    admin_a = seeded_data["admin_a"]

    login(client, email=admin_a.email, password="AdminPass123!")

    response = client.post(
        "/sales-structure/teams",
        json={
            "name": "Team Keliru",
            "code": "team-keliru",
            "organization_id": str(admin_a.organization_id),
            "manager_user_id": str(admin_a.id),
        },
        headers=csrf_headers(client),
    )

    assert response.status_code == 400
    assert (
        response.json()["detail"]
        == "User yang ditunjuk sebagai manager team harus memiliki role manager."
    )
