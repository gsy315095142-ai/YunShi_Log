from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.ai.chat_service import list_chat_history, send_chat
from app.ai.schemas import (
    AISettingsResponse,
    AISettingsUpdateRequest,
    ChatMessageItem,
    ChatRequest,
    ChatResponse,
)
from app.ai.settings_service import get_providers, get_settings, update_settings
from app.auth.deps import get_current_user
from app.db.database import get_db
from app.db.models import User

router = APIRouter(prefix="/ai", tags=["ai"])


@router.get("/providers")
def providers():
    return get_providers()


@router.get("/settings", response_model=AISettingsResponse)
def read_settings(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return get_settings(db, user)


@router.put("/settings", response_model=AISettingsResponse)
def save_settings(
    body: AISettingsUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return update_settings(db, user, body)


@router.post("/chat", response_model=ChatResponse)
async def chat(
    body: ChatRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return await send_chat(db, user, body)


@router.get("/chat/history", response_model=list[ChatMessageItem])
def chat_history(
    limit: int = Query(default=50, ge=1, le=200),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list_chat_history(db, user, limit)
