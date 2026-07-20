import type { TodayInfo } from '../api/records'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

interface TodayCardProps {
  info: TodayInfo | null
  onOpen: (date: string) => void
}

export default function TodayCard({ info, onOpen }: TodayCardProps) {
  if (!info) return null
  const d = new Date(`${info.date}T00:00:00`)
  const weekday = `周${WEEKDAYS[d.getDay()]}`
  // 农历字符串形如「己巳年 六月初七」，卡片只取月日部分
  const lunarDay = info.lunar.split(' ').slice(1).join(' ') || info.lunar

  return (
    <div className="card today-card" onClick={() => onOpen(info.date)}>
      <div className="today-left">
        <span className="today-tag">今天</span>
        <strong className="today-date">
          {d.getMonth() + 1}月{d.getDate()}日 {weekday}
        </strong>
        <span className="today-lunar">农历 {lunarDay}</span>
      </div>
      <div className="today-right">
        {info.count > 0 ? (
          <div className="today-records">
            <span className="today-count">今日 {info.count} 条记录</span>
            {info.previews.map((p, i) => (
              <span key={i} className="today-preview">
                · {p}
              </span>
            ))}
          </div>
        ) : (
          <span className="today-empty">今天还没有记录</span>
        )}
        <span className="today-cta">{info.count > 0 ? '查看 ›' : '＋ 记一笔'}</span>
      </div>
    </div>
  )
}
