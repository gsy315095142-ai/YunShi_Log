import { useState } from 'react'

type RecAsset = {
  id: string
  display_name?: string | null
  category_name?: string | null
  file_missing?: boolean
  file_url?: string | null
}

type Draft = {
  title: string
  hook: string
  body: string
  tags: string[]
  recommended_asset_ids: string[]
  asset_rationale: string
  disclaimer?: string
}

type GenerateResp = {
  ok: boolean
  parsed: boolean
  llm_error?: string | null
  parse_error?: string | null
  warnings: string[]
  catalog_asset_count_returned?: number
  draft: Draft | null
  recommended_assets: RecAsset[]
  raw_model_text?: string | null
  generation_raw_preview?: string | null
}

export function GenerateView(props: {
  notifyError: (message: string | null) => void
}) {
  const { notifyError } = props
  const [brief, setBrief] = useState('')
  const [withSkills, setWithSkills] = useState(true)
  const [maxPick, setMaxPick] = useState(6)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<GenerateResp | null>(null)

  const generate = async () => {
    const b = brief.trim()
    if (!b) {
      notifyError('请先填写 Brief（本次成稿诉求）')
      return
    }
    setBusy(true)
    notifyError(null)
    setResult(null)
    try {
      const r = await fetch('/api/generate/xiaohongshu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief: b,
          with_skills: withSkills,
          max_recommended_assets: maxPick,
        }),
      })
      const text = await r.text()
      if (!r.ok) throw new Error(text)
      const data = JSON.parse(text) as GenerateResp
      setResult(data)
    } catch (e) {
      notifyError(e instanceof Error ? e.message : '生成失败')
    } finally {
      setBusy(false)
    }
  }

  const draft = result?.draft

  const copyBody = async () => {
    if (!draft) return
    const chunk = [
      draft.title ? `【标题】${draft.title}` : '',
      draft.hook ? `【开头】${draft.hook}` : '',
      draft.body ? `【正文】\n${draft.body.replace(/\\n/g, '\n')}` : '',
      draft.tags?.length ? `【标签】 ${draft.tags.join(' ')}` : '',
      draft.asset_rationale ? `【配图说明】${draft.asset_rationale}` : '',
    ]
      .filter(Boolean)
      .join('\n\n')
    try {
      await navigator.clipboard.writeText(chunk)
    } catch {
      notifyError('复制失败（浏览器权限）')
    }
  }

  const recAssets = result?.recommended_assets ?? []

  return (
    <section className="card gen-shell">
      <div className="gen-head">
        <div>
          <h2 style={{ margin: 0 }}>小红书成稿</h2>
          <p className="hint gen-sub">
            根据 Brief 产出结构化草稿；配图仅能通过素材库 <code>id</code>
            推荐，服务端校验 id 并展示缩略图。调用主力 AI 的 OpenAI 兼容{' '}
            <code>/chat/completions</code>。
          </p>
        </div>
      </div>

      <label className="label">
        <span>Brief（需求 / 卖点 / 调性）</span>
        <textarea
          className="textarea"
          rows={6}
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="示例：主推一款无糖酸奶，受众是减重女生，语气轻松种草，要避免医疗承诺……"
          disabled={busy}
        />
      </label>

      <div className="gen-controls">
        <label className="check">
          <input
            type="checkbox"
            checked={withSkills}
            onChange={(e) => setWithSkills(e.target.checked)}
            disabled={busy}
          />
          <span>注入当前已勾选的 Skill</span>
        </label>
        <label className="gen-max">
          <span className="muted small">配图推荐上限（0～12）</span>
          <input
            type="number"
            className="input narrow-num"
            min={0}
            max={12}
            value={maxPick}
            onChange={(e) => setMaxPick(Number(e.target.value))}
            disabled={busy}
          />
        </label>
        <button
          type="button"
          className="btn primary"
          disabled={busy}
          onClick={() => void generate()}
        >
          {busy ? '生成中（可能需数十秒）…' : '生成成稿'}
        </button>
      </div>

      {typeof result?.catalog_asset_count_returned === 'number' ? (
        <p className="muted small gen-meta-inline">
          本次注入清单素材条数：{result.catalog_asset_count_returned}
        </p>
      ) : null}

      {result?.llm_error ? (
        <p className="warn compact-warn">模型未返回内容：{result.llm_error}</p>
      ) : null}

      {result?.parse_error ? (
        <p className="warn compact-warn">{result.parse_error}</p>
      ) : null}

      {result?.warnings?.length ? (
        <div className="warn-box">
          <div className="warn-box-title">提示</div>
          <ul className="warn-list">
            {result.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {draft ? (
        <div className="gen-result">
          <div className="row-actions spread">
            <h3 style={{ margin: 0 }}>草稿</h3>
            <button type="button" className="btn slim" onClick={() => void copyBody()}>
              复制正文区
            </button>
          </div>
          <div className="gen-block">
            <div className="gen-label">标题</div>
            <div className="gen-value">{draft.title}</div>
          </div>
          {draft.hook ? (
            <div className="gen-block">
              <div className="gen-label">开头钩子</div>
              <div className="gen-value">{draft.hook}</div>
            </div>
          ) : null}
          <div className="gen-block">
            <div className="gen-label">正文</div>
            <pre className="gen-pre">{draft.body.replace(/\\n/g, '\n')}</pre>
          </div>
          {draft.tags?.length ? (
            <div className="tag-row">
              {draft.tags.map((t) => (
                <span key={t} className="tag-pill">
                  {t}
                </span>
              ))}
            </div>
          ) : null}
          <div className="gen-block">
            <div className="gen-label">配图说明</div>
            <div className="gen-value">{draft.asset_rationale}</div>
          </div>

          <div className="gen-thumb-row">
            {recAssets.map((ra) => {
              const u =
                ra.file_url && ra.file_url.startsWith('/') ? ra.file_url : ''
              return (
                <figure key={ra.id} className="thumb-fig">
                  {u ? (
                    <img
                      src={u}
                      alt={ra.display_name ?? ra.id}
                      className="thumb-mini"
                    />
                  ) : (
                    <div className="thumb-missing-mini">无预览</div>
                  )}
                  <figcaption className="thumb-cap">
                    <span className="mono tiny">{ra.id.slice(0, 8)}…</span>
                    <span>{ra.display_name ?? ''}</span>
                    {ra.file_missing ? (
                      <span className="warn tiny"> · 磁盘缺失</span>
                    ) : null}
                  </figcaption>
                </figure>
              )
            })}
          </div>
        </div>
      ) : null}

      {result && !draft && result.raw_model_text ? (
        <details className="details-raw">
          <summary>查看模型原始响应（便于排错）</summary>
          <pre className="gen-pre">{result.raw_model_text}</pre>
        </details>
      ) : null}

      {draft && result?.generation_raw_preview ? (
        <details className="details-raw">
          <summary>查看已通过解析的原始 JSON 文本预览</summary>
          <pre className="gen-pre">{result.generation_raw_preview}</pre>
        </details>
      ) : null}
    </section>
  )
}
