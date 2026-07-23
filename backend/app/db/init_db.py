from sqlalchemy import text
from sqlalchemy.orm import Session

from app.auth.security import hash_password
from app.config import (
    DEFAULT_ADMIN_PASSWORD,
    DEFAULT_ADMIN_USERNAME,
    DEFAULT_USER_PASSWORD,
    DEFAULT_USER_USERNAME,
)
from app.db.database import Base, SessionLocal, engine
from app.db.models import User

# 历史表新增列的轻量迁移：(表名, 列名, 列定义)
_COLUMN_MIGRATIONS = [
    ("ai_chat_messages", "reasoning", "TEXT"),
    ("ai_chat_messages", "record_actions", "TEXT"),
    ("ai_settings", "model", "VARCHAR(64)"),
    ("ai_settings", "fallback_provider", "VARCHAR(32)"),
    ("ai_settings", "fallback_api_key_encrypted", "TEXT"),
    ("ai_settings", "fallback_api_base_url", "VARCHAR(255)"),
    ("ai_settings", "fallback_model", "VARCHAR(64)"),
]


def create_tables() -> None:
    Base.metadata.create_all(bind=engine)
    _apply_column_migrations()


def _apply_column_migrations() -> None:
    """create_all 不会给已存在的表补列，这里按需 ALTER TABLE。"""
    with engine.connect() as conn:
        for table, column, ddl in _COLUMN_MIGRATIONS:
            cols = {row[1] for row in conn.execute(text(f"PRAGMA table_info({table})"))}
            if cols and column not in cols:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}"))
        conn.commit()


def _rename_legacy_admin(db: Session) -> None:
    """历史大写管理员账号 Guosy 统一为小写 guosy（一次性迁移，幂等）。

    数据按 user_id 关联，改用户名不影响任何业务数据。
    若小写名已被占用（用户自行注册过）则跳过，避免唯一约束冲突。
    """
    legacy = db.query(User).filter(User.username == "Guosy").first()
    if legacy is None:
        return
    conflict = db.query(User).filter(User.username == "guosy").first()
    if conflict is not None:
        return
    legacy.username = "guosy"
    db.commit()


def seed_default_admin(db: Session) -> None:
    """按需补齐默认账号：已存在的跳过，新库/老库都能补。"""
    defaults = [
        (DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_PASSWORD, "admin"),
        (DEFAULT_USER_USERNAME, DEFAULT_USER_PASSWORD, "user"),
    ]
    for username, password, role in defaults:
        existing = db.query(User).filter(User.username == username).first()
        if existing:
            continue
        db.add(User(username=username, password_hash=hash_password(password), role=role))
    db.commit()


def init_database() -> None:
    create_tables()
    db = SessionLocal()
    try:
        _rename_legacy_admin(db)
        seed_default_admin(db)
    finally:
        db.close()
