"""AI 工具：允许测算大师在用户明确指示时写入/修改每日记录。

安全边界：仅开放「新增/覆盖写」一个工具，不开放删除——
删除只能在每日记录页手动操作（有二次确认弹窗保护），防止 AI 误解指令误删。
"""

import json
from datetime import datetime

from sqlalchemy.orm import Session

from app.db.models import DailyRecord, User

# 与手动录入一致的内容上限（见 records/schemas.py）
MAX_CONTENT_LENGTH = 2000

# OpenAI function calling 格式的工具定义（DeepSeek / 智谱均兼容）
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "save_daily_record",
            "description": (
                "写入或覆盖用户某一天的「每日记录」内容（该日已有记录则整体替换，没有则新建）。"
                "仅当用户明确要求记录、新增、修改或补充某天的日记时才能调用。"
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "date": {
                        "type": "string",
                        "description": "记录日期，格式 YYYY-MM-DD",
                    },
                    "content": {
                        "type": "string",
                        "description": "要写入的完整记录内容（覆盖式，非追加）",
                    },
                },
                "required": ["date", "content"],
            },
        },
    }
]


def execute_tool(db: Session, user: User, name: str, arguments_json: str) -> dict:
    """执行一次工具调用。成功返回 {ok, action, date, preview}，失败返回 {ok: False, error}。"""
    if name != "save_daily_record":
        return {"ok": False, "error": f"未知工具: {name}"}

    try:
        args = json.loads(arguments_json or "{}")
        day = datetime.strptime(str(args["date"]), "%Y-%m-%d").date()
        content = str(args["content"]).strip()
        if not content:
            raise ValueError("内容为空")
        if len(content) > MAX_CONTENT_LENGTH:
            raise ValueError(f"内容超长（上限 {MAX_CONTENT_LENGTH} 字）")
    except (KeyError, ValueError, json.JSONDecodeError) as exc:
        return {"ok": False, "error": f"参数不合法: {exc}"}

    row = (
        db.query(DailyRecord)
        .filter(DailyRecord.user_id == user.id, DailyRecord.record_date == day)
        .first()
    )
    if row is None:
        row = DailyRecord(user_id=user.id, record_date=day, content=content, sort_order=0)
        db.add(row)
        action = "created"
    else:
        row.content = content
        action = "updated"
    db.commit()
    return {"ok": True, "action": action, "date": day.isoformat(), "preview": content[:50]}
