"""加载 AI 测算所需的上下文，通过 records 模块接口获取数据。"""

from datetime import date

from sqlalchemy.orm import Session

from app.db.models import User
from app.records.service import list_day_records


def load_day_records_context(db: Session, user: User, linked_date: date | None) -> str:
    if linked_date is None:
        return ""
    items = list_day_records(db, user, linked_date)
    if not items:
        return f"【{linked_date.isoformat()}】当日无记录。"
    lines = [f"- {item.content}" for item in items]
    return f"【{linked_date.isoformat()} 的每日记录】\n" + "\n".join(lines)
