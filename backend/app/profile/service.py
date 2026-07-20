from sqlalchemy.orm import Session

from app.db.models import User, UserProfile
from app.fortune.calculator import compute_fortune
from app.profile.schemas import ProfileResponse, ProfileUpdateRequest


def _time_to_str(value) -> str | None:
    if value is None:
        return None
    return value.strftime("%H:%M")


def _build_response(profile: UserProfile | None) -> ProfileResponse:
    if profile is None:
        fortune = compute_fortune(None, None)
        return ProfileResponse(
            display_name=None,
            birth_date=None,
            birth_time=None,
            mbti=None,
            lunar=fortune.lunar,
            zodiac_sign=fortune.zodiac_sign,
            chinese_zodiac=fortune.chinese_zodiac,
            five_element=fortune.five_element,
            nayin=fortune.nayin,
            day_master=fortune.day_master,
            birth_time_display=fortune.birth_time_display,
        )

    fortune = compute_fortune(profile.birth_date, profile.birth_time)
    return ProfileResponse(
        display_name=profile.display_name,
        birth_date=profile.birth_date,
        birth_time=_time_to_str(profile.birth_time),
        mbti=profile.mbti,
        lunar=fortune.lunar,
        zodiac_sign=fortune.zodiac_sign,
        chinese_zodiac=fortune.chinese_zodiac,
        five_element=fortune.five_element,
        nayin=fortune.nayin,
        day_master=fortune.day_master,
        birth_time_display=fortune.birth_time_display,
    )


def get_profile(db: Session, user: User) -> ProfileResponse:
    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    return _build_response(profile)


def update_profile(db: Session, user: User, body: ProfileUpdateRequest) -> ProfileResponse:
    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    if profile is None:
        profile = UserProfile(user_id=user.id)
        db.add(profile)

    profile.display_name = body.display_name
    profile.birth_date = body.birth_date
    profile.birth_time = body.birth_time
    profile.mbti = body.mbti
    db.commit()
    db.refresh(profile)
    return _build_response(profile)
