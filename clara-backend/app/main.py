from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import models as _models  # noqa: F401
from app.api.routes_ai import router as ai_router
from app.api.routes_auth import router as auth_router
from app.api.routes_conversations import router as conversations_router
from app.api.routes_customers import router as customers_router
from app.api.routes_dashboard import router as dashboard_router
from app.api.routes_extension import router as extension_router
from app.api.routes_integrations import router as integrations_router
from app.api.routes_leads import router as leads_router
from app.api.routes_reply import router as reply_router
from app.api.routes_sales_structure import router as sales_structure_router
from app.api.routes_sent_messages import router as sent_messages_router
from app.api.routes_upload import router as upload_router
from app.api.routes_webhooks import router as webhooks_router
from app.core.config import settings
from app.core.logging import configure_logging
from app.middleware.request_logging import request_logging_middleware
from app.middleware.security_headers import security_headers_middleware
from app.api.routes_audit_logs import router as audit_logs_router
from app.api.routes_organizations import router as organizations_router
from app.api.routes_product_knowledge import router as product_knowledge_router



def create_app() -> FastAPI:
    configure_logging()

    app = FastAPI(title="Clara API", version="0.1.0")

    app.middleware("http")(request_logging_middleware)
    app.middleware("http")(security_headers_middleware)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth_router)
    app.include_router(organizations_router)
    app.include_router(sales_structure_router)
    app.include_router(product_knowledge_router)
    app.include_router(integrations_router)
    app.include_router(extension_router)
    app.include_router(upload_router)
    app.include_router(webhooks_router)
    app.include_router(leads_router)
    app.include_router(customers_router)
    app.include_router(conversations_router)
    app.include_router(ai_router)
    app.include_router(reply_router)
    app.include_router(sent_messages_router)
    app.include_router(dashboard_router)
    app.include_router(audit_logs_router)

    @app.get("/health")
    def health_check() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
