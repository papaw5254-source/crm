import { api } from './api'
import type { BrickType, InventoryIncome, PaginatedResponse, PaginationParams } from '@/types'

type InventoryParams = PaginationParams & {
  brickType?: BrickType
}

type InventoryPayload = {
  quantity: number
  description?: string
  date: string
  workerRatePerBrick?: number
  workerPaidAmount?: number
  brickType?: BrickType
}

export const inventoryService = {
  async getAll(params?: InventoryParams): Promise<PaginatedResponse<InventoryIncome>> {
    const res = await api.get('/inventory/income', { params })
    return res.data.data
  },

  async getOne(id: string): Promise<InventoryIncome> {
    const res = await api.get(`/inventory/income/${id}`)
    return res.data.data
  },

  async create(data: InventoryPayload): Promise<InventoryIncome> {
    const res = await api.post('/inventory/income', { ...data, brickType: data.brickType ?? 'RAW_BRICK' })
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
