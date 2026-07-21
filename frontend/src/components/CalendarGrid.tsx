import { useMemo } from 'react'
import type { DaySummary } from '../api/records'
import './CalendarGrid.css'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

function pad(n: number) {
  return String(n).padStart(2, '0')
}

interface CalendarGridProps {
  year: number
  month: number
  days: DaySummary[]
  loading: boolean
  selectedDate: string | null
  onShiftMonth: (delta: number) => void
  onOpenDay: (date: string) => void
}

export default function CalendarGrid({
  year,
  month,
  days,
  loading,
  selectedDate,
  onShiftMonth,
  onOpenDay,
}: CalendarGridProps) {
  const today = new Date()

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

  return (
    <div className="card calendar-card">
      <div className="month-nav">
        <button type="button" onClick={() => onShiftMonth(-1)} aria-label="上个月">
          ◀
        </button>
        <strong>
          {year}年{month}月
        </strong>
        <button type="button" onClick={() => onShiftMonth(1)} aria-label="下个月">
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
                onClick={() => onOpenDay(date)}
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
  )
}
