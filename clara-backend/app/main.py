from fastapi import FastAPI

from app.api.routes_ai import router as ai_router
from app.api.routes_conversations import router as conversations_router
from app.api.routes_upload import router as upload_router
from app.db.session import Base, engine

# Import models so SQLAlchemy knows them when creating tables.
from app.models.ai_extraction import AIExtraction  # noqa: F401
from app.models.conversation import Conversation  # noqa: F401
from app.models.message import Message  # noqa: F401


def create_app() -> FastAPI:
    app = FastAPI(title="Clara API", version="0.1.0")

    app.include_router(upload_router)
    app.include_router(conversations_router)
    app.include_router(ai_router)

    @app.get("/health")
    def health_check() -> dict[str, str]:
        return {"status": "ok"}

    return app


Base.metadata.create_all(bind=engine)

app = create_app()