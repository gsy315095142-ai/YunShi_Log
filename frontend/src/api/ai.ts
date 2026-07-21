import { apiFetch } from './client'

export interface AIProvider {
  id: string
  name: string
  default_base_url: string
  default_model: string
  models: string[]
}

export interface AISettings {
  provider: string
  api_base_url: string
  api_key_masked: string | null
  model: string
  fallback_provider: string | null
  fallback_api_base_url: string | null
  fallback_api_key_masked: string | null
  fallback_model: string | null
}

export interface RecordAction {
  action: string // "created" 新增 | "updated" 覆盖更新
  date: string // YYYY-MM-DD
  preview: string
}

export interface ChatMessage {
  id: number
  role: string
  content: string
  reasoning: string | null
  linked_date: string | null
  created_at: string
  record_actions?: RecordAction[] | null
  /** 本条回复是否由备用厂商接手生成（仅即时响应带回，历史消息无此字段） */
  used_fallback?: boolean | null
  /** 前端本地提示气泡（如未配置 API Key），不入库、不显示思考框 */
  notice?: boolean
}

export async function fetchProviders() {
  return apiFetch<AIProvider[]>('/api/v1/ai/providers')
}

export async function fetchAISettings() {
  return apiFetch<AISettings>('/api/v1/ai/settings')
}

export async function saveAISettings(body: {
  provider: string
  api_key?: string
  api_base_url?: string
  model?: string
  fallback_provider?: string | null
  fallback_api_key?: string
  fallback_model?: string
  clear_fallback?: boolean
}) {
  return apiFetch<AISettings>('/api/v1/ai/settings', {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function sendChat(message: string, linked_date?: string | null) {
  return apiFetch<{ reply: string; message: ChatMessage }>('/api/v1/ai/chat', {
    method: 'POST',
    body: JSON.stringify({ message, linked_date: linked_date || null }),
  })
}

export async function fetchChatHistory() {
  return apiFetch<ChatMessage[]>('/api/v1/ai/chat/history')
}
