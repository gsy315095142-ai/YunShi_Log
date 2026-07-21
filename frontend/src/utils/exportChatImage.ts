/**
 * 对话导出为 PNG 长图。
 * 纯 Canvas 手绘（不引入 html2canvas 依赖）：两趟渲染——先量高、再绘制。
 * 只导出对话正文与回执标签，不包含思考过程。
 * 返回 dataURL，由页面弹预览：手机长按存相册，也可点按钮下载。
 */
import type { ChatMessage } from '../api/ai'

const W = 720 // 逻辑宽度（实际像素 ×2，保证手机上看清晰）
const SCALE = 2
const PAD = 28
const FONT_SIZE = 25
const LINE_H = 38
const BUBBLE_PAD_X = 18
const BUBBLE_PAD_Y = 12
const BUBBLE_MAX_W = W - PAD * 2 - 96 // 对侧留白，气泡不顶满
const FONT = `${FONT_SIZE}px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`
const SMALL_FONT = `19px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`

const COLORS = {
  bg: '#f5f3fb',
  userBg: '#7c3aed',
  userText: '#ffffff',
  aiBg: '#ffffff',
  aiBorder: '#e9e0f7',
  aiText: '#2d2438',
  label: '#8b7faa',
  tag: '#8b7faa',
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const lines: string[] = []
  for (const para of text.split('\n')) {
    let line = ''
    for (const ch of para) {
      if (ctx.measureText(line + ch).width > maxW && line) {
        lines.push(line)
        line = ch
      } else {
        line += ch
      }
    }
    lines.push(line)
  }
  return lines
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** 单条消息的布局信息 */
interface Item {
  msg: ChatMessage
  isUser: boolean
  lines: string[]
  bubbleW: number
  bubbleH: number
  tags: string[]
  totalH: number
}

function fmtActionDate(iso: string) {
  const [, m, d] = iso.split('-')
  return `${Number(m)}月${Number(d)}日`
}

export function renderChatImage(messages: ChatMessage[]): string {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  ctx.font = FONT

  // —— 第一趟：排版量高 ——
  const items: Item[] = messages.map((msg) => {
    const isUser = msg.role === 'user'
    ctx.font = FONT
    const lines = wrapText(ctx, msg.content, BUBBLE_MAX_W - BUBBLE_PAD_X * 2)
    const bubbleW =
      Math.min(
        Math.max(...lines.map((l) => ctx.measureText(l).width)) + BUBBLE_PAD_X * 2,
        BUBBLE_MAX_W,
      )
    const bubbleH = lines.length * LINE_H + BUBBLE_PAD_Y * 2
    const tags: string[] = []
    msg.record_actions?.forEach((a) =>
      tags.push(`✏️ 已${a.action === 'created' ? '新增' : '更新'} ${fmtActionDate(a.date)} 的记录`),
    )
    if (msg.used_fallback) tags.push('🔄 已由备用模型接手')
    if (msg.linked_date) tags.push(`📅 ${msg.linked_date}`)
    const totalH = 26 /* 角色名 */ + bubbleH + (tags.length ? tags.length * 24 + 6 : 0) + 22 /* 间距 */
    return { msg, isUser, lines, bubbleW, bubbleH, tags, totalH }
  })

  const headerH = 96
  const footerH = 56
  const totalH = headerH + items.reduce((s, i) => s + i.totalH, 0) + footerH

  // —— 第二趟：正式绘制 ——
  canvas.width = W * SCALE
  canvas.height = totalH * SCALE
  ctx.scale(SCALE, SCALE)
  ctx.fillStyle = COLORS.bg
  ctx.fillRect(0, 0, W, totalH)

  let y = PAD

  // 标题
  ctx.fillStyle = COLORS.aiText
  ctx.font = `bold 30px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('运势 Log · 对话导出', W / 2, y + 24)
  ctx.fillStyle = COLORS.label
  ctx.font = SMALL_FONT
  const now = new Date()
  ctx.fillText(
    `导出于 ${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
    W / 2,
    y + 52,
  )
  y += headerH

  ctx.textAlign = 'left'
  for (const item of items) {
    const x = item.isUser ? W - PAD - item.bubbleW : PAD

    // 角色名
    ctx.fillStyle = COLORS.label
    ctx.font = SMALL_FONT
    const name = item.isUser ? '我' : '🔮 测算大师'
    if (item.isUser) {
      ctx.textAlign = 'right'
      ctx.fillText(name, W - PAD, y + 14)
    } else {
      ctx.textAlign = 'left'
      ctx.fillText(name, PAD, y + 14)
    }
    y += 26

    // 气泡
    ctx.fillStyle = item.isUser ? COLORS.userBg : COLORS.aiBg
    roundRect(ctx, x, y, item.bubbleW, item.bubbleH, 14)
    ctx.fill()
    if (!item.isUser) {
      ctx.strokeStyle = COLORS.aiBorder
      ctx.lineWidth = 1
      ctx.stroke()
    }

    // 正文
    ctx.fillStyle = item.isUser ? COLORS.userText : COLORS.aiText
    ctx.font = FONT
    ctx.textAlign = 'left'
    item.lines.forEach((line, i) => {
      ctx.fillText(line, x + BUBBLE_PAD_X, y + BUBBLE_PAD_Y + i * LINE_H + FONT_SIZE * 0.72)
    })
    y += item.bubbleH

    // 回执标签
    if (item.tags.length) {
      y += 6
      ctx.fillStyle = COLORS.tag
      ctx.font = SMALL_FONT
      for (const t of item.tags) {
        if (item.isUser) {
          ctx.textAlign = 'right'
          ctx.fillText(t, W - PAD, y + 15)
        } else {
          ctx.textAlign = 'left'
          ctx.fillText(t, PAD, y + 15)
        }
        y += 24
      }
    }
    y += 22
    ctx.textAlign = 'left'
  }

  // 页脚
  ctx.fillStyle = COLORS.label
  ctx.font = SMALL_FONT
  ctx.textAlign = 'center'
  ctx.fillText('—— 由 运势 Log 导出 ——', W / 2, y + 20)

  return canvas.toDataURL('image/png')
}
