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
    admin_a = seeded_data["admin_a"]
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

    superadmin_notifications = client.get("/dashboard/notifications")
    assert superadmin_notifications.status_code == 200, superadmin_notifications.text
    assert all(
        item["source_type"] != "extension_build_update"
        for item in superadmin_notifications.json()["items"]
    )

    client.post("/auth/logout", headers=csrf_headers(client))

    login(client, email=marketing_a.email, password="MarketingPass123!")

    sales_build_response = client.get("/dashboard/extension-builds")
    assert sales_build_response.status_code == 200, sales_build_response.text
    assert sales_build_response.json()["available"] is True
    assert sales_build_response.json()["can_download"] is True

    allowed_download = client.get("/dashboard/extension-builds/download")
    assert allowed_download.status_code == 200, allowed_download.text
    assert allowed_download.content == b"fake extension build"

    sales_notifications = client.get("/dashboard/notifications")
    assert sales_notifications.status_code == 200, sales_notifications.text
    sales_extension_notifications = [
        item
        for item in sales_notifications.json()["items"]
        if item["source_type"] == "extension_build_update"
    ]
    assert len(sales_extension_notifications) == 1
    assert sales_extension_notifications[0]["target_href"] == "/dashboard/profile"
    assert sales_extension_notifications[0]["target_role"] == "all"

    client.post("/auth/logout", headers=csrf_headers(client))

    login(client, email=manager_a.email, password="ManagerPass123!")

    manager_build_response = client.get("/dashboard/extension-builds")
    assert manager_build_response.status_code == 200, manager_build_response.text
    assert manager_build_response.json()["available"] is True
    assert manager_build_response.json()["can_download"] is True

    manager_download = client.get("/dashboard/extension-builds/download")
    assert manager_download.status_code == 200, manager_download.text
    assert manager_download.content == b"fake extension build"

    manager_notifications = client.get("/dashboard/notifications")
    assert manager_notifications.status_code == 200, manager_notifications.text
    manager_extension_notifications = [
        item
        for item in manager_notifications.json()["items"]
        if item["source_type"] == "extension_build_update"
    ]
    assert len(manager_extension_notifications) == 1
    assert manager_extension_notifications[0]["target_role"] == "all"

    client.post("/auth/logout", headers=csrf_headers(client))

    login(client, email=admin_a.email, password="AdminPass123!")

    head_notifications = client.get("/dashboard/notifications")
    assert head_notifications.status_code == 200, head_notifications.text
    head_extension_notifications = [
        item
        for item in head_notifications.json()["items"]
        if item["source_type"] == "extension_build_update"
    ]
    assert len(head_extension_notifications) == 1
    assert head_extension_notifications[0]["target_role"] == "all"


def test_resolved_extension_notification_stays_hidden_for_same_version(
    client: TestClient,
    seeded_data: dict[str, object],
    monkeypatch,
    tmp_path,
) -> None:
    owner = seeded_data["owner"]
    marketing_a = seeded_data["marketing_a"]
    monkeypatch.setattr(settings, "extension_distribution_dir", str(tmp_path))

    login(client, email=owner.email, password="OwnerPass123!")
    upload_response = client.post(
        "/dashboard/extension-builds",
        data={"version": "v9.9.9"},
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

    client.post("/auth/logout", headers=csrf_headers(client))

    login(client, email=marketing_a.email, password="MarketingPass123!")
    notifications_response = client.get("/dashboard/notifications")
    assert notifications_response.status_code == 200, notifications_response.text
    extension_notifications = [
        item
        for item in notifications_response.json()["items"]
        if item["source_type"] == "extension_build_update"
    ]
    assert len(extension_notifications) == 1

    resolve_response = client.patch(
        f"/dashboard/notifications/{extension_notifications[0]['id']}/resolve",
        json={"resolution_note": "Sudah ditutup."},
        headers=csrf_headers(client),
    )
    assert resolve_response.status_code == 200, resolve_response.text

    refreshed_response = client.get("/dashboard/notifications")
    assert refreshed_response.status_code == 200, refreshed_response.text
    refreshed_extension_notifications = [
        item
        for item in refreshed_response.json()["items"]
        if item["source_type"] == "extension_build_update"
    ]
    assert len(refreshed_extension_notifications) == 1
    assert refreshed_extension_notifications[0]["status"] == "resolved"
