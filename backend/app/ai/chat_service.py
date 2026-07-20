from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.ai.context_loader import load_day_records_context, load_profile_context
from app.ai.prompt_builder import build_chat_messages
from app.ai.provider_router import call_provider
from app.ai.schemas import ChatMessageItem, ChatRequest, ChatResponse
from app.ai.settings_service import require_chat_credentials
from app.db.models import AIChatMessage, User
from app.search.service import search_web

# 每次对话携带的最近历史消息条数（约 10 轮），超出部分暂不发送
CHAT_HISTORY_LIMIT = 20


def load_recent_history(db: Session, user: User, limit: int = CHAT_HISTORY_LIMIT) -> list[dict]:
    """读取最近 N 条聊天记录（正序），作为 AI 的对话记忆。"""
    rows = (
        db.query(AIChatMessage)
        .filter(AIChatMessage.user_id == user.id)
        .order_by(AIChatMessage.id.desc())
        .limit(limit)
        .all()
    )
    rows.reverse()
    return [{"role": r.role, "content": r.content} for r in rows]


async def send_chat(db: Session, user: User, body: ChatRequest) -> ChatResponse:
    provider, api_key, base_url, model = require_chat_credentials(db, user)

    history = load_recent_history(db, user)

    user_msg = AIChatMessage(
        user_id=user.id,
        role="user",
        content=body.message,
        linked_date=body.linked_date,
    )
    db.add(user_msg)
    db.commit()
    db.refresh(user_msg)

    profile_context = load_profile_context(db, user)
    day_context = load_day_records_context(db, user, body.linked_date)
    search_result = await search_web(body.message)
    messages = build_chat_messages(body.message, profile_context, day_context, search_result, history)

    try:
        reply_text = await call_provider(provider, api_key, base_url, messages, model)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"AI 调用失败: {exc}") from exc

    assistant_msg = AIChatMessage(
        user_id=user.id,
        role="assistant",
        content=reply_text,
        linked_date=body.linked_date,
    )
    db.add(assistant_msg)
    db.commit()
    db.refresh(assistant_msg)

    return ChatResponse(
        reply=reply_text,
        message=ChatMessageItem(
            id=assistant_msg.id,
            role=assistant_msg.role,
            content=assistant_msg.content,
            linked_date=assistant_msg.linked_date,
            created_at=assistant_msg.created_at.isoformat(),
        ),
    )


def list_chat_history(db: Session, user: User, limit: int = 50) -> list[ChatMessageItem]:
    rows = (
        db.query(AIChatMessage)
        .filter(AIChatMessage.user_id == user.id)
        .order_by(AIChatMessage.id.desc())
        .limit(limit)
        .all()
    )
    rows.reverse()
    return [
        ChatMessageItem(
            id=r.id,
            role=r.role,
            content=r.content,
            linked_date=r.linked_date,
            created_at=r.created_at.isoformat(),
        )
        for r in rows
    ]
