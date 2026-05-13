from pathlib import Path
import sys
import os
from collections.abc import Generator

import pytest
from fastapi import FastAPI
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault(
    "JWT_SECRET_KEY",
    "test-jwt-secret-key-with-32-plus-bytes",
)
os.environ.setdefault("APP_ENV", "development")
os.environ.setdefault("AUTH_COOKIE_SAMESITE", "lax")
os.environ.setdefault(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000",
)

from app.api import routes_auth, routes_extension, routes_product_knowledge
from app.core.config import settings
from app.db.session import Base, get_db
from app.main import create_app
from app.models.ai_extraction import AIExtraction
from app.models.approval_log import ApprovalLog
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.organization import Organization
from app.models.product_knowledge import ProductKnowledge
from app.models.reply_suggestion import ReplySuggestion
from app.models.sent_message import SentMessage
from app.models.user import User
from app.services.auth_service import hash_password


@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(_type, _compiler, **_kwargs):
    return "JSON"


@pytest.fixture()
def db_session_factory(monkeypatch: pytest.MonkeyPatch) -> Generator[sessionmaker, None, None]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    testing_session_factory = sessionmaker(
        bind=engine,
        autocommit=False,
        autoflush=False,
        expire_on_commit=False,
    )

    Base.metadata.create_all(
        bind=engine,
        tables=[
            Organization.__table__,
            User.__table__,
            Conversation.__table__,
            Message.__table__,
            AIExtraction.__table__,
            ReplySuggestion.__table__,
            ApprovalLog.__table__,
            SentMessage.__table__,
            ProductKnowledge.__table__,
        ],
    )

    monkeypatch.setattr(routes_auth, "create_audit_log", lambda *args, **kwargs: None)
    monkeypatch.setattr(routes_extension, "create_audit_log", lambda *args, **kwargs: None)
    monkeypatch.setattr(
        routes_product_knowledge,
        "create_audit_log",
        lambda *args, **kwargs: None,
    )
    monkeypatch.setattr(
        routes_auth.login_rate_limiter,
        "is_allowed",
        lambda *args, **kwargs: True,
    )

    yield testing_session_factory

    Base.metadata.drop_all(
        bind=engine,
        tables=[
            ProductKnowledge.__table__,
            SentMessage.__table__,
            ApprovalLog.__table__,
            ReplySuggestion.__table__,
            AIExtraction.__table__,
            Message.__table__,
            Conversation.__table__,
            User.__table__,
            Organization.__table__,
        ],
    )
    engine.dispose()


@pytest.fixture()
def app(db_session_factory: sessionmaker) -> Generator[FastAPI, None, None]:
    app_instance = create_app()

    def override_get_db() -> Generator[Session, None, None]:
        db = db_session_factory()
        try:
            yield db
        finally:
            db.close()

    app_instance.dependency_overrides[get_db] = override_get_db

    yield app_instance

    app_instance.dependency_overrides.clear()


@pytest.fixture()
def client(app: FastAPI) -> Generator[TestClient, None, None]:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def seeded_data(db_session_factory: sessionmaker) -> Generator[dict[str, object], None, None]:
    db = db_session_factory()

    org_a = Organization(name="Org Alpha", slug="org-alpha")
    org_b = Organization(name="Org Beta", slug="org-beta")
    db.add_all([org_a, org_b])
    db.flush()

    owner = User(
        organization_id=org_a.id,
        name="Owner Clara",
        email="owner@clara.local",
        hashed_password=hash_password("OwnerPass123!"),
        role="owner",
        is_active=True,
    )
    admin_a = User(
        organization_id=org_a.id,
        name="Admin Alpha",
        email="admin.alpha@clara.local",
        hashed_password=hash_password("AdminPass123!"),
        role="admin",
        is_active=True,
    )
    admin_b = User(
        organization_id=org_a.id,
        name="Admin Beta",
        email="admin.beta@clara.local",
        hashed_password=hash_password("AdminPass123!"),
        role="admin",
        is_active=True,
    )
    marketing_a = User(
        organization_id=org_a.id,
        created_by_user_id=admin_a.id,
        name="Marketing Alpha",
        email="marketing.alpha@clara.local",
        hashed_password=hash_password("MarketingPass123!"),
        role="marketing",
        is_active=True,
    )
    marketing_b = User(
        organization_id=org_a.id,
        created_by_user_id=admin_b.id,
        name="Marketing Beta",
        email="marketing.beta@clara.local",
        hashed_password=hash_password("MarketingPass123!"),
        role="marketing",
        is_active=True,
    )
    marketing_other_org = User(
        organization_id=org_b.id,
        created_by_user_id=admin_b.id,
        name="Marketing Gamma",
        email="marketing.gamma@clara.local",
        hashed_password=hash_password("MarketingPass123!"),
        role="marketing",
        is_active=True,
    )
    inactive_user = User(
        organization_id=org_a.id,
        name="Inactive User",
        email="inactive@clara.local",
        hashed_password=hash_password("InactivePass123!"),
        role="marketing",
        is_active=False,
    )

    db.add_all(
        [
            owner,
            admin_a,
            admin_b,
            marketing_a,
            marketing_b,
            marketing_other_org,
            inactive_user,
        ]
    )
    db.flush()

    marketing_a.created_by_user_id = admin_a.id
    marketing_b.created_by_user_id = admin_b.id
    marketing_other_org.created_by_user_id = admin_b.id

    owned_conversation = Conversation(
        organization_id=org_a.id,
        sales_user_id=marketing_b.id,
        title="Owned Conversation",
        source="whatsapp_txt",
        status="uploaded",
        current_stage="unknown",
        lead_temperature="unknown",
    )
    db.add(owned_conversation)

    global_knowledge = ProductKnowledge(
        organization_id=None,
        created_by_user_id=owner.id,
        title="Legalitas Global",
        category="general",
        content="Produk ini punya knowledge global.",
        source_type="manual_note",
        is_active=True,
    )
    db.add(global_knowledge)

    db.commit()
    db.refresh(owner)
    db.refresh(admin_a)
    db.refresh(admin_b)
    db.refresh(marketing_a)
    db.refresh(marketing_b)
    db.refresh(marketing_other_org)
    db.refresh(inactive_user)
    db.refresh(owned_conversation)
    db.refresh(global_knowledge)

    yield {
        "org_a": org_a,
        "org_b": org_b,
        "owner": owner,
        "admin_a": admin_a,
        "admin_b": admin_b,
        "marketing_a": marketing_a,
        "marketing_b": marketing_b,
        "marketing_other_org": marketing_other_org,
        "inactive_user": inactive_user,
        "owned_conversation": owned_conversation,
        "global_knowledge": global_knowledge,
    }

    db.close()


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
