import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = "so'm"): string {
  return new Intl.NumberFormat('uz-UZ').format(amount) + ' ' + currency
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('uz-UZ').format(num)
}

export function formatDate(date: string, fmt = 'dd.MM.yyyy'): string {
  try {
    return format(parseISO(date), fmt)
  } catch {
    return date
  }
}

export function formatDateTime(date: string): string {
  try {
    return format(parseISO(date), 'dd.MM.yyyy HH:mm')
  } catch {
    return date
  }
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function paymentTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    CASH: 'Naqd',
    CARD: 'Karta',
    DEBT: 'Nasiya',
    PREPAYMENT: 'Oldindan',
    BANK_TRANSFER: 'Perechisleniya',
  }
  return labels[type] || type
}

export function paymentTypeColor(type: string): string {
  const colors: Record<string, string> = {
    CASH: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    CARD: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    DEBT: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    PREPAYMENT: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    BANK_TRANSFER: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  }
  return colors[type] || 'bg-muted text-muted-foreground'
}

export function brickTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    RAW_BRICK: "Xom g'isht",
    BAKED_BRICK: "Pishgan g'isht",
  }
  return labels[type] || type
}

export function brickTypeColor(type: string): string {
  const colors: Record<string, string> = {
    RAW_BRICK: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    BAKED_BRICK: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  }
  return colors[type] || 'bg-muted text-muted-foreground'
}

export function kilnNameLabel(name: string): string {
  const labels: Record<string, string> = {
    HUMBUZ_1: '1-Humbuz',
    HUMBUZ_2: '2-Humbuz',
    HUMBUZ_3: '3-Humbuz',
  }
  return labels[name] || name
}

export function rawBrickSourceLabel(source: string): string {
  const labels: Record<string, string> = {
    FIELD: 'Daladan',
    RESERVE: 'Zaxiradan',
  }
  return labels[source] || source
}

export function reserveMovementTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    ADD: "Qo'shish",
    REMOVE: 'Chiqarish',
    SALE: 'Sotuv',
    TO_KILN: 'Humbuzga',
    ADJUSTMENT: 'Tuzatish',
  }
  return labels[type] || type
}

export function reserveMovementTypeColor(type: string): string {
  const colors: Record<string, string> = {
    ADD: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    REMOVE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    SALE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    TO_KILN: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    ADJUSTMENT: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  }
  return colors[type] || 'bg-muted text-muted-foreground'
}

export function prepaymentStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    ACTIVE: 'Faol',
    COMPLETED: 'Bajarildi',
    CANCELLED: 'Bekor qilindi',
  }
  return labels[status] || status
}

export function prepaymentStatusColor(status: string): string {
  const colors: Record<string, string> = {
    ACTIVE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    COMPLETED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  }
  return colors[status] || 'bg-muted text-muted-foreground'
}

export function moneyIncomeSourceLabel(source: string): string {
  const labels: Record<string, string> = {
    FOUNDER: "Ta'sischi",
    BANK: 'Bank',
    DEBT_RETURN: 'Qaytarilgan qarz',
    OTHER: 'Boshqa',
  }
  return labels[source] || source
}

export function moneyIncomeSourceColor(source: string): string {
  const colors: Record<string, string> = {
    FOUNDER: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    BANK: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    DEBT_RETURN: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    OTHER: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
  }
  return colors[source] || 'bg-muted text-muted-foreground'
}

export function workerPaymentCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    HUMBUZ_KIRDI_CHIQDI: 'Humbuz kirdi-chiqdi',
    HUMBUZ_ESHIKCHI: 'Humbuz eshikchi',
    PRESS: 'Press',
    FIELD_RAW_LOADING: 'Dala xom yuklash',
    RESERVE_RAW_LOADING: 'Zaxira xom yuklash',
    RESERVE_BAKED_LOADING: 'Zaxira pishgan yuklash',
    ROAD_PAYMENT: "Yo'l to'lovi",
    ADVANCE: 'Avans',
    OTHER: 'Boshqa',
  }
  return labels[category] || category
}

export function expenseCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    GAS: 'Gaz',
    ELECTRICITY: 'Elektr',
    SALARY: 'Maosh',
    TRANSPORT: 'Transport',
    MAINTENANCE: "Ta'mirlash",
    COAL: "Ko'mir",
    SOIL: 'Tuproq',
    SPARE_PARTS: 'Zapchast',
    CONSTRUCTION: 'Qurilish',
    MEDICINE: 'Dori',
    GREENHOUSE: 'Issiqxona',
    MATERIAL_HELP: 'Moddiy yordam',
    BANK_PAYMENT: "Bank to'lovi",
    ANIMAL_FEED: 'Yem',
    OTHER: 'Boshqa',
  }
  return labels[category] || category
}

export function expenseCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    GAS: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    ELECTRICITY: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    SALARY: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    TRANSPORT: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    MAINTENANCE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    COAL: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
    SOIL: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    SPARE_PARTS: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
    CONSTRUCTION: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
    MEDICINE: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
    GREENHOUSE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    MATERIAL_HELP: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
    BANK_PAYMENT: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    ANIMAL_FEED: 'bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-400',
    OTHER: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
  }
  return colors[category] || 'bg-muted text-muted-foreground'
}

export function roleLabel(role: string): string {
  return role === 'ADMIN' ? 'Admin' : 'Xodim'
}

export function truncate(str: string, length = 30): string {
  if (str.length <= length) return str
  return str.slice(0, length) + '...'
}

export function getErrorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const axiosError = error as Record<string, unknown>
    const response = axiosError.response as Record<string, unknown> | undefined
    const data = response?.data as Record<string, unknown> | undefined
    if (data?.message) {
      const msg = data.message
      return Array.isArray(msg) ? (msg as string[])[0] : String(msg)
    }
    const nested = data?.data as Record<string, unknown> | undefined
    if (nested?.message) return String(nested.message)
    if (axiosError.message) return String(axiosError.message)
  }
  if (error instanceof Error) return error.message
  return 'Xatolik yuz berdi'
}
