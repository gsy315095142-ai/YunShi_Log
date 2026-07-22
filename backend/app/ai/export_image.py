"""对话导出长图的存取：前端 Canvas 生成 PNG 后上传到后端，换取真实 http URL。

为什么需要它：部分手机浏览器（微信内置、国产浏览器）无法长按保存
data:/blob: 协议的图片，也不支持其 download 下载；真实 URL 则全部畅通。
"""

import re
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile
from fastapi.responses import FileResponse

from app.db.models import User

EXPORT_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "exports"
MAX_KEEP_PER_USER = 10  # 每个用户只保留最近 10 张，超出自动清理
MAX_BYTES = 20 * 1024 * 1024  # 单张上限 20MB
_SAFE_NAME = re.compile(r"^[a-f0-9]{32}\.png$")


async def upload_export_image(file: UploadFile, user: User) -> dict:
    """保存上传的 PNG，返回可直接访问的相对 URL。"""
    if file.content_type != "image/png":
        raise HTTPException(status_code=400, detail="仅支持 PNG 图片")
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="图片内容为空")
    if len(content) > MAX_BYTES:
        raise HTTPException(status_code=400, detail="图片过大")

    user_dir = EXPORT_DIR / str(user.id)
    user_dir.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex}.png"
    (user_dir / name).write_bytes(content)

    # 只保留最近 N 张，清理更早的
    files = sorted(user_dir.glob("*.png"), key=lambda p: p.stat().st_mtime, reverse=True)
    for old in files[MAX_KEEP_PER_USER:]:
        old.unlink(missing_ok=True)

    return {"url": f"/api/v1/ai/chat/export-image/{user.id}/{name}"}


def get_export_image(user_id: str, filename: str) -> FileResponse:
    """按 UUID 文件名取图。无需鉴权：文件名随机 32 位 hex 不可枚举，且自动清理。"""
    if not _SAFE_NAME.match(filename) or not user_id.isdigit():
        raise HTTPException(status_code=404, detail="图片不存在或已过期")
    path = EXPORT_DIR / user_id / filename
    if not path.is_file():
        raise HTTPException(status_code=404, detail="图片不存在或已过期")
    return FileResponse(path, media_type="image/png")
