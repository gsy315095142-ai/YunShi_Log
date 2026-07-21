import { useEffect, useState } from 'react'
import type { TodayInfo } from '../api/records'
import ConfirmDialog from './ConfirmDialog'
import IconButton, { DeleteIcon, EditIcon } from './IconButton'
import './TodayCard.css'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

interface TodayCardProps {
  info: TodayInfo | null
  /** 返回 null 表示成功，否则为错误提示文案 */
  onCreate: (text: string) => Promise<string | null>
  onUpdate: (id: number, text: string) => Promise<string | null>
  onDelete: (id: number) => Promise<void>
  onFortune: () => void
}

/**
 * 今日卡片：今天的记录直接在这里看、写、改、删，无需再打开弹层。
 * 每天只有一条记录，卡片即记录本身。
 */
export default function TodayCard({ info, onCreate, onUpdate, onDelete, onFortune }: TodayCardProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // 外部数据刷新（保存/删除后）且不在编辑态时，同步草稿
  useEffect(() => {
    if (!editing) setDraft(info?.content ?? '')
  }, [info?.content, editing])

  if (!info) return null

  const d = new Date(`${info.date}T00:00:00`)
  const weekday = `周${WEEKDAYS[d.getDay()]}`
  // 农历字符串形如「丙午年 六月初七」，卡片只取月日部分
  const lunarDay = info.lunar.split(' ').slice(1).join(' ') || info.lunar
  const hasRecord = info.id !== null

  const startEdit = () => {
    setDraft(info.content ?? '')
    setError('')
    setEditing(true)
  }

  const cancelEdit = () => {
    setDraft(info.content ?? '')
    setError('')
    setEditing(false)
  }

  const save = async () => {
    const text = draft.trim()
    if (!text || saving) return
    setSaving(true)
    setError('')
    const err = hasRecord ? await onUpdate(info.id!, text) : await onCreate(text)
    setSaving(false)
    if (err) {
      setError(err)
    } else {
      setEditing(false)
    }
  }

  const remove = async () => {
    if (info.id === null) return
    await onDelete(info.id)
    setConfirming(false)
  }

  return (
    <div className="today-block">
      <div className="card today-card">
        <div className="today-header">
          <span className="today-tag">今天</span>
          <strong className="today-date">
            {d.getMonth() + 1}月{d.getDate()}日 {weekday}
          </strong>
          <span className="today-lunar">农历 {lunarDay}</span>
        </div>

        <div className="today-body">
          {hasRecord && !editing ? (
            <p className="today-content">{info.content}</p>
          ) : (
            <div className="today-editor">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="记录今天的大事小情…"
                rows={3}
                autoFocus={editing}
              />
              <div className="today-editor-actions">
                {editing && (
                  <button type="button" className="cancel-btn" onClick={cancelEdit}>
                    取消
                  </button>
                )}
                <button type="button" className="submit-btn" disabled={saving || !draft.trim()} onClick={save}>
                  {saving ? '保存中…' : '保存'}
                </button>
              </div>
            </div>
          )}
          {error && <p className="today-error">{error}</p>}
        </div>

        {hasRecord && !editing && (
          <div className="today-actions-row">
            <IconButton label="编辑" onClick={startEdit}>
              <EditIcon />
            </IconButton>
            <IconButton label="删除" danger onClick={() => setConfirming(true)}>
              <DeleteIcon />
            </IconButton>
          </div>
        )}

        <ConfirmDialog
          open={confirming && hasRecord}
          title="删除今天的记录？"
          content={info.content ?? ''}
          tip="删除后不可恢复"
          confirmText="确认删除"
          onConfirm={remove}
          onCancel={() => setConfirming(false)}
        />
      </div>

      {!editing && (
        <button type="button" className="today-fortune-btn" onClick={onFortune}>
          🔮 测算今日运势 ›
        </button>
      )}
    </div>
  )
}
