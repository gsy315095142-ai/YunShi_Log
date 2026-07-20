/**
 * 自定义日期/时间下拉选择器。
 * 替代原生 <input type="date|time">：手机原生滚轮在日期列回绕时会连带改动月份，
 * 独立下拉各选各的，互不干扰。对外仍输出 'YYYY-MM-DD' / 'HH:MM' 字符串，后端契约不变。
 */

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: CURRENT_YEAR - 1919 }, (_, i) => CURRENT_YEAR - i)
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))

const pad2 = (n: number) => String(n).padStart(2, '0')

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

interface DateSelectProps {
  value: string // 'YYYY-MM-DD' 或 ''
  onChange: (v: string) => void
}

export function DateSelect({ value, onChange }: DateSelectProps) {
  const [y, m, d] = value ? value.split('-').map(Number) : [0, 0, 0]

  const update = (ny: number, nm: number, nd: number) => {
    // 年/月变化时，日超出当月天数则收敛（如 1月31日 → 2月28/29日）
    if (ny && nm) {
      const max = daysInMonth(ny, nm)
      if (nd > max) nd = max
    }
    onChange(ny && nm && nd ? `${ny}-${pad2(nm)}-${pad2(nd)}` : '')
  }

  return (
    <div className="dt-row">
      <select value={y || ''} onChange={(e) => update(Number(e.target.value), m, d)} aria-label="年">
        <option value="" disabled>
          年
        </option>
        {YEARS.map((yy) => (
          <option key={yy} value={yy}>
            {yy}
          </option>
        ))}
      </select>
      <select value={m || ''} onChange={(e) => update(y, Number(e.target.value), d)} aria-label="月">
        <option value="" disabled>
          月
        </option>
        {MONTHS.map((mm) => (
          <option key={mm} value={mm}>
            {mm}
          </option>
        ))}
      </select>
      <select value={d || ''} onChange={(e) => update(y, m, Number(e.target.value))} aria-label="日">
        <option value="" disabled>
          日
        </option>
        {Array.from({ length: y && m ? daysInMonth(y, m) : 31 }, (_, i) => i + 1).map((dd) => (
          <option key={dd} value={dd}>
            {dd}
          </option>
        ))}
      </select>
    </div>
  )
}

interface TimeSelectProps {
  value: string // 'HH:MM' 或 ''
  onChange: (v: string) => void
}

export function TimeSelect({ value, onChange }: TimeSelectProps) {
  const [hh, mm] = value ? value.split(':') : ['', '']

  const update = (h: string, m: string) => {
    if (!h) {
      onChange('')
    } else {
      onChange(`${h}:${m || '00'}`)
    }
  }

  return (
    <div className="dt-row">
      <select value={hh} onChange={(e) => update(e.target.value, mm)} aria-label="时">
        <option value="">未选择</option>
        {HOURS.map((h) => (
          <option key={h} value={h}>
            {h} 时
          </option>
        ))}
      </select>
      <select value={mm} onChange={(e) => update(hh || '00', e.target.value)} aria-label="分">
        <option value="">未选择</option>
        {MINUTES.map((m) => (
          <option key={m} value={m}>
            {m} 分
          </option>
        ))}
      </select>
    </div>
  )
}
