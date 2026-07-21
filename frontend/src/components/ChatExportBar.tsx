import './ChatExport.css'

interface ChatExportBarProps {
  count: number
  disabledExport: boolean
  onSelectAll: () => void
  onCancel: () => void
  onExport: () => void
}

// 对话导出多选工具条
export default function ChatExportBar({
  count,
  disabledExport,
  onSelectAll,
  onCancel,
  onExport,
}: ChatExportBarProps) {
  return (
    <div className="chat-tools selecting">
      <span className="select-count">已选 {count} 条</span>
      <button type="button" className="tool-btn" onClick={onSelectAll}>
        全选
      </button>
      <button type="button" className="tool-btn" onClick={onCancel}>
        取消
      </button>
      <button
        type="button"
        className="tool-btn primary"
        disabled={disabledExport}
        onClick={onExport}
      >
        🖼 导出 PNG
      </button>
    </div>
  )
}
