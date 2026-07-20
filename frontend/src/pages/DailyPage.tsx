import { useState } from 'react'
import {
  createRecord,
  deleteRecord,
  updateRecord,
  type RecordItem,
} from '../api/records'
import { ApiError } from '../api/client'
import { useMonthRecords } from '../hooks/useMonthRecords'
import CalendarGrid from '../components/CalendarGrid'
import DaySheet from '../components/DaySheet'
import './DailyPage.css'

export default function DailyPage() {
  const { year, month, days, recordsByDate, loading, loadMonth, shiftMonth } = useMonthRecords()
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [editorText, setEditorText] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(null)
  const [message, setMessage] = useState('')

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
      <CalendarGrid
        year={year}
        month={month}
        days={days}
        loading={loading}
        selectedDate={selectedDate}
        onShiftMonth={onShiftMonth}
        onOpenDay={openDay}
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
          onRemove={removeRecord}
        />
      )}
    </div>
  )
}
