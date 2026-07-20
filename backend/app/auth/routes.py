from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.auth.schemas import ChangePasswordRequest, LoginRequest, RegisterRequest, TokenResponse, UserResponse
from app.auth.service import change_password, get_me, login_user, register_user
from app.db.database import get_db
from app.db.models import User

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    return register_user(db, body)


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    return login_user(db, body)


@router.get("/me", response_model=UserResponse)
def me(user: User = Depends(get_current_user)):
    return get_me(user)


@router.post("/change-password")
def change_pwd(body: ChangePasswordRequest, db: Session = Depends(get_db)):
    return change_password(db, body)
