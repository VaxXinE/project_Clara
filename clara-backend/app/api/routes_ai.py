from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.ai_extraction_schema import AIExtractionResponse
from app.core.security import require_roles
from app.models.user import User
from app.services.ai_extraction_service import (
    AIExtractionError,
    analyze_conversation,
    list_ai_extractions,
)

router = APIRouter(prefix="/conversations", tags=["ai-extractions"])


@router.post("/{conversation_id}/analyze", response_model=AIExtractionResponse)
def analyze_conversation_endpoint(
    conversation_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("sales", "admin")),
):
    try:
        return analyze_conversation(db=db, conversation_id=conversation_id)
    except AIExtractionError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.get("/{conversation_id}/ai-extractions", response_model=list[AIExtractionResponse])
def list_ai_extractions_endpoint(
    conversation_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("sales", "marketing", "admin")),
):
    return list_ai_extractions(db=db, conversation_id=conversation_id)