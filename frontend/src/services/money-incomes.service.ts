import { api, getApiPayload } from './api'
import type { MoneyIncome, PaginatedResponse, PaginationParams } from '@/types'

export interface CreateMoneyIncomeDto {
  amount: number
  source: string
  fromWhom?: string
  description?: string
  date: string
}

export const moneyIncomesService = {
  async getAll(params?: PaginationParams & { source?: string }): Promise<PaginatedResponse<MoneyIncome>> {
    const res = await api.get('/money-incomes', { params })
    return getApiPayload<PaginatedResponse<MoneyIncome>>(res.data)
  },

  async create(data: CreateMoneyIncomeDto): Promise<MoneyIncome> {
    const res = await api.post('/money-incomes', data)
    return getApiPayload<MoneyIncome>(res.data)
  },

  async update(id: string, data: Partial<CreateMoneyIncomeDto>): Promise<MoneyIncome> {
    const res = await api.patch(`/money-incomes/${id}`, data)
    return getApiPayload<MoneyIncome>(res.data)
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/money-incomes/${id}`)
  },
}
