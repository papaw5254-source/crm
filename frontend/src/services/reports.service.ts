import api from './api'

type QueryValue = string | number | boolean | undefined | null
type QueryParams = Record<string, QueryValue>

function unwrap<T = any>(value: any): T {
  if (value?.data?.data !== undefined) return value.data.data as T
  if (value?.data !== undefined) return value.data as T
  return value as T
}

function cleanParams(params?: QueryParams) {
  if (!params) return undefined

  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  )
}

export const reportsService = {
  async getDashboard() {
    const response = await api.get('/reports/dashboard')
    return unwrap(response.data)
  },

  async getDaily(date?: string) {
    const response = await api.get('/reports/daily', {
      params: cleanParams({ date }),
    })
    return unwrap(response.data)
  },

  async getDailyReport(params?: QueryParams | string) {
    if (typeof params === 'string') return this.getDaily(params)
    const response = await api.get('/reports/daily', {
      params: cleanParams(params),
    })
    return unwrap(response.data)
  },

  async getMonthly(year?: number | string, month?: number | string) {
    const response = await api.get('/reports/monthly', {
      params: cleanParams({ year, month }),
    })
    return unwrap(response.data)
  },

  async getMonthlyReport(params?: QueryParams) {
    const response = await api.get('/reports/monthly', {
      params: cleanParams(params),
    })
    return unwrap(response.data)
  },

  async getYearly(year?: number | string) {
    const response = await api.get('/reports/yearly', {
      params: cleanParams({ year }),
    })
    return unwrap(response.data)
  },

  async getYearlyReport(params?: QueryParams) {
    const response = await api.get('/reports/yearly', {
      params: cleanParams(params),
    })
    return unwrap(response.data)
  },

  async getInventory(params?: QueryParams) {
    const response = await api.get('/reports/inventory', {
      params: cleanParams(params),
    })
    return unwrap(response.data)
  },

  async getInventoryReport(params?: QueryParams) {
    return this.getInventory(params)
  },

  async getStock() {
    const response = await api.get('/reports/stock')
    return unwrap(response.data)
  },

  async getDebts() {
    const response = await api.get('/reports/debts')
    return unwrap(response.data)
  },

  async getCashflow(params?: QueryParams) {
    const response = await api.get('/reports/cashflow', {
      params: cleanParams(params),
    })
    return unwrap(response.data)
  },

  async getCashflowReport(params?: QueryParams) {
    return this.getCashflow(params)
  },

  async getExcelStyle(params?: QueryParams) {
    const response = await api.get('/reports/excel-style', {
      params: cleanParams(params),
    })
    return unwrap(response.data)
  },

  async getExpenses(params?: QueryParams) {
    const response = await api.get('/reports/expenses', {
      params: cleanParams(params),
    })
    return unwrap(response.data)
  },

  async getExpenseReport(params?: QueryParams) {
    return this.getExpenses(params)
  },

  async getSales(params?: QueryParams) {
    const response = await api.get('/reports/sales', {
      params: cleanParams(params),
    })
    return unwrap(response.data)
  },

  async getSalesReport(params?: QueryParams) {
    return this.getSales(params)
  },
}

export default reportsService
