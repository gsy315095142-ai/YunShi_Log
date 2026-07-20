"""加载 AI 测算所需的上下文，通过 records / profile 模块接口获取数据。"""

from datetime import date

from sqlalchemy.orm import Session

from app.db.models import User
from app.profile.service import get_profile
from app.records.service import list_day_records


def load_day_records_context(db: Session, user: User, linked_date: date | None) -> str:
    if linked_date is None:
        return ""
    items = list_day_records(db, user, linked_date)
    if not items:
        return f"【{linked_date.isoformat()}】当日无记录。"
    lines = [f"- {item.content}" for item in items]
    return f"【{linked_date.isoformat()} 的每日记录】\n" + "\n".join(lines)


def load_profile_context(db: Session, user: User) -> str:
    """用户个人命理档案，每次对话默认注入；日主五行为八字本命核心。"""
    profile = get_profile(db, user)
    if profile.birth_date is None:
        return ""
    lines = [
        f"姓名：{profile.display_name}",
        f"公历生日：{profile.birth_date.isoformat()}"
        + (f" {profile.birth_time}" if profile.birth_time else "（出生时间未填）"),
        f"农历：{profile.lunar}",
        f"星座：{profile.zodiac_sign}",
        f"生肖：{profile.chinese_zodiac}",
        f"天干五行（年柱）：{profile.five_element}",
        f"纳音五行（年命）：{profile.nayin}",
        f"日主五行（八字本命核心，分析时以此为主要依据）：{profile.day_master}",
    ]
    if profile.mbti:
        lines.append(f"MBTI：{profile.mbti}")
    return "【用户个人信息】\n" + "\n".join(lines)
