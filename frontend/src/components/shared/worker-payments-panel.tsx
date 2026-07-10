'use client'

import { useQuery } from '@tanstack/react-query'
import { HardHat } from 'lucide-react'
import { workerPaymentsService } from '@/services/worker-payments.service'
import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'

interface WorkerPaymentsPanelProps {
  title: string
  categories: string[]
}

export function WorkerPaymentsPanel({ title, categories }: WorkerPaymentsPanelProps) {
  const { data: report, isLoading } = useQuery({
    queryKey: ['worker-payments-panel', categories.join(',')],
    queryFn: workerPaymentsService.getReport,
  })

  const stats = categories.reduce(
    (acc, cat) => {
      const row = report?.byCategory?.[cat]
      if (row) {
        acc.amount += row.amount
        acc.paid += row.paid
        acc.debt += row.debt
        acc.carriedDebt += row.carriedDebt
      }
      return acc
    },
    { amount: 0, paid: 0, debt: 0, carriedDebt: 0 },
  )

  if (isLoading) {
    return <div className="h-20 bg-muted animate-pulse rounded-xl" />
  }

  const totalOwed = stats.carriedDebt + stats.amount

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <HardHat className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold text-muted-foreground">{title}</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-muted/50 px-3 py-2 text-center">
            <p className="text-xs text-muted-foreground mb-0.5">Hisoblandi</p>
            <p className="font-semibold text-sm">{formatCurrency(totalOwed)}</p>
          </div>
          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 text-center">
            <p className="text-xs text-muted-foreground mb-0.5">Berildi</p>
            <p className="font-semibold text-sm text-emerald-600 dark:text-emerald-400">{formatCurrency(stats.paid)}</p>
          </div>
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2 text-center">
            <p className="text-xs text-muted-foreground mb-0.5">Qoldi</p>
            <p className="font-semibold text-sm text-red-500">{formatCurrency(Math.max(0, totalOwed - stats.paid))}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
