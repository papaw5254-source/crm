import { api } from './api'
import type { LoginResponse, User } from '@/types'

function unwrapData<T>(payload: unknown): T {
  let value = payload
  while (value && typeof value === 'object' && 'data' in value) {
    value = (value as { data: unknown }).data
  }
  return value as T
}

type LooseLoginResponse = Partial<LoginResponse> & {
  access_token?: string
  refresh_token?: string
  token?: string
}

function normalizeLoginResponse(payload: unknown): LoginResponse | null {
  const data = unwrapData<LooseLoginResponse>(payload)
  const accessToken = data?.accessToken ?? data?.access_token ?? data?.token
  const refreshToken = data?.refreshToken ?? data?.refresh_token

  if (!accessToken || !refreshToken || !data?.user) return null
  return { accessToken, refreshToken, user: data.user }
}

export const authService = {
  async login(username: string, password: string): Promise<LoginResponse> {
    const res = await api.post('/auth/login', { username, password })
    const data = normalizeLoginResponse(res.data)
    if (!data) {
      throw new Error("Login javobi noto'g'ri formatda qaytdi")
    }
    return data
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout').catch(() => {})
  },

  async getProfile(): Promise<User> {
    const res = await api.get('/auth/profile')
    return unwrapData<User>(res.data)
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await api.post('/auth/change-password', { currentPassword, newPassword })
  },
}
