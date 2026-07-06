'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { HardHat } from 'lucide-react'
import { workerPaymentsService } from '@/services/worker-payments.service'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatsCard } from '@/components/shared/stats-card'
import { formatCurrency, formatDate, workerPaymentCategoryLabel } from '@/lib/utils'
import type { WorkerPayment } from '@/types'

interface WorkerPaymentsPanelProps {
  title: string
  categories: string[]
  limit?: number
}

function currentMonth() {
  const now = new Date()
  return { month: now.getMonth() + 1, year: now.getFullYear() }
}

export function WorkerPaymentsPanel({ title, categories, limit = 6 }: WorkerPaymentsPanelProps) {
  const { month, year } = currentMonth()

  const { data: report } = useQuery({
    queryKey: ['worker-payments-report', title, month, year],
    queryFn: () => workerPaymentsService.getReport({ month, year }),
  })

  const { data: payments, isLoading } = useQuery({
    queryKey: ['worker-payments-panel', title, categories, limit],
    queryFn: async () => {
      const results = await Promise.all(
        categories.map((category) =>
          workerPaymentsService.getAll({ category, limit, sortBy: 'date', sortOrder: 'DESC' }),
        ),
      )
      return results
        .flatMap((result) => result.data)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, limit)
    },
  })

  const totals = useMemo(() => {
    return categories.reduce(
      (acc, category) => {
        const item = report?.byCategory?.[category]
        acc.amount += Number(item?.amount ?? 0)
        acc.paid += Number(item?.paid ?? 0)
        acc.debt += Number(item?.debt ?? 0)
        acc.carriedDebt += Number(item?.carriedDebt ?? 0)
        return acc
      },
      { amount: 0, paid: 0, debt: 0, carriedDebt: 0 },
    )
  }, [categories, report])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <HardHat className="h-4 w-4" /> {title}
        </h3>
        <span className="text-sm text-muted-foreground">
          {String(month).padStart(2, '0')}.{year}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <StatsCard title="Bu oy hisoblandi" value={totals.amount} icon={HardHat} color="amber" />
        <StatsCard title="Berildi" value={totals.paid} icon={HardHat} color="emerald" />
        <StatsCard title="Oldingi qarz" value={totals.carriedDebt} icon={HardHat} color="slate" />
        <StatsCard title="Jami qarz" value={totals.debt} icon={HardHat} color="red" />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Sanalar bo'yicha ishchi puli</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>
          ) : payments?.length ? (
            payments.map((payment: WorkerPayment) => (
              <div key={payment.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">{formatDate(payment.date)} - {payment.workerName}</p>
                  <p className="text-xs text-muted-foreground">{workerPaymentCategoryLabel(payment.category)}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatCurrency(Number(payment.amount))}</p>
                  <p className="text-xs text-muted-foreground">
                    Berildi: {formatCurrency(Number(payment.paidAmount))}
                    {Number(payment.remainingDebt) > 0 ? ` | Qarz: ${formatCurrency(Number(payment.remainingDebt))}` : ''}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Hali ishchi puli yozilmagan.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
