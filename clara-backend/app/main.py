from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes_ai import router as ai_router
from app.api.routes_conversations import router as conversations_router
from app.api.routes_dashboard import router as dashboard_router
from app.api.routes_reply import router as reply_router
from app.api.routes_sent_messages import router as sent_messages_router
from app.api.routes_upload import router as upload_router
from app.api.routes_auth import router as auth_router

# Import models are no longer needed here.
# Alembic handles database schema creation and migration.


def create_app() -> FastAPI:
    app = FastAPI(title="Clara API", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(upload_router)
    app.include_router(conversations_router)
    app.include_router(ai_router)
    app.include_router(reply_router)
    app.include_router(sent_messages_router)
    app.include_router(dashboard_router)
    app.include_router(auth_router)

    @app.get("/health")
    def health_check() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()