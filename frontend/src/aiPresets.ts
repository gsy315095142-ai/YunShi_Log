/** 与后端 `app/user_settings.py` 的 `infer_model_capability` 规则保持一致。 */

export type ModelCapability = 'text' | 'text_vision'

const GLM4V = /glm-4(\.\d+)?v/i

export function inferModelCapability(model: string): ModelCapability {
  const m = (model || '').trim().toLowerCase()
  if (!m) return 'text'
  if (m.includes('multimodal') || m.includes('vision')) return 'text_vision'
  if (
    m.includes('-vl') ||
    m.includes('qwen-vl') ||
    m.includes('qwen3-vl') ||
    m.includes('qwen2.5-vl')
  ) {
    return 'text_vision'
  }
  if (m.includes('kimi-k2')) return 'text_vision'
  if (m.includes('gpt-4o')) return 'text_vision'
  if (GLM4V.test(m) || m.includes('glm-4v')) return 'text_vision'
  if (m.includes('qwen3.6-plus')) return 'text_vision'
  return 'text'
}

export const CAP_LABEL: Record<ModelCapability, string> = {
  text: '纯文本',
  text_vision: '文本 + 识图（多模态）',
}

/** 智谱 GLM Coding Plan（OpenAI 兼容），国内与国际常见入口。 */
export const GLM_CODING_BASE_CN = 'https://open.bigmodel.cn/api/coding/paas/v4'
export const GLM_CODING_BASE_INTL = 'https://api.z.ai/api/coding/paas/v4'
export const GLM_MODEL_PRESETS = ['glm-5.1', 'glm-5', 'glm-5-turbo'] as const

export const DEEPSEEK_OPENAI_BASE = 'https://api.deepseek.com/v1'
export const DEEPSEEK_MODEL_PRESETS = ['deepseek-v4-pro', 'deepseek-v4-flash'] as const

/** 通义 / DashScope OpenAI 兼容（北京；国际可改用 dashscope-intl.aliyuncs.com）。 */
export const QWEN_DASHSCOPE_COMPAT_CN = 'https://dashscope.aliyuncs.com/compatible-mode/v1'
export const QWEN_DASHSCOPE_COMPAT_INTL =
  'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
export const QWEN_VISION_MODEL_PRESETS = [
  'qwen3-vl-plus',
  'qwen3-vl-flash',
  'qwen2.5-vl-72b-instruct',
] as const

/** Kimi / Moonshot OpenAI 兼容。 */
export const KIMI_OPENAI_BASE_CN = 'https://api.moonshot.cn/v1'
export const KIMI_OPENAI_BASE_INTL = 'https://api.moonshot.ai/v1'
export const KIMI_VISION_MODEL_PRESETS = [
  'kimi-k2.6',
  'kimi-k2.5',
  'moonshot-v1-128k-vision-preview',
] as const

export type PrimaryVendorId = 'glm' | 'deepseek' | 'custom'
export type VisionVendorId = 'qwen' | 'kimi' | 'custom'

export function normBaseUrl(u: string): string {
  return u.trim().replace(/\/+$/, '')
}

export function detectPrimaryVendor(baseUrl: string): PrimaryVendorId {
  const b = normBaseUrl(baseUrl)
  if (
    b === normBaseUrl(GLM_CODING_BASE_CN) ||
    b === normBaseUrl(GLM_CODING_BASE_INTL)
  ) {
    return 'glm'
  }
  if (b === normBaseUrl(DEEPSEEK_OPENAI_BASE)) return 'deepseek'
  return 'custom'
}

export function detectVisionVendor(baseUrl: string): VisionVendorId {
  const b = normBaseUrl(baseUrl)
  if (
    b === normBaseUrl(QWEN_DASHSCOPE_COMPAT_CN) ||
    b === normBaseUrl(QWEN_DASHSCOPE_COMPAT_INTL)
  ) {
    return 'qwen'
  }
  if (
    b === normBaseUrl(KIMI_OPENAI_BASE_CN) ||
    b === normBaseUrl(KIMI_OPENAI_BASE_INTL)
  ) {
    return 'kimi'
  }
  return 'custom'
}
