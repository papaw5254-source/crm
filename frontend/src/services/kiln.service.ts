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
  rawWorkerRatePerBrick?: number
  rawWorkerPaidAmount?: number
  bakedWorkerRatePerBrick?: number
  bakedWorkerPaidAmount?: number
  qachigarRatePerBrick?: number
  qachigarPaidAmount?: number
}

export const kilnService = {
  async getAll(params?: PaginationParams & { kilnName?: string; dateFrom?: string; dateTo?: string }): Promise<PaginatedResponse<KilnOperation>> {
    const res = await api.get('/kilns/operations', { params })
    return res.data?.data?.data ?? res.data?.data ?? res.data
  },

  async create(data: CreateKilnOperationDto): Promise<KilnOperation> {
    const res = await api.post('/kilns/operations', data)
    return res.data?.data?.data ?? res.data?.data ?? res.data
  },

  async update(id: string, data: Partial<CreateKilnOperationDto>): Promise<KilnOperation> {
    const res = await api.patch(`/kilns/operations/${id}`, data)
    return res.data?.data?.data ?? res.data?.data ?? res.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/kilns/operations/${id}`)
  },

  async getBakedOutput(date: string, kilnName: string): Promise<number> {
    const res = await api.get('/kilns/operations', { params: { dateFrom: date, dateTo: date, limit: 100 } })
    const raw = res.data?.data?.data ?? res.data?.data ?? res.data
    const arr: KilnOperation[] = Array.isArray(raw) ? raw : (raw?.data ?? [])
    return arr.filter((op) => op.kilnName === kilnName).reduce((s, op) => s + Number(op.bakedBricksOutput || 0), 0)
  },

  async getReport(params?: { dateFrom?: string; dateTo?: string; kilnName?: string }) {
    const res = await api.get('/kilns/report', { params })
    return res.data?.data?.data ?? res.data?.data ?? res.data
  },
}
