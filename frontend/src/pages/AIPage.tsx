import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { fetchMonthRecords } from '../api/records'
import { useAIChat } from '../hooks/useAIChat'
import { useChatExport } from '../hooks/useChatExport'
import AISettingsCard from '../components/AISettingsCard'
import ChatExportBar from '../components/ChatExportBar'
import ChatWindow from '../components/ChatWindow'
import DatePickerPopover from '../components/DatePickerPopover'
import ExportPreviewModal from '../components/ExportPreviewModal'
import './AIPage.css'

export default function AIPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [linkedDate, setLinkedDate] = useState('')
  const [dateOptions, setDateOptions] = useState<string[]>([])
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [input, setInput] = useState('')
  const { messages, sending, send } = useAIChat()
  const chatExport = useChatExport(messages)

  useEffect(() => {
    const now = new Date()
    fetchMonthRecords(now.getFullYear(), now.getMonth() + 1).then((data) => {
      const dates = Object.keys(data.records_by_date).sort()
      setDateOptions(dates)
    })
  }, [])

  // 从「测算今日运势」入口跳入时，预填提问与关联日期，用户只需点发送
  useEffect(() => {
    const state = location.state as { prefill?: string; linkedDate?: string } | null
    if (state?.prefill) {
      setInput(state.prefill)
      if (state.linkedDate) setLinkedDate(state.linkedDate)
      navigate(location.pathname, { replace: true, state: null })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <AISettingsCard
        actions={
          <button
            type="button"
            className="settings-btn"
            disabled={chatExport.exportable.length === 0}
            onClick={chatExport.enterSelectMode}
            title="选择对话导出为长图"
          >
            🖼 对话导出
          </button>
        }
      />

      <div className="card chat-card">
        {chatExport.selectMode && (
          <ChatExportBar
            count={chatExport.selectedIds.size}
            disabledExport={chatExport.selectedIds.size === 0}
            onSelectAll={chatExport.selectAll}
            onCancel={chatExport.exitSelectMode}
            onExport={chatExport.doExport}
          />
        )}
        <ChatWindow
          messages={messages}
          sending={sending}
          selectMode={chatExport.selectMode}
          selectedIds={chatExport.selectedIds}
          onToggleSelect={chatExport.toggleSelect}
        />
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
                placeholder="输入内容可@关联日期"
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
      </div>

      <ExportPreviewModal image={chatExport.exportImage} onClose={chatExport.closePreview} />
    </div>
  )
}
