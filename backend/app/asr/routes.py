from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.asr.service import AsrError, transcribe_via_funasr
from app.auth.deps import get_current_user
from app.db.models import User

router = APIRouter(prefix="/asr", tags=["asr"])

# 前端单次录音最长 60 秒，10MB 上限绰绰有余
MAX_AUDIO_BYTES = 10 * 1024 * 1024


@router.post("/transcribe")
async def transcribe(file: UploadFile = File(...), user: User = Depends(get_current_user)):
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="音频内容为空")
    if len(content) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=400, detail="音频文件过大")
    try:
        text = await transcribe_via_funasr(content, file.filename or "voice.webm")
    except AsrError as e:
        raise HTTPException(status_code=503, detail=str(e))
    return {"text": text}
