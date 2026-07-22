import { useEffect, useRef, useState } from 'react'
import type { ChatMessage } from '../api/ai'
import { cleanMarkdown, fmtMsgTime } from '../utils/cleanMarkdown'

/** 行内渲染：仅处理 **加粗**，未闭合标记原样输出 */
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[\s\S]+?\*\*)/g)
  return parts.map((part, i) =>
    part.length > 4 && part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      part
    ),
  )
}

/** 表格行 → 单元格数组：'| a | b |' → ['a', 'b'] */
function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => c.trim())
}

/** 分隔行（|---|---|）判定：去掉 |、-、:、空格后应为空 */
function isSeparatorRow(line: string): boolean {
  return line.includes('-') && line.trim().replace(/[\s|:;-]/g, '') === ''
}

/** 渲染单行（标题高亮 / 普通行） */
function renderLine(line: string, key: number): React.ReactNode {
  const heading = line.match(/^(#{1,6})\s+(.*)$/)
  return (
    <span key={key}>
      {heading ? <strong className="md-heading">{renderInline(heading[2])}</strong> : renderInline(line)}
    </span>
  )
}

/**
 * 轻量 Markdown 渲染（无第三方依赖）：
 * 行首 # 标题 → 加粗高亮行；| 表格 | → 真表格（可横向滑动）；**加粗** → <strong>。
 */
function renderRichText(text: string): React.ReactNode {
  const lines = text.split('\n')
  const blocks: React.ReactNode[] = []
  let key = 0
  let i = 0

  while (i < lines.length) {
    // 表格块：当前行像表格行，且下一行是分隔行
    if (
      lines[i].includes('|') &&
      i + 1 < lines.length &&
      isSeparatorRow(lines[i + 1])
    ) {
      const header = splitTableRow(lines[i])
      const body: string[][] = []
      i += 2 // 跳过表头与分隔行
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
        body.push(splitTableRow(lines[i]))
        i++
      }
      blocks.push(
        <div key={key++} className="md-table">
          <table>
            <thead>
              <tr>
                {header.map((c, j) => (
                  <th key={j}>{renderInline(c)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, r) => (
                <tr key={r}>
                  {row.map((c, j) => (
                    <td key={j}>{renderInline(c)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      )
      continue
    }
    blocks.push(renderLine(lines[i], key++))
    i++
  }

  // 用 \n 连接（容器 white-space: pre-wrap），表格块前后同样换行
  return blocks.map((b, i) => (
    <span key={i}>
      {i > 0 && '\n'}
      {b}
    </span>
  ))
}
import './ChatWindow.css'

interface ChatWindowProps {
  messages: ChatMessage[]
  sending: boolean
  /** 导出多选模式：显示勾选圈、点击气泡切换选中，隐藏复制按钮 */
  selectMode?: boolean
  selectedIds?: Set<number>
  onToggleSelect?: (id: number) => void
}

export default function ChatWindow({ messages, sending, selectMode, selectedIds, onToggleSelect }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  // 思考框默认收起，记录被展开的消息 id
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})
  // 复制成功反馈（1.5 秒后恢复）
  const [copiedId, setCopiedId] = useState<number | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  // 「2026-07-20」→「7月20日」
  const fmtActionDate = (iso: string) => {
    const [, m, d] = iso.split('-')
    return `${Number(m)}月${Number(d)}日`
  }

  const toggleThinking = (id: number) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  // 只复制对话正文，不含思考过程；去掉 Markdown 标记（** 与 #），复制出来是干净文字
  const copyContent = async (m: ChatMessage) => {
    const clean = cleanMarkdown(m.content)
    try {
      await navigator.clipboard.writeText(clean)
    } catch {
      // 剪贴板 API 不可用（如 http 环境）时的兜底：临时框放到屏幕外并打标记，
      // 避免触发焦点监听导致底部 Tab 栏闪隐、页面跳动
      const ta = document.createElement('textarea')
      ta.value = clean
      ta.setAttribute('readonly', '')
      ta.dataset.copyHelper = '1'
      ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
    setCopiedId(m.id)
    setTimeout(() => setCopiedId((cur) => (cur === m.id ? null : cur)), 1500)
  }

  return (
    <div className="chat-window">
      {messages.length === 0 && <p className="empty-tip">向测算大师提问，输入 @ 可关联某日记录</p>}
      {messages.map((m) => {
        const selectable = selectMode && !m.notice
        const selected = selectable && selectedIds?.has(m.id)
        return (
          <div
            key={m.id}
            className={`bubble ${m.role}${m.notice ? ' notice' : ''}${selectable ? ' selectable' : ''}${selected ? ' selected' : ''}`}
            onClick={selectable ? () => onToggleSelect?.(m.id) : undefined}
          >
            {selectable && (
              <span className={`select-check${selected ? ' on' : ''}`} aria-hidden>
                {selected ? '✓' : ''}
              </span>
            )}
            {m.role === 'assistant' && !m.notice && (
              m.reasoning ? (
                <div className={`thinking-box${expanded[m.id] ? ' open' : ''}`}>
                  <button
                    type="button"
                    className="thinking-bar"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleThinking(m.id)
                    }}
                    aria-expanded={!!expanded[m.id]}
                  >
                    <span className="thinking-status">💭 AI大师已然心里有数</span>
                    <span className="thinking-chevron">{expanded[m.id] ? '▾ 收起' : '▸ 展开'}</span>
                  </button>
                  {expanded[m.id] && <p className="thinking-content">{m.reasoning}</p>}
                </div>
              ) : (
                <div className="thinking-box empty">
                  <div className="thinking-bar static">
                    <span className="thinking-status">💭 当前AI未返回思考内容</span>
                  </div>
                </div>
              )
            )}
            <div className="bubble-text">{renderRichText(m.content)}</div>
            {m.record_actions?.map((a, i) => (
              <span key={i} className="tag action-tag">
                ✏️ 已{a.action === 'created' ? '新增' : '更新'} {fmtActionDate(a.date)} 的记录
              </span>
            ))}
            {m.used_fallback && <span className="tag fallback-tag">🔄 已由备用模型接手</span>}
            {m.linked_date && <span className="tag">📅 {m.linked_date}</span>}
            <span className="bubble-time">{fmtMsgTime(m.created_at)}</span>
            {!selectMode && !m.notice && (
              <button
                type="button"
                className={`copy-btn${copiedId === m.id ? ' done' : ''}`}
                title="复制对话内容"
                onClick={(e) => {
                  e.stopPropagation()
                  copyContent(m)
                }}
              >
                {copiedId === m.id ? '✓ 已复制' : '📋 复制'}
              </button>
            )}
          </div>
        )
      })}
      {sending && (
        <div className="bubble assistant">
          <div className="thinking-box pending">
            <div className="thinking-bar static">
              <span className="thinking-status thinking-pulse">💭 AI大师正在掐指一算…</span>
            </div>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}
