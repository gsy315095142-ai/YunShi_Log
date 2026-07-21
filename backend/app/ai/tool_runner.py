import json

from sqlalchemy.orm import Session

from app.ai.provider_router import call_with_fallback
from app.ai.record_tools import TOOLS, execute_tool
from app.ai.schemas import RecordAction
from app.db.models import User


async def run_with_tools(
    db: Session,
    user: User,
    primary: tuple[str, str, str | None, str],
    fallback: tuple[str, str, str | None, str] | None,
    messages: list[dict],
) -> tuple[dict, list[RecordAction], str]:
    """两段式调用：先带工具请求一次；若 AI 决定调用工具则执行并再请求最终回复。

    主厂商失败时自动切换备用厂商接手（不中断对话）。
    返回 (最终回复, 本次成功执行的记录操作列表, 实际使用的 provider)。
    """
    reply, used_provider = await call_with_fallback(primary, fallback, messages, tools=TOOLS)
    tool_calls = reply.get("tool_calls") or []
    if not tool_calls:
        return reply, [], used_provider

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

    # 第二次调用生成最终回复（不再带 tools，避免连环调用）；沿用上一次的厂商，失败仍可兜底
    current = (used_provider, fallback[1], fallback[2], fallback[3]) if fallback and used_provider == fallback[0] else primary
    final, used_provider = await call_with_fallback(current, fallback, messages)
    # 思考内容以第一次（决策）为主，若第二次也有则优先用第二次的
    final["reasoning"] = final.get("reasoning") or reply.get("reasoning")
    return final, actions, used_provider
