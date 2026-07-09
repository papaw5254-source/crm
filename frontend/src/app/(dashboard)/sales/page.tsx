'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, ShoppingCart, Pencil, Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { salesService } from '@/services/sales.service'
import { workerPaymentService } from '@/services/worker-payment.service'
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
import type { Sale, PaymentType, BrickType } from '@/types'

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
  workerOldDebt: z.coerce.number().min(0).optional(),
})

type FormData = z.infer<typeof schema>

const eskiQarzSchema = z.object({
  amount: z.coerce.number().min(0),
  paidAmount: z.coerce.number().min(0),
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
  const { page, limit, setPage } = usePagination()
  const debouncedSearch = useDebounce(search)

  const { data, isLoading } = useQuery({
    queryKey: ['sales', page, limit, debouncedSearch, filterDate],
    queryFn: () => salesService.getAll({
      page: filterDate ? 1 : page,
      limit: filterDate ? 500 : limit,
      search: debouncedSearch,
      ...(filterDate ? { dateFrom: filterDate, dateTo: filterDate } : {}),
    }),
  })

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { date: new Date().toISOString().split('T')[0], paymentType: 'CASH', brickType: 'BAKED_BRICK' },
  })

  const eskiQarzForm = useForm<EskiQarzForm>({
    resolver: zodResolver(eskiQarzSchema),
    defaultValues: { amount: 0, paidAmount: 0, date: new Date().toISOString().split('T')[0] },
  })

  const brickType = watch('brickType')
  const qty = watch('quantity')
  const price = watch('pricePerBrick')
  const workerRate = watch('workerRatePerBrick') || 0
  const workerPaid = watch('workerPaidAmount') || 0
  const workerOld = watch('workerOldDebt') || 0
  const total = (qty || 0) * (price || 0)
  const totalWorkerCost = brickType === 'RAW_BRICK' && workerRate > 0 ? (qty || 0) * workerRate : 0
  const saleWorkerDebt = brickType === 'RAW_BRICK' ? Math.max(0, workerOld + totalWorkerCost - workerPaid) : 0

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

  const eskiQarzMutation = useMutation({
    mutationFn: (d: EskiQarzForm) => workerPaymentService.create({
      workerName: "Ishchilar (xom g'isht yuklash)",
      category: 'FIELD_RAW_LOADING',
      amount: d.amount,
      paidAmount: d.paidAmount,
      remainingDebt: Math.max(0, d.amount - d.paidAmount),
      month: d.date.slice(0, 7),
      date: d.date,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worker-payments'] })
      toast.success('Eski qarz qo\'shildi')
      setEskiQarzOpen(false)
      eskiQarzForm.reset({ amount: 0, paidAmount: 0, date: new Date().toISOString().split('T')[0] })
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
      setValue('workerOldDebt', Number(item.workerOldDebt || 0))
    }
    setDialogOpen(true)
  }

  const onSubmit = (data: FormData) => {
    if (editItem) updateMutation.mutate(data)
    else createMutation.mutate(data)
  }

  const allRows = data?.data ?? []

  const filteredData = paymentTypeFilter === 'ALL'
    ? allRows
    : allRows.filter((s: Sale) => s.paymentType === paymentTypeFilter)

  const totalAmount = allRows.reduce((s: number, x: Sale) => s + Number(x.totalAmount), 0)
  const totalQty = allRows.reduce((s: number, x: Sale) => s + x.quantity, 0)
  const rawQty = allRows.filter((s: Sale) => s.brickType === 'RAW_BRICK').reduce((s: number, x: Sale) => s + x.quantity, 0)
  const bakedQty = allRows.filter((s: Sale) => s.brickType === 'BAKED_BRICK' || !s.brickType).reduce((s: number, x: Sale) => s + x.quantity, 0)
  const totalWorkerDebt = allRows.filter((s: Sale) => s.brickType === 'RAW_BRICK').reduce((s: number, x: Sale) => s + Number(x.workerDebt || 0), 0)

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
      cell: (r: Sale) => r.brickType === 'RAW_BRICK' && Number(r.totalWorkerCost) > 0
        ? <span className="text-orange-600 font-medium">{formatCurrency(Number(r.totalWorkerCost))}</span>
        : <span className="text-muted-foreground text-xs">—</span>,
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
              Yuklagchi eski qarz
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatsCard title="Jami sotuvlar" value={data?.meta?.total ?? 0} icon={ShoppingCart} color="emerald" format="number" suffix="ta" />
          <StatsCard title="Jami summa" value={totalAmount} icon={ShoppingCart} color="blue" />
          <StatsCard title="Jami miqdor" value={totalQty} icon={ShoppingCart} color="purple" format="number" suffix="dona" />
          <StatsCard title="Yuklagchi qarzi" value={totalWorkerDebt} icon={ShoppingCart} color="red" />
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
                  onClick={() => setPaymentTypeFilter(type)}
                >
                  {type === 'ALL' ? 'Barchasi' : paymentTypeLabel(type)}
                </Button>
              ))}
            </div>
          </div>

          {filteredData.length === 0 && !isLoading ? (
            <EmptyState icon={ShoppingCart} title="Sotuv yo'q" description="Birinchi sotuvni qo'shing" action={<Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-1" />Sotuv qo&apos;shish</Button>} />
          ) : (
            <>
              <DataTable columns={columns} data={filteredData} loading={isLoading} />
              {!filterDate && data?.meta && <Pagination page={page} totalPages={data.meta.totalPages} total={data.meta.total} limit={limit} onPageChange={setPage} />}
            </>
          )}
        </CardContent>
      </Card>

      {/* Sale dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editItem ? 'Sotuvni tahrirlash' : "Sotuv qo'shish"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Miqdor (dona) *</Label>
                <Input {...register('quantity')} type="number" placeholder="1000" />
                {errors.quantity && <p className="text-destructive text-xs">{errors.quantity.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Narx (1 dona) *</Label>
                <Input {...register('pricePerBrick')} type="number" step="0.01" placeholder="450" />
                {errors.pricePerBrick && <p className="text-destructive text-xs">{errors.pricePerBrick.message}</p>}
              </div>
            </div>

            {total > 0 && (
              <div className="rounded-xl bg-primary/10 p-3 text-sm">
                <span className="text-muted-foreground">Jami summa: </span>
                <span className="font-bold text-primary">{formatCurrency(total)}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label>To&apos;lov turi *</Label>
              <Select
                value={watch('paymentType') || 'CASH'}
                onValueChange={(v: string) => setValue('paymentType', v as PaymentType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Naqd</SelectItem>
                  <SelectItem value="CARD">Karta</SelectItem>
                  <SelectItem value="DEBT">Nasiya</SelectItem>
                  <SelectItem value="BANK_TRANSFER">Perechisleniya</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{watch('paymentType') === 'BANK_TRANSFER' ? 'Firma nomi' : 'Mijoz ismi'}</Label>
                <Input {...register('customerName')} placeholder={watch('paymentType') === 'BANK_TRANSFER' ? 'OOO Firm nomi' : 'Ahmadjon'} />
              </div>
              <div className="space-y-2">
                <Label>Telefon</Label>
                <Input {...register('customerPhone')} placeholder="+998901234567" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Sana *</Label>
              <Input {...register('date')} type="date" />
            </div>

            <div className="space-y-2">
              <Label>Izoh</Label>
              <Input {...register('description')} placeholder="Qo'shimcha ma'lumot..." />
            </div>

            {/* Worker payment section — only for xom g'isht */}
            {brickType === 'RAW_BRICK' && (
              <div className="rounded-xl border-2 border-dashed border-orange-400 p-4 space-y-3">
                <p className="text-sm font-semibold text-orange-600">Yuklagchi (xom g&apos;isht) ishchi puli</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Oldingi qarz</Label>
                    <Input {...register('workerOldDebt')} type="number" step="1" placeholder="0" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">1 dona narx</Label>
                    <Input {...register('workerRatePerBrick')} type="number" step="0.01" placeholder="20" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Berildi</Label>
                    <Input {...register('workerPaidAmount')} type="number" step="1" placeholder="0" />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 rounded-lg bg-orange-50 dark:bg-orange-950/20 p-2 text-xs text-center">
                  <div>
                    <div className="text-muted-foreground">Oldingi qarz</div>
                    <div className="font-semibold text-amber-600">{formatCurrency(workerOld)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Bugungi ish</div>
                    <div className="font-semibold">{formatCurrency(totalWorkerCost)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Berildi</div>
                    <div className="font-semibold text-green-600">{formatCurrency(workerPaid)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Jami qarz</div>
                    <div className={`font-bold ${saleWorkerDebt > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(saleWorkerDebt)}</div>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
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
            <DialogTitle>Yuklagchi eski qarz</DialogTitle>
          </DialogHeader>
          <form onSubmit={eskiQarzForm.handleSubmit((d) => eskiQarzMutation.mutate(d))} className="space-y-4">
            <div className="space-y-2">
              <Label>Qarz miqdori</Label>
              <Input {...eskiQarzForm.register('amount')} type="number" step="1" placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label>Berildi</Label>
              <Input {...eskiQarzForm.register('paidAmount')} type="number" step="1" placeholder="0" />
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
    </div>
  )
}
