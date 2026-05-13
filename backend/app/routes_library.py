from __future__ import annotations

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from app import library_manifest as lib


router = APIRouter(prefix="/api/library", tags=["library"])


class CategoryCreateBody(BaseModel):
    name: str = Field(..., min_length=1)


class CategoryPatchBody(BaseModel):
    name: str = Field(..., min_length=1)


class AssetPatchBody(BaseModel):
    display_name: str | None = None
    notes: str | None = None
    category_id: str | None = None


@router.get("/overview")
async def library_overview():
    dto = lib.build_overview()
    return {
        "effective_assets_root": dto.effective_root,
        "manifest_path": dto.manifest_path,
        "categories": dto.categories,
        "assets": dto.assets,
        "storage": dto.storage,
    }


@router.post("/categories")
async def create_category(body: CategoryCreateBody):
    st = lib.load_state()
    try:
        st, cat = lib.create_category(st, body.name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "category": cat.model_dump()}


@router.patch("/categories/{category_id}")
async def patch_category(category_id: str, body: CategoryPatchBody):
    st = lib.load_state()
    try:
        lib.rename_category(st, category_id, body.name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True}


@router.delete("/categories/{category_id}")
async def remove_category(category_id: str):
    st = lib.load_state()
    try:
        lib.delete_category(st, category_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True}


@router.post("/assets")
async def upload_asset(category_id: str = Form(...), file: UploadFile = File(...)):
    st = lib.load_state()
    raw_filename = file.filename or "upload.bin"
    payload = await file.read()
    if not payload:
        raise HTTPException(status_code=400, detail="上传内容为空")
    try:
        _, asset = lib.add_asset_upload(
            st,
            category_id=category_id.strip(),
            original_filename=raw_filename,
            data=payload,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"写入文件失败：{exc}") from exc
    return {"ok": True, "asset": asset.model_dump()}


@router.patch("/assets/{asset_id}")
async def patch_asset(asset_id: str, body: AssetPatchBody):
    st = lib.load_state()
    try:
        _, asset = lib.update_asset(
            st,
            asset_id,
            display_name=body.display_name,
            notes=body.notes,
            category_id=body.category_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "asset": asset.model_dump()}


@router.delete("/assets/{asset_id}")
async def remove_asset(asset_id: str):
    st = lib.load_state()
    try:
        lib.delete_asset(st, asset_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"ok": True}


@router.get("/assets/{asset_id}/file")
async def fetch_asset_binary(asset_id: str):
    try:
        _, p = lib.read_asset_disk_path(asset_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="素材不存在") from exc
    if not p.is_file():
        raise HTTPException(status_code=410, detail="文件已缺失")
    mime = lib.media_type_for_path(p)
    headers = {"Cache-Control": "private, max-age=3600"}
    return FileResponse(
        path=p,
        media_type=mime or "application/octet-stream",
        headers=headers,
    )
