'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  Banknote,
  Boxes,
  Flame,
  Package,
  ShoppingCart,
  TrendingUp,
  Warehouse,
} from 'lucide-react'

type StockItem = {
  brickType?: string
  quantity?: number | string
}

type DashboardStats = {
  todayIncome?: number | string
  todayExpense?: number | string
  todayProfit?: number | string
  monthlyProfit?: number | string
}

function toArray<T>(value: any): T[] {
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.data)) return value.data
  if (Array.isArray(value?.data?.data)) return value.data.data
  return []
}

function toNumber(value: unknown): number {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : 0
}

function formatNumber(value: unknown): string {
  return new Intl.NumberFormat('uz-UZ').format(toNumber(value))
}

function formatMoney(value: unknown): string {
  return `${formatNumber(value)} so'm`
}

async function apiGet<T>(url: string): Promise<T | null> {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null
    const response = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      cache: 'no-store',
    })

    if (!response.ok) return null
    return (await response.json()) as T
  } catch {
    return null
  }
}

export default function DashboardPage() {
  const [stockResponse, setStockResponse] = useState<any>(null)
  const [statsResponse, setStatsResponse] = useState<any>(null)

  useEffect(() => {
    let active = true

    async function loadDashboard() {
      const [stock, stats] = await Promise.all([
        apiGet('/api/stock'),
        apiGet('/api/reports/dashboard').catch(() => null),
      ])

      if (!active) return
      setStockResponse(stock)
      setStatsResponse(stats)
    }

    loadDashboard()

    return () => {
      active = false
    }
  }, [])

  const stocks = useMemo(() => toArray<StockItem>(stockResponse), [stockResponse])
  const stats: DashboardStats = statsResponse?.data ?? statsResponse ?? {}

  const rawStock = stocks.find((item) => item?.brickType === 'RAW_BRICK')?.quantity ?? 0
  const bakedStock = stocks.find((item) => item?.brickType === 'BAKED_BRICK')?.quantity ?? 0

  const cards = [
    {
      label: "Xom g'isht",
      value: formatNumber(rawStock),
      suffix: 'dona',
      icon: Package,
      color: 'text-amber-600',
      bg: 'bg-amber-100',
    },
    {
      label: "Pishgan g'isht",
      value: formatNumber(bakedStock),
      suffix: 'dona',
      icon: Flame,
      color: 'text-red-600',
      bg: 'bg-red-100',
    },
    {
      label: 'Bugungi tushum',
      value: formatMoney(stats.todayIncome),
      suffix: '',
      icon: Banknote,
      color: 'text-emerald-600',
      bg: 'bg-emerald-100',
    },
    {
      label: 'Bugungi foyda',
      value: formatMoney(stats.todayProfit),
      suffix: '',
      icon: TrendingUp,
      color: 'text-blue-600',
      bg: 'bg-blue-100',
    },
  ]

  const links = [
    { href: '/inventory', label: "Xom g'isht", icon: Boxes },
    { href: '/humbuz', label: 'Xumbuz', icon: Flame },
    { href: '/sales', label: 'Sotuv', icon: ShoppingCart },
    { href: '/zahiralar', label: 'Zahira', icon: Warehouse },
  ]

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">G'isht Zavodi CRM</h1>
        <p className="mt-1 text-sm text-slate-500">Ombor va moliyaviy holat</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-600">{card.label}</p>
                  <p className="mt-3 text-2xl font-bold text-slate-950">
                    {card.value}
                    {card.suffix ? <span className="ml-1 text-sm font-medium text-slate-500">{card.suffix}</span> : null}
                  </p>
                </div>
                <div className={`rounded-lg p-3 ${card.bg}`}>
                  <Icon className={`h-6 w-6 ${card.color}`} />
                </div>
              </div>
            </div>
          )
        })}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-950">Bo'limlar</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {links.map((link) => {
            const Icon = link.icon
            return (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-3 rounded-md border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50"
              >
                <Icon className="h-5 w-5 text-emerald-600" />
                {link.label}
              </Link>
            )
          })}
        </div>
      </section>
    </main>
  )
}
