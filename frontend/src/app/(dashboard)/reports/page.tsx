'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, TrendingUp, TrendingDown, Banknote, Package, Warehouse, ArrowUp, ArrowDown, Download } from 'lucide-react'
import {
  AreaChart, Area as AreaC, BarChart, Bar as BarC,
  XAxis as XAxisC, YAxis as YAxisC, CartesianGrid, Tooltip as TooltipC,
  ResponsiveContainer, Legend as LegendC, PieChart, Pie as PieC, Cell,
} from 'recharts'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const [Area, Bar, XAxis, YAxis, Tooltip, Legend, Pie] = [AreaC, BarC, XAxisC, YAxisC, TooltipC, LegendC, PieC].map((C) => C as unknown as any)
import { toast } from 'sonner'
import { reportsService } from '@/services/reports.service'
import { PageHeader } from '@/components/shared/page-header'
import { StatsCard } from '@/components/shared/stats-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { LoadingBlock } from '@/components/ui/spinner'
import { formatCurrency, formatDate, formatNumber, expenseCategoryLabel, getErrorMessage } from '@/lib/utils'
import { useAuth } from '@/providers/auth-provider'
import type { DayData, MonthData, Debtor } from '@/types'

function ChartSkeleton() {
  return <LoadingBlock minHeight="min-h-64" />
}

