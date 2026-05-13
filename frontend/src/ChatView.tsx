import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { copyToClipboard, segmentAssistantContent } from './chatSegments'

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

type AIMasked = {
  base_url: string
  model: string
  capability: 'text' | 'text_vision'
  api_key_set: boolean
}

type SettingsBrief = {
  primary_ai: AIMasked
  vision_ai: AIMasked
}

const LS_RECENT_PRIMARY = 'mm_recent_primary_models'
const LS_RECENT_VISION = 'mm_recent_vision_models'

function readRecent(storageKey: string): string[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return []
    const a = JSON.parse(raw) as unknown
    return Array.isArray(a) ? a.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : []
  } catch {
    return []
  }
}

function pushRecent(storageKey: string, model: string, maxLen = 12) {
  if (typeof localStorage === 'undefined') return
  const t = model.trim()
  if (!t) return
  const prev = readRecent(storageKey).filter((x) => x !== t)
  const next = [t, ...prev].slice(0, maxLen)
  localStorage.setItem(storageKey, JSON.stringify(next))
}

function uniqModelOptions(current: string, recent: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const add = (raw: string) => {
    const s = raw.trim()
    if (!s || seen.has(s)) return
    seen.add(s)
    out.push(s)
  }
  add(current)
  for (const r of recent) add(r)
  return out
}

const CAP_LABEL: Record<AIMasked['capability'], string> = {
  text: '纯文本',
  text_vision: '文本 + 识图',
}

function BubbleCopyButton(props: { text: string }) {
  const { text } = props
  const [state, setState] = useState<'idle' | 'ok' | 'fail'>('idle')
  return (
    <button
      type="button"
      className="btn slim bubble-copy"
      disabled={!text.trim()}
      onClick={() => {
        void (async () => {
          const ok = await copyToClipboard(text)
          setState(ok ? 'ok' : 'fail')
          window.setTimeout(() => setState('idle'), ok ? 1600 : 2400)
        })()
      }}
    >
      {state === 'ok' ? '已复制' : state === 'fail' ? '复制失败' : '复制'}
    </button>
  )
}

function AssistantSegmentBubbles(props: { messageId: string; content: string }) {
  const { messageId, content } = props
  const segs = useMemo(() => segmentAssistantContent(content), [content])
  return (
    <>
      {segs.map((seg, i) => {
        const chatRole =
          seg.kind === 'xhs'
            ? '小红书推文'
            : segs.length > 1
              ? '说明与对话'
              : '主力 AI'
        return (
          <div
            key={`${messageId}-${i}-${seg.kind}`}
            className={
              seg.kind === 'xhs'
                ? 'bubble bubble-assistant bubble-xhs'
                : 'bubble bubble-assistant'
            }
          >
            <div className="bubble-toolbar">
              <div className="bubble-role">{chatRole}</div>
              <BubbleCopyButton text={seg.text} />
            </div>
            <div className="bubble-body">{seg.text}</div>
          </div>
        )
      })}
    </>
  )
}

