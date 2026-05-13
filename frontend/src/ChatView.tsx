import { useCallback, useEffect, useRef, useState } from 'react'

type ChatSession = {
  id: string
  title: string
  created_at_ms: number
  updated_at_ms: number
}

type ChatMsg = {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at_ms: number
}

type SessionsResp = {
  retention_ms: number
  sessions: ChatSession[]
}

export function ChatView(props: {
  notifyError: (message: string | null) => void
}) {
  const { notifyError } = props
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [retentionMs, setRetentionMs] = useState(7 * 24 * 60 * 60 * 1000)

  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [loadingList, setLoadingList] = useState(false)
  const [loadingThread, setLoadingThread] = useState(false)
  const [sending, setSending] = useState(false)

  const [draft, setDraft] = useState('')
  const [withSkills, setWithSkills] = useState(true)
  const [lastAssistErr, setLastAssistErr] = useState<string | null>(null)
  const [lastUsedVision, setLastUsedVision] = useState(false)

  const retentionDays = retentionMs / (24 * 60 * 60 * 1000)

  const scrollToBottom = useCallback(() => {
    queueMicrotask(() => bottomRef.current?.scrollIntoView({ block: 'end' }))
  }, [])

  const loadSessions = useCallback(async () => {
    setLoadingList(true)
    notifyError(null)
    try {
      const r = await fetch('/api/chat/sessions')
      if (!r.ok) throw new Error(await r.text())
      const body = (await r.json()) as SessionsResp
      setRetentionMs(body.retention_ms)
      const list = body.sessions ?? []
      setSessions(list)
      setActiveId((prev) => {
        if (prev && list.some((s) => s.id === prev)) return prev
        return list[0]?.id ?? null
      })
    } catch (e) {
      setSessions([])
      setActiveId(null)
      notifyError(e instanceof Error ? e.message : '读取会话列表失败')
    } finally {
      setLoadingList(false)
    }
  }, [notifyError])

  const loadThread = useCallback(
    async (sid: string) => {
      setLoadingThread(true)
      notifyError(null)
      try {
        const r = await fetch(`/api/chat/sessions/${sid}`)
        if (!r.ok) throw new Error(await r.text())
        const data = await r.json()
        const rawMsgs = Array.isArray((data as { messages?: unknown }).messages)
          ? (data as { messages: ChatMsg[] }).messages
          : []
        setMessages(rawMsgs)
        if (data.session?.title) {
          const t = String(data.session.title)
          setSessions((prev) => prev.map((s) => (s.id === sid ? { ...s, title: t } : s)))
        }
      } catch (e) {
        setMessages([])
        notifyError(e instanceof Error ? e.message : '读取消息失败')
      } finally {
        setLoadingThread(false)
      }
    },
    [notifyError],
  )

  useEffect(() => {
    void loadSessions()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!activeId) {
      setMessages([])
      return
    }
    void loadThread(activeId)
  }, [activeId, loadThread])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom, loadingThread])

  const newSession = async () => {
    notifyError(null)
    try {
      const r = await fetch('/api/chat/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!r.ok) throw new Error(await r.text())
      const body = await r.json()
      const sess = body.session as ChatSession
      await loadSessions()
      setActiveId(sess.id)
      setMessages([])
    } catch (e) {
      notifyError(e instanceof Error ? e.message : '创建会话失败')
    }
  }

  const deleteActive = async () => {
    if (!activeId) return
    if (!window.confirm('确定删除该会话？消息将一并移除。')) return
    notifyError(null)
    try {
      const r = await fetch(`/api/chat/sessions/${activeId}`, {
        method: 'DELETE',
      })
      if (!r.ok) throw new Error(await r.text())
      setActiveId(null)
      setMessages([])
      await loadSessions()
    } catch (e) {
      notifyError(e instanceof Error ? e.message : '删除会话失败')
    }
  }

  const renameActive = async () => {
    if (!activeId) return
    const title = window.prompt('新的会话标题', '')
    if (title === null) return
    const t = title.trim()
    if (!t) {
      notifyError('标题不能为空')
      return
    }
    notifyError(null)
    try {
      const r = await fetch(`/api/chat/sessions/${activeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: t }),
      })
      if (!r.ok) throw new Error(await r.text())
      await loadSessions()
    } catch (e) {
      notifyError(e instanceof Error ? e.message : '重命名失败')
    }
  }

  const send = async () => {
    const text = draft.trim()
    if (!text || !activeId) return
    setSending(true)
    setLastAssistErr(null)
    setLastUsedVision(false)
    notifyError(null)
    try {
      const r = await fetch(`/api/chat/sessions/${activeId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: text,
          with_skills: withSkills,
        }),
      })
      if (!r.ok) throw new Error(await r.text())
      const body = await r.json()
      const outMsgs = Array.isArray((body as { messages?: unknown }).messages)
        ? (body as { messages: ChatMsg[] }).messages
        : []
      setMessages(outMsgs)
      if (body.session) {
        const sess = body.session as ChatSession
        setSessions((prev) => {
          const others = prev.filter((s) => s.id !== sess.id)
          return [sess, ...others].sort((a, b) => b.updated_at_ms - a.updated_at_ms)
        })
      }
      if (body.assistant_error) {
        setLastAssistErr(
          typeof body.error_detail === 'string' ? body.error_detail : '模型调用失败（已占位写入）',
        )
      }
      setLastUsedVision(Boolean((body as { used_vision?: boolean }).used_vision))
      setDraft('')
    } catch (e) {
      notifyError(e instanceof Error ? e.message : '发送失败')
    } finally {
      setSending(false)
    }
  }

  const activeTitle = sessions.find((s) => s.id === activeId)?.title ?? ''

  return (
    <section className="card chat-shell">
      <div className="row-actions spread chat-top">
        <div>
          <h2 style={{ margin: 0 }}>对话工作台</h2>
          <p className="hint" style={{ margin: '0.35rem 0 0' }}>
            会话在 <strong>{retentionDays} 天</strong> 内有更新会被保留（滚动过期自动清理）。
          </p>
        </div>
        <div className="row-actions">
          <button type="button" className="btn" disabled={loadingList} onClick={() => void loadSessions()}>
            {loadingList ? '刷新…' : '刷新列表'}
          </button>
          <button type="button" className="btn primary slim" onClick={() => void newSession()}>
            新会话
          </button>
        </div>
      </div>

      <div className="chat-grid">
        <aside className="chat-aside">
          <div className="muted small aside-hint">
            {sessions.length ? `共 ${sessions.length} 个会话` : '暂无会话'}
          </div>
          <div className="session-list">
            {sessions.map((s) => (
              <button
                key={s.id}
                type="button"
                className={s.id === activeId ? 'sess sess-active' : 'sess'}
                onClick={() => setActiveId(s.id)}
                title={`更新：${new Date(s.updated_at_ms).toLocaleString()}`}
              >
                <div className="sess-title">{s.title}</div>
                <div className="sess-meta muted small">
                  {new Date(s.updated_at_ms).toLocaleString()}
                </div>
              </button>
            ))}
          </div>

          <div className="aside-actions">
            <button
              type="button"
              className="btn slim"
              disabled={!activeId}
              onClick={() => void renameActive()}
            >
              改标题
            </button>
            <button
              type="button"
              className="btn slim danger-outline"
              disabled={!activeId}
              onClick={() => void deleteActive()}
            >
              删除会话
            </button>
          </div>

          <label className="check chat-skill-flag">
            <input
              type="checkbox"
              checked={withSkills}
              onChange={(e) => setWithSkills(e.target.checked)}
            />
            <span>发送时将已勾选 Skill 注入上下文</span>
          </label>
        </aside>

        <div className="chat-main">
          {!activeId ? (
            <p className="hint">请选择左侧会话，或点击「新会话」开始。</p>
          ) : (
            <>
              <div className="chat-thread-title">
                <div className="mono small">{activeTitle}</div>
                {loadingThread ? <span className="muted small">加载消息…</span> : null}
              </div>

              {lastUsedVision ? (
                <p className="muted small" style={{ margin: '0 0 0.5rem' }}>
                  本轮已由主力 AI <strong>按需</strong>触发识图模型并回注结果（未在无关问题上空跑多模态）。
                </p>
              ) : null}

              {lastAssistErr ? (
                <p className="warn compact-warn">上一次模型调用失败：{lastAssistErr}</p>
              ) : null}

              <div className="chat-thread">
                {messages.length === 0 ? (
                  <p className="hint">还没有消息，试试在下方输入你的需求。</p>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={
                        m.role === 'user' ? 'bubble bubble-user' : 'bubble bubble-assistant'
                      }
                    >
                      <div className="bubble-role">
                        {m.role === 'user' ? '我' : '主力 AI'}
                      </div>
                      <div className="bubble-body">{m.content}</div>
                    </div>
                  ))
                )}
                <div ref={bottomRef} />
              </div>

              <div className="composer">
                <textarea
                  className="textarea composer-input"
                  rows={4}
                  value={draft}
                  placeholder={
                    sending
                      ? '等待模型回复…'
                      : '描述你的小红书笔记诉求、卖点、口吻等（Shift+Enter 换行）'
                  }
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return
                    if (e.shiftKey) return
                    if (sending || !activeId) return
                    e.preventDefault()
                    void send()
                  }}
                  disabled={sending || !activeId}
                />
                <div className="row-actions composer-actions">
                  <button
                    type="button"
                    className="btn primary slim"
                    disabled={sending || !activeId || draft.trim().length === 0}
                    onClick={() => void send()}
                  >
                    {sending ? '发送中…' : '发送（Enter）'}
                  </button>
                  <span className="muted small">
                    走 OpenAI 兼容 <code>/chat/completions</code>；密钥在「设置与 Skill」。
                    需在画面层理解素材库图片时，主力可调用识图工具（请引用系统注入清单中的 id）。
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
