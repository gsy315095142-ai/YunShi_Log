import { apiFetch } from './client'

export interface RecordItem {
  id: number
  record_date: string
  content: string
  sort_order: number
}

export interface DaySummary {
  record_date: string
  preview: string
  count: number
}

export interface MonthRecords {
  year: number
  month: number
  days: DaySummary[]
  records_by_date: Record<string, RecordItem[]>
}

export interface TodayInfo {
  date: string
  lunar: string
  count: number
  previews: string[]
}

export async function fetchTodayInfo() {
  return apiFetch<TodayInfo>('/api/v1/records/today')
}

export async function fetchMonthRecords(year: number, month: number) {
  return apiFetch<MonthRecords>(`/api/v1/records?year=${year}&month=${month}`)
}

export async function fetchDayRecords(date: string) {
  return apiFetch<RecordItem[]>(`/api/v1/records/${date}`)
}

export async function createRecord(record_date: string, content: string) {
  return apiFetch<RecordItem>('/api/v1/records', {
    method: 'POST',
    body: JSON.stringify({ record_date, content }),
  })
}

export async function updateRecord(id: number, content: string) {
  return apiFetch<RecordItem>(`/api/v1/records/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  })
}

export async function deleteRecord(id: number) {
  return apiFetch<{ ok: boolean }>(`/api/v1/records/${id}`, { method: 'DELETE' })
}
