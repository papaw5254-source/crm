import { api } from './api'
import type { SalaryAdvance, SalaryWorker } from '@/types'

export const salaryWorkersService = {
  async getAll(params?: { month?: string; search?: string }): Promise<SalaryWorker[]> {
    const res = await api.get('/salary-workers', { params })
    return res.data.data
  },

  async getOne(id: string): Promise<SalaryWorker> {
    const res = await api.get(`/salary-workers/${id}`)
    return res.data.data
  },

  async create(data: { fullName: string; month: string; salaryAmount: number; notes?: string }): Promise<SalaryWorker> {
    const res = await api.post('/salary-workers', data)
    return res.data.data
  },

  async update(id: string, data: Partial<{ fullName: string; month: string; salaryAmount: number; notes?: string }>): Promise<SalaryWorker> {
    const res = await api.patch(`/salary-workers/${id}`, data)
    return res.data.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/salary-workers/${id}`)
  },

  async addAdvance(id: string, data: { amount: number; date: string; description?: string }): Promise<SalaryAdvance> {
    const res = await api.post(`/salary-workers/${id}/advances`, data)
    return res.data.data
  },

  async deleteAdvance(id: string, advanceId: string): Promise<void> {
    await api.delete(`/salary-workers/${id}/advances/${advanceId}`)
  },
}
