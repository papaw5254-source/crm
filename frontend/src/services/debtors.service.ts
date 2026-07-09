import { api, getApiPayload } from './api'
import type { Debtor, DebtPayment, PaginatedResponse, PaginationParams } from '@/types'

export const debtorsService = {
  async getAll(params?: PaginationParams & { isPaid?: boolean }): Promise<PaginatedResponse<Debtor>> {
    const res = await api.get('/debtors', { params })
    return getApiPayload(res.data)
  },

  async getOne(id: string): Promise<Debtor> {
    const res = await api.get(`/debtors/${id}`)
    return getApiPayload(res.data)
  },

  async addPayment(id: string, data: { amount: number; description?: string; date: string }): Promise<DebtPayment> {
    const res = await api.post(`/debtors/${id}/pay`, data)
    return getApiPayload(res.data)
  },

  async getPayments(id: string): Promise<PaginatedResponse<DebtPayment>> {
    const res = await api.get(`/debtors/${id}/payments`, { params: { limit: 100 } })
    return getApiPayload(res.data)
  },
}
