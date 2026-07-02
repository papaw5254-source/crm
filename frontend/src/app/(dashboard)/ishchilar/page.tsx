'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, HardHat, Pencil, Trash2, BarChart3 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { workerPaymentsService } from '@/services/worker-payments.service'
import { PageHeader } from '@/components/shared/page-header'
import { StatsCard } from '@/components/shared/stats-card'
import { DataTable } from '@/components/shared/data-table'
import { SearchInput } from '@/components/shared/search-input'
import { Pagination } from '@/components/shared/pagination'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatDate, formatCurrency, workerPaymentCategoryLabel, getErrorMessage } from '@/lib/utils'
import { useDebounce } from '@/hooks/use-debounce'
import { usePagination } from '@/hooks/use-pagination'
import { useAuth } from '@/providers/auth-provider'
import type { WorkerPayment, WorkerPaymentCategory } from '@/types'

const CATEGORIES: WorkerPaymentCategory[] = [
  'HUMBUZ_KIRDI_CHIQDI', 'HUMBUZ_ESHIKCHI', 'PRESS',
  'FIELD_RAW_LOADING', 'RESERVE_RAW_LOADING', 'RESERVE_BAKED_LOADING',
  'ROAD_PAYMENT', 'ADVANCE', 'OTHER',
]

const schema = z.object({
  workerName: z.string().min(1, 'Ishchi ismi kiritilishi shart'),
  category: z.string().min(1, 'Kategoriya tanlanishi shart'),
  debtFromPreviousMonth: z.coerce.number().min(0).optional().default(0),
  amount: z.coerce.number().min(0, "Summa 0 dan katta bo'lishi kerak"),
  paidAmount: z.coerce.number().min(0),
  month: z.coerce.number().min(1).max(12),
  year: z.coerce.number().min(2020).max(2100),
  date: z.string().min(1, 'Sana kiritilishi shart'),
  description: z.string().optional(),
})
type FormData = z.infer<typeof schema>

const MONTHS = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
]

