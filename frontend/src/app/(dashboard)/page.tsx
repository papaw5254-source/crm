'use client'

import { useQuery } from '@tanstack/react-query'
import {
  Package,
  TrendingUp,
  TrendingDown,
  Banknote,
  Calendar,
  BarChart3,
  AlertCircle,
  ShoppingCart,
  Receipt,
  Flame,
  Warehouse,
  HardHat,
} from 'lucide-react'
import {
  AreaChart,
  Area as AreaC,
  BarChart,
  Bar as BarC,
  XAxis as XAxisC,
  YAxis as YAxisC,
  CartesianGrid,
  Tooltip as TooltipC,
  ResponsiveContainer,
} from 'recharts'
import { reportsService } from '@/services/reports.service'
import { StatsCard } from '@/components/shared/stats-card'
import { PageHeader } from '@/components/shared/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatDate, paymentTypeLabel, paymentTypeColor } from '@/lib/utils'
import { useAuth } from '@/providers/auth-provider'
import type { Sale, Expense } from '@/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const [Area, Bar, XAxis, YAxis, Tooltip] = [AreaC, BarC, XAxisC, YAxisC, TooltipC].map((C) => C as unknown as any)

export default function DashboardPage() {
  const { user } = useAuth()
  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: reportsService.getDashboard,
    refetchInterval: 30000,
  })

  const isAdmin = user?.role === 'ADMIN'

  const salesChartData = dashboard?.recentSales
    ?.slice()
    .reverse()
    .map((sale: Sale) => ({
      date: formatDate(sale.date, 'dd.MM'),
      amount: Number(sale.totalAmount),
    })) ?? []

  const expenseChartData = dashboard?.recentExpenses
    ?.slice()
    .reverse()
    .map((exp: Expense) => ({
      date: formatDate(exp.date, 'dd.MM'),
      amount: Number(exp.amount),
    })) ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Xush kelibsiz, ${user?.fullName?.split(' ')[0]}!`}
        description="G'isht zavodi CRM tizimi"
      />

      {/* Stock Stats */}
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Ombor holati</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatsCard
            title="Xom g'isht"
            value={dashboard?.rawBrickStock ?? dashboard?.currentStock ?? 0}
            icon={Package}
            color="amber"
            format="number"
            suffix="dona"
            loading={isLoading}
          />
          <StatsCard
            title="Pishgan g'isht"
            value={dashboard?.bakedBrickStock ?? 0}
            icon={Flame}
            color="red"
            format="number"
            suffix="dona"
            loading={isLoading}
          />
          <StatsCard
            title="Zaxira xom"
            value={dashboard?.reserveRawBrick ?? 0}
            icon={Warehouse}
            color="slate"
            format="number"
            suffix="dona"
            loading={isLoading}
          />
          <StatsCard
            title="Zaxira pishgan"
            value={dashboard?.reserveBakedBrick ?? 0}
            icon={Warehouse}
            color="blue"
            format="number"
            suffix="dona"
            loading={isLoading}
          />
        </div>
      </div>

      {/* Finance Stats */}
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Moliyaviy ko&apos;rsatkichlar</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <StatsCard title="Bugungi tushum" value={dashboard?.todayCashReceived ?? 0} icon={Banknote} color="emerald" loading={isLoading} />
          <StatsCard title="Bugungi xarajat" value={dashboard?.todayExpenses ?? 0} icon={TrendingDown} color="red" loading={isLoading} />
          <StatsCard title="Bugungi foyda" value={dashboard?.todayProfit ?? 0} icon={TrendingUp} color={(dashboard?.todayProfit ?? 0) >= 0 ? 'emerald' : 'red'} loading={isLoading} />
          <StatsCard title="Oylik foyda" value={dashboard?.monthlyProfit ?? 0} icon={Calendar} color="purple" loading={isLoading} />
          {isAdmin && (
            <StatsCard title="Yillik foyda" value={dashboard?.yearlyProfit ?? 0} icon={BarChart3} color="amber" loading={isLoading} />
          )}
          <StatsCard title="Jami nasiya" value={dashboard?.totalDebts ?? 0} icon={AlertCircle} color="amber" loading={isLoading} />
          <StatsCard title="Ishchi qarzlari" value={dashboard?.totalWorkerDebts ?? 0} icon={HardHat} color="slate" loading={isLoading} />
          <StatsCard title="Bugungi sotuv" value={dashboard?.todaySalesAmount ?? 0} icon={ShoppingCart} color="blue" loading={isLoading} />
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">So&apos;nggi sotuvlar</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : salesChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={salesChartData}>
                  <defs>
                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={50} />
                  <Tooltip formatter={(v: number) => [formatCurrency(v), 'Summa']} contentStyle={{ borderRadius: '12px' }} />
                  <Area type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2} fill="url(#salesGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Ma&apos;lumot yo&apos;q</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">So&apos;nggi xarajatlar</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : expenseChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={expenseChartData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={50} />
                  <Tooltip formatter={(v: number) => [formatCurrency(v), 'Xarajat']} contentStyle={{ borderRadius: '12px' }} />
                  <Bar dataKey="amount" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Ma&apos;lumot yo&apos;q</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent lists */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-primary" />
              So&apos;nggi sotuvlar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
              : (dashboard?.recentSales?.length ?? 0) > 0
                ? dashboard!.recentSales.map((sale: Sale) => (
                    <div key={sale.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                      <div>
                        <p className="font-medium text-sm">{sale.customerName || "Noma'lum mijoz"}</p>
                        <p className="text-xs text-muted-foreground">{sale.quantity} dona • {formatDate(sale.date)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-sm">{formatCurrency(Number(sale.totalAmount))}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${paymentTypeColor(sale.paymentType)}`}>
                          {paymentTypeLabel(sale.paymentType)}
                        </span>
                      </div>
                    </div>
                  ))
                : <p className="text-center text-muted-foreground text-sm py-6">Sotuv yo&apos;q</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="h-4 w-4 text-amber-500" />
              So&apos;nggi xarajatlar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
              : (dashboard?.recentExpenses?.length ?? 0) > 0
                ? dashboard!.recentExpenses.map((expense: Expense) => (
                    <div key={expense.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                      <div>
                        <p className="font-medium text-sm">{expense.description || expense.category}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(expense.date)}</p>
                      </div>
                      <p className="font-semibold text-sm text-red-600 dark:text-red-400">
                        -{formatCurrency(Number(expense.amount))}
                      </p>
                    </div>
                  ))
                : <p className="text-center text-muted-foreground text-sm py-6">Xarajat yo&apos;q</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
