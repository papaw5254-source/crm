import { api } from './api'
import type {
  DashboardData,
  DailyReport,
  MonthlyReport,
  YearlyReport,
  DebtReport,
  ExpenseReport,
  SalesReport,
  InventoryReport,
  StockReport,
  CashflowReport,
} from '@/types'

export const reportsService = {
  async getDashboard(): Promise<DashboardData> {
    const res = await api.get('/reports/dashboard')
    return res.data.data
  },

  async getDaily(date?: string): Promise<DailyReport> {
    const res = await api.get('/reports/daily', { params: { date } })
    return res.data.data
  },

  async getMonthly(year?: number, month?: number): Promise<MonthlyReport> {
    const res = await api.get('/reports/monthly', { params: { year, month } })
    return res.data.data
  },

  async getYearly(year?: number): Promise<YearlyReport> {
    const res = await api.get('/reports/yearly', { params: { year } })
    return res.data.data
  },

  async getDebts(): Promise<DebtReport> {
    const res = await api.get('/reports/debts')
    return res.data.data
  },

  async getExpenses(params?: { dateFrom?: string; dateTo?: string }): Promise<ExpenseReport> {
    const res = await api.get('/reports/expenses', { params })
    return res.data.data
  },

  async getSales(params?: { dateFrom?: string; dateTo?: string }): Promise<SalesReport> {
    const res = await api.get('/reports/sales', { params })
    return res.data.data
  },

  async getInventory(params?: { dateFrom?: string; dateTo?: string }): Promise<InventoryReport> {
    const res = await api.get('/reports/inventory', { params })
    return res.data.data
  },

  async getStock(): Promise<StockReport> {
    const res = await api.get('/reports/stock')
    return res.data.data
  },

  async getCashflow(params?: { dateFrom?: string; dateTo?: string }): Promise<CashflowReport> {
    const res = await api.get('/reports/cashflow', { params })
    return res.data.data
  },

  async getExcelStyle(date?: string): Promise<DailyReport> {
    const res = await api.get('/reports/excel-style', { params: { date } })
    return res.data.data
  },
}
