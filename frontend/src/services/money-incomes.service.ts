import { api } from './api'
import type { MoneyIncome, PaginatedResponse, PaginationParams } from '@/types'

export interface CreateMoneyIncomeDto {
  amount: number
  source: string
  fromWhom?: string
  description?: string
  date: string
}

function unwrapPayload<T = any>(value: any): T {
  if (value?.meta && Array.isArray(value?.data)) return value as T

  let current = value
  for (let i = 0; i < 3; i += 1) {
    if (current?.data === undefined) break
    if (current.data?.meta && Array.isArray(current.data?.data)) return current.data as T
    current = current.data
  }

  return current as T
}

export const moneyIncomesService = {
  async getAll(params?: PaginationParams & { source?: string }): Promise<PaginatedResponse<MoneyIncome>> {
    const res = await api.get('/money-incomes', { params })
    return unwrapPayload<PaginatedResponse<MoneyIncome>>(res.data)
  },

  async create(data: CreateMoneyIncomeDto): Promise<MoneyIncome> {
    const res = await api.post('/money-incomes', data)
    return unwrapPayload<MoneyIncome>(res.data)
  },

  async update(id: string, data: Partial<CreateMoneyIncomeDto>): Promise<MoneyIncome> {
    const res = await api.patch(`/money-incomes/${id}`, data)
    return unwrapPayload<MoneyIncome>(res.data)
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/money-incomes/${id}`)
  },
}
