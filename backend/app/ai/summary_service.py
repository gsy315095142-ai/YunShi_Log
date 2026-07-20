"""对话摘要压缩：把最近窗口之外的旧消息滚动压缩为一份用户摘要。

记忆结构（每次对话注入）：
  - 最近 CHAT_HISTORY_LIMIT 条消息：原文携带
  - 更早的消息：压缩为一份持续更新的摘要（本模块维护）

触发规则：当"已压缩进度"之后、最近窗口之前的旧消息累计达到
SUMMARY_TRIGGER 条时，调用一次 AI 把它们并入摘要。
"""

import logging

from sqlalchemy.orm import Session

from app.ai.provider_router import call_provider
from app.db.models import AIChatMessage, AIChatSummary, User

logger = logging.getLogger(__name__)

# 未摘要的旧消息累计达到该条数时触发一次压缩
SUMMARY_TRIGGER = 10

_SUMMARY_SYSTEM_PROMPT = (
    "你是一名对话摘要助手，负责维护「测算大师」与用户之间的历史对话摘要。"
    "请将旧对话压缩进一份持续更新的摘要，保留：用户透露的个人事实与经历、"
    "情绪与近期状态、反复关心的问题、以及大师给出过的关键结论与建议。"
    "输出第三人称条目式摘要，300 字以内。直接输出更新后的完整摘要，不要任何解释。"
)


def _get_or_create(db: Session, user: User) -> AIChatSummary:
    row = db.query(AIChatSummary).filter(AIChatSummary.user_id == user.id).first()
    if row is None:
        row = AIChatSummary(user_id=user.id, summary="", summarized_up_to_id=0)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def _format_batch(rows: list[AIChatMessage]) -> str:
    name = {"user": "用户", "assistant": "大师"}
    return "\n".join(f"- {name.get(r.role, r.role)}：{r.content}" for r in rows)


async def get_chat_summary(
    db: Session,
    user: User,
    provider: str,
    api_key: str,
    base_url: str | None,
    model: str | None,
    recent_ids: list[int],
) -> str:
    """返回当前可用的对话摘要；若旧消息积累到阈值则先触发一次压缩。

    recent_ids：本次将作为原文携带的最近消息 id 列表，早于它们的才算"旧消息"。
    压缩失败不阻断聊天，退回旧摘要。
    """
    row = _get_or_create(db, user)

    cutoff_id = min(recent_ids) - 1 if recent_ids else None
    old_query = db.query(AIChatMessage).filter(
        AIChatMessage.user_id == user.id,
        AIChatMessage.id > row.summarized_up_to_id,
    )
    if cutoff_id is not None:
        old_query = old_query.filter(AIChatMessage.id <= cutoff_id)
    pending = old_query.order_by(AIChatMessage.id).all()

    if len(pending) >= SUMMARY_TRIGGER:
        prompt = (
            f"【已有摘要】\n{row.summary or '（暂无）'}\n\n"
            f"【需要并入的旧对话】\n{_format_batch(pending)}"
        )
        messages = [
            {"role": "system", "content": _SUMMARY_SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ]
        try:
            result = await call_provider(provider, api_key, base_url, messages, model)
            new_summary = result["content"].strip()
            if new_summary:
                row.summary = new_summary
                row.summarized_up_to_id = pending[-1].id
                db.commit()
        except Exception as exc:  # 压缩失败不影响主对话
            logger.warning("chat summary compression failed: %s", exc)
            db.rollback()

    return row.summary
