import { useEffect, useRef, useState } from 'react'
import type { ChatMessage } from '../api/ai'

interface ChatWindowProps {
  messages: ChatMessage[]
  sending: boolean
}

export default function ChatWindow({ messages, sending }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  // 思考框默认收起，记录被展开的消息 id
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  // 「2026-07-20」→「7月20日」
  const fmtActionDate = (iso: string) => {
    const [, m, d] = iso.split('-')
    return `${Number(m)}月${Number(d)}日`
  }

  const toggleThinking = (id: number) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="chat-window">
      {messages.length === 0 && <p className="empty-tip">向测算大师提问，输入 @ 可关联某日记录</p>}
      {messages.map((m) => (
        <div key={m.id} className={`bubble ${m.role}${m.notice ? ' notice' : ''}`}>
          {m.role === 'assistant' && !m.notice && (
            m.reasoning ? (
              <div className={`thinking-box${expanded[m.id] ? ' open' : ''}`}>
                <button
                  type="button"
                  className="thinking-bar"
                  onClick={() => toggleThinking(m.id)}
                  aria-expanded={!!expanded[m.id]}
                >
                  <span className="thinking-status">💭 AI大师已然心里有数</span>
                  <span className="thinking-chevron">{expanded[m.id] ? '▾ 收起' : '▸ 展开'}</span>
                </button>
                {expanded[m.id] && <p className="thinking-content">{m.reasoning}</p>}
              </div>
            ) : (
              <div className="thinking-box empty">
                <div className="thinking-bar static">
                  <span className="thinking-status">💭 当前AI未返回思考内容</span>
                </div>
              </div>
            )
          )}
          <p>{m.content}</p>
          {m.record_actions?.map((a, i) => (
            <span key={i} className="tag action-tag">
              ✏️ 已{a.action === 'created' ? '新增' : '更新'} {fmtActionDate(a.date)} 的记录
            </span>
          ))}
          {m.used_fallback && <span className="tag fallback-tag">🔄 已由备用模型接手</span>}
          {m.linked_date && <span className="tag">📅 {m.linked_date}</span>}
        </div>
      ))}
      {sending && (
        <div className="bubble assistant">
          <div className="thinking-box pending">
            <div className="thinking-bar static">
              <span className="thinking-status thinking-pulse">💭 AI大师正在掐指一算…</span>
            </div>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}
