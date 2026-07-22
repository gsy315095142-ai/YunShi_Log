import { useState } from 'react'
import type { ChatMessage } from '../api/ai'
import { renderChatImage } from '../utils/exportChatImage'
import { getToken } from '../utils/token'

// 对话导出：多选模式、选中的消息 id、生成的长图预览
export function useChatExport(messages: ChatMessage[]) {
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [exportImage, setExportImage] = useState<string | null>(null)
  // 上传服务器失败时回退本地 blob 预览，并提示用户保存方式可能受限
  const [exportOffline, setExportOffline] = useState(false)

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

  /** 把 blob 长图上传到后端换真实 URL；失败返回 null */
  const uploadImage = async (blobUrl: string): Promise<string | null> => {
    try {
      const blob = await (await fetch(blobUrl)).blob()
      const fd = new FormData()
      fd.append('file', blob, 'chat-export.png')
      const token = getToken()
      const res = await fetch('/api/v1/ai/chat/export-image', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      })
      if (!res.ok) return null
      const data = (await res.json()) as { url?: string }
      return data.url ?? null
    } catch {
      return null
    }
  }

  const doExport = async () => {
    const list = messages.filter((m) => selectedIds.has(m.id) && !m.notice)
    if (list.length === 0) return
    const blobUrl = await renderChatImage(list)
    exitSelectMode()
    const serverUrl = await uploadImage(blobUrl)
    if (serverUrl) {
      URL.revokeObjectURL(blobUrl)
      setExportImage(serverUrl)
      setExportOffline(false)
    } else {
      // 上传失败兜底：本地预览 + 明确提示
      setExportImage(blobUrl)
      setExportOffline(true)
    }
  }

  const closePreview = () => {
    // 释放本地 blob URL（服务器 URL 无需释放）
    if (exportImage?.startsWith('blob:')) URL.revokeObjectURL(exportImage)
    setExportImage(null)
    setExportOffline(false)
  }

  return {
    selectMode,
    selectedIds,
    exportImage,
    exportOffline,
    exportable,
    toggleSelect,
    selectAll,
    enterSelectMode,
    exitSelectMode,
    doExport,
    closePreview,
  }
}
