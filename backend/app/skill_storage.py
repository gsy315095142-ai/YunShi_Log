from __future__ import annotations

from pathlib import Path

from app import paths

MAX_SKILL_BYTES = 1_048_576  # 1 MiB


def safe_skill_filename(name: str) -> str:
    s = name.strip().replace("\\", "/")
    if not s:
        raise ValueError("缺少文件名")
    if ".." in s or "/" in s:
        raise ValueError("文件名不得包含路径或 ..")
    base = Path(s).name
    if len(base) < 4:
        raise ValueError("文件名过短")
    if len(base) > 160:
        raise ValueError("文件名过长")
    if not base.lower().endswith(".md"):
        raise ValueError("Skill 必须为 .md 扩展名")
    return base


def write_skill_markdown(filename: str, markdown_text: str) -> str:
    raw = markdown_text.encode("utf-8")
    if len(raw) > MAX_SKILL_BYTES:
        raise ValueError(f"正文超过上限（{MAX_SKILL_BYTES // 1024} KiB）")
    safe = safe_skill_filename(filename)
    root = paths.SKILLS_DIR
    root.mkdir(parents=True, exist_ok=True)
    path = root / safe
    path.write_bytes(raw)
    return safe
