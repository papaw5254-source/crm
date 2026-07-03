import { api } from './api'
import type { InventoryIncome, PaginatedResponse, PaginationParams } from '@/types'

export const inventoryService = {
  async getAll(params?: PaginationParams): Promise<PaginatedResponse<InventoryIncome>> {
    const res = await api.get('/inventory/income', { params })
    return res.data.data
  },

  async getOne(id: string): Promise<InventoryIncome> {
    const res = await api.get(`/inventory/income/${id}`)
    return res.data.data
  },

  async create(data: { quantity: number; description?: string; date: string; workerRatePerBrick?: number; workerPaidAmount?: number }): Promise<InventoryIncome> {
    const res = await api.post('/inventory/income', data)
    return res.data.data
  },

  async update(id: string, data: Partial<{ quantity: number; description: string; date: string }>): Promise<InventoryIncome> {
    const res = await api.patch(`/inventory/income/${id}`, data)
    return res.data.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/inventory/income/${id}`)
  },
}
