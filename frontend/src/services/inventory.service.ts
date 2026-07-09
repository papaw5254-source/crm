import { api, getApiPayload } from './api'
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
    return getApiPayload<PaginatedResponse<InventoryIncome>>(res.data)
  },

  async getOne(id: string): Promise<InventoryIncome> {
    const res = await api.get(`/inventory/income/${id}`)
    return getApiPayload<InventoryIncome>(res.data)
  },

  async create(data: InventoryPayload): Promise<InventoryIncome> {
    const res = await api.post('/inventory/income', { ...data, brickType: data.brickType ?? 'RAW_BRICK' })
    return getApiPayload<InventoryIncome>(res.data)
  },

  async update(id: string, data: Partial<InventoryPayload>): Promise<InventoryIncome> {
    const res = await api.patch(`/inventory/income/${id}`, data)
    return getApiPayload<InventoryIncome>(res.data)
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/inventory/income/${id}`)
  },
}
