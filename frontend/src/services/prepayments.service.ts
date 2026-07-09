import { api, getApiPayload } from './api'
import type { Prepayment, PrepaymentDelivery, PaginatedResponse, PaginationParams } from '@/types'

function asPaginatedPrepayments(value: any): PaginatedResponse<Prepayment> {
  const payload = getApiPayload<any>(value)
  if (payload?.meta && Array.isArray(payload?.data)) return payload
  if (Array.isArray(payload)) {
    return {
      data: payload,
      meta: { total: payload.length, page: 1, limit: payload.length || 10, totalPages: 1 },
    }
  }
  return { data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } }
}

function asDeliveries(value: any): PrepaymentDelivery[] {
  const payload = getApiPayload<any>(value)
  if (Array.isArray(payload)) return payload.filter(Boolean)
  if (Array.isArray(payload?.data)) return payload.data.filter(Boolean)
  return []
}

export interface CreatePrepaymentDto {
  customerName?: string
  customerPhone?: string
  brickType: string
  quantity: number
  pricePerBrick: number
  paidAmount: number
  date: string
  paymentType?: string
  description?: string
}

export interface DeliverPrepaymentDto {
  quantity: number
  date: string
  description?: string
}

export const prepaymentsService = {
  async getAll(params?: PaginationParams & { status?: string; brickType?: string }): Promise<PaginatedResponse<Prepayment>> {
    const res = await api.get('/prepayments', { params })
    return asPaginatedPrepayments(res.data)
  },

  async getOne(id: string): Promise<Prepayment> {
    const res = await api.get(`/prepayments/${id}`)
    return getApiPayload<Prepayment>(res.data)
  },

  async create(data: CreatePrepaymentDto): Promise<Prepayment> {
    const res = await api.post('/prepayments', data)
    return getApiPayload<Prepayment>(res.data)
  },

  async update(id: string, data: Partial<CreatePrepaymentDto> & { status?: string }): Promise<Prepayment> {
    const res = await api.patch(`/prepayments/${id}`, data)
    return getApiPayload<Prepayment>(res.data)
  },

  async deliver(id: string, data: DeliverPrepaymentDto): Promise<PrepaymentDelivery> {
    const res = await api.post(`/prepayments/${id}/deliver`, data)
    return getApiPayload<PrepaymentDelivery>(res.data)
  },

  async getDeliveries(id: string): Promise<PrepaymentDelivery[]> {
    const res = await api.get(`/prepayments/${id}/deliveries`)
    return asDeliveries(res.data)
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/prepayments/${id}`)
  },
}
