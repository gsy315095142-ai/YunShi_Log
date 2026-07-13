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

  const shiftMonth = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1)
    setYear(d.getFullYear())
    setMonth(d.getMonth() + 1)
    setSelectedDate(null)
    setEditingId(null)
    setEditorText('')
  }

  const openDay = (day: number) => {
    const date = `${year}-${pad(month)}-${pad(day)}`
    setSelectedDate(date)
    setEditingId(null)
    setEditorText('')
    setMessage('')
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
  }

  const removeRecord = async (id: number) => {
    if (!confirm('确定删除这条记录？')) return
    await deleteRecord(id)
    loadMonth()
  }

  return (
    <div className="daily-page">
      <div className="card calendar-card">
        <div className="month-nav">
          <button type="button" onClick={() => shiftMonth(-1)}>
            ◀
          </button>
          <strong>
            {year}年{month}月
          </strong>
          <button type="button" onClick={() => shiftMonth(1)}>
            ▶
          </button>
        </div>
        <div className="weekday-row">
          {WEEKDAYS.map((w) => (
            <span key={w}>{w}</span>
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
                  }`}
                  onClick={() => openDay(day)}
                >
                  <span className="day-num">{day}</span>
                  {info && <span className="preview">{info.preview}</span>}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {selectedDate && (
        <div className="card day-panel">
          <h3>{selectedDate} 的记录</h3>
          {selectedRecords.length === 0 && <p className="empty-tip">暂无记录</p>}
          <ul className="record-list">
            {selectedRecords.map((item) => (
              <li key={item.id}>
                <p>{item.content}</p>
                <div className="actions">
                  <button type="button" onClick={() => startEdit(item)}>
                    编辑
                  </button>
                  <button type="button" className="danger" onClick={() => removeRecord(item.id)}>
                    删除
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <textarea
            value={editorText}
            onChange={(e) => setEditorText(e.target.value)}
            placeholder={editingId ? '编辑记录内容' : '新增记录内容'}
            rows={3}
          />
          <button type="button" onClick={submitRecord}>
            {editingId ? '更新记录' : '新增记录'}
          </button>
          {message && <p className="msg">{message}</p>}
        </div>
      )}
    </div>
  )
}
