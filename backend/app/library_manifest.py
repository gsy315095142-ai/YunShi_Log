from __future__ import annotations

import mimetypes
import uuid
from dataclasses import dataclass
from pathlib import Path
from time import time

from pydantic import BaseModel, Field

from app import paths
from app.json_io import read_json, write_json_atomic
from app.user_settings import load_settings, resolved_assets_root


LIBRARY_MANIFEST_VERSION = 1
LIBRARY_MANIFEST_FILENAME = "assets_library.json"

ALLOWED_SUFFIXES = frozenset(
    {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tif", ".tiff"}
)


def utc_ms() -> int:
    return int(time() * 1000)


class CategoryRecord(BaseModel):
    id: str
    name: str
    created_at_ms: int
    updated_at_ms: int


class AssetRecord(BaseModel):
    id: str
    category_id: str
    display_name: str
    original_filename: str
    absolute_path: str
    notes: str = ""
    created_at_ms: int
    updated_at_ms: int
    size_bytes: int = 0


class LibraryState(BaseModel):
    version: int = LIBRARY_MANIFEST_VERSION
    categories: list[CategoryRecord] = Field(default_factory=list)
    assets: list[AssetRecord] = Field(default_factory=list)


def manifest_path() -> Path:
    return paths.resolved_data_dir() / LIBRARY_MANIFEST_FILENAME


def load_state() -> LibraryState:
    raw = read_json(manifest_path(), {})
    data = raw if isinstance(raw, dict) else {}
    if not data:
        state = LibraryState()
        cid = uuid.uuid4().hex
        now = utc_ms()
        state.categories.append(
            CategoryRecord(
                id=cid,
                name="默认分类",
                created_at_ms=now,
                updated_at_ms=now,
            ),
        )
        save_state(state)
        return state
    if "version" not in data:
        data["version"] = LIBRARY_MANIFEST_VERSION
    try:
        st = LibraryState.model_validate(data)
    except Exception:
        st = LibraryState()
        now = utc_ms()
        st.categories.append(
            CategoryRecord(
                id=uuid.uuid4().hex,
                name="默认分类",
                created_at_ms=now,
                updated_at_ms=now,
            ),
        )
        save_state(st)
        return st

    changed = False
    if len(st.categories) == 0:
        now = utc_ms()
        st.categories.append(
            CategoryRecord(
                id=uuid.uuid4().hex,
                name="默认分类",
                created_at_ms=now,
                updated_at_ms=now,
            ),
        )
        changed = True
    if changed:
        save_state(st)
    return st


def save_state(state: LibraryState) -> None:
    state.version = LIBRARY_MANIFEST_VERSION
    write_json_atomic(manifest_path(), state.model_dump())


def assets_root_now() -> Path:
    settings = load_settings()
    root = resolved_assets_root(settings)
    root.mkdir(parents=True, exist_ok=True)
    return root


def safe_suffix(original_name: str) -> str:
    suf = Path(original_name).suffix.lower()
    if suf not in ALLOWED_SUFFIXES:
        raise ValueError(f"暂不支持的文件类型：{suf or '（无后缀）'}")
    return suf


def media_type_for_path(p: Path) -> str | None:
    mime, _ = mimetypes.guess_type(str(p))
    return mime


@dataclass
class OverviewDTO:
    effective_root: str
    manifest_path: str
    categories: list[dict[str, object]]
    assets: list[dict[str, object]]
    storage: dict[str, object]


def _category_counts(state: LibraryState) -> dict[str, int]:
    cnt: dict[str, int] = {c.id: 0 for c in state.categories}
    for a in state.assets:
        cnt[a.category_id] = cnt.get(a.category_id, 0) + 1
    return cnt


def format_asset_catalog_for_llm_prompt(
    state: LibraryState | None = None,
    *,
    max_assets: int = 120,
    max_chars: int = 10_000,
) -> str:
    """单行素材清单，便于对话注入 id；与成稿链路相互独立，参数可微调。"""
    st = state or load_state()
    cmap = {c.id: c.name for c in st.categories}
    assets_sorted = sorted(
        st.assets,
        key=lambda a: (-a.updated_at_ms, a.display_name),
    )
    suffix = ""
    if len(assets_sorted) > max_assets:
        suffix = (
            f"\n（清单仅收录最近更新的 {max_assets} 条；库内共 {len(assets_sorted)} 条）"
        ).strip()

    packed: list[str] = []
    for a in assets_sorted[:max_assets]:
        cn = cmap.get(a.category_id, "")
        note = (a.notes or "").replace("\r", "").replace("\n", " ").strip()
        if len(note) > 160:
            note = note[:160] + "…"
        packed.append(
            f"- id={a.id}｜名称={a.display_name}｜分类={cn}｜备注={note or '—'}"
        )

    if not packed:
        return suffix or "素材库暂无条目。"

    while packed:
        body = "\n".join(packed).strip()
        candidate = body if not suffix else (body + "\n" + suffix).strip()
        if len(candidate) <= max_chars:
            return candidate
        packed.pop()
    return suffix or "素材库暂无条目。"


def build_overview(state: LibraryState | None = None) -> OverviewDTO:
    st = state or load_state()
    counts = _category_counts(st)
    cats_public: list[dict[str, object]] = []
    for c in sorted(st.categories, key=lambda x: x.name):
        cats_public.append(
            {
                "id": c.id,
                "name": c.name,
                "created_at_ms": c.created_at_ms,
                "updated_at_ms": c.updated_at_ms,
                "asset_count": counts.get(c.id, 0),
            },
        )

    disk_bytes = 0
    missing = 0
    assets_pub: list[dict[str, object]] = []
    for a in sorted(st.assets, key=lambda x: (-x.updated_at_ms, x.display_name)):
        path = Path(a.absolute_path)
        exists = path.is_file()
        if exists:
            try:
                disk_bytes += path.stat().st_size
            except OSError:
                missing += 1
        else:
            missing += 1
        assets_pub.append(
            {
                "id": a.id,
                "category_id": a.category_id,
                "display_name": a.display_name,
                "original_filename": a.original_filename,
                "notes": a.notes,
                "absolute_path": a.absolute_path,
                "created_at_ms": a.created_at_ms,
                "updated_at_ms": a.updated_at_ms,
                "size_bytes_recorded": a.size_bytes,
                "file_missing": not exists,
                "file_url": f"/api/library/assets/{a.id}/file",
            },
        )

    root = resolved_assets_root(load_settings())
    storage = {
        "asset_count": len(st.assets),
        "disk_bytes_used": disk_bytes,
        "missing_files": missing,
        "library_manifest_filename": LIBRARY_MANIFEST_FILENAME,
    }
    return OverviewDTO(
        effective_root=str(root.resolve()),
        manifest_path=str(manifest_path().resolve()),
        categories=cats_public,
        assets=assets_pub,
        storage=storage,
    )


def get_category(state: LibraryState, category_id: str) -> CategoryRecord | None:
    for c in state.categories:
        if c.id == category_id:
            return c
    return None


def create_category(state: LibraryState, name: str) -> tuple[LibraryState, CategoryRecord]:
    n = name.strip()
    if not n:
        raise ValueError("分类名称不能为空")
    now = utc_ms()
    record = CategoryRecord(
        id=uuid.uuid4().hex,
        name=n,
        created_at_ms=now,
        updated_at_ms=now,
    )
    st = state.model_copy(deep=True)
    st.categories.append(record)
    save_state(st)
    return st, record


def rename_category(state: LibraryState, category_id: str, name: str) -> LibraryState:
    n = name.strip()
    if not n:
        raise ValueError("分类名称不能为空")
    st = state.model_copy(deep=True)
    idx = None
    for i, c in enumerate(st.categories):
        if c.id == category_id:
            idx = i
            break
    if idx is None:
        raise ValueError("分类不存在")
    cat = st.categories[idx]
    st.categories[idx] = cat.model_copy(
        update={"name": n, "updated_at_ms": utc_ms()},
    )
    save_state(st)
    return st


def delete_category(state: LibraryState, category_id: str) -> LibraryState:
    st = state.model_copy(deep=True)
    if not get_category(st, category_id):
        raise ValueError("分类不存在")
    counts = _category_counts(st)
    if counts.get(category_id, 0) > 0:
        raise ValueError("请先删除或移走该分类下的素材后再删除分类")
    st.categories = [c for c in st.categories if c.id != category_id]
    if len(st.categories) == 0:
        now = utc_ms()
        st.categories.append(
            CategoryRecord(
                id=uuid.uuid4().hex,
                name="默认分类",
                created_at_ms=now,
                updated_at_ms=now,
            ),
        )
    save_state(st)
    return st


def add_asset_upload(
    state: LibraryState,
    *,
    category_id: str,
    original_filename: str,
    data: bytes,
) -> tuple[LibraryState, AssetRecord]:
    st = state.model_copy(deep=True)
    cat = get_category(st, category_id)
    if not cat:
        raise ValueError("分类不存在")
    suffix = safe_suffix(original_filename)
    asset_id = uuid.uuid4().hex
    destination = assets_root_now() / f"{asset_id}{suffix}"
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(data)
    now = utc_ms()
    stem = Path(original_filename).stem
    display_name = stem or asset_id[:8].upper()

    asset = AssetRecord(
        id=asset_id,
        category_id=category_id,
        display_name=display_name,
        original_filename=Path(original_filename).name,
        absolute_path=str(destination.resolve()),
        notes="",
        created_at_ms=now,
        updated_at_ms=now,
        size_bytes=destination.stat().st_size,
    )
    st.assets.append(asset)
    save_state(st)
    return st, asset


def update_asset(
    state: LibraryState,
    asset_id: str,
    *,
    display_name: str | None = None,
    notes: str | None = None,
    category_id: str | None = None,
) -> tuple[LibraryState, AssetRecord]:
    st = state.model_copy(deep=True)
    idx = None
    for i, a in enumerate(st.assets):
        if a.id == asset_id:
            idx = i
            break
    if idx is None:
        raise ValueError("素材不存在")

    cur = st.assets[idx]
    now = utc_ms()
    touched = False

    if category_id is not None:
        nc = category_id.strip()
        if nc != cur.category_id:
            if not get_category(st, nc):
                raise ValueError("分类不存在")
            cur = cur.model_copy(update={"category_id": nc, "updated_at_ms": now})
            touched = True

    if display_name is not None:
        name = display_name.strip()
        if not name:
            raise ValueError("展示名称不能为空")
        if name != cur.display_name:
            cur = cur.model_copy(update={"display_name": name, "updated_at_ms": now})
            touched = True

    if notes is not None:
        if notes != cur.notes:
            cur = cur.model_copy(update={"notes": notes, "updated_at_ms": now})
            touched = True

    if touched:
        st.assets[idx] = cur
        save_state(st)

    return st, cur


def delete_asset(state: LibraryState, asset_id: str) -> LibraryState:
    st = state.model_copy(deep=True)
    idx = None
    for i, a in enumerate(st.assets):
        if a.id == asset_id:
            idx = i
            break
    if idx is None:
        raise ValueError("素材不存在")
    path = Path(st.assets[idx].absolute_path)
    if path.is_file():
        try:
            path.unlink()
        except OSError:
            pass
    st.assets.pop(idx)
    save_state(st)
    return st


def read_asset_disk_path(asset_id: str) -> tuple[LibraryState, Path]:
    st = load_state()
    for a in st.assets:
        if a.id == asset_id:
            return st, Path(a.absolute_path)
    raise FileNotFoundError
