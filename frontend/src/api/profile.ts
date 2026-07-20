import { apiFetch } from './client'

export interface Profile {
  display_name: string | null
  birth_date: string | null
  birth_time: string | null
  mbti: string | null
  lunar: string | null
  zodiac_sign: string | null
  chinese_zodiac: string | null
  five_element: string | null
  nayin: string | null
  birth_time_display: string | null
}

export interface ProfileUpdate {
  display_name: string
  birth_date: string
  birth_time?: string | null
  mbti?: string | null
}

export async function fetchProfile() {
  return apiFetch<Profile>('/api/v1/profile')
}

export async function saveProfile(body: ProfileUpdate) {
  return apiFetch<Profile>('/api/v1/profile', {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}
