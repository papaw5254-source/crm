import { api, getApiPayload } from './api'
import type { Expense, ExpenseCategory, PaginatedResponse, PaginationParams } from '@/types'

export interface CreateExpenseDto {
  amount: number
  category: ExpenseCategory
  description?: string
  date: string
}

export const expensesService = {
  async getAll(params?: PaginationParams & { category?: ExpenseCategory }): Promise<PaginatedResponse<Expense>> {
    const res = await api.get('/expenses', { params })
    return getApiPayload(res.data)
  },

  async getOne(id: string): Promise<Expense> {
    const res = await api.get(`/expenses/${id}`)
    return getApiPayload(res.data)
  },

  async create(data: CreateExpenseDto): Promise<Expense> {
    const res = await api.post('/expenses', data)
    return getApiPayload(res.data)
  },

  async update(id: string, data: Partial<CreateExpenseDto>): Promise<Expense> {
    const res = await api.patch(`/expenses/${id}`, data)
    return getApiPayload(res.data)
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/expenses/${id}`)
  },
}
