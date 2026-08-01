import { api } from './api'
import type { FuelExpense, FuelIncome, FuelLedgerRow } from '@/types'

export const fuelService = {
  async getIncomes(params?: { date?: string; dateFrom?: string; dateTo?: string }): Promise<FuelIncome[]> {
    const res = await api.get('/fuel/incomes', { params })
    return res.data.data
  },

  async createIncome(data: { liters: number; pricePerLiter: number; paymentType: string; date: string; description?: string }): Promise<FuelIncome> {
    const res = await api.post('/fuel/incomes', data)
    return res.data.data
  },

  async deleteIncome(id: string): Promise<void> {
    await api.delete(`/fuel/incomes/${id}`)
  },

  async getExpenses(params?: { date?: string; dateFrom?: string; dateTo?: string; destination?: string }): Promise<FuelExpense[]> {
    const res = await api.get('/fuel/expenses', { params })
    return res.data.data
  },

  async createExpense(data: { liters: number; destination: string; date: string; description?: string }): Promise<FuelExpense> {
    const res = await api.post('/fuel/expenses', data)
    return res.data.data
  },

  async getExpenseDestinations(): Promise<string[]> {
    const res = await api.get('/fuel/expenses/destinations')
    return res.data.data
  },

  async deleteExpense(id: string): Promise<void> {
    await api.delete(`/fuel/expenses/${id}`)
  },

  async getBalance(): Promise<number> {
    const res = await api.get('/fuel/balance')
    return res.data.data.balance
  },

  async getLedger(params?: { dateFrom?: string; dateTo?: string }): Promise<FuelLedgerRow[]> {
    const res = await api.get('/fuel/ledger', { params })
    return res.data.data
  },
}
