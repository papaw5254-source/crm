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

function decodeJwtUser(token: string): Partial<User> | null {
  try {
    const [, payload] = token.split('.')
    if (!payload) return null
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const json = JSON.parse(atob(normalized))
    return {
      id: json.sub || json.id || json.userId || '',
      username: json.username || json.phone || json.login || 'user',
      fullName: json.fullName || json.name || json.username || json.phone || 'User',
      phone: json.phone,
      role: json.role || 'EMPLOYEE',
      isActive: true,
      createdAt: '',
      updatedAt: '',
    }
  } catch {
    return null
  }
}

function findJwtToken(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'string') {
    return value.split('.').length === 3 ? value : null
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findJwtToken(item)
      if (found) return found
    }
    return null
  }
  if (typeof value === 'object') {
    for (const item of Object.values(value as Record<string, unknown>)) {
      const found = findJwtToken(item)
      if (found) return found
    }
  }
  return null
}

function findUserLike(value: unknown): Partial<User> | null {
  if (!value || typeof value !== 'object') return null
  const obj = value as Record<string, any>

  if (obj.user && typeof obj.user === 'object') return obj.user
  if (obj.profile && typeof obj.profile === 'object') return obj.profile
  if (obj.account && typeof obj.account === 'object') return obj.account
  if (obj.currentUser && typeof obj.currentUser === 'object') return obj.currentUser
  if (obj.userData && typeof obj.userData === 'object') return obj.userData

  if (obj.id || obj.sub || obj.username || obj.fullName || obj.phone) {
    return {
      id: obj.id || obj.sub || obj.userId || '',
      username: obj.username || obj.phone || obj.login || 'user',
      fullName: obj.fullName || obj.name || obj.username || obj.phone || 'User',
      phone: obj.phone,
      role: obj.role || 'EMPLOYEE',
      isActive: obj.isActive ?? true,
      createdAt: obj.createdAt || '',
      updatedAt: obj.updatedAt || '',
    }
  }

  for (const item of Object.values(obj)) {
    const found = findUserLike(item)
    if (found) return found
  }
  return null
}

function normalizeLoginResponse(response: unknown): LoginResponse {
  const payload = unwrapResponse(response)
  const tokens = payload?.tokens || payload?.auth || payload?.session || {}
  const rawAccessToken =
    payload?.accessToken ||
    payload?.access_token ||
    payload?.jwt ||
    payload?.token ||
    payload?.access?.token ||
    tokens?.accessToken ||
    tokens?.access_token ||
    tokens?.token
  const accessToken =
    typeof rawAccessToken === 'string'
      ? rawAccessToken
      : findJwtToken(rawAccessToken) || findJwtToken(payload)
  const refreshToken =
    payload?.refreshToken ||
    payload?.refresh_token ||
    payload?.refresh?.token ||
    tokens?.refreshToken ||
    tokens?.refresh_token ||
    ''
  const user =
    payload?.user ||
    payload?.profile ||
    payload?.account ||
    payload?.currentUser ||
    payload?.userData ||
    (payload?.id || payload?.username || payload?.fullName ? payload : null) ||
    findUserLike(payload) ||
    (typeof accessToken === 'string' ? decodeJwtUser(accessToken) : null)

  if (!accessToken) {
    throw new Error("Login javobi noto'g'ri formatda qaytdi. Backend /api/auth/login javobini tekshiring.")
  }

  const safeUser = (user || {
    id: '',
    username: 'user',
    fullName: 'User',
    role: 'EMPLOYEE',
    isActive: true,
    createdAt: '',
    updatedAt: '',
  }) as User

  return { user: safeUser, accessToken, refreshToken }
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
