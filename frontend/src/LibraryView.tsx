import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export type CategoryRow = {
  id: string
  name: string
  asset_count: number
}

export type AssetRow = {
  id: string
  category_id: string
  display_name: string
  original_filename: string
  notes: string
  absolute_path: string
  updated_at_ms: number
  file_missing: boolean
  file_url: string
}

type Overview = {
  effective_assets_root: string
  manifest_path: string
  categories: CategoryRow[]
  assets: AssetRow[]
  storage: {
    asset_count: number
    disk_bytes_used: number
    missing_files: number
    library_manifest_filename: string
  }
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB'] as const
  let i = 0
  let n = bytes
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i += 1
  }
  const digits = i === 0 ? 0 : n >= 10 ? 1 : 2
  return `${n.toFixed(digits)} ${units[i]}`
}

export function LibraryView(props: {
  notifyError: (message: string | null) => void
  onOpenSettings?: () => void
}) {
  const { notifyError, onOpenSettings } = props
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const [overview, setOverview] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(false)
  const [filterCat, setFilterCat] = useState<string>('__all__')
  const [newCatName, setNewCatName] = useState('')
  const [renameFor, setRenameFor] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const [drafts, setDrafts] = useState<
    Record<
      string,
      { display_name: string; notes: string; category_id: string }
    >
  >({})

  const refresh = useCallback(async () => {
    setLoading(true)
    notifyError(null)
    try {
      const r = await fetch('/api/library/overview')
      if (!r.ok) throw new Error(await r.text())
      const data = (await r.json()) as Overview
      setOverview(data)

      const d: Record<string, { display_name: string; notes: string; category_id: string }> =
        {}
      for (const a of data.assets) {
        d[a.id] = {
          display_name: a.display_name,
          notes: a.notes,
          category_id: a.category_id,
        }
      }
      setDrafts(d)
      if (
        filterCat !== '__all__' &&
        !data.categories.some((c) => c.id === filterCat)
      ) {
        setFilterCat('__all__')
      }
    } catch (e) {
      setOverview(null)
      notifyError(e instanceof Error ? e.message : '读取素材库失败')
    } finally {
      setLoading(false)
    }
  }, [filterCat, notifyError])

  useEffect(() => {
    void refresh()
    // 首次挂载拉取即可；刷新由按钮与写操作触发。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filteredAssets = useMemo(() => {
    if (!overview) return []
    if (filterCat === '__all__') return overview.assets
    return overview.assets.filter((a) => a.category_id === filterCat)
  }, [overview, filterCat])

  const uploadTargetCategory = filterCat !== '__all__' ? filterCat : overview?.categories[0]?.id

  const onUploadPick = async (files: FileList | null) => {
    if (!files?.length || !overview) return
    const cid = uploadTargetCategory
    if (!cid) {
      notifyError('请先选择或创建一个分类后再上传')
      return
    }
    notifyError(null)
    for (const f of Array.from(files)) {
      const fd = new FormData()
      fd.set('category_id', cid)
      fd.set('file', f)
      try {
        const r = await fetch('/api/library/assets', { method: 'POST', body: fd })
        if (!r.ok) throw new Error(await r.text())
      } catch (e) {
        notifyError(e instanceof Error ? e.message : '上传失败')
        break
      }
    }
    await refresh()
  }

  const addCategory = async () => {
    const name = newCatName.trim()
    if (!name) return
    try {
      const r = await fetch('/api/library/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!r.ok) throw new Error(await r.text())
      setNewCatName('')
      await refresh()
    } catch (e) {
      notifyError(e instanceof Error ? e.message : '创建分类失败')
    }
  }

  const commitRename = async () => {
    const id = renameFor
    const name = renameValue.trim()
    if (!id || !name) return
    try {
      const r = await fetch(`/api/library/categories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!r.ok) throw new Error(await r.text())
      setRenameFor(null)
      setRenameValue('')
      await refresh()
    } catch (e) {
      notifyError(e instanceof Error ? e.message : '重命名失败')
    }
  }

  const removeCategory = async (cid: string) => {
    if (
      !window.confirm(
        '确定删除该分类？（分类下不能有素材；若为空分类才会成功）',
      )
    )
      return
    try {
      const r = await fetch(`/api/library/categories/${cid}`, { method: 'DELETE' })
      if (!r.ok) throw new Error(await r.text())
      await refresh()
    } catch (e) {
      notifyError(e instanceof Error ? e.message : '删除分类失败')
    }
  }

  const saveAssetDraft = async (assetId: string) => {
    const d = drafts[assetId]
    if (!d) return
    try {
      const r = await fetch(`/api/library/assets/${assetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: d.display_name,
          notes: d.notes,
          category_id: d.category_id,
        }),
      })
      if (!r.ok) throw new Error(await r.text())
      await refresh()
    } catch (e) {
      notifyError(e instanceof Error ? e.message : '保存素材失败')
    }
  }

  const deleteAssetRow = async (assetId: string) => {
    if (!window.confirm('确定删除该素材？磁盘文件将一并移除。')) return
    try {
      const r = await fetch(`/api/library/assets/${assetId}`, {
        method: 'DELETE',
      })
      if (!r.ok) throw new Error(await r.text())
      await refresh()
    } catch (e) {
      notifyError(e instanceof Error ? e.message : '删除素材失败')
    }
  }

  return (
    <div className="library">
      <section className="card">
        <input
          ref={uploadInputRef}
          type="file"
          accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.tif,.tiff"
          multiple
          hidden
          onChange={(e) => void onUploadPick(e.target.files)}
        />
        <div className="row-actions spread lib-head">
          <h2 style={{ margin: 0 }}>素材库</h2>
          <div className="row-actions" style={{ marginTop: 0 }}>
            <button
              type="button"
              className="btn primary slim"
              disabled={!overview || loading}
              onClick={() => uploadInputRef.current?.click()}
            >
              上传素材
            </button>
            <button
              type="button"
              className="btn slim"
              onClick={() => onOpenSettings?.()}
            >
              存储路径
            </button>
            <button
              type="button"
              className="btn slim"
              disabled={loading}
              onClick={() => void refresh()}
            >
              {loading ? '刷新中…' : '刷新'}
            </button>
          </div>
        </div>

        {!overview ? (
          <p className="hint">尚未加载素材数据。</p>
        ) : (
          <>
            <div className="lib-stats">
              <div>
                <div className="stat-label">生效素材目录</div>
                <div className="stat-value path">{overview.effective_assets_root}</div>
              </div>
              <div>
                <div className="stat-label">清单文件（JSON）</div>
                <div className="stat-value path">{overview.manifest_path}</div>
              </div>
              <div>
                <div className="stat-label">磁盘占用（已存在文件）</div>
                <div className="stat-value">{formatBytes(overview.storage.disk_bytes_used)}</div>
                <div className="muted small">
                  素材条数：{overview.storage.asset_count}；磁盘缺失或未读：{overview.storage.missing_files}
                </div>
              </div>
            </div>

            <div className="library-layout">
              <aside className="lib-aside">
                <div className="aside-title">分类</div>
                <button
                  type="button"
                  className={
                    filterCat === '__all__' ? 'cat-pill cat-pill-active' : 'cat-pill'
                  }
                  onClick={() => setFilterCat('__all__')}
                >
                  全部素材
                </button>
                {(overview.categories ?? []).map((c) => (
                  <div key={c.id} className="cat-block">
                    <button
                      type="button"
                      className={
                        filterCat === c.id ? 'cat-pill cat-pill-active' : 'cat-pill'
                      }
                      onClick={() => setFilterCat(c.id)}
                      title={`${c.asset_count} 条`}
                    >
                      {c.name}
                      <span className="cat-count">{c.asset_count}</span>
                    </button>
                    <div className="cat-mini-actions">
                      <button
                        type="button"
                        className="linkish"
                        onClick={() => {
                          setRenameFor(c.id)
                          setRenameValue(c.name)
                        }}
                      >
                        重命名
                      </button>
                      <button
                        type="button"
                        className="linkish danger"
                        onClick={() => void removeCategory(c.id)}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ))}
                <div className="new-cat">
                  <input
                    className="input"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="新分类名称"
                  />
                  <button type="button" className="btn primary slim" onClick={() => void addCategory()}>
                    添加分类
                  </button>
                </div>
              </aside>

              <div className="lib-main">
                {renameFor ? (
                  <div className="rename-bar">
                    <span className="muted">分类重命名</span>
                    <input
                      className="input"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                    />
                    <button type="button" className="btn" onClick={() => void commitRename()}>
                      保存
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        setRenameFor(null)
                        setRenameValue('')
                      }}
                    >
                      取消
                    </button>
                  </div>
                ) : null}

                <div className="upload-bar">
                  <button
                    type="button"
                    className="btn primary slim"
                    onClick={() => uploadInputRef.current?.click()}
                  >
                    选择图片上传
                  </button>
                  <span className="hint-inline">
                    目标分类：
                    <strong>{uploadTargetCategory ? '已选' : '（无）'}</strong>
                    {filterCat !== '__all__'
                      ? ` · 当前筛选 "${overview.categories.find((c) => c.id === filterCat)?.name ?? ''}"`
                      : ` · 「全部素材」时使用列表中的第一个分类作为上传默认`}
                  </span>
                </div>

                {filteredAssets.length === 0 ? (
                  <p className="hint">当前筛选下暂无素材。</p>
                ) : (
                  <div className="asset-grid">
                    {filteredAssets.map((a) => {
                      const d = drafts[a.id]
                      const src =
                        !a.file_missing && a.file_url.startsWith('/')
                          ? `${a.file_url}?t=${a.updated_at_ms}`
                          : undefined
                      return (
                        <article key={a.id} className="asset-card">
                          <div className="thumb-wrap">
                            {src ? (
                              <img src={src} alt={a.display_name} className="thumb" />
                            ) : (
                              <div className="thumb-missing">
                                {a.file_missing ? '文件缺失或不可读' : '无法预览'}
                              </div>
                            )}
                          </div>
                          <div className="asset-body">
                            <label className="mini-label">展示名称</label>
                            <input
                              className="input"
                              value={d?.display_name ?? ''}
                              onChange={(e) =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [a.id]: {
                                    ...(prev[a.id] ?? {
                                      display_name: '',
                                      notes: '',
                                      category_id: a.category_id,
                                    }),
                                    display_name: e.target.value,
                                  },
                                }))
                              }
                            />
                            <label className="mini-label">分类</label>
                            <select
                              className="input"
                              value={d?.category_id ?? a.category_id}
                              onChange={(e) =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [a.id]: {
                                    ...(prev[a.id] ?? {
                                      display_name: a.display_name,
                                      notes: a.notes,
                                      category_id: a.category_id,
                                    }),
                                    category_id: e.target.value,
                                  },
                                }))
                              }
                            >
                              {overview.categories.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                            <label className="mini-label">备注（选填）</label>
                            <textarea
                              className="textarea"
                              rows={3}
                              value={d?.notes ?? ''}
                              onChange={(e) =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [a.id]: {
                                    ...(prev[a.id] ?? {
                                      display_name: a.display_name,
                                      notes: '',
                                      category_id: a.category_id,
                                    }),
                                    notes: e.target.value,
                                  },
                                }))
                              }
                            />
                            <div className="asset-meta muted small">
                              原名：{a.original_filename}
                            </div>
                            <div className="row-actions">
                              <button
                                type="button"
                                className="btn primary slim"
                                onClick={() => void saveAssetDraft(a.id)}
                              >
                                保存更改
                              </button>
                              <button
                                type="button"
                                className="btn slim danger-outline"
                                onClick={() => void deleteAssetRow(a.id)}
                              >
                                删除
                              </button>
                            </div>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
