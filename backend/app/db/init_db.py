from sqlalchemy.orm import Session

from app.auth.security import hash_password
from app.config import DEFAULT_ADMIN_PASSWORD, DEFAULT_ADMIN_USERNAME
from app.db.database import Base, SessionLocal, engine
from app.db.models import User


def create_tables() -> None:
    Base.metadata.create_all(bind=engine)


def seed_default_admin(db: Session) -> None:
    existing = db.query(User).filter(User.username == DEFAULT_ADMIN_USERNAME).first()
    if existing:
        return
    admin = User(
        username=DEFAULT_ADMIN_USERNAME,
        password_hash=hash_password(DEFAULT_ADMIN_PASSWORD),
        role="admin",
    )
    db.add(admin)
    db.commit()


def init_database() -> None:
    create_tables()
    db = SessionLocal()
    try:
        seed_default_admin(db)
    finally:
        db.close()
