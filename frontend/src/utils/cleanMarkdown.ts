/**
 * 去掉 Markdown 标记（行首 # 标题符号 与 ** 加粗符号），
 * 用于复制、导出长图等需要纯文本的场景。
 */
export function cleanMarkdown(text: string): string {
  return text
    .split('\n')
    .map((line) => line.replace(/^#{1,6}\s+/, ''))
    .join('\n')
    .replace(/\*\*/g, '')
}

/** '2026-07-21T18:05:00' → '07-21 18:05'（对话时间戳展示用） */
export function fmtMsgTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