export default function IshchilarPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'list' | 'report'>('list')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editItem, setEditItem] = useState<WorkerPayment | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const { page, limit, setPage } = usePagination()
  const debouncedSearch = useDebounce(search)
  const currentMonth = new Date().getMonth() + 1
  const currentYear = new Date().getFullYear()
  const [reportMonth, setReportMonth] = useState(currentMonth)
  const [reportYear, setReportYear] = useState(currentYear)

  const { data, isLoading } = useQuery({
    queryKey: ['worker-payments', page, limit, debouncedSearch],
    queryFn: () => workerPaymentsService.getAll({ page, limit, search: debouncedSearch }),
  })

  const { data: report, isLoading: reportLoading } = useQuery({
    queryKey: ['worker-payments-report', reportMonth, reportYear],
    queryFn: () => workerPaymentsService.getReport({ month: reportMonth, year: reportYear }),
    enabled: tab === 'report',
  })

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      month: currentMonth,
      year: currentYear,
      debtFromPreviousMonth: 0,
      paidAmount: 0,
    },
  })

  const debtPrev = watch('debtFromPreviousMonth') ?? 0
  const amount = watch('amount') ?? 0
  const paidAmount = watch('paidAmount') ?? 0
  const remainingDebt = Number(debtPrev) + Number(amount) - Number(paidAmount)

  const createMutation = useMutation({
    mutationFn: (d: FormData) => workerPaymentsService.create(d as Parameters<typeof workerPaymentsService.create>[0]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worker-payments'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success("Ishchi to'lovi qo'shildi")
      setDialogOpen(false)
      reset({ date: new Date().toISOString().split('T')[0], month: currentMonth, year: currentYear, debtFromPreviousMonth: 0, paidAmount: 0 })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const updateMutation = useMutation({
    mutationFn: (d: FormData) => workerPaymentsService.update(editItem!.id, d as Parameters<typeof workerPaymentsService.update>[1]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worker-payments'] })
      toast.success("Ishchi to'lovi yangilandi")
      setEditItem(null)
      setDialogOpen(false)
      reset()
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => workerPaymentsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worker-payments'] })
      toast.success("To'lov o'chirildi")
      setDeleteId(null)
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const openEdit = (item: WorkerPayment) => {
    setEditItem(item)
    setValue('workerName', item.workerName)
    setValue('category', item.category)
    setValue('debtFromPreviousMonth', Number(item.debtFromPreviousMonth))
    setValue('amount', Number(item.amount))
    setValue('paidAmount', Number(item.paidAmount))
    setValue('month', item.month)
    setValue('year', item.year)
    setValue('date', item.date)
    setValue('description', item.description || '')
    setDialogOpen(true)
  }

  const allItems = data?.data ?? []
  const totalAmount = allItems.reduce((s, x) => s + Number(x.amount), 0)
  const totalPaid = allItems.reduce((s, x) => s + Number(x.paidAmount), 0)
  const totalDebt = allItems.reduce((s, x) => s + Number(x.remainingDebt), 0)

  const columns = [
    { key: 'worker', header: 'Ishchi', cell: (r: WorkerPayment) => <span className="font-medium">{r.workerName}</span> },
    {
      key: 'category',
      header: 'Kategoriya',
      cell: (r: WorkerPayment) => (
        <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
          {workerPaymentCategoryLabel(r.category)}
        </span>
      ),
    },
    { key: 'month', header: 'Oy', cell: (r: WorkerPayment) => <span className="text-sm">{MONTHS[r.month - 1]} {r.year}</span> },
    { key: 'amount', header: "Hisoblangan", cell: (r: WorkerPayment) => <span className="font-medium">{formatCurrency(Number(r.amount))}</span> },
    {
      key: 'paid',
      header: "To'langan",
      cell: (r: WorkerPayment) => (
        <span className="font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(Number(r.paidAmount))}</span>
      ),
    },
    {
      key: 'debt',
      header: 'Qolgan qarz',
      cell: (r: WorkerPayment) => (
        <span className={Number(r.remainingDebt) > 0 ? 'font-semibold text-red-600 dark:text-red-400' : 'text-muted-foreground'}>
          {Number(r.remainingDebt) > 0 ? formatCurrency(Number(r.remainingDebt)) : '—'}
        </span>
      ),
    },
    { key: 'date', header: 'Sana', cell: (r: WorkerPayment) => <span className="text-sm text-muted-foreground">{formatDate(r.date)}</span> },
    {
      key: 'actions',
      header: '',
      cell: (r: WorkerPayment) => (
        <div className="flex gap-1 justify-end">
          <Button variant="ghost" size="icon-sm" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
          {isAdmin && (
            <Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(r.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ishchilar"
        description="Ishchi to'lovlari va qarz boshqaruvi"
        actions={
          <Button onClick={() => { setEditItem(null); reset({ date: new Date().toISOString().split('T')[0], month: currentMonth, year: currentYear, debtFromPreviousMonth: 0, paidAmount: 0 }); setDialogOpen(true) }}>
            <Plus className="h-4 w-4 mr-1" /> To&apos;lov qo&apos;shish
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard title="Jami hisoblangan" value={totalAmount} icon={HardHat} color="blue" />
        <StatsCard title="Jami to'langan" value={totalPaid} icon={HardHat} color="emerald" />
        <StatsCard title="Jami qarz" value={totalDebt} icon={HardHat} color="red" />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'list' | 'report')}>
        <TabsList>
          <TabsTrigger value="list">Ro&apos;yxat</TabsTrigger>
          <TabsTrigger value="report"><BarChart3 className="h-4 w-4 mr-1" />Oylik hisobot</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-4 space-y-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Ishchi ismi bo'yicha..." className="max-w-sm" />
              {allItems.length === 0 && !isLoading ? (
                <EmptyState icon={HardHat} title="Ishchi yo'q" description="Birinchi ishchi to'lovini qo'shing" action={<Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-1" />To&apos;lov qo&apos;shish</Button>} />
              ) : (
                <>
                  <DataTable columns={columns} data={allItems} loading={isLoading} />
                  {data && <Pagination page={page} totalPages={data.meta.totalPages} total={data.meta.total} limit={limit} onPageChange={setPage} />}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="report" className="mt-4 space-y-4">
          <div className="flex gap-3 items-center">
            <Select value={String(reportMonth)} onValueChange={(v) => setReportMonth(Number(v))}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={String(reportYear)} onValueChange={(v) => setReportYear(Number(v))}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[2023, 2024, 2025, 2026].map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {reportLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)}
            </div>
          ) : report ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatsCard title="Ishchilar soni" value={report.totalWorkers} icon={HardHat} color="blue" format="number" suffix="ta" />
                <StatsCard title="Hisoblangan" value={report.totalAmount} icon={HardHat} color="slate" />
                <StatsCard title="To'langan" value={report.totalPaid} icon={HardHat} color="emerald" />
                <StatsCard title="Qolgan qarz" value={report.totalDebt} icon={HardHat} color="red" />
              </div>

              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-4">Kategoriya bo&apos;yicha hisobot</h3>
                  <div className="space-y-3">
                    {Object.entries(report.byCategory).map(([cat, stats]) => (
                      <div key={cat} className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                        <div>
                          <p className="font-medium text-sm">{workerPaymentCategoryLabel(cat)}</p>
                          <p className="text-xs text-muted-foreground">{(stats as { count: number }).count} ta ishchi</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-sm">{formatCurrency(Number((stats as { amount: number }).amount))}</p>
                          <p className="text-xs text-red-500">Qarz: {formatCurrency(Number((stats as { debt: number }).debt))}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <EmptyState icon={BarChart3} title="Ma'lumot yo'q" description="Tanlangan oy uchun ma'lumot topilmadi" />
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editItem ? "To'lovni tahrirlash" : "To'lov qo'shish"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit((d) => editItem ? updateMutation.mutate(d) : createMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ishchi ismi *</Label>
                <Input {...register('workerName')} placeholder="Ahmadjon" />
                {errors.workerName && <p className="text-destructive text-xs">{errors.workerName.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Kategoriya *</Label>
                <Select defaultValue={editItem?.category ?? 'OTHER'} onValueChange={(v) => setValue('category', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{workerPaymentCategoryLabel(c)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Oy</Label>
                <Select defaultValue={String(editItem?.month ?? currentMonth)} onValueChange={(v) => setValue('month', Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Yil</Label>
                <Select defaultValue={String(editItem?.year ?? currentYear)} onValueChange={(v) => setValue('year', Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[2023, 2024, 2025, 2026].map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Oldingi qarz</Label>
                <Input {...register('debtFromPreviousMonth')} type="number" step="0.01" placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>Hisoblangan *</Label>
                <Input {...register('amount')} type="number" step="0.01" placeholder="500000" />
                {errors.amount && <p className="text-destructive text-xs">{errors.amount.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>To&apos;langan</Label>
                <Input {...register('paidAmount')} type="number" step="0.01" placeholder="0" />
              </div>
            </div>

            {(Number(debtPrev) + Number(amount)) > 0 && (
              <div className="rounded-xl bg-muted/50 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Qolgan qarz:</span>
                  <span className={`font-bold ${remainingDebt > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {formatCurrency(Math.max(0, remainingDebt))}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Sana *</Label>
              <Input {...register('date')} type="date" />
            </div>
            <div className="space-y-2">
              <Label>Izoh</Label>
              <Input {...register('description')} placeholder="Qo'shimcha ma'lumot..." />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Bekor qilish</Button>
              <Button type="submit" disabled={isSubmitting || createMutation.isPending || updateMutation.isPending}>
                {isSubmitting || createMutation.isPending || updateMutation.isPending ? 'Saqlanmoqda...' : editItem ? 'Saqlash' : "Qo'shish"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="To'lovni o'chirishni tasdiqlang"
        description="Bu amal orqaga qaytarib bo'lmaydi."
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
