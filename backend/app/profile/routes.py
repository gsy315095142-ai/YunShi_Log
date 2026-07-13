from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.db.database import get_db
from app.db.models import User
from app.profile.schemas import ProfileResponse, ProfileUpdateRequest
from app.profile.service import get_profile, update_profile

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("", response_model=ProfileResponse)
def read_profile(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return get_profile(db, user)


@router.put("", response_model=ProfileResponse)
def save_profile(
    body: ProfileUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return update_profile(db, user, body)