function StatRow({ label, value, highlight, onClick }: { label: string; value: string | number; highlight?: 'green' | 'red'; onClick?: () => void }) {
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

const PIE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

export default function ReportsPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  const today = new Date().toISOString().split('T')[0]
  const [dailyDate, setDailyDate] = useState(today)
  const [monthlyYear, setMonthlyYear] = useState(new Date().getFullYear())
  const [monthlyMonth, setMonthlyMonth] = useState(new Date().getMonth() + 1)
  const [yearlyYear, setYearlyYear] = useState(new Date().getFullYear())
  const [cfFrom, setCfFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])
  const [cfTo, setCfTo] = useState(today)
  const [downloading, setDownloading] = useState<'daily' | 'monthly' | 'yearly' | null>(null)
  const [showDebtPaymentBreakdown, setShowDebtPaymentBreakdown] = useState(false)

  const handleDownloadDaily = async () => {
    setDownloading('daily')
    try {
      await reportsService.downloadDailyExcel(dailyDate)
    } catch (e: unknown) {
      toast.error(getErrorMessage(e))
    } finally {
      setDownloading(null)
    }
  }

  const handleDownloadMonthly = async () => {
    setDownloading('monthly')
    try {
      await reportsService.downloadMonthlyExcel(monthlyYear, monthlyMonth)
    } catch (e: unknown) {
      toast.error(getErrorMessage(e))
    } finally {
      setDownloading(null)
    }
  }

  const handleDownloadYearly = async () => {
    setDownloading('yearly')
    try {
      await reportsService.downloadYearlyExcel(yearlyYear)
    } catch (e: unknown) {
      toast.error(getErrorMessage(e))
    } finally {
      setDownloading(null)
    }
  }

  const { data: daily, isLoading: dailyLoading } = useQuery({
    queryKey: ['report-daily', dailyDate],
    queryFn: () => reportsService.getDaily(dailyDate),
  })

  const { data: monthly, isLoading: monthlyLoading } = useQuery({
    queryKey: ['report-monthly', monthlyYear, monthlyMonth],
    queryFn: () => reportsService.getMonthly(monthlyYear, monthlyMonth),
  })

  const { data: yearly, isLoading: yearlyLoading } = useQuery({
    queryKey: ['report-yearly', yearlyYear],
    queryFn: () => reportsService.getYearly(yearlyYear),
    enabled: isAdmin,
  })

  const { data: stock, isLoading: stockLoading } = useQuery({
    queryKey: ['report-stock'],
    queryFn: reportsService.getStock,
  })

  const { data: debts, isLoading: debtsLoading } = useQuery({
    queryKey: ['report-debts'],
    queryFn: reportsService.getDebts,
  })

  const { data: cashflow, isLoading: cfLoading } = useQuery({
    queryKey: ['report-cashflow', cfFrom, cfTo],
    queryFn: () => reportsService.getCashflow({ dateFrom: cfFrom, dateTo: cfTo }),
  })

  const monthlyChartData = monthly?.groupedByDay
    ? (Object.entries(monthly.groupedByDay) as [string, DayData][]).map(([date, d]) => ({
        date: formatDate(date, 'dd.MM'),
        savdo: Number(d.salesAmount),
        xarajat: Number(d.expenses),
        ishchi: Number(d.workerAccrued ?? 0),
        foyda: Number(d.profit ?? (Number(d.cashReceived ?? 0) - Number(d.expenses) - Number(d.workerAccrued ?? 0))),
      }))
    : []

  const yearlyChartData = yearly?.groupedByMonth
    ? (Object.entries(yearly.groupedByMonth) as [string, MonthData][]).map(([key, m]) => ({
        oy: `${key.split('-')[1]}-oy`,
        savdo: Number(m.salesAmount),
        xarajat: Number(m.expenses),
        ishchi: Number(m.workerAccrued ?? 0),
        foyda: Number(m.profit ?? (Number(m.cashReceived ?? 0) - Number(m.expenses) - Number(m.workerAccrued ?? 0))),
      }))
    : []

  const expensePieData = monthly?.expenseByCategory
    ? Object.entries(monthly.expenseByCategory).map(([cat, val]) => ({
        name: expenseCategoryLabel(cat),
        value: Number(val),
      }))
    : []

  return (
    <div className="space-y-6">
      <PageHeader title="Hisobotlar" description="Moliyaviy hisobot va tahlillar" />

      <Tabs defaultValue="daily">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="daily">Kunlik</TabsTrigger>
          <TabsTrigger value="monthly">Oylik</TabsTrigger>
          {isAdmin && <TabsTrigger value="yearly">Yillik</TabsTrigger>}
          <TabsTrigger value="stock">Ombor</TabsTrigger>
          <TabsTrigger value="debts">Qarzlar</TabsTrigger>
          <TabsTrigger value="cashflow">Pul oqimi</TabsTrigger>
        </TabsList>

        {/* ── Daily ─────────────────────────────────────────────────────── */}
        <TabsContent value="daily" className="space-y-6 mt-4">
          <div className="flex items-end gap-4">
            <div className="space-y-1">
              <Label>Sana</Label>
              <Input type="date" value={dailyDate} onChange={(e) => setDailyDate(e.target.value)} className="w-44" />
            </div>
            <Button variant="outline" onClick={handleDownloadDaily} disabled={downloading === 'daily'}>
              <Download className="h-4 w-4 mr-1" /> {downloading === 'daily' ? 'Yuklanmoqda...' : 'Excel yuklab olish'}
            </Button>
          </div>

          {dailyLoading ? (
            <LoadingBlock />
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatsCard title="Jami sotuv" value={Number(daily?.totalSalesAmount ?? 0)} icon={TrendingUp} color="emerald" />
                <StatsCard title="Naqd tushum" value={Number(daily?.receivedCash ?? 0)} icon={Banknote} color="blue" />
                <StatsCard title="Xarajat + Ishchi puli" value={Number(daily?.totalExpenses ?? 0) + Number(daily?.workerPayments ?? 0)} icon={TrendingDown} color="red" />
                <StatsCard title="Kun oxiriga qolgan pul" value={Number(daily?.endOfDayBalance ?? 0)} icon={BarChart3} color={Number(daily?.endOfDayBalance ?? 0) >= 0 ? 'emerald' : 'red'} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Ishlab chiqarish & Sotuv</CardTitle></CardHeader>
                  <CardContent className="p-4 divide-y divide-border">
                    <StatRow label="Xom g'isht ishlab chiqarildi" value={formatNumber(daily?.rawBrickProduced ?? 0) + ' dona'} />
                    <StatRow label="Pishgan g'isht chiqdi (humbuz)" value={formatNumber(daily?.bakedBrickProduced ?? 0) + ' dona'} />
                    <StatRow label="Xom g'isht sotildi" value={formatNumber(daily?.rawBrickSold ?? 0) + ' dona'} />
                    <StatRow label="Pishgan g'isht sotildi" value={formatNumber(daily?.bakedBrickSold ?? 0) + ' dona'} />
                    <StatRow label="Zaxira sotuvidan g'isht sotildi" value={formatNumber(daily?.reserveSoldBricks ?? 0) + ' dona'} />
                    <StatRow label="Zalog g'ishti yetkazildi" value={formatNumber(daily?.prepaymentDeliveredBricks ?? 0) + ' dona'} />
                    <StatRow label="Naqd sotuvlar" value={formatCurrency(Number(daily?.cashSales ?? 0))} highlight="green" />
                    <StatRow label="Karta sotuvlar" value={formatCurrency(Number(daily?.cardSales ?? 0))} highlight="green" />
                    <StatRow label="Perechisleniya" value={formatCurrency(Number(daily?.bankTransferSales ?? 0))} highlight="green" />
                    <StatRow label="Nasiya sotuvlar" value={formatCurrency(Number(daily?.debtSalesAmount ?? 0))} highlight="red" />
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
                    <StatRow label="Qog'oziy foyda" value={formatCurrency(Number(daily?.paperProfit ?? 0))} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Ishchi puli</CardTitle></CardHeader>
                  <CardContent className="p-4 divide-y divide-border">
                    <StatRow label="Jami hisoblangan" value={formatCurrency(Number(daily?.workerAccrued ?? 0))} highlight="red" />
                    <StatRow label="Jami to'langan" value={formatCurrency(Number(daily?.workerPayments ?? 0))} highlight="green" />
                    {daily?.workerByCategory && Object.keys(daily.workerByCategory).length > 0 ? (
                      <>
                        {Object.entries(daily.workerByCategory).map(([cat, val]) => {
                          const v = val as { accrued: number; paid: number }
                          const labels: Record<string, string> = {
                            HUMBUZ_KIRDI_CHIQDI: 'Humbuz',
                            QACHIGAR: 'Qachigar',
                            RESERVE_RAW_LOADING: 'Zaxira (xom)',
                            RESERVE_BAKED_LOADING: 'Zaxira (pishgan)',
                            ESHIKCHI: 'Eshikchi',
                            KRETKACHI: 'Kretkachi',
                            PRESS: 'Press',
                            YUKLAGCHI: 'Yuklagchi',
                            FIELD_RAW_LOADING: 'Yuklagchi (xom)',
                            ROAD_PAYMENT: "Yo'l haqi",
                          }
                          const label = labels[cat] ?? cat
                          return (
                            <div key={cat}>
                              <StatRow label={`${label} — hisoblandi`} value={formatCurrency(Number(v.accrued))} />
                              <StatRow label={`${label} — to'landi`} value={formatCurrency(Number(v.paid))} highlight="green" />
                            </div>
                          )
                        })}
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground py-2 text-center">Bu kunda ishchi to&apos;lovi yo&apos;q</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* ── Monthly ────────────────────────────────────────────────────── */}
        <TabsContent value="monthly" className="space-y-6 mt-4">
          <div className="flex items-end gap-4">
            <div className="space-y-1">
              <Label>Yil</Label>
              <Input type="number" value={monthlyYear} onChange={(e) => setMonthlyYear(Number(e.target.value))} className="w-28" min={2020} max={2030} />
            </div>
            <div className="space-y-1">
              <Label>Oy</Label>
              <Input type="number" value={monthlyMonth} onChange={(e) => setMonthlyMonth(Number(e.target.value))} className="w-24" min={1} max={12} />
            </div>
            <Button variant="outline" onClick={handleDownloadMonthly} disabled={downloading === 'monthly'}>
              <Download className="h-4 w-4 mr-1" /> {downloading === 'monthly' ? 'Yuklanmoqda...' : 'Excel yuklab olish'}
            </Button>
          </div>

          {monthlyLoading ? (
            <LoadingBlock />
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatsCard title="Jami sotuv" value={Number(monthly?.totalSalesAmount ?? 0)} icon={TrendingUp} color="emerald" />
                <StatsCard title="Naqd tushum" value={Number(monthly?.cashReceived ?? 0)} icon={Banknote} color="blue" />
                <StatsCard title="Xarajat + Ishchi puli" value={Number(monthly?.totalExpenses ?? 0) + Number(monthly?.workerPaid ?? 0)} icon={TrendingDown} color="red" />
                <StatsCard title="Kun oxiriga qolgan pul" value={Number(monthly?.endOfDayBalance ?? 0)} icon={BarChart3} color={Number(monthly?.endOfDayBalance ?? 0) >= 0 ? 'emerald' : 'red'} />
              </div>
              {monthly && (
                <Card>
                  <CardContent className="p-4 divide-y divide-border">
                    <StatRow label="Jami sotuv (qog'oz)" value={formatCurrency(Number(monthly.totalSalesAmount))} />
                    <StatRow label="Zaxira sotuvidan sotilgan g'isht" value={formatNumber(Number(monthly.reserveSoldBricks ?? 0)) + ' dona'} />
                    <StatRow label="Zaxira sotuvidan summa" value={formatCurrency(Number(monthly.reserveSalesAmount ?? 0))} />
                    <StatRow label="Nasiya sotuvlar" value={formatCurrency(Number(monthly.debtSalesAmount))} highlight="red" />
                    <StatRow label="Naqd tushum" value={formatCurrency(Number(monthly.cashReceived))} highlight="green" />
                    <StatRow label="Zalog puli" value={formatCurrency(Number(monthly.prepaymentPaid ?? 0))} highlight="green" />
                    <StatRow label="Zalog g'ishti yetkazildi" value={formatNumber(Number(monthly.prepaymentDeliveredBricks ?? 0)) + ' dona'} />
                    <StatRow label="Pul kirimlari" value={formatCurrency(Number(monthly.moneyIncomes ?? 0))} highlight="green" />
                    <StatRow label="Xarajatlar" value={formatCurrency(Number(monthly.totalExpenses))} highlight="red" />
                    <StatRow label="Ishchi puli (hisoblangan)" value={formatCurrency(Number(monthly.workerAccrued ?? 0))} highlight="red" />
                    <StatRow label="Ishchi puli (to'langan)" value={formatCurrency(Number(monthly.workerPaid ?? 0))} highlight="green" />
                    <StatRow label="Qog'oziy foyda" value={formatCurrency(Number(monthly.paperProfit ?? 0))} />
                    <StatRow label="Kun oxiriga qolgan pul" value={formatCurrency(Number(monthly.endOfDayBalance ?? 0))} highlight={Number(monthly.endOfDayBalance ?? 0) >= 0 ? 'green' : 'red'} />
                  </CardContent>
                </Card>
              )}
            </>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Kunlik tahlil</CardTitle></CardHeader>
                <CardContent>
                  {monthlyLoading ? <ChartSkeleton /> : monthlyChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <AreaChart data={monthlyChartData}>
                        <defs>
                          <linearGradient id="salesG" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} width={60} />
                        <Tooltip formatter={(v: number, name: string) => [formatCurrency(v), name]} contentStyle={{ borderRadius: '12px' }} />
                        <Legend />
                        <Area type="monotone" dataKey="savdo" stroke="#10b981" fill="url(#salesG)" strokeWidth={2} name="Sotuv" />
                        <Area type="monotone" dataKey="xarajat" stroke="#f59e0b" fill="none" strokeWidth={2} strokeDasharray="4 2" name="Xarajat" />
                        <Area type="monotone" dataKey="ishchi" stroke="#ec4899" fill="none" strokeWidth={2} strokeDasharray="2 2" name="Ishchi puli" />
                        <Area type="monotone" dataKey="foyda" stroke="#3b82f6" fill="none" strokeWidth={2} name="Foyda" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : <div className="h-64 flex items-center justify-center text-muted-foreground">Ma&apos;lumot yo&apos;q</div>}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Xarajatlar taqsimoti</CardTitle></CardHeader>
              <CardContent>
                {monthlyLoading ? <ChartSkeleton /> : expensePieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={expensePieData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                        {expensePieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <div className="h-64 flex items-center justify-center text-muted-foreground">Ma&apos;lumot yo&apos;q</div>}
              </CardContent>
            </Card>
          </div>

          {monthly?.groupedByDay && Object.entries(monthly.groupedByDay).some(([, d]) => Number((d as DayData).prepaymentPaid ?? 0) > 0) && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Kunlar bo&apos;yicha zalog puli</CardTitle></CardHeader>
              <CardContent className="p-4 divide-y divide-border">
                {(Object.entries(monthly.groupedByDay) as [string, DayData][])
                  .filter(([, d]) => Number(d.prepaymentPaid ?? 0) > 0)
                  .map(([date, d]) => (
                    <StatRow key={date} label={formatDate(date)} value={formatCurrency(Number(d.prepaymentPaid))} highlight="green" />
                  ))}
              </CardContent>
            </Card>
          )}

          {monthly?.groupedByDay && Object.entries(monthly.groupedByDay).some(([, d]) => Number((d as DayData).prepaymentDeliveredBricks ?? 0) > 0) && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Kunlar bo&apos;yicha zalog g&apos;ishti</CardTitle></CardHeader>
              <CardContent className="p-4 divide-y divide-border">
                {(Object.entries(monthly.groupedByDay) as [string, DayData][])
                  .filter(([, d]) => Number(d.prepaymentDeliveredBricks ?? 0) > 0)
                  .map(([date, d]) => (
                    <StatRow key={date} label={formatDate(date)} value={formatNumber(Number(d.prepaymentDeliveredBricks)) + ' dona'} />
                  ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Yearly (admin) ───────────────────────────────────────────────── */}
        {isAdmin && (
          <TabsContent value="yearly" className="space-y-6 mt-4">
            <div className="flex items-end gap-4">
              <div className="space-y-1">
                <Label>Yil</Label>
                <Input type="number" value={yearlyYear} onChange={(e) => setYearlyYear(Number(e.target.value))} className="w-28" min={2020} max={2030} />
              </div>
              <Button variant="outline" onClick={handleDownloadYearly} disabled={downloading === 'yearly'}>
                <Download className="h-4 w-4 mr-1" /> {downloading === 'yearly' ? 'Yuklanmoqda...' : 'Excel yuklab olish'}
              </Button>
            </div>

            {yearlyLoading ? (
              <LoadingBlock />
            ) : (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatsCard title="Jami sotuv" value={Number(yearly?.totalSalesAmount ?? 0)} icon={TrendingUp} color="emerald" />
                  <StatsCard title="Naqd tushum" value={Number(yearly?.cashReceived ?? 0)} icon={Banknote} color="blue" />
                  <StatsCard title="Xarajat + Ishchi puli" value={Number(yearly?.totalExpenses ?? 0) + Number(yearly?.workerPaid ?? 0)} icon={TrendingDown} color="red" />
                  <StatsCard title="Kun oxiriga qolgan pul" value={Number(yearly?.endOfDayBalance ?? 0)} icon={BarChart3} color={Number(yearly?.endOfDayBalance ?? 0) >= 0 ? 'emerald' : 'red'} />
                </div>
                {yearly && (
                  <Card>
                    <CardContent className="p-4 divide-y divide-border">
                      <StatRow label="Jami sotuv (qog'oz)" value={formatCurrency(Number(yearly.totalSalesAmount))} />
                      <StatRow label="Zaxira sotuvidan sotilgan g'isht" value={formatNumber(Number(yearly.reserveSoldBricks ?? 0)) + ' dona'} />
                      <StatRow label="Zaxira sotuvidan summa" value={formatCurrency(Number(yearly.reserveSalesAmount ?? 0))} />
                      <StatRow label="Nasiya sotuvlar" value={formatCurrency(Number(yearly.debtSalesAmount))} highlight="red" />
                      <StatRow label="Naqd tushum" value={formatCurrency(Number(yearly.cashReceived))} highlight="green" />
                      <StatRow label="Zalog puli" value={formatCurrency(Number(yearly.prepaymentPaid ?? 0))} highlight="green" />
                      <StatRow label="Zalog g'ishti yetkazildi" value={formatNumber(Number(yearly.prepaymentDeliveredBricks ?? 0)) + ' dona'} />
                      <StatRow label="Pul kirimlari" value={formatCurrency(Number(yearly.moneyIncomes ?? 0))} highlight="green" />
                      <StatRow label="Xarajatlar" value={formatCurrency(Number(yearly.totalExpenses))} highlight="red" />
                      <StatRow label="Ishchi puli (hisoblangan)" value={formatCurrency(Number(yearly.workerAccrued ?? 0))} highlight="red" />
                      <StatRow label="Ishchi puli (to'langan)" value={formatCurrency(Number(yearly.workerPaid ?? 0))} highlight="green" />
                      <StatRow label="Qog'oziy foyda" value={formatCurrency(Number(yearly.paperProfit ?? 0))} />
                      <StatRow label="Kun oxiriga qolgan pul" value={formatCurrency(Number(yearly.endOfDayBalance ?? 0))} highlight={Number(yearly.endOfDayBalance ?? 0) >= 0 ? 'green' : 'red'} />
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Oylik tahlil ({yearlyYear})</CardTitle></CardHeader>
              <CardContent>
                {yearlyLoading ? <ChartSkeleton /> : yearlyChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={yearlyChartData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="oy" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} width={70} />
                      <Tooltip formatter={(v: number, name: string) => [formatCurrency(v), name]} contentStyle={{ borderRadius: '12px' }} />
                      <Legend />
                      <Bar dataKey="savdo" fill="#10b981" radius={[4, 4, 0, 0]} name="Sotuv" />
                      <Bar dataKey="xarajat" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Xarajat" />
                      <Bar dataKey="ishchi" fill="#ec4899" radius={[4, 4, 0, 0]} name="Ishchi puli" />
                      <Bar dataKey="foyda" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Foyda" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div className="h-64 flex items-center justify-center text-muted-foreground">Ma&apos;lumot yo&apos;q</div>}
              </CardContent>
            </Card>

            {yearly?.groupedByMonth && Object.entries(yearly.groupedByMonth).some(([, m]) => Number((m as MonthData).prepaymentPaid ?? 0) > 0) && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Oylar bo&apos;yicha zalog puli</CardTitle></CardHeader>
                <CardContent className="p-4 divide-y divide-border">
                  {(Object.entries(yearly.groupedByMonth) as [string, MonthData][])
                    .filter(([, m]) => Number(m.prepaymentPaid ?? 0) > 0)
                    .map(([key, m]) => (
                      <StatRow key={key} label={`${key.split('-')[1]}-oy`} value={formatCurrency(Number(m.prepaymentPaid))} highlight="green" />
                    ))}
                </CardContent>
              </Card>
            )}

            {yearly?.groupedByMonth && Object.entries(yearly.groupedByMonth).some(([, m]) => Number((m as MonthData).prepaymentDeliveredBricks ?? 0) > 0) && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Oylar bo&apos;yicha zalog g&apos;ishti</CardTitle></CardHeader>
                <CardContent className="p-4 divide-y divide-border">
                  {(Object.entries(yearly.groupedByMonth) as [string, MonthData][])
                    .filter(([, m]) => Number(m.prepaymentDeliveredBricks ?? 0) > 0)
                    .map(([key, m]) => (
                      <StatRow key={key} label={`${key.split('-')[1]}-oy`} value={formatNumber(Number(m.prepaymentDeliveredBricks)) + ' dona'} />
                    ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}

        {/* ── Stock ─────────────────────────────────────────────────────── */}
        <TabsContent value="stock" className="space-y-6 mt-4">
          {stockLoading ? (
            <LoadingBlock />
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatsCard title="Pishgan g'isht (ombor)" value={stock?.bakedBrickStock ?? 0} icon={Package} color="red" format="number" suffix="dona" />
              <StatsCard title="Xom g'isht (ombor)" value={stock?.rawBrickStock ?? 0} icon={Package} color="amber" format="number" suffix="dona" />
              <StatsCard title="Zaxira xom g'isht" value={stock?.reserveRawBrick ?? 0} icon={Warehouse} color="slate" format="number" suffix="dona" />
              <StatsCard title="Zaxira pishgan g'isht" value={stock?.reserveBakedBrick ?? 0} icon={Warehouse} color="blue" format="number" suffix="dona" />
            </div>
          )}

          {!stockLoading && stock && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-4 divide-y divide-border">
                  <StatRow label="Jami xom g'isht (ombor + zaxira)" value={formatNumber(stock.totalRawBrick) + ' dona'} />
                  <StatRow label="Jami pishgan g'isht (ombor + zaxira)" value={formatNumber(stock.totalBakedBrick) + ' dona'} />
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ── Debts ─────────────────────────────────────────────────────── */}
        <TabsContent value="debts" className="space-y-6 mt-4">
          {debtsLoading ? (
            <LoadingBlock />
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatsCard title="Qarzdorlar soni" value={debts?.totalDebtors ?? 0} icon={BarChart3} color="amber" format="number" suffix="ta" />
              <StatsCard title="Jami qarz" value={debts?.totalDebt ?? 0} icon={TrendingDown} color="red" />
              <StatsCard title="Jami to'langan" value={debts?.totalPaid ?? 0} icon={TrendingUp} color="emerald" />
              <StatsCard title="Qolgan qarz" value={debts?.totalRemainingDebt ?? 0} icon={BarChart3} color="red" />
            </div>
          )}

          {!debtsLoading && debts?.workerDebts && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Ishchi qarzlari</CardTitle></CardHeader>
              <CardContent className="p-4 divide-y divide-border">
                <StatRow label="Qarzli ishchilar" value={formatNumber(debts.workerDebts.totalWorkers) + ' ta'} />
                <StatRow label="Jami ishchi qarzlari" value={formatCurrency(debts.workerDebts.totalDebt)} highlight="red" />
              </CardContent>
            </Card>
          )}

          {!debtsLoading && (debts?.unpaidDebtors?.length ?? 0) > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">To&apos;lanmagan qarzlar</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {debts!.unpaidDebtors.map((d: Debtor) => (
                    <div key={d.id} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="font-medium text-sm">{d.fullName}</p>
                        <p className="text-xs text-muted-foreground">{d.phone || '—'}</p>
                      </div>
                      <p className="font-semibold text-sm text-red-600 dark:text-red-400">{formatCurrency(Number(d.remainingDebt))}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Cashflow ──────────────────────────────────────────────────── */}
        <TabsContent value="cashflow" className="space-y-6 mt-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label>Dan</Label>
              <Input type="date" value={cfFrom} onChange={(e) => setCfFrom(e.target.value)} className="w-44" />
            </div>
            <div className="space-y-1">
              <Label>Gacha</Label>
              <Input type="date" value={cfTo} onChange={(e) => setCfTo(e.target.value)} className="w-44" />
            </div>
          </div>

          {cfLoading ? (
            <LoadingBlock />
          ) : cashflow ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatsCard title="Jami kirim" value={cashflow.totalInflows} icon={ArrowUp} color="emerald" />
                <StatsCard title="Jami chiqim" value={cashflow.totalOutflows} icon={ArrowDown} color="red" />
                <StatsCard title="Sof pul oqimi" value={cashflow.netCashflow} icon={Banknote} color={cashflow.netCashflow >= 0 ? 'emerald' : 'red'} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base text-emerald-600">Kirimlar</CardTitle></CardHeader>
                  <CardContent className="p-4 divide-y divide-border">
                    <StatRow label="Naqd sotuvlar" value={formatCurrency(cashflow.inflows.cashSales)} highlight="green" />
                    <StatRow label="Karta sotuvlar" value={formatCurrency(cashflow.inflows.cardSales)} highlight="green" />
                    <StatRow label="Perechisleniya" value={formatCurrency(cashflow.inflows.bankTransferSales ?? 0)} highlight="green" />
                    <StatRow label="Qarz to'lovlari" value={formatCurrency(cashflow.inflows.debtPayments)} highlight="green" />
                    <StatRow label="Oldindan to'lovlar" value={formatCurrency(cashflow.inflows.prepayments)} highlight="green" />
                    <StatRow label="Boshqa kirimlar" value={formatCurrency(cashflow.inflows.moneyIncomes)} highlight="green" />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base text-red-600">Chiqimlar</CardTitle></CardHeader>
                  <CardContent className="p-4 divide-y divide-border">
                    <StatRow label="Xarajatlar" value={formatCurrency(cashflow.outflows.expenses)} highlight="red" />
                    <StatRow label="Ishchi to'lovlari" value={formatCurrency(cashflow.outflows.workerPayments)} highlight="red" />
                  </CardContent>
                </Card>
              </div>
            </>
          ) : <div className="text-center text-muted-foreground py-12">Ma&apos;lumot yo&apos;q</div>}
        </TabsContent>
      </Tabs>
    </div>
  )
}
