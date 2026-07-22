/**
 * 去掉 Markdown 标记（行首 # 标题、** 加粗、表格语法），
 * 用于复制、导出长图等需要纯文本的场景。
 * 表格行转为「单元格 ｜ 单元格」的纯文本，分隔行（|---|）直接丢弃。
 */
export function cleanMarkdown(text: string): string {
  return text
    .split('\n')
    .filter((line) => !(line.includes('-') && line.trim().replace(/[\s|:;-]/g, '') === ''))
    .map((line) => {
      if (line.includes('|')) {
        const cells = line
          .trim()
          .replace(/^\||\|$/g, '')
          .split('|')
          .map((c) => c.trim())
        if (cells.length > 1) return cells.join(' ｜ ')
      }
      return line.replace(/^#{1,6}\s+/, '')
    })
    .join('\n')
    .replace(/\*\*/g, '')
}

/** '2026-07-21T18:05:00' → '07-21 18:05'（对话时间戳展示用） */
export function fmtMsgTime(iso: string): string {
  // 后端 SQLite CURRENT_TIMESTAMP 存的是 UTC 且无时区后缀，JS 会误当本地时间；
  // 无时区信息时补 'Z' 按 UTC 解析，再转为本地时间显示
  const hasTz = iso.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(iso)
  const d = new Date(hasTz ? iso : `${iso}Z`)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
