import { useEffect, useRef, useState } from 'react'
import { transcribeVoice } from '../api/asr'

export type VoiceState = 'idle' | 'recording' | 'transcribing'

/** 单次录音最长 60 秒，到时自动结束并识别 */
const MAX_RECORD_MS = 60_000

/** 按浏览器支持度挑选录音格式（iOS Safari 只认 audio/mp4） */
const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']

function pickMime(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) ?? ''
}

function extOf(mime: string): string {
  if (mime.includes('mp4')) return 'm4a'
  if (mime.includes('ogg')) return 'ogg'
  return 'webm'
}

/**
 * 语音输入：start 开始录音，stop 结束并上传识别，识别文本经 onText 回调交给调用方填入输入框。
 * onError 用于提示（无麦克风权限、浏览器不支持、识别失败等）。
 */
export function useVoiceInput(onText: (text: string) => void, onError: (msg: string) => void) {
  const [state, setState] = useState<VoiceState>('idle')
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<number>(0)
  const mimeRef = useRef('')
  // 回调用 ref 持有，避免闭包捕获旧值
  const cbRef = useRef({ onText, onError })
  cbRef.current = { onText, onError }

  const cleanup = () => {
    window.clearTimeout(timerRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    recorderRef.current = null
  }

  // 组件卸载时释放麦克风
  useEffect(() => cleanup, [])

  const stop = () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }

  const start = async () => {
    if (state !== 'idle') return
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      cbRef.current.onError('当前浏览器不支持语音输入')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mime = pickMime()
      mimeRef.current = mime
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      recorderRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mimeRef.current || 'audio/webm' })
        const ext = extOf(mimeRef.current)
        cleanup()
        setState('transcribing')
        try {
          cbRef.current.onText(await transcribeVoice(blob, ext))
        } catch (err) {
          cbRef.current.onError(err instanceof Error ? err.message : '语音识别失败，请稍后再试')
        } finally {
          setState('idle')
        }
      }
      recorder.start()
      setState('recording')
      timerRef.current = window.setTimeout(stop, MAX_RECORD_MS)
    } catch {
      cleanup()
      cbRef.current.onError('无法访问麦克风，请在浏览器中允许麦克风权限')
    }
  }

  /** 点击切换：空闲 → 开始录音；录音中 → 结束并识别 */
  const toggle = () => {
    if (state === 'recording') stop()
    else if (state === 'idle') void start()
  }

  return { state, toggle }
}
