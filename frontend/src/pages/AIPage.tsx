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
  const [model, setModel] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [linkedDate, setLinkedDate] = useState('')
  const [dateOptions, setDateOptions] = useState<string[]>([])
  const [showDatePicker, setShowDatePicker] = useState(false)
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
      setModel(s.model)
    })
    fetchChatHistory().then(setMessages)

    const now = new Date()
    fetchMonthRecords(now.getFullYear(), now.getMonth() + 1).then((data) => {
      const dates = Object.keys(data.records_by_date).sort()
      setDateOptions(dates)
    })
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  const currentProvider = providers.find((p) => p.id === provider)
  const modelOptions = currentProvider?.models ?? []

  const onProviderChange = (value: string) => {
    setProvider(value)
    const found = providers.find((p) => p.id === value)
    if (found) {
      setApiBaseUrl(found.default_base_url)
      setModel(found.default_model)
    }
  }

  const saveSettings = async () => {
    setSettingsMsg('')
    try {
      const saved = await saveAISettings({
        provider,
        api_base_url: apiBaseUrl,
        api_key: apiKey || undefined,
        model,
      })
      setApiKeyMasked(saved.api_key_masked)
      setApiKey('')
      setSettingsMsg('AI 配置已保存')
    } catch (err) {
      setSettingsMsg(err instanceof ApiError ? err.message : '保存失败')
    }
  }

  const onInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setInput(val)
    if (val.endsWith('@') && dateOptions.length > 0) {
      setShowDatePicker(true)
    } else {
      setShowDatePicker(false)
    }
  }

  const onSelectDate = (date: string) => {
    setLinkedDate(date)
    setShowDatePicker(false)
    setInput((prev) => prev.replace(/@$/, ''))
  }

  const onSend = async () => {
    if (!input.trim() || sending) return
    setChatMsg('')
    setSending(true)
    const userText = input.trim()
    const sentDate = linkedDate
    setInput('')
    setLinkedDate('')
    setShowDatePicker(false)
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        role: 'user',
        content: userText,
        linked_date: sentDate || null,
        created_at: new Date().toISOString(),
      },
    ])
    try {
      const res = await sendChat(userText, sentDate || null)
      setMessages((prev) => [...prev, res.message])
    } catch (err) {
      setChatMsg(err instanceof ApiError ? err.message : '发送失败')
    } finally {
      setSending(false)
    }
  }

  const providerName = currentProvider?.name ?? provider
  const settingsSummary = apiKeyMasked
    ? `${providerName} · ${model} · ${apiKeyMasked}`
    : `${providerName} · 未配置 API Key`

  return (
    <div className="ai-page">
      <div className={`card settings-card ${settingsOpen ? 'expanded' : 'collapsed'}`}>
        <div className="settings-header" onClick={() => setSettingsOpen(!settingsOpen)}>
          <span className="settings-summary">
            <svg className="settings-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></svg>
            AI 配置
            <em className="settings-status">{settingsSummary}</em>
          </span>
          <svg className={`settings-toggle ${settingsOpen ? 'open' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
        </div>
        {settingsOpen && (
          <div className="settings-body">
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
              模型
              <select value={model} onChange={(e) => setModel(e.target.value)}>
                {modelOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
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
        )}
      </div>

      <div className="card chat-card">
        <div className="chat-window">
          {messages.length === 0 && <p className="empty-tip">向测算大师提问，输入 @ 可关联某日记录</p>}
          {messages.map((m) => (
            <div key={m.id} className={`bubble ${m.role}`}>
              <p>{m.content}</p>
              {m.linked_date && <span className="tag">📅 {m.linked_date}</span>}
            </div>
          ))}
          {sending && <p className="loading">测算大师思考中...</p>}
          <div ref={bottomRef} />
        </div>
        <div className="chat-input-area">
          {linkedDate && (
            <div className="linked-chips">
              <span className="date-chip">
                📅 {linkedDate}
                <button type="button" className="chip-remove" onClick={() => setLinkedDate('')}>✕</button>
              </span>
            </div>
          )}
          <div className="chat-input-row">
            <div className="input-wrapper">
              <textarea
                value={input}
                onChange={onInputChange}
                placeholder="输入内容，用 @ 关联日期..."
                rows={2}
              />
              {showDatePicker && (
                <div className="date-picker-popover">
                  {dateOptions.map((d) => (
                    <button key={d} type="button" className="date-picker-item" onClick={() => onSelectDate(d)}>
                      📅 {d}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button type="button" onClick={onSend} disabled={sending}>
              发送
            </button>
          </div>
        </div>
        {chatMsg && <p className="msg error">{chatMsg}</p>}
      </div>
    </div>
  )
}
