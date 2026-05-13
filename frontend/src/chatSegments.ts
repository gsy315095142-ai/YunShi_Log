/** 与后端 system 提示中的 <xiaohongshu_note>…</xiaohongshu_note> 约定一致。 */

export type AssistantSegmentKind = 'chat' | 'xhs'

export type AssistantSegment = {
  kind: AssistantSegmentKind
  text: string
}

/**
 * 将助手原始正文拆成「对话说明」与「小红书笔记」两类片段（按出现顺序）。
 * 无标签时整段视为对话。
 */
export function segmentAssistantContent(raw: string): AssistantSegment[] {
  const s = raw ?? ''
  const segments: AssistantSegment[] = []
  let last = 0
  const re = /<xiaohongshu_note>([\s\S]*?)<\/xiaohongshu_note>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(s)) !== null) {
    const before = s.slice(last, m.index).trim()
    if (before) segments.push({ kind: 'chat', text: before })
    const note = m[1].trim()
    if (note) segments.push({ kind: 'xhs', text: note })
    last = m.index + m[0].length
  }
  const tail = s.slice(last).trim()
  if (tail) segments.push({ kind: 'chat', text: tail })
  if (segments.length === 0) {
    return [{ kind: 'chat', text: s }]
  }
  return segments
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  }
}
