import { api } from './api'
import type { WorkerPayment, WorkerPaymentReport, PaginatedResponse, PaginationParams } from '@/types'

export interface CreateWorkerPaymentDto {
  workerName: string
  category: string
  debtFromPreviousMonth?: number
  amount: number
  paidAmount: number
  month?: string | number
  year?: number
  date: string
  description?: string
  sourceType?: string
  sourceId?: string
}

export const workerPaymentsService = {
  async getAll(params?: PaginationParams & { category?: string; month?: number; year?: number; debtOnly?: boolean }): Promise<PaginatedResponse<WorkerPayment>> {
    const { month, year, ...rest } = params || {}
    const monthKey = month && year ? `${year}-${String(month).padStart(2, '0')}` : undefined
    const res = await api.get('/worker-payments', { params: { ...rest, ...(monthKey ? { month: monthKey } : {}) } })
    return res.data.data
  },

  async create(data: CreateWorkerPaymentDto): Promise<WorkerPayment> {
    const res = await api.post('/worker-payments', data)
    return res.data.data
  },

  async update(id: string, data: Partial<CreateWorkerPaymentDto>): Promise<WorkerPayment> {
    const res = await api.patch(`/worker-payments/${id}`, data)
    return res.data.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/worker-payments/${id}`)
  },

  async getReport(params?: { month?: number; year?: number }): Promise<WorkerPaymentReport> {
    const res = await api.get('/worker-payments/report', { params })
    return res.data.data
  },
}
