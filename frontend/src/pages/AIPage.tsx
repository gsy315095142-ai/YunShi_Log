import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { fetchMonthRecords } from '../api/records'
import { useAIChat } from '../hooks/useAIChat'
import { useChatExport } from '../hooks/useChatExport'
import { useVoiceInput } from '../hooks/useVoiceInput'
import AISettingsCard from '../components/AISettingsCard'
import ChatExportBar from '../components/ChatExportBar'
import ChatWindow from '../components/ChatWindow'
import DatePickerPopover from '../components/DatePickerPopover'
import ExportPreviewModal from '../components/ExportPreviewModal'
import VoiceButton from '../components/VoiceButton'
import './AIPage.css'

/** 「＋」快捷发送的预设提问，点击直接发送 */
const QUICK_SENDS = ['我今天的运势怎么样，请详细说明', '请分析一下我的整体情况']

export default function AIPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [linkedDate, setLinkedDate] = useState('')
  const [dateOptions, setDateOptions] = useState<string[]>([])
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showQuickSend, setShowQuickSend] = useState(false)
  const [input, setInput] = useState('')
  const { messages, sending, send } = useAIChat()
  const chatExport = useChatExport(messages)
  // 语音输入：识别文本追加到输入框末尾
  const voice = useVoiceInput(
    (text) => setInput((prev) => prev + text),
    (msg) => alert(msg),
  )

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

  // 「＋」快捷发送：直接发送预设提问，无需经过输入框
  const onQuickSend = async (text: string) => {
    if (sending) return
    setShowQuickSend(false)
    await send(text, '')
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
            <div className="chat-input-btns">
              <div className="quick-send-wrapper">
                <button
                  type="button"
                  className="quick-send-btn"
                  aria-label="快捷发送"
                  onClick={() => setShowQuickSend((v) => !v)}
                >
                  ＋
                </button>
                {showQuickSend && (
                  <>
                    {/* 透明遮罩：点击外部任意位置收回弹层 */}
                    <div className="quick-send-backdrop" onClick={() => setShowQuickSend(false)} />
                    <div className="quick-send-popover">
                      {QUICK_SENDS.map((q) => (
                        <button
                          key={q}
                          type="button"
                          className="quick-send-item"
                          disabled={sending}
                          onClick={() => onQuickSend(q)}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <VoiceButton state={voice.state} onToggle={voice.toggle} disabled={sending} />
              <button type="button" className="send-btn" aria-label="发送" onClick={onSend} disabled={sending}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4 20-7z" /></svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <ExportPreviewModal image={chatExport.exportImage} offline={chatExport.exportOffline} onClose={chatExport.closePreview} />
    </div>
  )
}
