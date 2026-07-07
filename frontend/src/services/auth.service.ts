import { api } from './api'
import type { LoginResponse, User } from '@/types'

type LoginInput = {
  username?: string
  phone?: string
  password: string
}

export type LoginCredentials = LoginInput
export type AuthResponse = LoginResponse

function unwrapResponse(value: unknown): any {
  let current: any = value
  for (let i = 0; i < 4; i += 1) {
    if (current?.data && typeof current.data === 'object') {
      current = current.data
    } else {
      break
    }
  }
  return current
}

function normalizeLoginResponse(response: unknown): LoginResponse {
  const payload = unwrapResponse(response)
  const tokens = payload?.tokens || payload?.token || {}
  const user = payload?.user || payload?.profile || payload?.data?.user
  const accessToken =
    payload?.accessToken ||
    payload?.access_token ||
    tokens?.accessToken ||
    tokens?.access_token
  const refreshToken =
    payload?.refreshToken ||
    payload?.refresh_token ||
    tokens?.refreshToken ||
    tokens?.refresh_token ||
    ''

  if (!user || !accessToken) {
    throw new Error("Login javobi noto'g'ri formatda qaytdi. Backend /api/auth/login javobini tekshiring.")
  }

  return { user, accessToken, refreshToken }
}

export const authService = {
  async login(usernameOrInput: string | LoginInput, password?: string): Promise<LoginResponse> {
    const body =
      typeof usernameOrInput === 'string'
        ? { username: usernameOrInput, password }
        : usernameOrInput

    const res = await api.post('/auth/login', body)
    return normalizeLoginResponse(res.data)
  },

  async getProfile(): Promise<User> {
    const res = await api.get('/auth/profile')
    const payload = unwrapResponse(res.data)
    return payload?.user || payload
  },

  async me(): Promise<User> {
    const res = await api.get('/auth/profile')
    const payload = unwrapResponse(res.data)
    return payload?.user || payload
  },

  async getMe(): Promise<User> {
    const res = await api.get('/auth/profile')
    const payload = unwrapResponse(res.data)
    return payload?.user || payload
  },

  async refresh(refreshToken: string): Promise<LoginResponse> {
    const res = await api.post('/auth/refresh', { refreshToken })
    return normalizeLoginResponse(res.data)
  },

  logout() {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('user')
  },
}

export default authService
