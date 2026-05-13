from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.generate_service import generate_xhs_post


router = APIRouter(prefix="/api/generate", tags=["generate"])


class XiaohongshuBody(BaseModel):
    brief: str = Field(..., min_length=1, max_length=24_000)
    with_skills: bool = True
    max_recommended_assets: int = Field(default=6, ge=0, le=12)


@router.post("/xiaohongshu")
async def generate_xhs(body: XiaohongshuBody):
    try:
        return await generate_xhs_post(
            brief=body.brief,
            with_skills=body.with_skills,
            max_recommended_assets=body.max_recommended_assets,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
