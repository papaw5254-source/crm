import { api } from './api'
import type { Sale, PaginatedResponse, PaginationParams, PaymentType } from '@/types'

export interface CreateSaleDto {
  quantity: number
  pricePerBrick: number
  paymentType: PaymentType
  customerName?: string
  customerPhone?: string
  description?: string
  date: string
}

export const salesService = {
  async getAll(params?: PaginationParams): Promise<PaginatedResponse<Sale>> {
    const res = await api.get('/sales', { params })
    return res.data.data
  },

  async getOne(id: string): Promise<Sale> {
    const res = await api.get(`/sales/${id}`)
    return res.data.data
  },

  async create(data: CreateSaleDto): Promise<Sale> {
    const res = await api.post('/sales', data)
    return res.data.data
  },

  async update(id: string, data: Partial<CreateSaleDto>): Promise<Sale> {
    const res = await api.patch(`/sales/${id}`, data)
    return res.data.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/sales/${id}`)
  },
}
