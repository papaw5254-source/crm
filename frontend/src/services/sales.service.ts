import api from './api'

export type PaymentType = 'CASH' | 'BANK_TRANSFER' | 'DEBT' | string
export type BrickType = 'RAW_BRICK' | 'BAKED_BRICK' | string

export interface Sale {
  id: string
  date?: string
  brickType?: BrickType
  quantity?: number
  pricePerUnit?: number
  totalAmount?: number
  paidAmount?: number
  debtAmount?: number
  paymentType?: PaymentType
  customerName?: string
  customerPhone?: string
  firmName?: string
  factoryName?: string
  vehicleNumber?: string
  notes?: string
  createdAt?: string
  updatedAt?: string
  [key: string]: any
}

export interface CreateSaleDto {
  date?: string
  brickType?: BrickType
  quantity?: number
  pricePerBrick?: number
  pricePerUnit?: number
  totalAmount?: number
  paidAmount?: number
  debtAmount?: number
  paymentType?: PaymentType
  isReserveSale?: boolean
  workerRatePerBrick?: number
  workerPaidAmount?: number
  customerName?: string
  customerPhone?: string
  firmName?: string
  factoryName?: string
  vehicleNumber?: string
  notes?: string
  [key: string]: any
}

export type UpdateSaleDto = Partial<CreateSaleDto>
export type CreateSaleData = CreateSaleDto
export type UpdateSaleData = UpdateSaleDto
export type SaleFormData = CreateSaleDto

export interface SaleQuery {
  page?: number
  limit?: number
  search?: string
  brickType?: BrickType
  paymentType?: PaymentType
  startDate?: string
  endDate?: string
  [key: string]: any
}

export interface PaginatedSales {
  data: Sale[]
  meta?: {
    total?: number
    page?: number
    limit?: number
    totalPages?: number
    [key: string]: any
  }
  [key: string]: any
}

export type SalesResponse = PaginatedSales
export type SalesQuery = SaleQuery
export type SalesQueryParams = SaleQuery

function unwrapPayload<T = any>(value: any): T {
  if (value?.meta && Array.isArray(value?.data)) return value as T

  let current = value
  for (let i = 0; i < 4; i += 1) {
    if (current?.meta && Array.isArray(current?.data)) return current as T
    if (current?.data !== undefined) {
      current = current.data
      continue
    }
    break
  }

  return current as T
}

function asPaginatedSales(value: any): PaginatedSales {
  const payload = unwrapPayload<any>(value)

  if (payload?.meta && Array.isArray(payload?.data)) {
    return payload
  }

  if (Array.isArray(payload)) {
    return {
      data: payload,
      meta: {
        total: payload.length,
        page: 1,
        limit: payload.length,
        totalPages: 1,
      },
    }
  }

  if (Array.isArray(payload?.items)) {
    return {
      data: payload.items,
      meta: payload.meta,
    }
  }

  if (Array.isArray(payload?.results)) {
    return {
      data: payload.results,
      meta: payload.meta,
    }
  }

  return {
    data: [],
    meta: {
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    },
  }
}

function normalizeSalePayload(data: CreateSaleDto | UpdateSaleDto) {
  const payload: Record<string, any> = { ...data }

  delete payload.workerPayment
  delete payload.workerPaymentAmount
  delete payload.workerPrice
  delete payload.workerDebtAmount
  delete payload.workerPaymentNote
  delete payload.workerPaymentId
  delete payload.totalAmount
  delete payload.paidAmount
  delete payload.debtAmount
  delete payload.pricePerUnit

  if (data.quantity !== undefined) payload.quantity = Number(data.quantity)
  if (data.pricePerBrick !== undefined) payload.pricePerBrick = Number(data.pricePerBrick)
  if (data.workerRatePerBrick !== undefined) payload.workerRatePerBrick = Number(data.workerRatePerBrick)
  if (data.workerPaidAmount !== undefined) payload.workerPaidAmount = Number(data.workerPaidAmount)

  return payload
}

async function deleteSaleById(id: string) {
  if (!id) {
    throw new Error('Sale id is required')
  }

  const response = await api.delete(`/sales/${id}`)
  return unwrapPayload(response.data)
}

export const salesService = {
  async getAll(params?: SaleQuery): Promise<PaginatedSales> {
    const response = await api.get('/sales', { params })
    return asPaginatedSales(response.data)
  },

  async getRegular(params?: SaleQuery): Promise<PaginatedSales> {
    const response = await api.get('/sales/regular', { params })
    return asPaginatedSales(response.data)
  },

  async getSales(params?: SaleQuery): Promise<PaginatedSales> {
    return this.getAll(params)
  },

  async getOne(id: string): Promise<Sale> {
    const response = await api.get(`/sales/${id}`)
    return unwrapPayload<Sale>(response.data)
  },

  async getById(id: string): Promise<Sale> {
    return this.getOne(id)
  },

  async create(data: CreateSaleDto): Promise<Sale> {
    const response = await api.post('/sales', normalizeSalePayload(data))
    return unwrapPayload<Sale>(response.data)
  },

  async createSale(data: CreateSaleDto): Promise<Sale> {
    return this.create(data)
  },

  async update(id: string, data: UpdateSaleDto): Promise<Sale> {
    const response = await api.patch(`/sales/${id}`, normalizeSalePayload(data))
    return unwrapPayload<Sale>(response.data)
  },

  async updateSale(id: string, data: UpdateSaleDto): Promise<Sale> {
    return this.update(id, data)
  },

  async delete(id: string) {
    return deleteSaleById(id)
  },

  async remove(id: string) {
    return deleteSaleById(id)
  },

  async deleteSale(id: string) {
    return deleteSaleById(id)
  },

  async getStats(params?: SaleQuery) {
    const response = await api.get('/sales/stats', { params })
    return unwrapPayload(response.data)
  },

  async getBankTransferFirms(): Promise<string[]> {
    const response = await api.get('/sales/firms/bank-transfer')
    const payload = unwrapPayload<any>(response.data)
    if (Array.isArray(payload)) return payload
    if (Array.isArray(payload?.data)) return payload.data
    return []
  },

  async getDebtFirms(): Promise<string[]> {
    const response = await api.get('/sales/firms/debt')
    const payload = unwrapPayload<any>(response.data)
    if (Array.isArray(payload)) return payload
    if (Array.isArray(payload?.data)) return payload.data
    return []
  },

  async getFirmNames(): Promise<string[]> {
    const response = await api.get('/sales/firms')
    const payload = unwrapPayload<any>(response.data)
    if (Array.isArray(payload)) return payload
    if (Array.isArray(payload?.data)) return payload.data
    return []
  },
}

export default salesService
