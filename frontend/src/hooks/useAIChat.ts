import { useEffect, useState } from 'react'
import { fetchChatHistory, sendChat, type ChatMessage } from '../api/ai'
import { ApiError } from '../api/client'

export function useAIChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sending, setSending] = useState(false)

  useEffect(() => {
    fetchChatHistory().then(setMessages)
  }, [])

  const send = async (text: string, linkedDate: string) => {
    setSending(true)
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        role: 'user',
        content: text,
        reasoning: null,
        linked_date: linkedDate || null,
        created_at: new Date().toISOString(),
      },
    ])
    try {
      const res = await sendChat(text, linkedDate || null)
      setMessages((prev) => [...prev, res.message])
    } catch (err) {
      // 失败（如未配置 API Key）以 AI 提示气泡的形式展现在聊天窗口，不落库
      const notice = err instanceof ApiError ? err.message : '发送失败，请稍后再试'
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'assistant',
          content: `⚠️ ${notice}`,
          reasoning: null,
          linked_date: null,
          created_at: new Date().toISOString(),
          notice: true,
        },
      ])
    } finally {
      setSending(false)
    }
  }

  return { messages, sending, send }
}
