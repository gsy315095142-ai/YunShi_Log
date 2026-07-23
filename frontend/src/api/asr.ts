import { getToken } from '../utils/token'

/**
 * 上传录音到后端语音识别接口，返回识别文本。
 * 注意：FormData 上传需手动带 Bearer token（apiFetch 会强制 JSON Content-Type，不适用 multipart）。
 */
export async function transcribeVoice(blob: Blob, ext: string): Promise<string> {
  const fd = new FormData()
  fd.append('file', blob, `voice.${ext}`)
  const token = getToken()
  const res = await fetch('/api/v1/asr/transcribe', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  })
  const data = (await res.json().catch(() => ({}))) as { text?: string; detail?: string }
  if (!res.ok) throw new Error(data.detail || '语音识别失败，请稍后再试')
  const text = (data.text ?? '').trim()
  if (!text) throw new Error('没有听清，请靠近麦克风再试一次')
  return text
}
