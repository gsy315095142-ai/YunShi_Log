import type { VoiceState } from '../hooks/useVoiceInput'
import './VoiceButton.css'

interface VoiceButtonProps {
  state: VoiceState
  onToggle: () => void
  disabled?: boolean
}

/**
 * 语音输入按钮：
 * 空闲 → 麦克风圆钮；录音中 → 红色呼吸药丸（停止图标 + 文字提示，点击停止）；识别中 → 转圈药丸
 */
export default function VoiceButton({ state, onToggle, disabled }: VoiceButtonProps) {
  if (state === 'recording') {
    return (
      <button
        type="button"
        className="voice-btn recording"
        aria-label="语音录入中，点击停止"
        onClick={onToggle}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
          <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
        <span className="voice-btn-text">语音录入中，点击停止</span>
      </button>
    )
  }

  if (state === 'transcribing') {
    return (
      <button type="button" className="voice-btn busy" aria-label="识别中" disabled>
        <span className="voice-spinner" />
        <span className="voice-btn-text">识别中…</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      className="voice-btn"
      aria-label="语音输入"
      title="语音输入"
      disabled={disabled}
      onClick={onToggle}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
        <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
        <path d="M12 18v4" />
      </svg>
    </button>
  )
}
