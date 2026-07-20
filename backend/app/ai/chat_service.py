import json

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.ai.context_loader import load_day_records_context, load_profile_context, load_today_context
from app.ai.prompt_builder import build_chat_messages
from app.ai.provider_router import call_provider
from app.ai.record_tools import TOOLS, execute_tool
from app.ai.schemas import ChatMessageItem, ChatRequest, ChatResponse, RecordAction
from app.ai.settings_service import require_chat_credentials
from app.ai.summary_service import get_chat_summary
from app.db.models import AIChatMessage, User
from app.search.service import search_web

# 每次对话携带的最近历史消息条数（约 10 轮），更早的消息压缩为摘要注入
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
    return [{"id": r.id, "role": r.role, "content": r.content} for r in rows]


def _parse_record_actions(raw: str | None) -> list[RecordAction] | None:
    """数据库里存的是 JSON 字符串，转为 schema 列表。"""
    if not raw:
        return None
    try:
        return [RecordAction.model_validate(a) for a in json.loads(raw)]
    except (ValueError, TypeError):
        return None


async def _call_with_tools(
    db: Session,
    user: User,
    provider: str,
    api_key: str,
    base_url: str | None,
    messages: list[dict],
    model: str,
) -> tuple[dict, list[RecordAction]]:
    """两段式调用：先带工具请求一次；若 AI 决定调用工具则执行并再请求最终回复。

    返回 (最终回复, 本次成功执行的记录操作列表)。
    """
    reply = await call_provider(provider, api_key, base_url, messages, model, tools=TOOLS)
    tool_calls = reply.get("tool_calls") or []
    if not tool_calls:
        return reply, []

    # 把 AI 的工具调用意图追加进上下文，再逐条执行、回传结果
    messages.append({"role": "assistant", "content": reply["content"] or "", "tool_calls": tool_calls})
    actions: list[RecordAction] = []
    for call in tool_calls:
        fn = call.get("function", {})
        result = execute_tool(db, user, fn.get("name", ""), fn.get("arguments", "{}"))
        if result.get("ok"):
            actions.append(
                RecordAction(action=result["action"], date=result["date"], preview=result["preview"])
            )
        messages.append(
            {
                "role": "tool",
                "tool_call_id": call.get("id", ""),
                "content": json.dumps(result, ensure_ascii=False),
            }
        )

    # 第二次调用生成最终回复（不再带 tools，避免连环调用）
    final = await call_provider(provider, api_key, base_url, messages, model)
    # 思考内容以第一次（决策）为主，若第二次也有则优先用第二次的
    final["reasoning"] = final.get("reasoning") or reply.get("reasoning")
    return final, actions


async def send_chat(db: Session, user: User, body: ChatRequest) -> ChatResponse:
    provider, api_key, base_url, model = require_chat_credentials(db, user)

    history = load_recent_history(db, user)
    summary = await get_chat_summary(
        db, user, provider, api_key, base_url, model, [h["id"] for h in history]
    )

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
    messages = build_chat_messages(
        body.message, profile_context, day_context, search_result, history, summary,
        today_context=load_today_context(),
    )

    try:
        reply, record_actions = await _call_with_tools(
            db, user, provider, api_key, base_url, messages, model
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"AI 调用失败: {exc}") from exc

    reply_text = reply["content"]
    reasoning = reply.get("reasoning")

    assistant_msg = AIChatMessage(
        user_id=user.id,
        role="assistant",
        content=reply_text,
        reasoning=reasoning,
        linked_date=body.linked_date,
        record_actions=(
            json.dumps([a.model_dump() for a in record_actions], ensure_ascii=False)
            if record_actions
            else None
        ),
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
            reasoning=assistant_msg.reasoning,
            linked_date=assistant_msg.linked_date,
            created_at=assistant_msg.created_at.isoformat(),
            record_actions=record_actions or None,
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
            reasoning=r.reasoning,
            linked_date=r.linked_date,
            created_at=r.created_at.isoformat(),
            record_actions=_parse_record_actions(r.record_actions),
        )
        for r in rows
    ]
