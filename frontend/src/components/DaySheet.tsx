import { useEffect, useState } from 'react'
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
  onUpdate: (id: number, content: string) => void
  onRequestDelete: (id: number) => void
  onCancelDelete: () => void
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
  onUpdate,
  onRequestDelete,
  onCancelDelete,
  onRemove,
}: DaySheetProps) {
  // 条目内联编辑的文本，进入编辑态时用条目原文初始化
  const [editText, setEditText] = useState('')

  useEffect(() => {
    if (editingId !== null) {
      const item = records.find((r) => r.id === editingId)
      setEditText(item?.content ?? '')
    }
  }, [editingId, records])

  const confirmingItem = records.find((r) => r.id === confirmingDeleteId)

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
            {records.map((item) =>
              editingId === item.id ? (
                <li key={item.id} className="editing">
                  <div className="inline-editor">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={3}
                      autoFocus
                    />
                    <div className="inline-editor-actions">
                      <button type="button" className="cancel-btn" onClick={onCancelEdit}>
                        取消
                      </button>
                      <button
                        type="button"
                        className="submit-btn"
                        onClick={() => onUpdate(item.id, editText)}
                      >
                        保存
                      </button>
                    </div>
                  </div>
                </li>
              ) : (
                <li key={item.id}>
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
                      className="icon-btn danger"
                      aria-label="删除"
                      title="删除"
                      onClick={() => onRequestDelete(item.id)}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>
                    </button>
                  </div>
                </li>
              )
            )}
          </ul>
          {message && <p className="msg sheet-msg">{message}</p>}
        </div>
        {records.length === 0 && (
          <div className="sheet-editor">
            <textarea
              value={editorText}
              onChange={(e) => onEditorChange(e.target.value)}
              placeholder="新增记录内容"
              rows={3}
            />
            <div className="editor-actions">
              <button type="button" className="submit-btn" onClick={onSubmit}>
                新增记录
              </button>
            </div>
          </div>
        )}
      </div>

      {confirmingItem && (
        <div className="confirm-backdrop" onClick={onCancelDelete}>
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h4>删除这条记录？</h4>
            <p className="confirm-content">{confirmingItem.content}</p>
            <p className="confirm-tip">删除后不可恢复</p>
            <div className="confirm-actions">
              <button type="button" className="cancel-btn" onClick={onCancelDelete}>
                取消
              </button>
              <button
                type="button"
                className="danger-btn"
                onClick={() => onRemove(confirmingItem.id)}
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
