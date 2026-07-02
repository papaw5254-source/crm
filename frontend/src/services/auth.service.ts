import { api } from './api'
import type { LoginResponse, User } from '@/types'

export const authService = {
  async login(username: string, password: string): Promise<LoginResponse> {
    const res = await api.post('/auth/login', { username, password })
    return res.data.data
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout').catch(() => {})
  },

  async getProfile(): Promise<User> {
    const res = await api.get('/auth/profile')
    return res.data.data
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await api.post('/auth/change-password', { currentPassword, newPassword })
  },
}
