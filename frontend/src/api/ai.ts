import { apiFetch } from './client'

export interface AIProvider {
  id: string
  name: string
  default_base_url: string
}

export interface AISettings {
  provider: string
  api_base_url: string
  api_key_masked: string | null
}

export interface ChatMessage {
  id: number
  role: string
  content: string
  linked_date: string | null
  created_at: string
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
