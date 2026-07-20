import { useEffect, useState } from 'react'
import { fetchChatHistory, sendChat, type ChatMessage } from '../api/ai'
import { ApiError } from '../api/client'

export function useAIChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sending, setSending] = useState(false)
  const [chatMsg, setChatMsg] = useState('')

  useEffect(() => {
    fetchChatHistory().then(setMessages)
  }, [])

  const send = async (text: string, linkedDate: string) => {
    setChatMsg('')
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
      setChatMsg(err instanceof ApiError ? err.message : '发送失败')
    } finally {
      setSending(false)
    }
  }

  return { messages, sending, chatMsg, send }
}
