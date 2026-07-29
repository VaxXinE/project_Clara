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

from app.api import (
    routes_auth,
    routes_dashboard,
    routes_extension,
    routes_product_knowledge,
    routes_sales_structure,
)
from app.core.config import settings
from app.db.session import Base, get_db
from app.main import create_app
from app.models.ai_extraction import AIExtraction
from app.models.approval_log import ApprovalLog
from app.models.audit_log import AuditLog
from app.models.chat_review_case import ChatReviewCase
from app.models.chat_review_note import ChatReviewNote
from app.models.conversation import Conversation
from app.models.customer_profile import CustomerProfile
from app.models.kpi_alert_record import KpiAlertRecord
from app.models.kpi_command_snapshot import KpiCommandSnapshot
from app.models.knowledge_update_proposal import KnowledgeUpdateProposal
from app.models.lead import Lead
from app.models.lead_activity_event import LeadActivityEvent
from app.models.lead_deal import LeadDeal
from app.models.lead_discipline_log import LeadDisciplineLog
from app.models.lead_task import LeadTask
from app.models.lead_task_event import LeadTaskEvent
from app.models.marketing_execution_item import MarketingExecutionItem
from app.models.message import Message
from app.models.organization import Organization
from app.models.ops_notification import OpsNotification
from app.models.performance_action import PerformanceAction
from app.models.product_knowledge import ProductKnowledge
from app.models.reply_suggestion import ReplySuggestion
from app.models.sales_performance_snapshot import SalesPerformanceSnapshot
from app.models.sales_team import SalesTeam
from app.models.sales_unit import SalesUnit
from app.models.sent_message import SentMessage
from app.models.team_performance_snapshot import TeamPerformanceSnapshot
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
            SalesUnit.__table__,
            SalesTeam.__table__,
            User.__table__,
            CustomerProfile.__table__,
            KpiCommandSnapshot.__table__,
            KpiAlertRecord.__table__,
            Lead.__table__,
            LeadActivityEvent.__table__,
            LeadDisciplineLog.__table__,
            LeadTask.__table__,
            LeadTaskEvent.__table__,
            LeadDeal.__table__,
            MarketingExecutionItem.__table__,
            OpsNotification.__table__,
            PerformanceAction.__table__,
            SalesPerformanceSnapshot.__table__,
            TeamPerformanceSnapshot.__table__,
            Conversation.__table__,
            Message.__table__,
            AIExtraction.__table__,
            ReplySuggestion.__table__,
            ApprovalLog.__table__,
            AuditLog.__table__,
            ChatReviewCase.__table__,
            ChatReviewNote.__table__,
            SentMessage.__table__,
            ProductKnowledge.__table__,
            KnowledgeUpdateProposal.__table__,
        ],
    )

    monkeypatch.setattr(routes_auth, "create_audit_log", lambda *args, **kwargs: None)
    monkeypatch.setattr(routes_extension, "create_audit_log", lambda *args, **kwargs: None)
    monkeypatch.setattr(routes_dashboard, "create_audit_log", lambda *args, **kwargs: None)
    monkeypatch.setattr(
        routes_product_knowledge,
        "create_audit_log",
        lambda *args, **kwargs: None,
    )
    monkeypatch.setattr(
        routes_sales_structure,
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
            KnowledgeUpdateProposal.__table__,
            ProductKnowledge.__table__,
            SentMessage.__table__,
            AuditLog.__table__,
            ChatReviewNote.__table__,
            ChatReviewCase.__table__,
            ApprovalLog.__table__,
            ReplySuggestion.__table__,
            AIExtraction.__table__,
            Message.__table__,
            Conversation.__table__,
            LeadActivityEvent.__table__,
            LeadDisciplineLog.__table__,
            LeadTaskEvent.__table__,
            LeadTask.__table__,
            LeadDeal.__table__,
            MarketingExecutionItem.__table__,
            OpsNotification.__table__,
            TeamPerformanceSnapshot.__table__,
            SalesPerformanceSnapshot.__table__,
            Lead.__table__,
            CustomerProfile.__table__,
            KpiAlertRecord.__table__,
            KpiCommandSnapshot.__table__,
            SalesTeam.__table__,
            SalesUnit.__table__,
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
        role="superadmin",
        is_active=True,
    )
    admin_a = User(
        organization_id=org_a.id,
        name="Admin Alpha",
        email="admin.alpha@clara.local",
        hashed_password=hash_password("AdminPass123!"),
        role="head",
        is_active=True,
    )
    admin_b = User(
        organization_id=org_a.id,
        name="Admin Beta",
        email="admin.beta@clara.local",
        hashed_password=hash_password("AdminPass123!"),
        role="head",
        is_active=True,
    )
    manager_a = User(
        organization_id=org_a.id,
        name="Manager Alpha",
        email="manager.alpha@clara.local",
        hashed_password=hash_password("ManagerPass123!"),
        role="manager",
        is_active=True,
    )
    manager_b = User(
        organization_id=org_a.id,
        name="Manager Beta",
        email="manager.beta@clara.local",
        hashed_password=hash_password("ManagerPass123!"),
        role="manager",
        is_active=True,
    )
    marketing_a = User(
        organization_id=org_a.id,
        created_by_user_id=admin_a.id,
        name="Marketing Alpha",
        email="marketing.alpha@clara.local",
        hashed_password=hash_password("MarketingPass123!"),
        role="sales",
        is_active=True,
    )
    marketing_b = User(
        organization_id=org_a.id,
        created_by_user_id=admin_b.id,
        name="Marketing Beta",
        email="marketing.beta@clara.local",
        hashed_password=hash_password("MarketingPass123!"),
        role="sales",
        is_active=True,
    )
    marketing_other_org = User(
        organization_id=org_b.id,
        created_by_user_id=admin_b.id,
        name="Marketing Gamma",
        email="marketing.gamma@clara.local",
        hashed_password=hash_password("MarketingPass123!"),
        role="sales",
        is_active=True,
    )
    inactive_user = User(
        organization_id=org_a.id,
        name="Inactive User",
        email="inactive@clara.local",
        hashed_password=hash_password("InactivePass123!"),
        role="sales",
        is_active=False,
    )

    db.add_all(
        [
            owner,
            admin_a,
            admin_b,
            manager_a,
            manager_b,
            marketing_a,
            marketing_b,
            marketing_other_org,
            inactive_user,
        ]
    )
    db.flush()

    manager_a.created_by_user_id = admin_a.id
    manager_b.created_by_user_id = admin_b.id
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
    db.flush()

    owned_customer_profile = CustomerProfile(
        organization_id=org_a.id,
        assigned_user_id=marketing_b.id,
        display_name="Owned Customer",
        canonical_key="owned customer",
        last_contact_at=owned_conversation.created_at,
    )
    db.add(owned_customer_profile)
    db.flush()

    owned_lead = Lead(
        organization_id=org_a.id,
        assigned_user_id=marketing_b.id,
        customer_profile_id=owned_customer_profile.id,
        display_name="Owned Customer",
        source="whatsapp_txt",
        current_stage="qualification",
        lead_temperature="warm",
        last_contact_at=owned_conversation.created_at,
    )
    db.add(owned_lead)
    db.flush()
    owned_conversation.lead_id = owned_lead.id

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
    db.refresh(manager_a)
    db.refresh(manager_b)
    db.refresh(marketing_a)
    db.refresh(marketing_b)
    db.refresh(marketing_other_org)
    db.refresh(inactive_user)
    db.refresh(owned_conversation)
    db.refresh(owned_customer_profile)
    db.refresh(owned_lead)
    db.refresh(global_knowledge)

    yield {
        "org_a": org_a,
        "org_b": org_b,
        "owner": owner,
        "admin_a": admin_a,
        "admin_b": admin_b,
        "manager_a": manager_a,
        "manager_b": manager_b,
        "marketing_a": marketing_a,
        "marketing_b": marketing_b,
        "marketing_other_org": marketing_other_org,
        "inactive_user": inactive_user,
        "owned_conversation": owned_conversation,
        "owned_customer_profile": owned_customer_profile,
        "owned_lead": owned_lead,
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
