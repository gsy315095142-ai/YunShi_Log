import './ConfirmDialog.css'

interface ConfirmDialogProps {
  open: boolean
  title: string
  /** 被确认内容的摘要（如待删除记录原文），传入即显示内容块 */
  content?: string
  /** 内容下方的辅助提示（如「删除后不可恢复」），传入即显示 */
  tip?: string
  confirmText?: string
  cancelText?: string
  /** 危险操作样式（红色确认按钮），默认 true */
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** 通用确认弹窗：点击遮罩或「取消」触发 onCancel，「确认」触发 onConfirm */
export default function ConfirmDialog({
  open,
  title,
  content,
  tip,
  confirmText = '确认',
  cancelText = '取消',
  danger = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null
  return (
    <div className="confirm-backdrop" onClick={onCancel}>
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
        <h4>{title}</h4>
        {content !== undefined && <p className="confirm-content">{content}</p>}
        {tip && <p className="confirm-tip">{tip}</p>}
        <div className="confirm-actions">
          <button type="button" className="cancel-btn" onClick={onCancel}>
            {cancelText}
          </button>
          <button
            type="button"
            className={danger ? 'danger-btn' : 'submit-btn'}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
