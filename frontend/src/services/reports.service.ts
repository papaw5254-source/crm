import api from './api'

type QueryValue = string | number | boolean | undefined | null
type QueryParams = Record<string, QueryValue>

function cleanParams(params?: QueryParams) {
  if (!params) return undefined

  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  )
}

function unwrap(value: any) {
  let current = value

  for (let i = 0; i < 5; i += 1) {
    if (current?.data !== undefined) {
      current = current.data
      continue
    }
    break
  }

  return current
}

function safeReport(value: any) {
  const payload = unwrap(value) ?? {}

  if (Array.isArray(payload)) {
    return {
      data: payload,
      total: payload.length,
      totals: {},
      summary: {},
      items: payload,
    }
  }

  const data = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload?.results)
        ? payload.results
        : []

  return {
    data,
    items: data,
    results: data,
    total: payload?.total ?? payload?.meta?.total ?? data.length ?? 0,
    totals: payload?.totals ?? payload?.summary ?? {},
    summary: payload?.summary ?? payload?.totals ?? {},
    meta: payload?.meta ?? {
      total: payload?.total ?? data.length ?? 0,
      page: 1,
      limit: data.length,
      totalPages: data.length ? 1 : 0,
    },
    ...payload,
  }
}

async function getReport(path: string, params?: QueryParams) {
  const response = await api.get(path, {
    params: cleanParams(params),
  })
  return safeReport(response.data)
}

async function downloadFile(path: string, params: QueryParams | undefined, fallbackFilename: string) {
  const response = await api.get(path, {
    params: cleanParams(params),
    responseType: 'blob',
  })
  const blob = new Blob([response.data], { type: String(response.headers['content-type'] || 'application/octet-stream') })
  const disposition = response.headers['content-disposition'] as string | undefined
  const match = disposition?.match(/filename="?([^"]+)"?/)
  const filename = match?.[1] || fallbackFilename
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export const reportsService = {
  getDashboard: () => getReport('/reports/dashboard'),

  getDaily: (date?: string) => getReport('/reports/daily', { date }),
  getDailyReport: (params?: QueryParams | string) =>
    typeof params === 'string' ? getReport('/reports/daily', { date: params }) : getReport('/reports/daily', params),

  getMonthly: (year?: number | string, month?: number | string) =>
    getReport('/reports/monthly', { year, month }),
  getMonthlyReport: (params?: QueryParams) => getReport('/reports/monthly', params),

  getYearly: (year?: number | string) => getReport('/reports/yearly', { year }),
  getYearlyReport: (params?: QueryParams) => getReport('/reports/yearly', params),

  getInventory: (params?: QueryParams) => getReport('/reports/inventory', params),
  getInventoryReport: (params?: QueryParams) => getReport('/reports/inventory', params),

  getStock: () => getReport('/reports/stock'),
  getDebts: () => getReport('/reports/debts'),

  getCashflow: (params?: QueryParams) => getReport('/reports/cashflow', params),
  getCashflowReport: (params?: QueryParams) => getReport('/reports/cashflow', params),

  getExcelStyle: (params?: QueryParams) => getReport('/reports/excel-style', params),

  getExpenses: (params?: QueryParams) => getReport('/reports/expenses', params),
  getExpenseReport: (params?: QueryParams) => getReport('/reports/expenses', params),

  getSales: (params?: QueryParams) => getReport('/reports/sales', params),
  getSalesReport: (params?: QueryParams) => getReport('/reports/sales', params),

  downloadDailyExcel: (date: string) =>
    downloadFile('/reports/daily/excel', { date }, `kunlik-hisobot-${date}.xlsx`),
  downloadMonthlyExcel: (year: number, month: number) =>
    downloadFile('/reports/monthly/excel', { year, month }, `oylik-hisobot-${year}-${String(month).padStart(2, '0')}.xlsx`),
  downloadYearlyExcel: (year: number) =>
    downloadFile('/reports/yearly/excel', { year }, `yillik-hisobot-${year}.xlsx`),
}

export default reportsService
