import { useState } from 'react'
import type { ChatMessage } from '../api/ai'
import { renderChatImage } from '../utils/exportChatImage'

// 对话导出：多选模式、选中的消息 id、生成的长图预览
export function useChatExport(messages: ChatMessage[]) {
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

  const selectAll = () => {
    setSelectedIds(new Set(exportable.map((m) => m.id)))
  }

  const enterSelectMode = () => {
    setSelectMode(true)
  }

  const exitSelectMode = () => {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  const doExport = async () => {
    const list = messages.filter((m) => selectedIds.has(m.id) && !m.notice)
    if (list.length === 0) return
    setExportImage(await renderChatImage(list))
    exitSelectMode()
  }

  const closePreview = () => {
    // 释放 blob URL，避免内存泄漏
    if (exportImage?.startsWith('blob:')) URL.revokeObjectURL(exportImage)
    setExportImage(null)
  }

  return {
    selectMode,
    selectedIds,
    exportImage,
    exportable,
    toggleSelect,
    selectAll,
    enterSelectMode,
    exitSelectMode,
    doExport,
    closePreview,
  }
}
