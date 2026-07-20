import type { RecordItem } from '../api/records'

interface DaySheetProps {
  selectedDate: string
  records: RecordItem[]
  editorText: string
  editingId: number | null
  confirmingDeleteId: number | null
  message: string
  onClose: () => void
  onEditorChange: (text: string) => void
  onSubmit: () => void
  onStartEdit: (item: RecordItem) => void
  onCancelEdit: () => void
  onRemove: (id: number) => void
}

export default function DaySheet({
  selectedDate,
  records,
  editorText,
  editingId,
  confirmingDeleteId,
  message,
  onClose,
  onEditorChange,
  onSubmit,
  onStartEdit,
  onCancelEdit,
  onRemove,
}: DaySheetProps) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="card day-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <h3>{selectedDate} 的记录</h3>
          <button type="button" className="sheet-close" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>
        <div className="sheet-body">
          {records.length === 0 && <p className="empty-tip">暂无记录，写下今天的第一条吧</p>}
          <ul className="record-list">
            {records.map((item) => (
              <li key={item.id} className={editingId === item.id ? 'editing' : ''}>
                <p>{item.content}</p>
                <div className="item-actions">
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="编辑"
                    title="编辑"
                    onClick={() => onStartEdit(item)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>
                  </button>
                  <button
                    type="button"
                    className={`icon-btn danger${confirmingDeleteId === item.id ? ' confirming' : ''}`}
                    aria-label="删除"
                    title={confirmingDeleteId === item.id ? '再次点击确认删除' : '删除'}
                    onClick={() => onRemove(item.id)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="sheet-editor">
          <textarea
            value={editorText}
            onChange={(e) => onEditorChange(e.target.value)}
            placeholder={editingId ? '编辑记录内容' : '新增记录内容'}
            rows={3}
          />
          <div className="editor-actions">
            {editingId && (
              <button type="button" className="cancel-btn" onClick={onCancelEdit}>
                取消编辑
              </button>
            )}
            <button type="button" className="submit-btn" onClick={onSubmit}>
              {editingId ? '更新记录' : '新增记录'}
            </button>
          </div>
          {message && <p className="msg">{message}</p>}
        </div>
      </div>
    </div>
  )
}
