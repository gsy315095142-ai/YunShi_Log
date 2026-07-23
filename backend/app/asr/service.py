"""转发音频到本机 FunASR 常驻服务（Flask，POST /transcribe，返回 {"text": ...}）。"""

import httpx

from app.config import ASR_BASE_URL, ASR_ENABLED, ASR_TIMEOUT_SEC


class AsrError(Exception):
    """语音识别失败，message 可直接展示给用户。"""


async def transcribe_via_funasr(content: bytes, filename: str) -> str:
    if not ASR_ENABLED:
        raise AsrError("语音识别功能未开启")

    url = f"{ASR_BASE_URL.rstrip('/')}/transcribe"
    try:
        async with httpx.AsyncClient(timeout=ASR_TIMEOUT_SEC) as client:
            resp = await client.post(url, files={"file": (filename, content)})
    except httpx.ConnectError:
        raise AsrError("语音识别服务未启动，请联系管理员") from None
    except httpx.TimeoutException:
        raise AsrError("识别超时，请说短一点再试") from None
    except httpx.HTTPError:
        raise AsrError("语音识别失败，请稍后再试") from None

    if resp.status_code != 200:
        raise AsrError("语音识别失败，请稍后再试")

    text = (resp.json().get("text") or "").strip()
    if not text:
        raise AsrError("没有听清，请靠近麦克风再试一次")
    return text
