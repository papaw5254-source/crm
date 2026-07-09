import { api } from './api'
import type { Stock, PaginatedResponse, StockMovement, PaginationParams } from '@/types'

export const stockService = {
  async getStock(): Promise<Stock[]> {
    const res = await api.get('/stock')
    const payload = res.data?.data ?? res.data
    if (Array.isArray(payload)) return payload
    if (Array.isArray(payload?.data)) return payload.data
    if (Array.isArray(payload?.items)) return payload.items
    if (Array.isArray(payload?.results)) return payload.results
    return []
  },

  async getMovements(params?: PaginationParams): Promise<PaginatedResponse<StockMovement>> {
    const res = await api.get('/stock/movements', { params })
    return res.data.data
  },

  async adjust(quantity: number, reason?: string): Promise<Stock> {
    const res = await api.patch('/stock/adjust', { quantity, reason })
    return res.data.data
  },
}
