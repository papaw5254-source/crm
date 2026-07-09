import { api, getApiPayload } from './api'
import type { User, PaginatedResponse, PaginationParams } from '@/types'

export interface CreateUserDto {
  fullName: string
  phone?: string
  username: string
  password: string
  role?: 'ADMIN' | 'EMPLOYEE'
}

export const usersService = {
  async getAll(params?: PaginationParams): Promise<PaginatedResponse<User>> {
    const res = await api.get('/users', { params })
    return getApiPayload(res.data)
  },

  async getOne(id: string): Promise<User> {
    const res = await api.get(`/users/${id}`)
    return getApiPayload(res.data)
  },

  async create(data: CreateUserDto): Promise<User> {
    const res = await api.post('/users', data)
    return getApiPayload(res.data)
  },

  async update(id: string, data: Partial<CreateUserDto & { isActive: boolean }>): Promise<User> {
    const res = await api.patch(`/users/${id}`, data)
    return getApiPayload(res.data)
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/users/${id}`)
  },

  async updateProfile(data: { fullName: string }): Promise<User> {
    const res = await api.patch('/auth/profile', data)
    return getApiPayload(res.data)
  },

  async changePassword(data: { currentPassword: string; newPassword: string; confirmPassword: string }): Promise<void> {
    await api.post('/auth/change-password', {
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
    })
  },
}
