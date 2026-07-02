import { api } from './api'
import type { Prepayment, PrepaymentDelivery, PaginatedResponse, PaginationParams } from '@/types'

export interface CreatePrepaymentDto {
  customerName: string
  customerPhone?: string
  brickType: string
  quantity: number
  pricePerBrick: number
  paidAmount: number
  notes?: string
}

export interface DeliverPrepaymentDto {
  quantity: number
  notes?: string
}

export const prepaymentsService = {
  async getAll(params?: PaginationParams & { status?: string; brickType?: string }): Promise<PaginatedResponse<Prepayment>> {
    const res = await api.get('/prepayments', { params })
    return res.data.data
  },

  async getOne(id: string): Promise<Prepayment> {
    const res = await api.get(`/prepayments/${id}`)
    return res.data.data
  },

  async create(data: CreatePrepaymentDto): Promise<Prepayment> {
    const res = await api.post('/prepayments', data)
    return res.data.data
  },

  async update(id: string, data: Partial<CreatePrepaymentDto> & { status?: string }): Promise<Prepayment> {
    const res = await api.patch(`/prepayments/${id}`, data)
    return res.data.data
  },

  async deliver(id: string, data: DeliverPrepaymentDto): Promise<PrepaymentDelivery> {
    const res = await api.post(`/prepayments/${id}/deliver`, data)
    return res.data.data
  },

  async getDeliveries(id: string): Promise<PrepaymentDelivery[]> {
    const res = await api.get(`/prepayments/${id}/deliveries`)
    return res.data.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/prepayments/${id}`)
  },
}
