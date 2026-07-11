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
  workerRatePerBrick?: number
  workerPaidAmount?: number
}

export const kilnService = {
  async getAll(params?: PaginationParams & { kilnName?: string; dateFrom?: string; dateTo?: string }): Promise<PaginatedResponse<KilnOperation>> {
    const res = await api.get('/kilns/operations', { params })
    const raw = res.data.data
    if (Array.isArray(raw)) {
      return { data: raw, meta: { total: raw.length, page: 1, limit: raw.length, totalPages: 1 } }
    }
    return raw
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

  async getBakedOutput(date: string, kilnName: string): Promise<number> {
    const res = await api.get('/kilns/operations', { params: { dateFrom: date, dateTo: date, limit: 100 } })
    const paged: PaginatedResponse<KilnOperation> = res.data.data
    const ops = (paged?.data ?? []).filter((op) => op.kilnName === kilnName)
    return ops.reduce((s, op) => s + Number(op.bakedBricksOutput || 0), 0)
  },

  async getReport(params?: { dateFrom?: string; dateTo?: string; kilnName?: string }) {
    const res = await api.get('/kilns/report', { params })
    return res.data.data
  },
}
