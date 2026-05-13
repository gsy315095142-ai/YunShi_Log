from __future__ import annotations

import os
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SKILLS_DIR = REPO_ROOT / "skills"
DATA_DIR = REPO_ROOT / "data"


def default_assets_root() -> Path:
    """Default image storage root: ~/Documents/MarketingMaterials/assets (never under repo)."""
    return Path.home() / "Documents" / "MarketingMaterials" / "assets"


def resolved_data_dir() -> Path:
    override = os.environ.get("MARKETING_DATA_DIR", "").strip()
    if override:
        return Path(override).expanduser().resolve()
    return DATA_DIR.resolve()


def ensure_skill_and_data_dirs() -> None:
    SKILLS_DIR.mkdir(parents=True, exist_ok=True)
    resolved_data_dir().mkdir(parents=True, exist_ok=True)
    default_assets_root().mkdir(parents=True, exist_ok=True)
