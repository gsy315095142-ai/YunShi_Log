import { apiFetch } from './client'
import { setToken } from '../utils/token'

export interface UserInfo {
  id: number
  username: string
  role: string
}

export async function login(username: string, password: string) {
  const data = await apiFetch<{ access_token: string }>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
  setToken(data.access_token)
  return data
}

export async function register(username: string, password: string) {
  return apiFetch<UserInfo>('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export async function fetchMe() {
  return apiFetch<UserInfo>('/api/v1/auth/me')
}

export async function changePassword(username: string, old_password: string, new_password: string) {
  return apiFetch<{ ok: boolean }>('/api/v1/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ username, old_password, new_password }),
  })
}
