from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.ai.chat_repository import CHAT_HISTORY_LIMIT, load_recent_history, save_message
from app.ai.context_loader import load_day_records_context, load_profile_context, load_today_context
from app.ai.prompt_builder import build_chat_messages
from app.ai.schemas import ChatMessageItem, ChatRequest, ChatResponse
from app.ai.settings_service import get_fallback_credentials, require_chat_credentials
from app.ai.summary_service import get_chat_summary
from app.ai.tool_runner import run_with_tools
from app.db.models import User
from app.search.service import search_web

__all__ = ["CHAT_HISTORY_LIMIT", "send_chat"]


async def send_chat(db: Session, user: User, body: ChatRequest) -> ChatResponse:
    primary = require_chat_credentials(db, user)
    provider, api_key, base_url, model = primary
    fallback = get_fallback_credentials(db, user)

    history = load_recent_history(db, user, limit=CHAT_HISTORY_LIMIT)
    summary = await get_chat_summary(
        db, user, provider, api_key, base_url, model, [h["id"] for h in history]
    )

    save_message(db, user, role="user", content=body.message, linked_date=body.linked_date)

    profile_context = load_profile_context(db, user)
    day_context = load_day_records_context(db, user, body.linked_date)
    search_result = await search_web(body.message)
    messages = build_chat_messages(
        body.message, profile_context, day_context, search_result, history, summary,
        today_context=load_today_context(),
    )

    try:
        reply, record_actions, used_provider = await run_with_tools(
            db, user, primary, fallback, messages
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"AI 调用失败: {exc}") from exc

    reply_text = reply["content"]
    reasoning = reply.get("reasoning")
    used_fallback = used_provider != provider

    assistant_msg = save_message(
        db,
        user,
        role="assistant",
        content=reply_text,
        reasoning=reasoning,
        linked_date=body.linked_date,
        record_actions=record_actions,
    )

    return ChatResponse(
        reply=reply_text,
        message=ChatMessageItem(
            id=assistant_msg.id,
            role=assistant_msg.role,
            content=assistant_msg.content,
            reasoning=assistant_msg.reasoning,
            linked_date=assistant_msg.linked_date,
            created_at=assistant_msg.created_at.isoformat(),
            record_actions=record_actions or None,
            used_fallback=used_fallback,
        ),
    )
