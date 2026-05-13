from __future__ import annotations

from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from pydantic import BaseModel, Field

from app import paths
from app.skill_storage import write_skill_markdown
from app.library_manifest import LIBRARY_MANIFEST_FILENAME, manifest_path
from app.chat_store import CHAT_DIRNAME, chat_index_path
from app.routes_chat import router as chat_router
from app.routes_generate import router as generate_router
from app.routes_library import router as library_router
from app.user_settings import (
    apply_settings_patch,
    load_settings,
    public_settings_view,
    read_selected_skill_text,
    set_skills_selected,
    skill_rows,
)


class SkillSelectionPayload(BaseModel):
    selected: list[str] = Field(default_factory=list)


def register_settings_routes(app: FastAPI) -> None:
    @app.get("/api/settings")
    async def get_settings():
        """每次请求读取磁盘，保证与其它进程改写或手动改文件后能尽快对齐。"""
        return public_settings_view(load_settings())

    @app.patch("/api/settings")
    async def patch_settings(body: dict[str, Any]):
        try:
            updated = apply_settings_patch(body)
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return public_settings_view(updated)

    @app.get("/api/skills/bundled")
    async def get_skills_bundled():
        text, files = read_selected_skill_text(load_settings())
        return {"text": text, "files": files, "empty": len(files) == 0}

    @app.put("/api/skills/selection")
    async def put_skill_selection(payload: SkillSelectionPayload):
        s = set_skills_selected(payload.selected)
        return {"ok": True, "items": skill_rows(s)}

    @app.post("/api/skills/upload")
    async def upload_skill_file(file: UploadFile = File(...)):
        raw_name = file.filename or "skill.md"
        body = await file.read()
        if len(body) > 1_048_576:
            raise HTTPException(status_code=400, detail="文件过大（上限 1 MiB）")
        try:
            text = body.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise HTTPException(status_code=400, detail="请使用 UTF-8 编码的 Markdown") from exc
        try:
            basename = write_skill_markdown(raw_name, text)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        items = skill_rows(load_settings())
        return {"ok": True, "filename": basename, "items": items}


def register_legacy_skills(app: FastAPI) -> None:
    @app.get("/api/skills")
    async def list_skills_detail():
        s = load_settings()
        items = skill_rows(s)
        return {
            "items": items,
            "skills": [i["filename"] for i in items],
        }


def register_health_meta(app: FastAPI) -> None:
    @app.get("/api/health")
    async def health():
        return {"ok": True, "service": "marketing-materials"}

    @app.get("/api/meta")
    async def meta():
        repo = paths.REPO_ROOT
        assets = paths.default_assets_root()
        return {
            "repo_root": str(repo),
            "skills_dir": str(paths.SKILLS_DIR.resolve()),
            "data_dir": str(paths.resolved_data_dir()),
            "default_assets_root": str(assets),
            "settings_file": str(paths.resolved_data_dir() / "user_settings.json"),
            "library_manifest_file": str(manifest_path().resolve()),
            "library_manifest_filename": LIBRARY_MANIFEST_FILENAME,
            "chat_index_file": str(chat_index_path().resolve()),
            "chat_dir": str((paths.resolved_data_dir() / CHAT_DIRNAME).resolve()),
            "data_dir_override_env": "MARKETING_DATA_DIR",
        }


def attach_routes(app: FastAPI) -> None:
    register_health_meta(app)
    register_settings_routes(app)
    register_legacy_skills(app)
    app.include_router(library_router)
    app.include_router(chat_router)
    app.include_router(generate_router)
