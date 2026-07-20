import { useEffect, useState } from 'react'
import { fetchMonthRecords, type DaySummary, type RecordItem } from '../api/records'

export function useMonthRecords() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [days, setDays] = useState<DaySummary[]>([])
  const [recordsByDate, setRecordsByDate] = useState<Record<string, RecordItem[]>>({})
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

  const shiftMonth = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1)
    setYear(d.getFullYear())
    setMonth(d.getMonth() + 1)
  }

  return { year, month, days, recordsByDate, loading, loadMonth, shiftMonth }
}
