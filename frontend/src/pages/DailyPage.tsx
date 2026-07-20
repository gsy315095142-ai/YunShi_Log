import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  createRecord,
  deleteRecord,
  fetchTodayInfo,
  updateRecord,
  type RecordItem,
  type TodayInfo,
} from '../api/records'
import { ApiError } from '../api/client'
import { useMonthRecords } from '../hooks/useMonthRecords'
import CalendarGrid from '../components/CalendarGrid'
import DaySheet from '../components/DaySheet'
import TodayCard from '../components/TodayCard'
import './DailyPage.css'

export default function DailyPage() {
  const navigate = useNavigate()
  const { year, month, days, recordsByDate, loading, loadMonth, shiftMonth } = useMonthRecords()
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [editorText, setEditorText] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [todayInfo, setTodayInfo] = useState<TodayInfo | null>(null)

  const loadToday = () => {
    fetchTodayInfo()
      .then(setTodayInfo)
      .catch(() => {})
  }

  useEffect(() => {
    loadToday()
  }, [])

  const resetEditor = () => {
    setEditingId(null)
    setEditorText('')
    setConfirmingDeleteId(null)
    setMessage('')
  }

  const onShiftMonth = (delta: number) => {
    shiftMonth(delta)
    setSelectedDate(null)
    resetEditor()
  }

  const openDay = (date: string) => {
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
      await createRecord(selectedDate, editorText.trim())
      setEditorText('')
      loadMonth()
      loadToday()
      setMessage('已保存')
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : '保存失败')
    }
  }

  const startEdit = (item: RecordItem) => {
    setEditingId(item.id)
    setConfirmingDeleteId(null)
    setMessage('')
  }

  const cancelEdit = () => {
    setEditingId(null)
  }

  const updateRecordItem = async (id: number, content: string) => {
    if (!content.trim()) return
    setMessage('')
    try {
      await updateRecord(id, content.trim())
      setEditingId(null)
      loadMonth()
      loadToday()
      setMessage('已保存')
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : '保存失败')
    }
  }

  const removeRecord = async (id: number) => {
    await deleteRecord(id)
    setConfirmingDeleteId(null)
    if (editingId === id) cancelEdit()
    loadMonth()
    loadToday()
  }

  // —— 今日卡片：自治 CRUD，返回 null 表示成功，否则为错误提示 ——
  const createToday = async (text: string): Promise<string | null> => {
    if (!todayInfo) return '加载中，请稍后再试'
    try {
      await createRecord(todayInfo.date, text)
      loadMonth()
      loadToday()
      return null
    } catch (err) {
      return err instanceof ApiError ? err.message : '保存失败'
    }
  }

  const updateToday = async (id: number, text: string): Promise<string | null> => {
    try {
      await updateRecord(id, text)
      loadMonth()
      loadToday()
      return null
    } catch (err) {
      return err instanceof ApiError ? err.message : '保存失败'
    }
  }

  const deleteToday = async (id: number) => {
    await deleteRecord(id)
    loadMonth()
    loadToday()
  }

  // 跳转 AI 测算页，预填今日日期与提问，用户只需点发送
  const goFortune = () => {
    if (!todayInfo) return
    navigate('/ai', {
      state: {
        prefill: `今天是 ${todayInfo.date}（农历 ${todayInfo.lunar}），请帮我测算今日运势`,
        linkedDate: todayInfo.date,
      },
    })
  }

  return (
    <div className="daily-page">
      <CalendarGrid
        year={year}
        month={month}
        days={days}
        loading={loading}
        selectedDate={selectedDate}
        onShiftMonth={onShiftMonth}
        onOpenDay={openDay}
      />

      <TodayCard
        info={todayInfo}
        onCreate={createToday}
        onUpdate={updateToday}
        onDelete={deleteToday}
        onFortune={goFortune}
      />

      {selectedDate && (
        <DaySheet
          selectedDate={selectedDate}
          records={selectedRecords}
          editorText={editorText}
          editingId={editingId}
          confirmingDeleteId={confirmingDeleteId}
          message={message}
          onClose={closeDay}
          onEditorChange={setEditorText}
          onSubmit={submitRecord}
          onStartEdit={startEdit}
          onCancelEdit={cancelEdit}
          onUpdate={updateRecordItem}
          onRequestDelete={setConfirmingDeleteId}
          onCancelDelete={() => setConfirmingDeleteId(null)}
          onRemove={removeRecord}
        />
      )}
    </div>
  )
}
