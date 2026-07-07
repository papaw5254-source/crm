import { api } from './api'
import type { Sale, PaginatedResponse, PaginationParams, PaymentType } from '@/types'

export interface CreateSaleDto {
  brickType?: string
  quantity: number
  pricePerBrick: number
  paymentType: PaymentType
  customerName?: string
  customerPhone?: string
  description?: string
  date: string
  isReserveSale?: boolean
  workerRatePerBrick?: number
  workerPaidAmount?: number
}

export interface BankTransferFirm {
  firmName: string
  totalSales: number
  totalQuantity: number
  totalAmount: number
  sales: Sale[]
}

export const salesService = {
  async getAll(params?: PaginationParams & { isReserveSale?: boolean }): Promise<PaginatedResponse<Sale>> {
    const res = await api.get('/sales', { params })
    if (res.data?.meta && Array.isArray(res.data?.data)) return res.data
    if (res.data?.meta && Array.isArray(res.data?.data)) return res.data
    if (res.data?.meta && Array.isArray(res.data?.data)) return res.data
    if (res.data?.meta && Array.isArray(res.data?.data)) return res.data
    if (res.data?.meta && Array.isArray(res.data?.data)) return res.data
    if (res.data?.meta && Array.isArray(res.data?.data)) return res.data
    if (res.data?.meta && Array.isArray(res.data?.data)) return res.data
    if (res.data?.meta && Array.isArray(res.data?.data)) return res.data
    if (res.data?.meta && Array.isArray(res.data?.data)) return res.data
    if (res.data?.meta && Array.isArray(res.data?.data)) return res.data
    if (res.data?.meta && Array.isArray(res.data?.data)) return res.data
    if (res.data?.meta && Array.isArray(res.data?.data)) return res.data
    if (res.data?.meta && Array.isArray(res.data?.data)) return res.data
    if (res.data?.meta && Array.isArray(res.data?.data)) return res.data
    if (res.data?.meta && Array.isArray(res.data?.data)) return res.data
    if (res.data?.meta && Array.isArray(res.data?.data)) return res.data
    if (res.data?.meta && Array.isArray(res.data?.data)) return res.data
    if (res.data?.meta && Array.isArray(res.data?.data)) return res.data
    if (res.data?.meta && Array.isArray(res.data?.data)) return res.data
    if (res.data?.meta && Array.isArray(res.data?.data)) return res.data
    return res.data?.data ?? res.data
  },

  async getBankTransferFirms(): Promise<BankTransferFirm[]> {
    const res = await api.get('/sales/bank-transfer/firms')
    return res.data?.data ?? res.data
  },

  async getDebtFirms(): Promise<BankTransferFirm[]> {
    const res = await api.get('/sales/debt/firms')
    return res.data?.data ?? res.data
  },

  async getFirmNames(): Promise<string[]> {
    const res = await api.get('/sales/firm-names')
    return res.data?.data ?? res.data
  },

  async getOne(id: string): Promise<Sale> {
    const res = await api.get(`/sales/${id}`)
    return res.data?.data ?? res.data
  },

  async create(data: CreateSaleDto): Promise<Sale> {
    const res = await api.post('/sales', data)
    return res.data?.data ?? res.data
  },

  async update(id: string, data: Partial<CreateSaleDto>): Promise<Sale> {
    const res = await api.patch(`/sales/${id}`, data)
    return res.data?.data ?? res.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/sales/${id}`)
  },
}
