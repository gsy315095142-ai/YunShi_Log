from datetime import date, time

from pydantic import BaseModel, Field


class ProfileUpdateRequest(BaseModel):
    display_name: str = Field(min_length=1, max_length=64)
    birth_date: date
    birth_time: time | None = None
    mbti: str | None = Field(default=None, max_length=8)


class ProfileResponse(BaseModel):
    display_name: str | None
    birth_date: date | None
    birth_time: str | None
    mbti: str | None
    lunar: str | None
    zodiac_sign: str | None
    chinese_zodiac: str | None
    five_element: str | None
    birth_time_display: str | None
