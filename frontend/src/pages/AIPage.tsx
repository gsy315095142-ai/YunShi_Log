import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { fetchMonthRecords } from '../api/records'
import { useAIChat } from '../hooks/useAIChat'
import AISettingsCard from '../components/AISettingsCard'
import ChatWindow from '../components/ChatWindow'
import DatePickerPopover from '../components/DatePickerPopover'
import { renderChatImage } from '../utils/exportChatImage'
import './AIPage.css'

export default function AIPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [linkedDate, setLinkedDate] = useState('')
  const [dateOptions, setDateOptions] = useState<string[]>([])
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [input, setInput] = useState('')
  const { messages, sending, send } = useAIChat()
  // 对话导出：多选模式、选中的消息 id、生成的长图预览
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [exportImage, setExportImage] = useState<string | null>(null)

  const exportable = messages.filter((m) => !m.notice)

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const exitSelectMode = () => {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  const doExport = () => {
    const list = messages.filter((m) => selectedIds.has(m.id) && !m.notice)
    if (list.length === 0) return
    setExportImage(renderChatImage(list))
    exitSelectMode()
  }

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
            disabled={exportable.length === 0}
            onClick={() => setSelectMode(true)}
            title="选择对话导出为长图"
          >
            🖼 对话导出
          </button>
        }
      />

      <div className="card chat-card">
        {selectMode && (
          <div className="chat-tools selecting">
            <span className="select-count">已选 {selectedIds.size} 条</span>
            <button
              type="button"
              className="tool-btn"
              onClick={() => setSelectedIds(new Set(exportable.map((m) => m.id)))}
            >
              全选
            </button>
            <button type="button" className="tool-btn" onClick={exitSelectMode}>
              取消
            </button>
            <button
              type="button"
              className="tool-btn primary"
              disabled={selectedIds.size === 0}
              onClick={doExport}
            >
              🖼 导出 PNG
            </button>
          </div>
        )}
        <ChatWindow
          messages={messages}
          sending={sending}
          selectMode={selectMode}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
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

      {/* 长图预览：手机长按图片保存到相册，也可下载为文件 */}
      {exportImage && (
        <div className="export-backdrop" onClick={() => setExportImage(null)}>
          <div className="export-modal" onClick={(e) => e.stopPropagation()}>
            <p className="export-tip">✅ 长图已生成：手机<b>长按图片</b>即可保存到相册</p>
            <div className="export-img-wrap">
              <img src={exportImage} alt="对话长图" />
            </div>
            <div className="export-actions">
              <a className="tool-btn primary" href={exportImage} download="运势Log对话长图.png">
                下载 PNG
              </a>
              <button type="button" className="tool-btn" onClick={() => setExportImage(null)}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
