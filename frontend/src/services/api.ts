import axios from 'axios'

const API_URL = '/api'

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

function normalizeApiResponse(data: unknown) {
  if (
    data &&
    typeof data === 'object' &&
    'data' in data &&
    ('success' in data || 'timestamp' in data)
  ) {
    return data
  }

  return { data }
}

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }

  return config
})

api.interceptors.response.use(
  (response) => {
    response.data = normalizeApiResponse(response.data)
    return response
  },
  (error) => {
    if (error?.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      localStorage.removeItem('user')
    }

    return Promise.reject(error)
  },
)

export default api
