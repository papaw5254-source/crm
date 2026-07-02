import { api } from './api'
import type { KilnOperation, PaginatedResponse, PaginationParams } from '@/types'

export interface CreateKilnOperationDto {
  kilnName: string
  rawBricksEntered?: number
  bakedBricksOutput?: number
  rawBrickSource?: string
  responsibleWorker?: string
  date: string
  description?: string
}

export const kilnService = {
  async getAll(params?: PaginationParams & { kilnName?: string; dateFrom?: string; dateTo?: string }): Promise<PaginatedResponse<KilnOperation>> {
    const res = await api.get('/kilns/operations', { params })
    return res.data.data
  },

  async create(data: CreateKilnOperationDto): Promise<KilnOperation> {
    const res = await api.post('/kilns/operations', data)
    return res.data.data
  },

  async update(id: string, data: Partial<CreateKilnOperationDto>): Promise<KilnOperation> {
    const res = await api.patch(`/kilns/operations/${id}`, data)
    return res.data.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/kilns/operations/${id}`)
  },

  async getReport(params?: { dateFrom?: string; dateTo?: string; kilnName?: string }) {
    const res = await api.get('/kilns/report', { params })
    return res.data.data
  },
}
