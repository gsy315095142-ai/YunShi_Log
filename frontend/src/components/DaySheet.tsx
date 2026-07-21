import { useEffect, useState } from 'react'
import type { RecordItem } from '../api/records'
import ConfirmDialog from './ConfirmDialog'
import IconButton, { DeleteIcon, EditIcon } from './IconButton'
import './DaySheet.css'

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
                    <IconButton label="编辑" onClick={() => onStartEdit(item)}>
                      <EditIcon />
                    </IconButton>
                    <IconButton label="删除" danger onClick={() => onRequestDelete(item.id)}>
                      <DeleteIcon />
                    </IconButton>
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

      <ConfirmDialog
        open={confirmingItem !== undefined}
        title="删除这条记录？"
        content={confirmingItem?.content}
        tip="删除后不可恢复"
        confirmText="确认删除"
        onConfirm={() => confirmingItem && onRemove(confirmingItem.id)}
        onCancel={onCancelDelete}
      />
    </div>
  )
}
