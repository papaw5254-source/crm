import axios from 'axios'

const API_URL = '/api'

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken')
    if (token) {
      if (token !== 'undefined' && token !== 'null') {
        config.headers.Authorization = `Bearer ${token}`
      }
    }
  }

  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      localStorage.removeItem('user')
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login'
      }
    }

    return Promise.reject(error)
  },
)

export function getErrorMessage(error: any): string {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    "Xatolik yuz berdi"
  )
}

export function getApiPayload<T = any>(value: any): T {
  let current = value

  for (let i = 0; i < 5; i += 1) {
    if (current?.meta && current?.data !== undefined) break
    if (current?.data !== undefined) {
      current = current.data
      continue
    }
    break
  }

  return current as T
}

export function getApiList<T = any>(value: any): T[] {
  const payload = getApiPayload<any>(value)

  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.results)) return payload.results

  return []
}

export default api
