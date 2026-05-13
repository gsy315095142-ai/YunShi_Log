from __future__ import annotations

from copy import deepcopy
from pathlib import Path
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app import paths
from app.json_io import read_json, write_json_atomic

Capability = Literal["text", "text_vision"]

SETTINGS_VERSION = 1
SETTINGS_FILENAME = "user_settings.json"


class AIProfile(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    base_url: str = ""
    chat_model: str = Field(default="", alias="model")
    api_key: str = ""
    capability: Capability = "text"


class UserSettingsFile(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    version: int = SETTINGS_VERSION
    primary_ai: AIProfile = Field(default_factory=lambda: AIProfile(capability="text"))
    vision_ai: AIProfile = Field(
        default_factory=lambda: AIProfile(capability="text_vision")
    )
    assets_root: str = ""
    skills_deselected: list[str] = Field(default_factory=list)


def settings_path() -> Path:
    return paths.resolved_data_dir() / SETTINGS_FILENAME


def _normalize_disk(data: dict[str, Any]) -> dict[str, Any]:
    if not data:
        return UserSettingsFile().model_dump(by_alias=True)
    if "version" not in data:
        data = {**data, "version": SETTINGS_VERSION}
    return data


def load_settings() -> UserSettingsFile:
    raw = read_json(settings_path(), {})
    raw = _normalize_disk(raw if isinstance(raw, dict) else {})
    try:
        return UserSettingsFile.model_validate(raw)
    except Exception:
        return UserSettingsFile()


def save_settings(settings: UserSettingsFile) -> None:
    settings.version = SETTINGS_VERSION
    write_json_atomic(settings_path(), settings.model_dump(by_alias=True))


def mask_profile_for_api(profile: AIProfile) -> dict[str, Any]:
    return {
        "base_url": profile.base_url,
        "model": profile.chat_model,
        "capability": profile.capability,
        "api_key_set": bool(profile.api_key.strip()),
    }


def merge_ai_update(
    current: AIProfile,
    body: dict[str, Any] | None,
) -> AIProfile:
    if not body:
        return current
    out = current.model_copy(deep=True)
    if "base_url" in body and isinstance(body["base_url"], str):
        out.base_url = body["base_url"].strip()
    if "model" in body and isinstance(body["model"], str):
        out.chat_model = body["model"].strip()
    if "capability" in body and body["capability"] in ("text", "text_vision"):
        out.capability = body["capability"]  # type: ignore[assignment]
    if "api_key" in body:
        key = body["api_key"]
        if key is None:
            pass
        elif isinstance(key, str):
            if key.strip() == "":
                out.api_key = ""
            else:
                out.api_key = key.strip()
    return out


def resolved_assets_root(settings: UserSettingsFile) -> Path:
    raw = (settings.assets_root or "").strip()
    if raw:
        return Path(raw).expanduser().resolve()
    return paths.default_assets_root()


def list_skill_files() -> list[str]:
    root = paths.SKILLS_DIR
    if not root.is_dir():
        return []
    return sorted(p.name for p in root.glob("*.md") if p.is_file())


def clean_deselected(settings: UserSettingsFile) -> UserSettingsFile:
    files = set(list_skill_files())
    out = settings.model_copy(deep=True)
    out.skills_deselected = [n for n in out.skills_deselected if n in files]
    return out


def skill_rows(settings: UserSettingsFile) -> list[dict[str, Any]]:
    settings = clean_deselected(settings)
    deset = set(settings.skills_deselected)
    rows: list[dict[str, Any]] = []
    for name in list_skill_files():
        rows.append({"filename": name, "selected": name not in deset})
    return rows


def set_skills_deselected(filenames: list[str]) -> UserSettingsFile:
    settings = clean_deselected(load_settings())
    known = set(list_skill_files())
    # store only valid basenames
    deselected = sorted({n for n in filenames if n in known})
    settings.skills_deselected = deselected
    save_settings(settings)
    return settings


def set_skills_selected(selected: list[str]) -> UserSettingsFile:
    known = list_skill_files()
    want = {n for n in selected if n in known}
    deselected = [n for n in known if n not in want]
    return set_skills_deselected(deselected)


def read_selected_skill_text(settings: UserSettingsFile) -> tuple[str, list[str]]:
    settings = clean_deselected(settings)
    deset = set(settings.skills_deselected)
    parts: list[str] = []
    used: list[str] = []
    for name in list_skill_files():
        if name in deset:
            continue
        path = paths.SKILLS_DIR / name
        try:
            text = path.read_text(encoding="utf-8")
        except OSError:
            continue
        parts.append(f"### Skill: {name}\n\n{text.strip()}\n")
        used.append(name)
    return "\n---\n\n".join(parts).strip(), used


def apply_settings_patch(body: dict[str, Any]) -> UserSettingsFile:
    s = load_settings()
    if "primary_ai" in body and isinstance(body["primary_ai"], dict):
        s.primary_ai = merge_ai_update(s.primary_ai, body["primary_ai"])
    if "vision_ai" in body and isinstance(body["vision_ai"], dict):
        s.vision_ai = merge_ai_update(s.vision_ai, body["vision_ai"])
    if "assets_root" in body and isinstance(body["assets_root"], str):
        s.assets_root = body["assets_root"].strip()
    s = clean_deselected(s)
    try:
        resolved_assets_root(s).mkdir(parents=True, exist_ok=True)
    except OSError:
        pass
    save_settings(s)
    return s


def public_settings_view(settings: UserSettingsFile) -> dict[str, Any]:
    s = clean_deselected(settings)
    return {
        "version": s.version,
        "primary_ai": mask_profile_for_api(s.primary_ai),
        "vision_ai": mask_profile_for_api(s.vision_ai),
        "assets_root": s.assets_root,
        "assets_root_effective": str(resolved_assets_root(s)),
    }


def internal_primary_for_worker() -> AIProfile:
    return deepcopy(load_settings().primary_ai)


def internal_vision_for_worker() -> AIProfile:
    return deepcopy(load_settings().vision_ai)
