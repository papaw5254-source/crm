'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, ShoppingCart, Pencil, Trash2, HardHat } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { salesService } from '@/services/sales.service'
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
import { formatDate, formatCurrency, brickTypeLabel, brickTypeColor, paymentTypeLabel, paymentTypeColor, getErrorMessage } from '@/lib/utils'
import { useDebounce } from '@/hooks/use-debounce'
import { usePagination } from '@/hooks/use-pagination'
import { useAuth } from '@/providers/auth-provider'
import type { Sale, PaymentType, BrickType, WorkerPayment } from '@/types'

const schema = z.object({
  brickType: z.enum(['RAW_BRICK', 'BAKED_BRICK']),
  quantity: z.coerce.number().min(1, 'Miqdor 1 dan katta bo\'lishi kerak'),
  pricePerBrick: z.coerce.number().min(0.01, 'Narx 0 dan katta bo\'lishi kerak'),
  paymentType: z.enum(['CASH', 'CARD', 'DEBT', 'PREPAYMENT', 'BANK_TRANSFER']),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  description: z.string().optional(),
  date: z.string().min(1, 'Sana kiritilishi shart'),
  workerRatePerBrick: z.coerce.number().min(0).optional(),
  workerPaidAmount: z.coerce.number().min(0).optional(),
})

type FormData = z.infer<typeof schema>

const eskiQarzSchema = z.object({
  oldDebt: z.coerce.number().min(0),
  date: z.string().min(1),
})
type EskiQarzForm = z.infer<typeof eskiQarzSchema>

