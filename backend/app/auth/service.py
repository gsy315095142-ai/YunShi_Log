from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.auth.schemas import LoginRequest, RegisterRequest, TokenResponse, UserResponse
from app.auth.security import create_access_token, hash_password, verify_password
from app.db.models import User


def register_user(db: Session, body: RegisterRequest) -> UserResponse:
    exists = db.query(User).filter(User.username == body.username).first()
    if exists:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="用户名已存在")
    user = User(
        username=body.username,
        password_hash=hash_password(body.password),
        role="user",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserResponse.model_validate(user)


def login_user(db: Session, body: LoginRequest) -> TokenResponse:
    user = db.query(User).filter(User.username == body.username).first()
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="账号或密码错误")
    token = create_access_token(user.id, user.username, user.role)
    return TokenResponse(access_token=token)


def get_me(user: User) -> UserResponse:
    return UserResponse.model_validate(user)


def change_password(db: Session, body: ChangePasswordRequest) -> dict:
    """凭「用户名 + 旧密码」修改密码；错误提示与登录一致，避免枚举账号。"""
    user = db.query(User).filter(User.username == body.username).first()
    if user is None or not verify_password(body.old_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="账号或旧密码错误")
    user.password_hash = hash_password(body.new_password)
    db.commit()
    return {"ok": True}
