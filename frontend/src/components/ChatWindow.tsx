import { useEffect, useRef } from 'react'
import type { ChatMessage } from '../api/ai'

interface ChatWindowProps {
  messages: ChatMessage[]
  sending: boolean
}

export default function ChatWindow({ messages, sending }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  return (
    <div className="chat-window">
      {messages.length === 0 && <p className="empty-tip">向测算大师提问，输入 @ 可关联某日记录</p>}
      {messages.map((m) => (
        <div key={m.id} className={`bubble ${m.role}`}>
          {m.role === 'assistant' && (
            <div className={`thinking-box${m.reasoning ? '' : ' empty'}`}>
              <span className="thinking-label">💭 思考过程</span>
              <p>{m.reasoning || '当前AI未返回思考内容'}</p>
            </div>
          )}
          <p>{m.content}</p>
          {m.linked_date && <span className="tag">📅 {m.linked_date}</span>}
        </div>
      ))}
      {sending && <p className="loading">测算大师思考中...</p>}
      <div ref={bottomRef} />
    </div>
  )
}
