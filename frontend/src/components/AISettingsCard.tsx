import { useEffect, useState } from 'react'
import {
  fetchAISettings,
  fetchProviders,
  saveAISettings,
  type AIProvider,
} from '../api/ai'
import { ApiError } from '../api/client'

export default function AISettingsCard() {
  const [providers, setProviders] = useState<AIProvider[]>([])
  const [provider, setProvider] = useState('deepseek')
  const [apiBaseUrl, setApiBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [apiKeyMasked, setApiKeyMasked] = useState<string | null>(null)
  const [model, setModel] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsMsg, setSettingsMsg] = useState('')

  useEffect(() => {
    fetchProviders().then(setProviders)
    fetchAISettings().then((s) => {
      setProvider(s.provider)
      setApiBaseUrl(s.api_base_url)
      setApiKeyMasked(s.api_key_masked)
      setModel(s.model)
    })
  }, [])

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

  const providerName = currentProvider?.name ?? provider
  const settingsSummary = apiKeyMasked
    ? `${providerName} · ${model} · ${apiKeyMasked}`
    : `${providerName} · 未配置 API Key`

  return (
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
  )
}
