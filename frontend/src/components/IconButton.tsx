import type { ReactNode } from 'react'

interface IconButtonProps {
  /** 无障碍标签与悬浮提示文字 */
  label: string
  onClick: () => void
  /** 危险操作（如删除），hover 变红 */
  danger?: boolean
  children: ReactNode
}

/** 条目右侧的图标按钮（.icon-btn 基础样式见 DaySheet.css） */
export default function IconButton({ label, onClick, danger, children }: IconButtonProps) {
  return (
    <button
      type="button"
      className={`icon-btn${danger ? ' danger' : ''}`}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>
  )
}

export function DeleteIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2V6" /></svg>
  )
}
