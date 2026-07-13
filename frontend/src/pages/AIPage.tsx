import { useEffect, useRef, useState } from 'react'
import {
  fetchAISettings,
  fetchChatHistory,
  fetchProviders,
  saveAISettings,
  sendChat,
  type AIProvider,
  type ChatMessage,
} from '../api/ai'
import { fetchMonthRecords } from '../api/records'
import { ApiError } from '../api/client'
import './AIPage.css'

export default function AIPage() {
  const [providers, setProviders] = useState<AIProvider[]>([])
  const [provider, setProvider] = useState('deepseek')
  const [apiBaseUrl, setApiBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [apiKeyMasked, setApiKeyMasked] = useState<string | null>(null)
  const [linkedDate, setLinkedDate] = useState('')
  const [dateOptions, setDateOptions] = useState<string[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [settingsMsg, setSettingsMsg] = useState('')
  const [chatMsg, setChatMsg] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchProviders().then(setProviders)
    fetchAISettings().then((s) => {
      setProvider(s.provider)
      setApiBaseUrl(s.api_base_url)
      setApiKeyMasked(s.api_key_masked)
    })
    fetchChatHistory().then(setMessages)

    const now = new Date()
    fetchMonthRecords(now.getFullYear(), now.getMonth() + 1).then((data) => {
      const dates = Object.keys(data.records_by_date).sort()
      setDateOptions(dates)
      if (dates.length > 0) setLinkedDate(dates[dates.length - 1])
    })
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  const onProviderChange = (value: string) => {
    setProvider(value)
    const found = providers.find((p) => p.id === value)
    if (found) setApiBaseUrl(found.default_base_url)
  }

  const saveSettings = async () => {
    setSettingsMsg('')
    try {
      const saved = await saveAISettings({
        provider,
        api_base_url: apiBaseUrl,
        api_key: apiKey || undefined,
      })
      setApiKeyMasked(saved.api_key_masked)
      setApiKey('')
      setSettingsMsg('AI 配置已保存')
    } catch (err) {
      setSettingsMsg(err instanceof ApiError ? err.message : '保存失败')
    }
  }

  const onSend = async () => {
    if (!input.trim() || sending) return
    setChatMsg('')
    setSending(true)
    const userText = input.trim()
    setInput('')
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        role: 'user',
        content: userText,
        linked_date: linkedDate || null,
        created_at: new Date().toISOString(),
      },
    ])
    try {
      const res = await sendChat(userText, linkedDate || null)
      setMessages((prev) => [...prev, res.message])
    } catch (err) {
      setChatMsg(err instanceof ApiError ? err.message : '发送失败')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="ai-page">
      <div className="card settings-card">
        <h3>AI 配置</h3>
        <label>
          厂商
          <select value={provider} onChange={(e) => onProviderChange(e.target.value)}>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          API URL
          <input value={apiBaseUrl} onChange={(e) => setApiBaseUrl(e.target.value)} />
        </label>
        <label>
          API Key {apiKeyMasked ? `（已配置 ${apiKeyMasked}）` : ''}
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="输入新的 API Key"
          />
        </label>
        <button type="button" onClick={saveSettings}>
          保存配置
        </button>
        {settingsMsg && <p className="msg">{settingsMsg}</p>}
      </div>

      <div className="card chat-card">
        <div className="chat-toolbar">
          <label>
            关联日期
            <select value={linkedDate} onChange={(e) => setLinkedDate(e.target.value)}>
              <option value="">不关联</option>
              {dateOptions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="chat-window">
          {messages.length === 0 && <p className="empty-tip">向测算大师提问，可关联某日记录</p>}
          {messages.map((m) => (
            <div key={m.id} className={`bubble ${m.role}`}>
              <p>{m.content}</p>
              {m.linked_date && <span className="tag">{m.linked_date}</span>}
            </div>
          ))}
          {sending && <p className="loading">测算大师思考中...</p>}
          <div ref={bottomRef} />
        </div>
        <div className="chat-input">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="请输入想测算的内容..."
            rows={2}
          />
          <button type="button" onClick={onSend} disabled={sending}>
            发送
          </button>
        </div>
        {chatMsg && <p className="msg error">{chatMsg}</p>}
      </div>
    </div>
  )
}
