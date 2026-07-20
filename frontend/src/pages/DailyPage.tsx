import { useEffect, useMemo, useState } from 'react'
import {
  createRecord,
  deleteRecord,
  fetchMonthRecords,
  updateRecord,
  type RecordItem,
} from '../api/records'
import { ApiError } from '../api/client'
import './DailyPage.css'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export default function DailyPage() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [days, setDays] = useState<{ record_date: string; preview: string; count: number }[]>([])
  const [recordsByDate, setRecordsByDate] = useState<Record<string, RecordItem[]>>({})
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [editorText, setEditorText] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  const loadMonth = () => {
    setLoading(true)
    fetchMonthRecords(year, month)
      .then((data) => {
        setDays(data.days)
        setRecordsByDate(data.records_by_date)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadMonth()
  }, [year, month])

  const dayMap = useMemo(() => {
    const map = new Map<string, { preview: string; count: number }>()
    days.forEach((d) => map.set(d.record_date, { preview: d.preview, count: d.count }))
    return map
  }, [days])

  const firstWeekday = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const resetEditor = () => {
    setEditingId(null)
    setEditorText('')
    setConfirmingDeleteId(null)
    setMessage('')
  }

  const shiftMonth = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1)
    setYear(d.getFullYear())
    setMonth(d.getMonth() + 1)
    setSelectedDate(null)
    resetEditor()
  }

  const openDay = (day: number) => {
    const date = `${year}-${pad(month)}-${pad(day)}`
    setSelectedDate(date)
    resetEditor()
  }

  const closeDay = () => {
    setSelectedDate(null)
    resetEditor()
  }

  const selectedRecords = selectedDate ? recordsByDate[selectedDate] || [] : []

  const submitRecord = async () => {
    if (!selectedDate || !editorText.trim()) return
    setMessage('')
    try {
      if (editingId) {
        await updateRecord(editingId, editorText.trim())
      } else {
        await createRecord(selectedDate, editorText.trim())
      }
      setEditorText('')
      setEditingId(null)
      loadMonth()
      setMessage('已保存')
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : '保存失败')
    }
  }

  const startEdit = (item: RecordItem) => {
    setEditingId(item.id)
    setEditorText(item.content)
    setConfirmingDeleteId(null)
    setMessage('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditorText('')
  }

  const removeRecord = async (id: number) => {
    if (confirmingDeleteId !== id) {
      setConfirmingDeleteId(id)
      return
    }
    await deleteRecord(id)
    setConfirmingDeleteId(null)
    if (editingId === id) cancelEdit()
    loadMonth()
  }

  return (
    <div className="daily-page">
      <div className="card calendar-card">
        <div className="month-nav">
          <button type="button" onClick={() => shiftMonth(-1)} aria-label="上个月">
            ◀
          </button>
          <strong>
            {year}年{month}月
          </strong>
          <button type="button" onClick={() => shiftMonth(1)} aria-label="下个月">
            ▶
          </button>
        </div>
        <div className="weekday-row">
          {WEEKDAYS.map((w, i) => (
            <span key={w} className={i === 0 || i === 6 ? 'weekend' : ''}>
              {w}
            </span>
          ))}
        </div>
        {loading ? (
          <p className="loading">加载中...</p>
        ) : (
          <div className="calendar-grid">
            {cells.map((day, idx) => {
              if (day === null) return <div key={`e-${idx}`} className="cell empty" />
              const date = `${year}-${pad(month)}-${pad(day)}`
              const info = dayMap.get(date)
              const isToday =
                day === today.getDate() &&
                month === today.getMonth() + 1 &&
                year === today.getFullYear()
              return (
                <button
                  key={date}
                  type="button"
                  className={`cell day ${info ? 'has-record' : ''} ${isToday ? 'today' : ''} ${
                    selectedDate === date ? 'selected' : ''
                  } ${idx % 7 === 0 || idx % 7 === 6 ? 'weekend' : ''}`}
                  onClick={() => openDay(day)}
                >
                  <span className="day-top">
                    <span className="day-num">{day}</span>
                    {info && info.count > 1 && <span className="count-badge">{info.count}</span>}
                  </span>
                  {info && <span className="preview">{info.preview}</span>}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {selectedDate && (
        <div className="sheet-backdrop" onClick={closeDay}>
          <div className="card day-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-header">
              <h3>{selectedDate} 的记录</h3>
              <button type="button" className="sheet-close" onClick={closeDay} aria-label="关闭">
                ✕
              </button>
            </div>
            <div className="sheet-body">
              {selectedRecords.length === 0 && <p className="empty-tip">暂无记录，写下今天的第一条吧</p>}
              <ul className="record-list">
                {selectedRecords.map((item) => (
                  <li key={item.id} className={editingId === item.id ? 'editing' : ''}>
                    <p>{item.content}</p>
                    <div className="actions">
                      <button type="button" onClick={() => startEdit(item)}>
                        编辑
                      </button>
                      <button
                        type="button"
                        className={confirmingDeleteId === item.id ? 'danger confirming' : 'danger'}
                        onClick={() => removeRecord(item.id)}
                      >
                        {confirmingDeleteId === item.id ? '确认删除' : '删除'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="sheet-editor">
              <textarea
                value={editorText}
                onChange={(e) => setEditorText(e.target.value)}
                placeholder={editingId ? '编辑记录内容' : '新增记录内容'}
                rows={3}
              />
              <div className="editor-actions">
                {editingId && (
                  <button type="button" className="cancel-btn" onClick={cancelEdit}>
                    取消编辑
                  </button>
                )}
                <button type="button" className="submit-btn" onClick={submitRecord}>
                  {editingId ? '更新记录' : '新增记录'}
                </button>
              </div>
              {message && <p className="msg">{message}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
