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
  // 农历字符串形如「丙午年 六月初七」，卡片只取月日部分
  const lunarDay = info.lunar.split(' ').slice(1).join(' ') || info.lunar

  return (
    <div className="card today-card" onClick={() => onOpen(info.date)}>
      <div className="today-header">
        <span className="today-tag">今天</span>
        <strong className="today-date">
          {d.getMonth() + 1}月{d.getDate()}日 {weekday}
        </strong>
        <span className="today-lunar">农历 {lunarDay}</span>
      </div>
      <div className="today-body">
        {info.content ? (
          <p className="today-content">{info.content}</p>
        ) : (
          <p className="today-empty">今天还没有记录，写下第一条吧</p>
        )}
      </div>
      <div className="today-footer">
        <span className="today-cta">{info.content ? '查看 / 编辑 ›' : '＋ 记一笔'}</span>
      </div>
    </div>
  )
}
