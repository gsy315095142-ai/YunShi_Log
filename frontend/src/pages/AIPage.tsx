import { useEffect, useState } from 'react'
import { fetchMonthRecords } from '../api/records'
import { useAIChat } from '../hooks/useAIChat'
import AISettingsCard from '../components/AISettingsCard'
import ChatWindow from '../components/ChatWindow'
import DatePickerPopover from '../components/DatePickerPopover'
import './AIPage.css'

export default function AIPage() {
  const [linkedDate, setLinkedDate] = useState('')
  const [dateOptions, setDateOptions] = useState<string[]>([])
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [input, setInput] = useState('')
  const { messages, sending, chatMsg, send } = useAIChat()

  useEffect(() => {
    const now = new Date()
    fetchMonthRecords(now.getFullYear(), now.getMonth() + 1).then((data) => {
      const dates = Object.keys(data.records_by_date).sort()
      setDateOptions(dates)
    })
  }, [])

  const onInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setInput(val)
    if (val.endsWith('@') && dateOptions.length > 0) {
      setShowDatePicker(true)
    } else {
      setShowDatePicker(false)
    }
  }

  const onSelectDate = (date: string) => {
    setLinkedDate(date)
    setShowDatePicker(false)
    setInput((prev) => prev.replace(/@$/, ''))
  }

  const onSend = async () => {
    if (!input.trim() || sending) return
    const userText = input.trim()
    const sentDate = linkedDate
    setInput('')
    setLinkedDate('')
    setShowDatePicker(false)
    await send(userText, sentDate)
  }

  return (
    <div className="ai-page">
      <AISettingsCard />

      <div className="card chat-card">
        <ChatWindow messages={messages} sending={sending} />
        <div className="chat-input-area">
          {linkedDate && (
            <div className="linked-chips">
              <span className="date-chip">
                📅 {linkedDate}
                <button type="button" className="chip-remove" onClick={() => setLinkedDate('')}>✕</button>
              </span>
            </div>
          )}
          <div className="chat-input-row">
            <div className="input-wrapper">
              <textarea
                value={input}
                onChange={onInputChange}
                placeholder="输入内容，用 @ 关联日期..."
                rows={2}
              />
              {showDatePicker && (
                <DatePickerPopover dateOptions={dateOptions} onSelect={onSelectDate} />
              )}
            </div>
            <button type="button" onClick={onSend} disabled={sending}>
              发送
            </button>
          </div>
        </div>
        {chatMsg && <p className="msg error">{chatMsg}</p>}
      </div>
    </div>
  )
}
