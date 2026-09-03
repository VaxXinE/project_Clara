import base64
import hashlib
from urllib.parse import parse_qs, urlencode, urlsplit

import jwt
import pytest
from fastapi.testclient import TestClient

from app.core.config import settings

CLIENT_ID = "live-chat-dashboard"
CLIENT_SECRET = "test-live-chat-client-secret-32-bytes-minimum"
SIGNING_SECRET = "test-clara-sso-signing-secret-32-bytes-minimum"
REDIRECT_URI = "https://live-chat.example.com/auth/clara/callback"
VERIFIER = "test-pkce-verifier-with-more-than-forty-three-characters-123456"


def configure_sso(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "sso_issuer", "https://clara.example.com")
    monkeypatch.setattr(settings, "sso_client_id", CLIENT_ID)
    monkeypatch.setattr(settings, "sso_client_secret", CLIENT_SECRET)
    monkeypatch.setattr(settings, "sso_redirect_uris", REDIRECT_URI)
    monkeypatch.setattr(settings, "sso_signing_secret", SIGNING_SECRET)


def login(client: TestClient, email: str, password: str) -> None:
    response = client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text


def pkce_challenge() -> str:
    digest = hashlib.sha256(VERIFIER.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


def authorization_params(**overrides: str) -> dict[str, str]:
    params = {
        "client_id": CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "scope": "openid profile email",
        "state": "random-state-at-least-16-chars",
        "nonce": "random-nonce-value",
        "code_challenge": pkce_challenge(),
        "code_challenge_method": "S256",
    }
    params.update(overrides)
    return params


def test_authorization_code_flow_is_pkce_bound_and_single_use(
    client: TestClient,
    seeded_data: dict[str, object],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    configure_sso(monkeypatch)
    user = seeded_data["marketing_a"]
    login(client, user.email, "MarketingPass123!")

    authorize = client.get(
        f"/oauth/authorize?{urlencode(authorization_params())}",
        follow_redirects=False,
    )
    assert authorize.status_code == 302, authorize.text
    callback = urlsplit(authorize.headers["location"])
    query = parse_qs(callback.query)
    assert f"{callback.scheme}://{callback.netloc}{callback.path}" == REDIRECT_URI
    assert query["state"] == ["random-state-at-least-16-chars"]
    code = query["code"][0]

    wrong_verifier = client.post(
        "/oauth/token",
        data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": REDIRECT_URI,
            "code_verifier": "x" * 43,
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
        },
    )
    assert wrong_verifier.status_code == 401

    token = client.post(
        "/oauth/token",
        data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": REDIRECT_URI,
            "code_verifier": VERIFIER,
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
        },
    )
    assert token.status_code == 200, token.text
    payload = token.json()
    id_claims = jwt.decode(
        payload["id_token"],
        CLIENT_SECRET,
        algorithms=["HS256"],
        audience=CLIENT_ID,
        issuer="https://clara.example.com",
    )
    assert id_claims["sub"] == str(user.id)
    assert id_claims["organizationId"] == str(user.organization_id)
    assert id_claims["nonce"] == "random-nonce-value"

    replay = client.post(
        "/oauth/token",
        data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": REDIRECT_URI,
            "code_verifier": VERIFIER,
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
        },
    )
    assert replay.status_code == 401

    credentials = base64.b64encode(f"{CLIENT_ID}:{CLIENT_SECRET}".encode()).decode()
    introspection = client.post(
        "/oauth/introspect",
        data={"token": payload["access_token"]},
        headers={"Authorization": f"Basic {credentials}"},
    )
    assert introspection.status_code == 200, introspection.text
    assert introspection.json()["active"] is True
    assert introspection.json()["sub"] == str(user.id)

    userinfo = client.get(
        "/oauth/userinfo",
        headers={"Authorization": f"Bearer {payload['access_token']}"},
    )
    assert userinfo.status_code == 200, userinfo.text
    assert userinfo.json()["email"] == user.email


def test_authorize_rejects_unregistered_redirect_uri(
    client: TestClient,
    seeded_data: dict[str, object],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    configure_sso(monkeypatch)
    user = seeded_data["marketing_a"]
    login(client, user.email, "MarketingPass123!")

    response = client.get(
        f"/oauth/authorize?{urlencode(authorization_params(redirect_uri='https://attacker.example/callback'))}",
        follow_redirects=False,
    )
    assert response.status_code == 400
    assert "code=" not in response.text


def test_authorize_redirects_unauthenticated_user_to_clara_login(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    configure_sso(monkeypatch)
    monkeypatch.setattr(
        settings, "sso_login_url", "https://dashboard.clara.example/login"
    )

    response = client.get(
        f"/oauth/authorize?{urlencode(authorization_params())}",
        follow_redirects=False,
    )

    assert response.status_code == 302
    location = urlsplit(response.headers["location"])
    assert f"{location.scheme}://{location.netloc}{location.path}" == (
        "https://dashboard.clara.example/login"
    )
    return_to = parse_qs(location.query)["returnTo"][0]
    assert return_to.startswith("https://clara.example.com/oauth/authorize?")
