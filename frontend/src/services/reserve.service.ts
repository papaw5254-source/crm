import { api } from './api'
import type { ReserveMovement, ReserveBalance, PaginatedResponse, PaginationParams } from '@/types'

export interface CreateReserveMovementDto {
  brickType: string
  movementType: string
  quantity: number
  reason?: string
  date: string
  customerName?: string
  customerPhone?: string
  workerRatePerBrick?: number
  workerPaidAmount?: number
}

export const reserveService = {
  async getAll(params?: PaginationParams & { brickType?: string; movementType?: string }): Promise<PaginatedResponse<ReserveMovement>> {
    const res = await api.get('/reserve/movements', { params })
    return res.data.data
  },

  async create(data: CreateReserveMovementDto): Promise<ReserveMovement> {
    const res = await api.post('/reserve/movements', data)
    return res.data.data
  },

  async update(id: string, data: CreateReserveMovementDto): Promise<ReserveMovement> {
    const res = await api.patch(`/reserve/movements/${id}`, data)
    return res.data.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/reserve/movements/${id}`)
  },

  async getBalance(): Promise<ReserveBalance> {
    const res = await api.get('/reserve/balance')
    return res.data.data
  },

  async getReport(params?: { dateFrom?: string; dateTo?: string }) {
    const res = await api.get('/reserve/report', { params })
    return res.data.data
  },
}
