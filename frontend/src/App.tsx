import { useCallback, useEffect, useRef, useState } from 'react'
import { ChatView } from './ChatView'
import { GenerateView } from './GenerateView'
import { LibraryView } from './LibraryView'
import './App.css'

type WorkspaceTab = 'library' | 'chat' | 'generate' | 'settings'

type Health = { ok: boolean; service: string }
type Meta = {
  repo_root: string
  skills_dir: string
  data_dir: string
  default_assets_root: string
  settings_file: string
  library_manifest_file?: string
  library_manifest_filename?: string
  chat_index_file?: string
  chat_dir?: string
  data_dir_override_env: string
}
type AIMasked = {
  base_url: string
  model: string
  capability: 'text' | 'text_vision'
  api_key_set: boolean
}
type SettingsResp = {
  version: number
  primary_ai: AIMasked
  vision_ai: AIMasked
  assets_root: string
  assets_root_effective: string
}
type SkillItem = { filename: string; selected: boolean }
type SkillsResp = { items: SkillItem[]; skills: string[] }

const CAP_OPTS: { v: AIMasked['capability']; label: string }[] = [
  { v: 'text', label: '纯文本' },
  { v: 'text_vision', label: '文本 + 识图（多模态）' },
]

function App() {
  const [tab, setTab] = useState<WorkspaceTab>('library')

  const [health, setHealth] = useState<Health | null>(null)
  const [meta, setMeta] = useState<Meta | null>(null)
  const [networkError, setNetworkError] = useState<string | null>(null)

  const [settings, setSettings] = useState<SettingsResp | null>(null)
  const [primBase, setPrimBase] = useState('')
  const [primModel, setPrimModel] = useState('')
  const [primCap, setPrimCap] = useState<AIMasked['capability']>('text')
  const [primKey, setPrimKey] = useState('')
  const [primTouchedKey, setPrimTouchedKey] = useState(false)

  const [visBase, setVisBase] = useState('')
  const [visModel, setVisModel] = useState('')
  const [visCap, setVisCap] = useState<AIMasked['capability']>('text_vision')
  const [visKey, setVisKey] = useState('')
  const [visTouchedKey, setVisTouchedKey] = useState(false)

  const [assetsRoot, setAssetsRoot] = useState('')

  const [skillItems, setSkillItems] = useState<SkillItem[]>([])
  const [skillSaving, setSkillSaving] = useState(false)

  const [bundledText, setBundledText] = useState('')
  const [bundledLoading, setBundledLoading] = useState(false)

  const [settingsMsg, setSettingsMsg] = useState<string | null>(null)
  const [settingsSaving, setSettingsSaving] = useState(false)

  const prefTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hydrateSettings = useCallback((s: SettingsResp) => {
    setSettings(s)
    setPrimBase(s.primary_ai.base_url)
    setPrimModel(s.primary_ai.model)
    setPrimCap(s.primary_ai.capability)
    setPrimKey('')
    setPrimTouchedKey(false)
    setVisBase(s.vision_ai.base_url)
    setVisModel(s.vision_ai.model)
    setVisCap(s.vision_ai.capability)
    setVisKey('')
    setVisTouchedKey(false)
    setAssetsRoot(s.assets_root)
  }, [])

  const bootstrap = useCallback(async () => {
    setNetworkError(null)
    setSettingsMsg(null)
    try {
      const [h, m, cfg, skills] = await Promise.all([
        fetch('/api/health').then((r) => r.json()),
        fetch('/api/meta').then((r) => r.json()),
        fetch('/api/settings').then((r) => r.json()),
        fetch('/api/skills').then((r) => r.json()),
      ])
      setHealth(h as Health)
      setMeta(m as Meta)
      hydrateSettings(cfg as SettingsResp)
      const si = skills as SkillsResp
      setSkillItems(si.items ?? [])
    } catch (e) {
      setHealth(null)
      setMeta(null)
      setSettings(null)
      setSkillItems([])
      setNetworkError(e instanceof Error ? e.message : '请求失败')
    }
  }, [hydrateSettings])

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  const persistSkillSelection = useCallback(async (next: SkillItem[]) => {
    setSkillSaving(true)
    try {
      const selected = next.filter((i) => i.selected).map((i) => i.filename)
      const r = await fetch('/api/skills/selection', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selected }),
      })
      if (!r.ok) throw new Error(await r.text())
      const body = await r.json()
      setSkillItems(body.items ?? next)
    } catch (e) {
      setNetworkError(e instanceof Error ? e.message : 'Skill 勾选保存失败')
    } finally {
      setSkillSaving(false)
    }
  }, [])

  const queueSkillPersist = useCallback(
    (next: SkillItem[]) => {
      if (prefTimer.current) clearTimeout(prefTimer.current)
      prefTimer.current = setTimeout(() => {
        prefTimer.current = null
        void persistSkillSelection(next)
      }, 450)
    },
    [persistSkillSelection],
  )

  useEffect(() => {
    return () => {
      if (prefTimer.current) clearTimeout(prefTimer.current)
    }
  }, [])

  const toggleSkill = (filename: string) => {
    const next = skillItems.map((i) =>
      i.filename === filename ? { ...i, selected: !i.selected } : i,
    )
    setSkillItems(next)
    queueSkillPersist(next)
  }

  const selectAllSkills = (on: boolean) => {
    const next = skillItems.map((i) => ({ ...i, selected: on }))
    setSkillItems(next)
    queueSkillPersist(next)
  }

  const loadBundled = async () => {
    setBundledLoading(true)
    setBundledText('')
    try {
      const r = await fetch('/api/skills/bundled')
      if (!r.ok) throw new Error(await r.text())
      const body = await r.json()
      setBundledText(body.text ?? '')
    } catch (e) {
      setNetworkError(e instanceof Error ? e.message : '加载合并文本失败')
    } finally {
      setBundledLoading(false)
    }
  }

  const saveAiSettings = async () => {
    setSettingsSaving(true)
    setSettingsMsg(null)
    try {
      const body: Record<string, unknown> = {
        assets_root: assetsRoot,
      }
      const primary_ai: Record<string, string> = {
        base_url: primBase,
        model: primModel,
        capability: primCap,
      }
      if (primTouchedKey) primary_ai.api_key = primKey
      const vision_ai: Record<string, string> = {
        base_url: visBase,
        model: visModel,
        capability: visCap,
      }
      if (visTouchedKey) vision_ai.api_key = visKey

      body.primary_ai = primary_ai
      body.vision_ai = vision_ai

      const r = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) throw new Error(await r.text())
      const cfg = (await r.json()) as SettingsResp
      hydrateSettings(cfg)
      setSettingsMsg('已保存，并已立即生效')
    } catch (e) {
      setSettingsMsg(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSettingsSaving(false)
    }
  }

  return (
    <main className="shell">
      <header className="header header-row">
        <div>
          <h1>营销素材工作台</h1>
          <p className="tag">P5 · 识图按需编排</p>
        </div>
        <nav className="tabs" aria-label="工作区切换">
          <button
            type="button"
            className={tab === 'library' ? 'tab tab-active' : 'tab'}
            onClick={() => setTab('library')}
          >
            素材库
          </button>
          <button
            type="button"
            className={tab === 'chat' ? 'tab tab-active' : 'tab'}
            onClick={() => setTab('chat')}
          >
            对话
          </button>
          <button
            type="button"
            className={tab === 'generate' ? 'tab tab-active' : 'tab'}
            onClick={() => setTab('generate')}
          >
            成稿
          </button>
          <button
            type="button"
            className={tab === 'settings' ? 'tab tab-active' : 'tab'}
            onClick={() => setTab('settings')}
          >
            设置与 Skill
          </button>
        </nav>
      </header>

      {networkError ? (
        <p className="warn banner">
          网络或接口异常：{networkError}（可先启动后端{' '}
          <code>uvicorn app.main:app --reload --port 8000</code>，再点
          <button type="button" className="btn-inline" onClick={() => void bootstrap()}>
            重新加载
          </button>
          ）
        </p>
      ) : null}

      {tab === 'library' ? (
        <LibraryView notifyError={(m) => setNetworkError(m)} />
      ) : null}

      {tab === 'chat' ? (
        <ChatView notifyError={(m) => setNetworkError(m)} />
      ) : null}

      {tab === 'generate' ? (
        <GenerateView notifyError={(m) => setNetworkError(m)} />
      ) : null}

      {tab === 'settings' ? (
        <>
          <section className="card compact">
            <h2>系统状态</h2>
            {!health ? (
              !networkError && <p>加载中…</p>
            ) : (
              <dl className="kv">
                <dt>健康检查</dt>
                <dd>{health.ok ? '正常' : '异常'}</dd>
              </dl>
            )}
          </section>

          {meta ? (
            <section className="card compact">
              <h2>路径约定</h2>
              <dl className="kv">
                <dt>配置文件</dt>
                <dd className="path">{meta.settings_file}</dd>
                {meta.library_manifest_file ? (
                  <>
                    <dt>素材清单</dt>
                    <dd className="path">{meta.library_manifest_file}</dd>
                  </>
                ) : null}
                {meta.chat_index_file ? (
                  <>
                    <dt>对话索引</dt>
                    <dd className="path">{meta.chat_index_file}</dd>
                  </>
                ) : null}
                {meta.chat_dir ? (
                  <>
                    <dt>对话消息目录</dt>
                    <dd className="path">{meta.chat_dir}</dd>
                  </>
                ) : null}
                <dt>Skill 目录</dt>
                <dd className="path">{meta.skills_dir}</dd>
                <dt>数据目录</dt>
                <dd className="path">{meta.data_dir}</dd>
                <dt>默认素材根目录</dt>
                <dd className="path">{meta.default_assets_root}</dd>
              </dl>
              <p className="hint">
                可选：环境变量 <code>{meta.data_dir_override_env}</code>{' '}
                覆盖数据目录。
              </p>
            </section>
          ) : null}

          {settings ? (
            <section className="card">
          <h2>AI 与素材配置</h2>
          <p className="hint">
            API Key 仅写入本机配置文件，响应中永远不返回明文。若不修改密钥，请不要编辑密钥输入框；若清空密钥并保存，将删除本地已保存的密钥。
          </p>

          <fieldset className="fieldset">
            <legend>主力 AI</legend>
            <label className="label">
              <span>Base URL</span>
              <input
                className="input"
                value={primBase}
                onChange={(e) => setPrimBase(e.target.value)}
                placeholder="例如 OpenAI 兼容接口地址"
                autoComplete="off"
              />
            </label>
            <label className="label">
              <span>模型名</span>
              <input
                className="input"
                value={primModel}
                onChange={(e) => setPrimModel(e.target.value)}
                autoComplete="off"
              />
            </label>
            <label className="label">
              <span>能力</span>
              <select
                className="input"
                value={primCap}
                onChange={(e) =>
                  setPrimCap(e.target.value as AIMasked['capability'])
                }
              >
                {CAP_OPTS.map((o) => (
                  <option key={o.v} value={o.v}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="label">
              <span>
                API Key
                {settings.primary_ai.api_key_set ? (
                  <em className="sub">（已保存，编辑以替换或清空）</em>
                ) : (
                  <em className="sub">（尚未配置）</em>
                )}
              </span>
              <input
                className="input mono"
                type="password"
                value={primKey}
                placeholder={settings.primary_ai.api_key_set ? '············' : ''}
                onChange={(e) => {
                  setPrimKey(e.target.value)
                  setPrimTouchedKey(true)
                }}
                autoComplete="off"
              />
            </label>
          </fieldset>

          <fieldset className="fieldset">
            <legend>识图 AI</legend>
            <label className="label">
              <span>Base URL</span>
              <input
                className="input"
                value={visBase}
                onChange={(e) => setVisBase(e.target.value)}
                autoComplete="off"
              />
            </label>
            <label className="label">
              <span>模型名</span>
              <input
                className="input"
                value={visModel}
                onChange={(e) => setVisModel(e.target.value)}
                autoComplete="off"
              />
            </label>
            <label className="label">
              <span>能力</span>
              <select
                className="input"
                value={visCap}
                onChange={(e) =>
                  setVisCap(e.target.value as AIMasked['capability'])
                }
              >
                {CAP_OPTS.map((o) => (
                  <option key={o.v} value={o.v}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="label">
              <span>
                API Key
                {settings.vision_ai.api_key_set ? (
                  <em className="sub">（已保存）</em>
                ) : (
                  <em className="sub">（尚未配置）</em>
                )}
              </span>
              <input
                className="input mono"
                type="password"
                value={visKey}
                placeholder={settings.vision_ai.api_key_set ? '············' : ''}
                onChange={(e) => {
                  setVisKey(e.target.value)
                  setVisTouchedKey(true)
                }}
                autoComplete="off"
              />
            </label>
          </fieldset>

          <label className="label">
            <span>自定义素材根目录（留空则用默认）</span>
            <input
              className="input mono"
              value={assetsRoot}
              onChange={(e) => setAssetsRoot(e.target.value)}
              placeholder="示例：D:\\素材库\\MarketingAssets"
              autoComplete="off"
            />
          </label>

          <p className="hint">
            当前生效：<span className="path">{settings.assets_root_effective}</span>
          </p>

          <div className="row-actions">
            <button
              type="button"
              className="btn primary"
              disabled={settingsSaving}
              onClick={() => void saveAiSettings()}
            >
              {settingsSaving ? '保存中…' : '保存配置'}
            </button>
            {settingsMsg ? <span className="muted">{settingsMsg}</span> : null}
          </div>
            </section>
          ) : (
            !networkError && (
              <section className="card">
                <p>加载设置中…</p>
              </section>
            )
          )}

          <section className="card">
            <div className="row-actions spread">
              <h2 style={{ margin: 0 }}>Skill 勾选</h2>
              <div className="row-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => selectAllSkills(true)}
                  disabled={skillItems.length === 0}
                >
                  全选
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => selectAllSkills(false)}
                  disabled={skillItems.length === 0}
                >
                  全不选
                </button>
                {skillSaving ? (
                  <span className="muted">正在保存勾选…</span>
                ) : null}
              </div>
            </div>
            {skillItems.length === 0 ? (
              <p className="hint">
                暂无 <code>.md</code> 文件（请将 Skill 放到仓库根的{' '}
                <code>skills/</code>）。
              </p>
            ) : (
              <ul className="checklist">
                {skillItems.map((i) => (
                  <li key={i.filename}>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={i.selected}
                        onChange={() => toggleSkill(i.filename)}
                      />
                      <span className="mono">{i.filename}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <div className="row-actions">
              <button
                type="button"
                className="btn"
                onClick={() => void loadBundled()}
              >
                {bundledLoading ? '读取中…' : '预览已选 Skill 合并文本'}
              </button>
            </div>
            {bundledText ? (
              <pre className="bundled">{bundledText}</pre>
            ) : bundledLoading ? (
              <p className="hint">正在向后端读取合并正文…</p>
            ) : null}
          </section>
        </>
      ) : null}
    </main>
  )
}

export default App