export default function SalesPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editItem, setEditItem] = useState<Sale | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<PaymentType | 'ALL'>('ALL')
  const [filterDate, setFilterDate] = useState('')
  const [eskiQarzOpen, setEskiQarzOpen] = useState(false)
  const [deleteEskiQarzId, setDeleteEskiQarzId] = useState<string | null>(null)
  const { page, limit, setPage } = usePagination()
  const debouncedSearch = useDebounce(search)

  const now = new Date()
  const THIS_MONTH = now.getMonth() + 1
  const THIS_YEAR = now.getFullYear()

  const { data: wpReport } = useQuery({
    queryKey: ['worker-payments-report', THIS_MONTH, THIS_YEAR],
    queryFn: () => workerPaymentsService.getReport({ month: THIS_MONTH, year: THIS_YEAR }),
  })
  const emptyStats = { amount: 0, paid: 0, debt: 0, carriedDebt: 0 }
  const yuklagchiStatsRaw = wpReport?.byCategory?.FIELD_RAW_LOADING ?? emptyStats

  const { data: eskiQarzData } = useQuery({
    queryKey: ['worker-payments-eski-qarz'],
    queryFn: () => workerPaymentsService.getAll({ category: 'FIELD_RAW_LOADING', limit: 200 }),
  })
  const eskiQarzList = (eskiQarzData?.data ?? []).filter((r: WorkerPayment) => !r.sourceId && Number(r.debtFromPreviousMonth) > 0)
  const eskiQarzCarriedDebt = eskiQarzList.reduce((acc: number, r: WorkerPayment) => acc + Number(r.debtFromPreviousMonth), 0)
  const yuklagchiStats = { ...yuklagchiStatsRaw, carriedDebt: eskiQarzCarriedDebt }

  const scoped = !!filterDate || paymentTypeFilter !== 'ALL'

  const { data, isLoading } = useQuery({
    queryKey: ['sales', page, limit, debouncedSearch, filterDate, paymentTypeFilter],
    queryFn: () => salesService.getAll({
      page: scoped ? 1 : page,
      limit: scoped ? 500 : limit,
      search: debouncedSearch,
      isReserveSale: false,
      ...(filterDate ? { dateFrom: filterDate, dateTo: filterDate } : {}),
      ...(paymentTypeFilter !== 'ALL' ? { paymentType: paymentTypeFilter } : {}),
    }),
  })

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { date: new Date().toISOString().split('T')[0], paymentType: 'CASH', brickType: 'BAKED_BRICK' },
  })

  const eskiQarzForm = useForm<EskiQarzForm>({
    resolver: zodResolver(eskiQarzSchema),
    defaultValues: { oldDebt: 0, date: new Date().toISOString().split('T')[0] },
  })

  const brickType = watch('brickType')
  const qty = watch('quantity')
  const price = watch('pricePerBrick')
  const workerRate = watch('workerRatePerBrick') || 0
  const workerPaid = watch('workerPaidAmount') || 0
  const total = (qty || 0) * (price || 0)
  const totalWorkerCost = brickType === 'RAW_BRICK' && workerRate > 0 ? (qty || 0) * workerRate : 0
  const workerDebtCalc = Math.max(0, totalWorkerCost - workerPaid)

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['sales'] })
    queryClient.invalidateQueries({ queryKey: ['stock'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    queryClient.invalidateQueries({ queryKey: ['debtors'] })
    queryClient.invalidateQueries({ queryKey: ['worker-payments'] })
  }

  const createMutation = useMutation({
    mutationFn: (data: FormData) => salesService.create(data),
    onSuccess: () => {
      invalidateAll()
      toast.success('Sotuv muvaffaqiyatli qo\'shildi')
      setDialogOpen(false)
      reset({ date: new Date().toISOString().split('T')[0], paymentType: 'CASH', brickType: 'BAKED_BRICK' })
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormData) => salesService.update(editItem!.id, data),
    onSuccess: () => {
      invalidateAll()
      toast.success('Sotuv yangilandi')
      setEditItem(null)
      setDialogOpen(false)
      reset()
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => salesService.delete(id),
    onSuccess: () => {
      invalidateAll()
      toast.success('Sotuv o\'chirildi')
      setDeleteId(null)
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const deleteEskiQarzMutation = useMutation({
    mutationFn: (id: string) => workerPaymentsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worker-payments-eski-qarz'] })
      queryClient.invalidateQueries({ queryKey: ['worker-payments-report'] })
      toast.success("Eski qarz o'chirildi")
      setDeleteEskiQarzId(null)
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const eskiQarzMutation = useMutation({
    mutationFn: (d: EskiQarzForm) => workerPaymentsService.create({
      workerName: "Ishchilar (xom g'isht yuklash)",
      category: 'FIELD_RAW_LOADING',
      amount: 0,
      paidAmount: 0,
      debtFromPreviousMonth: d.oldDebt,
      month: d.date.slice(0, 7),
      date: d.date,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worker-payments'] })
      queryClient.invalidateQueries({ queryKey: ['worker-payments-eski-qarz'] })
      queryClient.invalidateQueries({ queryKey: ['worker-payments-report'] })
      toast.success('Eski qarz qo\'shildi')
      setEskiQarzOpen(false)
      eskiQarzForm.reset({ oldDebt: 0, date: new Date().toISOString().split('T')[0] })
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const openEdit = (item: Sale) => {
    setEditItem(item)
    setValue('brickType', (item.brickType ?? 'BAKED_BRICK') as BrickType)
    setValue('quantity', item.quantity)
    setValue('pricePerBrick', Number(item.pricePerBrick))
    setValue('paymentType', item.paymentType)
    setValue('customerName', item.customerName || '')
    setValue('customerPhone', item.customerPhone || '')
    setValue('description', item.description || '')
    setValue('date', item.date)
    if (item.brickType === 'RAW_BRICK') {
      setValue('workerRatePerBrick', Number(item.workerRatePerBrick || 0))
      setValue('workerPaidAmount', Number(item.workerPaidAmount || 0))
    }
    setDialogOpen(true)
  }

  const onSubmit = (data: FormData) => {
    if (editItem) updateMutation.mutate(data)
    else createMutation.mutate(data)
  }

  const allRows = data?.data ?? []

  // Backend-computed totals span every filtered row, not just the current page
  // (allRows.reduce() here would only ever cover the current page's ~10 rows).
  const totalAmount = data?.meta?.totalAmount ?? 0
  const totalQty = data?.meta?.totalQuantity ?? 0
  const rawQty = data?.meta?.totalRawQuantity ?? 0
  const bakedQty = data?.meta?.totalBakedQuantity ?? 0

  const columns = [
    { key: 'date', header: 'Sana', cell: (r: Sale) => <span className="font-medium">{formatDate(r.date)}</span> },
    { key: 'customer', header: 'Mijoz', cell: (r: Sale) => <span>{r.customerName || "Noma'lum"}</span> },
    {
      key: 'brickType',
      header: "G'isht turi",
      cell: (r: Sale) => (
        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${brickTypeColor(r.brickType ?? 'BAKED_BRICK')}`}>
          {brickTypeLabel(r.brickType ?? 'BAKED_BRICK')}
        </span>
      ),
    },
    { key: 'qty', header: 'Miqdor', cell: (r: Sale) => <span className="font-medium">{r.quantity.toLocaleString()} dona</span> },
    { key: 'price', header: 'Narx', cell: (r: Sale) => <span>{formatCurrency(Number(r.pricePerBrick))}</span> },
    { key: 'total', header: 'Jami', cell: (r: Sale) => <span className="font-semibold text-primary">{formatCurrency(Number(r.totalAmount))}</span> },
    {
      key: 'workerCost',
      header: 'Ishchi puli',
      cell: (r: Sale) => r.brickType === 'RAW_BRICK' && Number(r.totalWorkerCost) > 0 ? (
        <div className="text-xs space-y-0.5">
          <div className="font-semibold text-orange-600">{formatCurrency(Number(r.totalWorkerCost))}</div>
          <div className="text-muted-foreground">
            <span className="text-emerald-600">Berildi: {formatCurrency(Number(r.workerPaidAmount ?? 0))}</span>
            {Number(r.workerDebt) > 0 && <span className="text-red-500 ml-1">Qarz: {formatCurrency(Number(r.workerDebt))}</span>}
          </div>
        </div>
      ) : <span className="text-muted-foreground text-xs">—</span>,
    },
    {
      key: 'type',
      header: "To'lov turi",
      cell: (r: Sale) => (
        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${paymentTypeColor(r.paymentType)}`}>
          {paymentTypeLabel(r.paymentType)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      cell: (r: Sale) => (
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
        title="Chiqim (Sotuvlar)"
        description="G'isht sotuvlari boshqaruvi"
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setEskiQarzOpen(true)}>
              Yuklagan eski qarz
            </Button>
            <Button onClick={() => { setEditItem(null); reset({ date: new Date().toISOString().split('T')[0], paymentType: 'CASH', brickType: 'BAKED_BRICK' }); setDialogOpen(true) }}>
              <Plus className="h-4 w-4 mr-1" /> Sotuv qo&apos;shish
            </Button>
          </div>
        }
      />

      {filterDate ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatsCard title="Jami sotuvlar" value={allRows.length} icon={ShoppingCart} color="emerald" format="number" suffix="ta" />
          <StatsCard title="Jami summa" value={totalAmount} icon={ShoppingCart} color="blue" />
          <StatsCard title={`Pishgan g'isht`} value={bakedQty} icon={ShoppingCart} color="amber" format="number" suffix="dona" />
          <StatsCard title="Xom g'isht" value={rawQty} icon={ShoppingCart} color="purple" format="number" suffix="dona" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatsCard title="Jami sotuvlar" value={data?.meta?.total ?? 0} icon={ShoppingCart} color="emerald" format="number" suffix="ta" />
          <StatsCard title="Jami summa" value={totalAmount} icon={ShoppingCart} color="blue" />
          <StatsCard title="Jami miqdor" value={totalQty} icon={ShoppingCart} color="purple" format="number" suffix="dona" />
        </div>
      )}

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
            <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Mijoz nomi bo'yicha..." className="sm:max-w-xs" />
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={filterDate}
                onChange={(e) => { setFilterDate(e.target.value); setPage(1) }}
                className="w-40"
              />
              {filterDate && (
                <Button variant="outline" size="sm" onClick={() => { setFilterDate(''); setPage(1) }}>
                  ✕ Tozalash
                </Button>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              {(['ALL', 'CASH', 'CARD', 'DEBT', 'BANK_TRANSFER'] as const).map((type) => (
                <Button
                  key={type}
                  variant={paymentTypeFilter === type ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setPaymentTypeFilter(type); setPage(1) }}
                >
                  {type === 'ALL' ? 'Barchasi' : paymentTypeLabel(type)}
                </Button>
              ))}
            </div>
          </div>

          {allRows.length === 0 && !isLoading ? (
            <EmptyState icon={ShoppingCart} title="Sotuv yo'q" description="Birinchi sotuvni qo'shing" action={<Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-1" />Sotuv qo&apos;shish</Button>} />
          ) : (
            <>
              <DataTable columns={columns} data={allRows} loading={isLoading} />
              {!scoped && data?.meta && <Pagination page={page} totalPages={data.meta.totalPages} total={data.meta.total} limit={limit} onPageChange={setPage} />}
            </>
          )}
        </CardContent>
      </Card>

      {/* Yuklagchi ishchi puli */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <HardHat className="h-4 w-4" /> Yuklagchi ishchi puli — bu oy
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatsCard title="Hisoblangan" value={Number(yuklagchiStats.amount)} icon={HardHat} color="amber" />
          <StatsCard title="Berildi" value={Number(yuklagchiStats.paid)} icon={HardHat} color="emerald" />
          <StatsCard title="Oldingi qarz" value={Number(yuklagchiStats.carriedDebt)} icon={HardHat} color="slate" />
          <StatsCard title="Jami qarz" value={Number(yuklagchiStats.debt)} icon={HardHat} color="red" />
        </div>

        {eskiQarzList.length > 0 && (
          <Card>
            <CardContent className="p-3">
              <p className="text-xs font-semibold text-muted-foreground mb-2">Qo&apos;shilgan eski qarzlar</p>
              <div className="space-y-1">
                {eskiQarzList.map((r: WorkerPayment) => (
                  <div key={r.id} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-muted-foreground">{formatDate(r.date)}</span>
                      <span className="font-semibold text-orange-600">{formatCurrency(Number(r.debtFromPreviousMonth))}</span>
                      {r.description && <span className="text-xs text-muted-foreground">{r.description}</span>}
                    </div>
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 w-7 p-0" onClick={() => setDeleteEskiQarzId(r.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Sale dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg flex flex-col max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editItem ? 'Sotuvni tahrirlash' : "Sotuv qo'shish"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
            <div className="overflow-y-auto flex-1 space-y-3 pr-1">
              <div className="space-y-1.5">
                <Label>G&apos;isht turi *</Label>
                <Select
                  value={watch('brickType') || 'BAKED_BRICK'}
                  onValueChange={(v: string) => setValue('brickType', v as BrickType)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BAKED_BRICK">Pishgan g&apos;isht</SelectItem>
                    <SelectItem value="RAW_BRICK">Xom g&apos;isht</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Miqdor (dona) *</Label>
                  <Input {...register('quantity')} type="number" placeholder="1000" />
                  {errors.quantity && <p className="text-destructive text-xs">{errors.quantity.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Narx (1 dona) *</Label>
                  <Input {...register('pricePerBrick')} type="number" step="0.01" placeholder="450" />
                  {errors.pricePerBrick && <p className="text-destructive text-xs">{errors.pricePerBrick.message}</p>}
                </div>
              </div>

              {total > 0 && (
                <div className="rounded-lg bg-primary/10 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">Jami summa: </span>
                  <span className="font-bold text-primary">{formatCurrency(total)}</span>
                </div>
              )}

              {/* Worker payment section — only for xom g'isht */}
              {brickType === 'RAW_BRICK' && (
                <div className="rounded-lg border border-dashed border-orange-400 px-3 py-2 space-y-2">
                  <p className="text-xs font-semibold text-orange-600">Yuklagan puli</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-0.5">
                      <Label className="text-xs text-muted-foreground">1 dona narx (so&apos;m)</Label>
                      <Input {...register('workerRatePerBrick')} type="number" step="0.01" placeholder="20" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-0.5">
                      <Label className="text-xs text-muted-foreground">Berildi (so&apos;m)</Label>
                      <Input {...register('workerPaidAmount')} type="number" placeholder="0" className="h-8 text-sm" />
                    </div>
                  </div>
                  {totalWorkerCost > 0 && (
                    <div className="grid grid-cols-3 gap-1 rounded bg-orange-50 dark:bg-orange-950/20 px-2 py-1 text-xs text-center">
                      <div>
                        <div className="text-muted-foreground">Hisoblandi</div>
                        <div className="font-semibold">{formatCurrency(totalWorkerCost)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Berildi</div>
                        <div className="font-semibold text-emerald-600">{formatCurrency(workerPaid)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Qarz</div>
                        <div className="font-bold text-red-600">{formatCurrency(workerDebtCalc)}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <Label>To&apos;lov turi *</Label>
                <Select
                  value={watch('paymentType') || 'CASH'}
                  onValueChange={(v: string) => setValue('paymentType', v as PaymentType)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Naqd</SelectItem>
                    <SelectItem value="CARD">Karta</SelectItem>
                    <SelectItem value="DEBT">Nasiya</SelectItem>
                    <SelectItem value="BANK_TRANSFER">Perechisleniya</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{watch('paymentType') === 'BANK_TRANSFER' ? 'Firma nomi' : 'Mijoz ismi'}</Label>
                  <Input {...register('customerName')} placeholder={watch('paymentType') === 'BANK_TRANSFER' ? 'OOO Firm' : 'Ahmadjon'} />
                </div>
                <div className="space-y-1.5">
                  <Label>Telefon</Label>
                  <Input {...register('customerPhone')} placeholder="+998901234567" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Sana *</Label>
                  <Input {...register('date')} type="date" />
                </div>
                <div className="space-y-1.5">
                  <Label>Izoh</Label>
                  <Input {...register('description')} placeholder="Qo'shimcha ma'lumot..." />
                </div>
              </div>
            </div>

            <DialogFooter className="pt-3 border-t mt-3">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Bekor qilish</Button>
              <Button type="submit" loading={isSubmitting || createMutation.isPending || updateMutation.isPending}>
                {editItem ? 'Saqlash' : "Qo'shish"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Eski qarz dialog */}
      <Dialog open={eskiQarzOpen} onOpenChange={setEskiQarzOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Yuklagan puli — eski qarz</DialogTitle>
          </DialogHeader>
          <form onSubmit={eskiQarzForm.handleSubmit((d) => eskiQarzMutation.mutate(d))} className="space-y-4">
            <div className="space-y-2">
              <Label>Eski qarz miqdori (so&apos;m)</Label>
              <Input {...eskiQarzForm.register('oldDebt')} type="number" step="1" placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label>Sana</Label>
              <Input {...eskiQarzForm.register('date')} type="date" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEskiQarzOpen(false)}>Bekor qilish</Button>
              <Button type="submit" loading={eskiQarzMutation.isPending}>Saqlash</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Sotuvni o'chirishni tasdiqlang"
        description="Ombor miqdori tiklanadi."
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        loading={deleteMutation.isPending}
      />

      <ConfirmDialog
        open={!!deleteEskiQarzId}
        onOpenChange={(o) => !o && setDeleteEskiQarzId(null)}
        title="Eski qarzni o'chirish"
        description="Bu yozuv o'chiriladi va oldingi qarz hisoblanmaydi."
        onConfirm={() => deleteEskiQarzId && deleteEskiQarzMutation.mutate(deleteEskiQarzId)}
        loading={deleteEskiQarzMutation.isPending}
      />
    </div>
  )
}
