import json

from sqlalchemy.orm import Session

from app.ai.schemas import ChatMessageItem, RecordAction
from app.db.models import AIChatMessage, User

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


def save_message(
    db: Session,
    user: User,
    role: str,
    content: str,
    reasoning: str | None = None,
    linked_date: str | None = None,
    record_actions: list[RecordAction] | None = None,
) -> AIChatMessage:
    """落库一条对话消息（含 record_actions 的 JSON 序列化）。"""
    msg = AIChatMessage(
        user_id=user.id,
        role=role,
        content=content,
        reasoning=reasoning,
        linked_date=linked_date,
        record_actions=(
            json.dumps([a.model_dump() for a in record_actions], ensure_ascii=False)
            if record_actions
            else None
        ),
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


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
