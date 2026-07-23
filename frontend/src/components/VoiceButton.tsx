import type { VoiceState } from '../hooks/useVoiceInput'
import './VoiceButton.css'

interface VoiceButtonProps {
  state: VoiceState
  onToggle: () => void
  disabled?: boolean
}

/** 语音输入按钮：点击开始录音（红色呼吸闪烁），再点结束并识别；识别中显示转圈 */
export default function VoiceButton({ state, onToggle, disabled }: VoiceButtonProps) {
  const label = state === 'recording' ? '结束录音' : state === 'transcribing' ? '识别中' : '语音输入'
  return (
    <button
      type="button"
      className={`voice-btn${state === 'recording' ? ' recording' : ''}`}
      aria-label={label}
      title={label}
      disabled={disabled || state === 'transcribing'}
      onClick={onToggle}
    >
      {state === 'transcribing' ? (
        <span className="voice-spinner" />
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
          <path d="M12 18v4" />
        </svg>
      )}
    </button>
  )
}
