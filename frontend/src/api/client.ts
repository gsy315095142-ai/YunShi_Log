import { clearToken, getToken } from '../utils/token'
import { appPath } from '../utils/basePath'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json')
  }
  const token = getToken()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const res = await fetch(path, { ...init, headers })
  if (res.status === 401) {
    clearToken()
    const loginPath = appPath('login')
    if (!window.location.pathname.startsWith(loginPath.replace(/\/$/, ''))) {
      window.location.href = loginPath
    }
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const detail = (data as { detail?: string | Array<{ msg?: string }> }).detail
    let message = '请求失败'
    if (typeof detail === 'string') {
      message = detail
    } else if (Array.isArray(detail)) {
      message = detail.map((d) => d.msg || '').filter(Boolean).join('；') || message
    }
    throw new ApiError(res.status, message)
  }
  return data as T
}