export function ChatView(props: {
  notifyError: (message: string | null) => void
  onAfterAssistantReply?: () => void
  onOpenSettings?: () => void
}) {
  const { notifyError, onAfterAssistantReply, onOpenSettings } = props
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const sendReqIdRef = useRef(0)

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

  const [aiApi, setAiApi] = useState<SettingsBrief | null>(null)
  const [loadingAiApi, setLoadingAiApi] = useState(false)
  const [patchingRole, setPatchingRole] = useState<null | 'primary' | 'vision'>(null)

  const retentionDays = retentionMs / (24 * 60 * 60 * 1000)

  const reloadAiSettings = useCallback(async () => {
    setLoadingAiApi(true)
    try {
      const r = await fetch('/api/settings')
      const text = await r.text()
      if (!r.ok) throw new Error(text)
      const body = JSON.parse(text) as SettingsBrief
      setAiApi(body)
    } catch (e) {
      setAiApi(null)
    } finally {
      setLoadingAiApi(false)
    }
  }, [])

  useEffect(() => {
    void reloadAiSettings()
    let throttle = 0
    const bounce = () => {
      window.clearTimeout(throttle)
      throttle = window.setTimeout(() => void reloadAiSettings(), 400)
    }
    window.addEventListener('focus', bounce)
    const onVis = () => {
      if (document.visibilityState === 'visible') bounce()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('focus', bounce)
      document.removeEventListener('visibilitychange', onVis)
      window.clearTimeout(throttle)
    }
  }, [reloadAiSettings])

  const scrollToBottom = useCallback(() => {
    queueMicrotask(() => bottomRef.current?.scrollIntoView({ block: 'end' }))
  }, [])

  const canPrimaryChat = useMemo(() => {
    const p = aiApi?.primary_ai
    if (!p) return false
    return Boolean(
      p.api_key_set &&
        typeof p.base_url === 'string' &&
        p.base_url.trim().length > 0 &&
        typeof p.model === 'string' &&
        p.model.trim().length > 0,
    )
  }, [aiApi])

  const visionReady = useMemo(() => {
    const v = aiApi?.vision_ai
    if (!v) return false
    return Boolean(
      v.api_key_set &&
        v.base_url.trim() &&
        v.model.trim() &&
        v.capability === 'text_vision',
    )
  }, [aiApi])

  const patchAiModel = useCallback(
    async (role: 'primary' | 'vision', model: string) => {
      setPatchingRole(role)
      notifyError(null)
      try {
        const body =
          role === 'primary' ? { primary_ai: { model } } : { vision_ai: { model } }
        const r = await fetch('/api/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const t = await r.text()
        if (!r.ok) throw new Error(t)
        const next = JSON.parse(t) as SettingsBrief
        setAiApi(next)
        pushRecent(role === 'primary' ? LS_RECENT_PRIMARY : LS_RECENT_VISION, model.trim())
      } catch (e) {
        notifyError(e instanceof Error ? e.message : '切换模型失败')
      } finally {
        setPatchingRole(null)
      }
    },
    [notifyError],
  )

  const promptCustomModel = (role: 'primary' | 'vision', fallback: string) => {
    const name = window.prompt('输入模型 ID（与服务商文档一致）', fallback || '')
    if (name === null) return
    const t = name.trim()
    if (!t) {
      notifyError('模型名不能为空')
      return
    }
    void patchAiModel(role, t)
  }

  const loadSessions = useCallback(async () => {
    setLoadingList(true)
    notifyError(null)
    try {
      const r = await fetch('/api/chat/sessions')
      if (!r.ok) throw new Error(await r.text())
      const body = (await r.json()) as SessionsResp
      setRetentionMs(body.retention_ms)
      let list = body.sessions ?? []

      if (list.length === 0) {
        const cr = await fetch('/api/chat/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
        if (!cr.ok) throw new Error(await cr.text())
        const created = (await cr.json()) as { session?: ChatSession }
        const sess = created.session
        if (sess?.id) {
          list = [sess]
        }
      }

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
    if (!text || !activeId || !canPrimaryChat) return

    const reqId = ++sendReqIdRef.current
    const ts = Date.now()
    const optimisticUser: ChatMsg = {
      id: `optimistic-user-${ts}`,
      role: 'user',
      content: text,
      created_at_ms: ts,
    }
    const optimisticAssistant: ChatMsg = {
      id: `optimistic-assistant-${ts}`,
      role: 'assistant',
      content: '主力 AI 正在生成回复…',
      created_at_ms: ts,
    }

    setSending(true)
    setLastAssistErr(null)
    setLastUsedVision(false)
    notifyError(null)
    setMessages((prev) => [...prev, optimisticUser, optimisticAssistant])
    setDraft('')

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
      if (sendReqIdRef.current !== reqId) return
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
      onAfterAssistantReply?.()
    } catch (e) {
      if (sendReqIdRef.current !== reqId) return
      notifyError(e instanceof Error ? e.message : '发送失败')
      setMessages((prev) =>
        prev.filter((m) => m.id !== optimisticUser.id && m.id !== optimisticAssistant.id),
      )
      setDraft(text)
    } finally {
      if (sendReqIdRef.current === reqId) setSending(false)
    }
  }

  const activeTitle = sessions.find((s) => s.id === activeId)?.title ?? ''

  const primaryModels = uniqModelOptions(
    aiApi?.primary_ai.model ?? '',
    readRecent(LS_RECENT_PRIMARY),
  )
  const visionModels = uniqModelOptions(
    aiApi?.vision_ai.model ?? '',
    readRecent(LS_RECENT_VISION),
  )

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
            <div className="chat-main-empty">
              <p className="hint">请选择左侧会话，或点击「新会话」开始。</p>
            </div>
          ) : (
            <div className="chat-main-stack">
              <div className="chat-main-top">
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
              </div>

              <div className="chat-thread">
                {messages.length === 0 ? (
                  <p className="hint">还没有消息，试试在下方输入你的需求。</p>
                ) : (
                  messages.map((m) =>
                    m.role === 'user' ? (
                      <div key={m.id} className="bubble bubble-user">
                        <div className="bubble-role">我</div>
                        <div className="bubble-body">{m.content}</div>
                      </div>
                    ) : (
                      <AssistantSegmentBubbles key={m.id} messageId={m.id} content={m.content} />
                    ),
                  )
                )}
                <div ref={bottomRef} />
              </div>

              <div className="chat-ai-bar">
                {loadingAiApi ? (
                  <p className="hint chat-ai-loading">加载 AI 配置…</p>
                ) : !aiApi ? (
                  <p className="hint chat-ai-loading">
                    无法读取 AI 配置。请点击{' '}
                    <button type="button" className="linkish chat-ai-settings-link" onClick={() => onOpenSettings?.()}>
                      设置
                    </button>
                    检查网络或服务。
                  </p>
                ) : (
                  <>
                    <div className="chat-ai-slot">
                      <div className="chat-ai-slot-head">
                        <span className="chat-ai-label">对话 AI</span>
                        <span className="chat-ai-cap">{CAP_LABEL[aiApi.primary_ai.capability]}</span>
                      </div>
                      <div className="chat-ai-slot-row">
                        <select
                          className="input chat-ai-select"
                          aria-label="对话模型"
                          value={aiApi.primary_ai.model.trim() === '' ? '' : aiApi.primary_ai.model}
                          disabled={patchingRole === 'primary'}
                          onChange={(e) => {
                            const v = e.target.value
                            if (v === '__custom_primary__') {
                              promptCustomModel('primary', aiApi.primary_ai.model || '')
                            } else void patchAiModel('primary', v)
                          }}
                        >
                          {aiApi.primary_ai.model.trim() === '' ? (
                            <option value="">未选择模型</option>
                          ) : null}
                          {primaryModels.map((m) => (
                            <option key={`p-${m}`} value={m}>
                              {m}
                            </option>
                          ))}
                          <option value="__custom_primary__">自定义模型…</option>
                        </select>
                        <span
                          className={
                            aiApi.primary_ai.api_key_set ? 'chat-ai-badge ok' : 'chat-ai-badge warn'
                          }
                        >
                          {aiApi.primary_ai.api_key_set ? '密钥已配' : '未配密钥'}
                        </span>
                      </div>
                      {!canPrimaryChat ? (
                        <p className="hint chat-ai-warn">
                          无法发送对话：请补充{' '}
                          <strong>Base URL</strong>、<strong>模型名</strong> 与{' '}
                          <strong>API Key</strong>。
                          <button type="button" className="linkish chat-ai-settings-link" onClick={() => onOpenSettings?.()}>
                            打开设置
                          </button>
                          。
                        </p>
                      ) : null}
                    </div>
                    <div className="chat-ai-slot">
                      <div className="chat-ai-slot-head">
                        <span className="chat-ai-label">识图 AI</span>
                        <span className="chat-ai-cap">{CAP_LABEL[aiApi.vision_ai.capability]}</span>
                      </div>
                      <div className="chat-ai-slot-row">
                        <select
                          className="input chat-ai-select"
                          aria-label="识图模型"
                          value={aiApi.vision_ai.model.trim() === '' ? '' : aiApi.vision_ai.model}
                          disabled={patchingRole === 'vision'}
                          onChange={(e) => {
                            const v = e.target.value
                            if (v === '__custom_vision__') {
                              promptCustomModel('vision', aiApi.vision_ai.model || '')
                            } else void patchAiModel('vision', v)
                          }}
                        >
                          {aiApi.vision_ai.model.trim() === '' ? (
                            <option value="">未选择模型</option>
                          ) : null}
                          {visionModels.map((m) => (
                            <option key={`v-${m}`} value={m}>
                              {m}
                            </option>
                          ))}
                          <option value="__custom_vision__">自定义模型…</option>
                        </select>
                        <span
                          className={visionReady ? 'chat-ai-badge ok' : 'chat-ai-badge warn'}
                        >
                          {visionReady ? '识图可用' : '识图不可用'}
                        </span>
                      </div>
                      {!visionReady ? (
                        <p className="hint chat-ai-warn muted">
                          按需识图时需多模态模型 + Key + Base URL。可在{' '}
                          <button type="button" className="linkish chat-ai-settings-link" onClick={() => onOpenSettings?.()}>
                            设置
                          </button>
                          中配置。
                        </p>
                      ) : null}
                    </div>
                  </>
                )}
              </div>

              <div
                className={
                  !canPrimaryChat ? 'composer composer-locked' : 'composer'
                }
              >
                <textarea
                  className="textarea composer-input"
                  rows={4}
                  value={draft}
                  placeholder={
                    !canPrimaryChat
                      ? '请先在右上角「设置」或上方提示中补齐对话 AI 后再发送…'
                      : sending
                        ? '上方已显示你的消息，请等待 AI 完成回复…'
                        : '描述你的小红书笔记诉求、卖点、口吻等（Shift+Enter 换行）'
                  }
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return
                    if (e.shiftKey) return
                    if (sending || !activeId || !canPrimaryChat) return
                    e.preventDefault()
                    void send()
                  }}
                  disabled={sending || !activeId || !canPrimaryChat}
                />
                <div className="row-actions composer-actions">
                  <button
                    type="button"
                    className="btn primary slim"
                    disabled={sending || !activeId || !canPrimaryChat || draft.trim().length === 0}
                    onClick={() => void send()}
                  >
                    {sending ? '回复中…' : '发送（Enter）'}
                  </button>
                  <span className="muted small composer-hint-ai">
                    走 OpenAI 兼容 <code>/chat/completions</code>。
                    {!canPrimaryChat ? null : ' 识图需在设置中按需配置（见上方）。'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
