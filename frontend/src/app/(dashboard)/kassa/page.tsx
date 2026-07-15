'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Wallet, TrendingUp, TrendingDown, PiggyBank } from 'lucide-react'
import { reportsService } from '@/services/reports.service'
import { PageHeader } from '@/components/shared/page-header'
import { StatsCard } from '@/components/shared/stats-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LoadingBlock } from '@/components/ui/spinner'
import { formatCurrency, formatDate } from '@/lib/utils'

function StatRow({ label, value, highlight, onClick }: { label: string; value: string; highlight?: 'green' | 'red'; onClick?: () => void }) {
  return (
    <div
      className={`flex items-center justify-between py-2 border-b border-border last:border-0 ${onClick ? 'cursor-pointer hover:opacity-70' : ''}`}
      onClick={onClick}
    >
      <span className="text-sm text-muted-foreground">{label}{onClick && ' (bosing)'}</span>
      <span className={`text-sm font-semibold ${highlight === 'green' ? 'text-emerald-600 dark:text-emerald-400' : highlight === 'red' ? 'text-red-600 dark:text-red-400' : ''}`}>
        {value}
      </span>
    </div>
  )
}

export default function KassaPage() {
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(today)
  const [showDebtPaymentBreakdown, setShowDebtPaymentBreakdown] = useState(false)

  const { data: daily, isLoading } = useQuery({
    queryKey: ['report-daily', date],
    queryFn: () => reportsService.getDaily(date),
  })

  const rasxod = Number(daily?.totalExpenses ?? 0) + Number(daily?.workerPayments ?? 0)

  return (
    <div className="space-y-6">
      <PageHeader title="Kassa" description="Kunlik kassa harakati — avtomatik hisoblanadi" />

      <div className="flex items-end gap-4">
        <div className="space-y-1">
          <Label>Sana</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
        </div>
      </div>

      {isLoading ? (
        <LoadingBlock />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title={`Kechagi qoldiq`}
              value={Number(daily?.previousDayBalance ?? 0)}
              icon={Wallet}
              color="slate"
            />
            <StatsCard
              title="Bugungi tushum"
              value={Number(daily?.cashBasisIncome ?? 0)}
              icon={TrendingUp}
              color="emerald"
            />
            <StatsCard
              title="Bugungi rasxod"
              value={rasxod}
              icon={TrendingDown}
              color="red"
            />
            <StatsCard
              title="Kun oxiriga qolgan pul"
              value={Number(daily?.endOfDayBalance ?? 0)}
              icon={PiggyBank}
              color={Number(daily?.endOfDayBalance ?? 0) >= 0 ? 'emerald' : 'red'}
            />
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">{formatDate(date)} — tafsilot</CardTitle></CardHeader>
            <CardContent className="p-4 divide-y divide-border">
              <StatRow label="Kechagi qoldiq" value={formatCurrency(Number(daily?.previousDayBalance ?? 0))} />
              <StatRow label="Naqd sotuvlar" value={formatCurrency(Number(daily?.cashSales ?? 0))} highlight="green" />
              <StatRow label="Karta sotuvlar" value={formatCurrency(Number(daily?.cardSales ?? 0))} highlight="green" />
              <StatRow
                label="Qarz to'lovlari"
                value={formatCurrency(Number(daily?.debtPayments ?? 0))}
                highlight="green"
                onClick={() => setShowDebtPaymentBreakdown((v) => !v)}
              />
              {showDebtPaymentBreakdown && (
                <div className="py-2 space-y-1 bg-muted/30 rounded-lg px-3 my-1">
                  {(daily?.debtPaymentDetails?.length ?? 0) === 0 ? (
                    <p className="text-xs text-muted-foreground">Bu kunda qarz to&apos;lovi yo&apos;q</p>
                  ) : (
                    daily!.debtPaymentDetails!.map((dp, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{dp.debtorName}{dp.description ? ` — ${dp.description}` : ''}</span>
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(dp.amount)}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
              <StatRow label="Zalog puli" value={formatCurrency(Number(daily?.prepaymentPaid ?? 0))} highlight="green" />
              <StatRow label="Pul kirimlari" value={formatCurrency(Number(daily?.moneyIncomes ?? 0))} highlight="green" />
              <StatRow label="Bugungi tushum (jami)" value={formatCurrency(Number(daily?.cashBasisIncome ?? 0))} highlight="green" />
              <StatRow label="Xarajatlar" value={formatCurrency(Number(daily?.totalExpenses ?? 0))} highlight="red" />
              <StatRow label="Ishchi puli (to'langan)" value={formatCurrency(Number(daily?.workerPayments ?? 0))} highlight="red" />
              <StatRow label="Bugungi rasxod (jami)" value={formatCurrency(rasxod)} highlight="red" />
              <StatRow
                label="Kun oxiriga qolgan pul"
                value={formatCurrency(Number(daily?.endOfDayBalance ?? 0))}
                highlight={Number(daily?.endOfDayBalance ?? 0) >= 0 ? 'green' : 'red'}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
