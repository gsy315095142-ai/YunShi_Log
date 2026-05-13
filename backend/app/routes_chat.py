from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app import paths
from app.chat_llm import orchestrate_primary_chat_reply
from app.chat_store import CHAT_DIRNAME, CHAT_RETENTION_MS, SessionSummary
from app.chat_store import append_turn, chat_index_path, create_session
from app.chat_store import delete_session, get_session, load_index, load_messages, rename_session


router = APIRouter(prefix="/api/chat", tags=["chat"])


class CreateSessionBody(BaseModel):
    title: str | None = Field(default=None, max_length=200)


class PatchSessionBody(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)


class SendChatBody(BaseModel):
    content: str = Field(..., min_length=1)
    with_skills: bool = True


def _dump(summary: SessionSummary) -> dict[str, object]:
    return summary.model_dump()


@router.get("/sessions")
async def list_sessions():
    idx = load_index()
    return {
        "retention_ms": CHAT_RETENTION_MS,
        "sessions": [_dump(s) for s in idx.sessions],
    }


@router.post("/sessions")
async def http_create_session(body: CreateSessionBody):
    sess = create_session(body.title)
    return {"session": _dump(sess)}


@router.get("/sessions/{session_id}")
async def http_fetch_session(session_id: str):
    sess = get_session(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="会话不存在或已过期被清理")
    msgs = load_messages(session_id)
    return {
        "session": _dump(sess),
        "messages": [m.model_dump() for m in msgs.messages],
    }


@router.patch("/sessions/{session_id}")
async def http_rename_session(session_id: str, body: PatchSessionBody):
    try:
        sess = rename_session(session_id, body.title)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"session": _dump(sess)}


@router.delete("/sessions/{session_id}")
async def http_delete_session(session_id: str):
    try:
        delete_session(session_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"ok": True}


@router.post("/sessions/{session_id}/messages")
async def http_append_message(session_id: str, body: SendChatBody):
    sess = get_session(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="会话不存在或已过期被清理")

    msgs = load_messages(session_id)
    user_clean = body.content.strip()

    reply, err, used_vision = await orchestrate_primary_chat_reply(
        history=msgs.messages,
        user_draft=user_clean,
        with_skills=body.with_skills,
    )
    has_text = bool(reply.strip())
    assistant_txt = reply.strip() if has_text else f"【模型调用失败】{err or '未知错误'}"

    try:
        refreshed, history = append_turn(
            session_id,
            user_content=user_clean,
            assistant_content=assistant_txt,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    fail = err is not None or not has_text
    err_out = err
    if fail and err_out is None and not has_text:
        err_out = "模型返回为空或无有效回复。"
    return {
        "assistant_error": fail,
        "error_detail": err_out if fail else None,
        "used_vision": used_vision,
        "session": _dump(refreshed),
        "messages": [m.model_dump() for m in history],
    }


@router.get("/meta")
async def chat_meta():
    root = paths.resolved_data_dir()
    return {
        "chat_index_file": str(chat_index_path().resolve()),
        "chat_dir": str((root / CHAT_DIRNAME).resolve()),
    }
