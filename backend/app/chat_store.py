from __future__ import annotations

import uuid
from pathlib import Path
from time import time
from typing import Literal

from pydantic import BaseModel, Field

from app import paths
from app.json_io import read_json, write_json_atomic


def utc_ms() -> int:
    return int(time() * 1000)


CHAT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000
CHAT_INDEX_FILE = "chat_index.json"
CHAT_DIRNAME = "chats"


class ChatVersioned(BaseModel):
    version: int = 1


class SessionSummary(BaseModel):
    id: str
    title: str
    created_at_ms: int
    updated_at_ms: int


class ChatIndex(ChatVersioned):
    sessions: list[SessionSummary] = Field(default_factory=list)


Role = Literal["user", "assistant", "system"]


class StoredMessage(BaseModel):
    id: str
    role: Role
    content: str
    created_at_ms: int


class SessionMessages(ChatVersioned):
    session_id: str
    messages: list[StoredMessage] = Field(default_factory=list)


def chat_index_path() -> Path:
    return paths.resolved_data_dir() / CHAT_INDEX_FILE


def chats_dir() -> Path:
    d = paths.resolved_data_dir() / CHAT_DIRNAME
    d.mkdir(parents=True, exist_ok=True)
    return d


def messages_path(session_id: str) -> Path:
    return chats_dir() / f"{session_id}.json"


def load_index(raw_prune: bool = True) -> ChatIndex:
    raw = read_json(chat_index_path(), {})
    data = raw if isinstance(raw, dict) else {}
    try:
        index = ChatIndex.model_validate(data) if data else ChatIndex()
    except Exception:
        index = ChatIndex()
    index.version = 1
    chats_dir()

    if raw_prune:
        trimmed, removed = prune_index(index)
        if removed:
            save_index(trimmed)
        index = trimmed
    return index


def save_index(index: ChatIndex) -> None:
    index.version = 1
    write_json_atomic(chat_index_path(), index.model_dump())


def load_messages(session_id: str) -> SessionMessages:
    p = messages_path(session_id)
    raw = read_json(p, {})
    data = raw if isinstance(raw, dict) else {}
    data.setdefault("session_id", session_id)
    try:
        sm = SessionMessages.model_validate(data)
    except Exception:
        sm = SessionMessages(session_id=session_id, messages=[])
    sm.version = 1
    return sm


def save_messages(messages: SessionMessages) -> None:
    messages.version = 1
    write_json_atomic(messages_path(messages.session_id), messages.model_dump())


def prune_index(index: ChatIndex) -> tuple[ChatIndex, list[str]]:
    cutoff = utc_ms() - CHAT_RETENTION_MS
    kept: list[SessionSummary] = []
    removed_ids: list[str] = []

    for s in index.sessions:
        if s.updated_at_ms >= cutoff:
            kept.append(s)
        else:
            removed_ids.append(s.id)

    for sid in removed_ids:
        p = messages_path(sid)
        if p.is_file():
            try:
                p.unlink()
            except OSError:
                pass

    kept_sorted = sorted(kept, key=lambda x: (-x.updated_at_ms, -x.created_at_ms))
    return ChatIndex(sessions=kept_sorted), removed_ids


def prune_chat_sessions_startup() -> None:
    idx = load_index(raw_prune=False)
    trimmed, removed = prune_index(idx)
    if removed:
        save_index(trimmed)


def get_session(session_id: str) -> SessionSummary | None:
    index = load_index()
    return next((s for s in index.sessions if s.id == session_id), None)


def create_session(initial_title: str | None = None) -> SessionSummary:
    chats_dir()
    index = load_index(raw_prune=False)
    sid = uuid.uuid4().hex
    now = utc_ms()
    title = (initial_title or "").strip() or "新会话"
    summary = SessionSummary(
        id=sid,
        title=title[:120],
        created_at_ms=now,
        updated_at_ms=now,
    )
    index.sessions.insert(0, summary)
    index.sessions.sort(key=lambda s: (-s.updated_at_ms, -s.created_at_ms))
    save_index(index)

    msgs = SessionMessages(session_id=sid, messages=[])
    save_messages(msgs)
    return summary


def delete_session(session_id: str) -> None:
    index = load_index(raw_prune=False)
    idx_pos = next((i for i, s in enumerate(index.sessions) if s.id == session_id), None)
    if idx_pos is None:
        raise ValueError("会话不存在")
    index.sessions.pop(idx_pos)
    save_index(index)
    p = messages_path(session_id)
    if p.is_file():
        try:
            p.unlink()
        except OSError:
            pass


def rename_session(session_id: str, title: str) -> SessionSummary:
    name = title.strip()
    if not name:
        raise ValueError("标题不能为空")

    index = load_index(raw_prune=False)
    pos = None
    cur: SessionSummary | None = None
    for i, s in enumerate(index.sessions):
        if s.id == session_id:
            pos = i
            cur = s
            break
    if pos is None or cur is None:
        raise ValueError("会话不存在")

    updated = SessionSummary(
        id=cur.id,
        title=name[:200],
        created_at_ms=cur.created_at_ms,
        updated_at_ms=utc_ms(),
    )
    index.sessions[pos] = updated
    index.sessions.sort(key=lambda ss: (-ss.updated_at_ms, -ss.created_at_ms))
    save_index(index)
    return updated


def append_turn(
    session_id: str,
    *,
    user_content: str,
    assistant_content: str,
) -> tuple[SessionSummary, list[StoredMessage]]:
    index = load_index()
    sess = next((s for s in index.sessions if s.id == session_id), None)
    if sess is None:
        raise ValueError("会话不存在")

    msgs = load_messages(session_id)
    um = StoredMessage(
        id=uuid.uuid4().hex,
        role="user",
        content=user_content,
        created_at_ms=utc_ms(),
    )
    am = StoredMessage(
        id=uuid.uuid4().hex,
        role="assistant",
        content=assistant_content,
        created_at_ms=utc_ms(),
    )
    msgs.messages.append(um)
    msgs.messages.append(am)

    updated_title = sess.title.strip()
    if updated_title == "新会话":
        head = user_content.strip().splitlines()[0][:60].strip()
        if head:
            updated_title = head

    bump = utc_ms()
    refreshed = SessionSummary(
        id=sess.id,
        title=updated_title[:200],
        created_at_ms=sess.created_at_ms,
        updated_at_ms=bump,
    )
    replaced = False
    for i, s in enumerate(index.sessions):
        if s.id == session_id:
            index.sessions[i] = refreshed
            replaced = True
            break
    if not replaced:
        index.sessions.append(refreshed)

    index.sessions.sort(key=lambda ss: (-ss.updated_at_ms, -ss.created_at_ms))
    save_messages(msgs)
    save_index(index)
    return refreshed, msgs.messages
