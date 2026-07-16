from fastapi.testclient import TestClient

from app.core.config import settings


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


def test_superadmin_uploads_one_global_extension_for_all_roles(
    client: TestClient,
    seeded_data: dict[str, object],
    monkeypatch,
    tmp_path,
) -> None:
    owner = seeded_data["owner"]
    marketing_a = seeded_data["marketing_a"]
    manager_a = seeded_data["manager_a"]
    monkeypatch.setattr(settings, "extension_distribution_dir", str(tmp_path))

    login(client, email=owner.email, password="OwnerPass123!")

    upload_response = client.post(
        "/dashboard/extension-builds",
        data={"version": "v1.2.3"},
        files={
            "file": (
                "clara-global.zip",
                b"fake extension build",
                "application/zip",
            )
        },
        headers=csrf_headers(client),
    )

    assert upload_response.status_code == 200, upload_response.text
    upload_payload = upload_response.json()
    assert upload_payload["role"] == "all"
    assert upload_payload["version"] == "v1.2.3"

    client.post("/auth/logout", headers=csrf_headers(client))

    login(client, email=marketing_a.email, password="MarketingPass123!")

    sales_build_response = client.get("/dashboard/extension-builds")
    assert sales_build_response.status_code == 200, sales_build_response.text
    assert sales_build_response.json()["available"] is True
    assert sales_build_response.json()["can_download"] is True

    allowed_download = client.get("/dashboard/extension-builds/download")
    assert allowed_download.status_code == 200, allowed_download.text
    assert allowed_download.content == b"fake extension build"

    client.post("/auth/logout", headers=csrf_headers(client))

    login(client, email=manager_a.email, password="ManagerPass123!")

    manager_build_response = client.get("/dashboard/extension-builds")
    assert manager_build_response.status_code == 200, manager_build_response.text
    assert manager_build_response.json()["available"] is True
    assert manager_build_response.json()["can_download"] is True

    manager_download = client.get("/dashboard/extension-builds/download")
    assert manager_download.status_code == 200, manager_download.text
    assert manager_download.content == b"fake extension build"
