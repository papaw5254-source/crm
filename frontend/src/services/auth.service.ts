import { api } from './api'
import type { LoginResponse, User } from '@/types'

function unwrapData<T>(payload: unknown): T {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as { data: T }).data
  }
  return payload as T
}

export const authService = {
  async login(username: string, password: string): Promise<LoginResponse> {
    const res = await api.post('/auth/login', { username, password })
    const data = unwrapData<LoginResponse>(res.data)
    if (!data?.accessToken || !data?.refreshToken || !data?.user) {
      throw new Error('Login javobi noto‘g‘ri formatda qaytdi')
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
