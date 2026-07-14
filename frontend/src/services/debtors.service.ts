import { api } from './api'
import type { Debtor, DebtPayment, PaginatedResponse, PaginationParams } from '@/types'

export const debtorsService = {
  async create(data: { fullName: string; phone?: string; notes?: string; oldDebt?: number; lastDebtDate?: string }): Promise<Debtor> {
    const res = await api.post('/debtors', data)
    return res.data.data
  },

  async getAll(params?: PaginationParams & { isPaid?: boolean }): Promise<PaginatedResponse<Debtor>> {
    const res = await api.get('/debtors', { params })
    return res.data.data
  },

  async getOne(id: string): Promise<Debtor> {
    const res = await api.get(`/debtors/${id}`)
    return res.data.data
  },

  async addPayment(id: string, data: { amount: number; description?: string; date: string }): Promise<DebtPayment> {
    const res = await api.post(`/debtors/${id}/pay`, data)
    return res.data.data
  },

  async getPayments(id: string): Promise<PaginatedResponse<DebtPayment>> {
    const res = await api.get(`/debtors/${id}/payments`, { params: { limit: 100 } })
    return res.data.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/debtors/${id}`)
  },
}
