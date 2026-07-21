import { useEffect, useState } from 'react'
import {
  fetchAISettings,
  fetchProviders,
  saveAISettings,
  type AIProvider,
} from '../api/ai'
import { ApiError } from '../api/client'

interface AISettingsCardProps {
  /** 配置栏右侧操作位（如「对话导出」按钮） */
  actions?: React.ReactNode
}

export default function AISettingsCard({ actions }: AISettingsCardProps) {
  const [providers, setProviders] = useState<AIProvider[]>([])
  const [provider, setProvider] = useState('deepseek')
  const [apiBaseUrl, setApiBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [apiKeyMasked, setApiKeyMasked] = useState<string | null>(null)
  const [model, setModel] = useState('')
  const [fallbackProvider, setFallbackProvider] = useState('')
  const [fallbackModel, setFallbackModel] = useState('')
  const [fallbackApiKey, setFallbackApiKey] = useState('')
  const [fallbackApiKeyMasked, setFallbackApiKeyMasked] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsMsg, setSettingsMsg] = useState('')

  useEffect(() => {
    fetchProviders().then(setProviders)
    fetchAISettings().then((s) => {
      setProvider(s.provider)
      setApiBaseUrl(s.api_base_url)
      setApiKeyMasked(s.api_key_masked)
      setModel(s.model)
      setFallbackProvider(s.fallback_provider ?? '')
      setFallbackModel(s.fallback_model ?? '')
      setFallbackApiKeyMasked(s.fallback_api_key_masked)
    })
  }, [])

  const currentProvider = providers.find((p) => p.id === provider)
  const modelOptions = currentProvider?.models ?? []
  const fallbackProviderInfo = providers.find((p) => p.id === fallbackProvider)
  const fallbackModelOptions = fallbackProviderInfo?.models ?? []

  const onProviderChange = (value: string) => {
    setProvider(value)
    const found = providers.find((p) => p.id === value)
    if (found) {
      setApiBaseUrl(found.default_base_url)
      setModel(found.default_model)
    }
  }

  const onFallbackProviderChange = (value: string) => {
    setFallbackProvider(value)
    const found = providers.find((p) => p.id === value)
    setFallbackModel(found?.default_model ?? '')
  }

  const saveSettings = async () => {
    setSettingsMsg('')
    try {
      const saved = await saveAISettings({
        provider,
        api_base_url: apiBaseUrl,
        api_key: apiKey || undefined,
        model,
        ...(fallbackProvider
          ? {
              fallback_provider: fallbackProvider,
              fallback_model: fallbackModel || undefined,
              fallback_api_key: fallbackApiKey || undefined,
            }
          : { clear_fallback: true }),
      })
      setApiKeyMasked(saved.api_key_masked)
      setApiKey('')
      setFallbackApiKeyMasked(saved.fallback_api_key_masked)
      setFallbackApiKey('')
      setSettingsMsg('AI 配置已保存')
    } catch (err) {
      setSettingsMsg(err instanceof ApiError ? err.message : '保存失败')
    }
  }

  const providerName = currentProvider?.name ?? provider
  const fallbackName = fallbackProviderInfo?.name ?? ''
  // 摘要只显示厂商与模型，不暴露 Key；备用厂商以括号附带
  const settingsSummary = `${providerName} · ${model}${fallbackProvider && fallbackName ? `（备用：${fallbackName}）` : ''}`

  return (
    <>
      <div className="settings-bar">
        <span className="settings-status">{settingsSummary}</span>
        <button
          type="button"
          className="settings-btn compact"
          onClick={() => {
            setSettingsMsg('')
            setSettingsOpen(true)
          }}
        >
          <svg className="settings-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></svg>
          AI 配置
        </button>
        {/* 右侧操作位（如「对话导出」），由父组件注入 */}
        {actions && <span className="settings-actions">{actions}</span>}
      </div>

      {settingsOpen && (
        <div className="settings-backdrop" onClick={() => setSettingsOpen(false)}>
          <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="settings-modal-header">
              <h4>AI 配置</h4>
              <button
                type="button"
                className="settings-close"
                aria-label="关闭"
                onClick={() => setSettingsOpen(false)}
              >
                ✕
              </button>
            </div>
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

              <div className="settings-divider">备用厂商（主厂商无响应时自动接手，可选）</div>
              <label>
                备用厂商
                <select value={fallbackProvider} onChange={(e) => onFallbackProviderChange(e.target.value)}>
                  <option value="">不启用</option>
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              {fallbackProvider && (
                <>
                  <label>
                    备用模型
                    <select value={fallbackModel} onChange={(e) => setFallbackModel(e.target.value)}>
                      {fallbackModelOptions.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    备用 API Key {fallbackApiKeyMasked ? `（已配置 ${fallbackApiKeyMasked}）` : ''}
                    <input
                      type="password"
                      value={fallbackApiKey}
                      onChange={(e) => setFallbackApiKey(e.target.value)}
                      placeholder="输入备用厂商的 API Key"
                    />
                  </label>
                </>
              )}

              <button type="button" className="settings-save" onClick={saveSettings}>
                保存配置
              </button>
              {settingsMsg && <p className="msg">{settingsMsg}</p>}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
