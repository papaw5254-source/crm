'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, ShoppingCart, Pencil, Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { salesService } from '@/services/sales.service'
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
})

type FormData = z.infer<typeof schema>

export default function SalesPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editItem, setEditItem] = useState<Sale | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<PaymentType | 'ALL'>('ALL')
  const { page, limit, setPage } = usePagination()
  const debouncedSearch = useDebounce(search)

  const { data, isLoading } = useQuery({
    queryKey: ['sales', page, limit, debouncedSearch],
    queryFn: () => salesService.getAll({ page, limit, search: debouncedSearch }),
  })

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { date: new Date().toISOString().split('T')[0], paymentType: 'CASH', brickType: 'BAKED_BRICK' },
  })

  const qty = watch('quantity')
  const price = watch('pricePerBrick')
  const total = (qty || 0) * (price || 0)

  const createMutation = useMutation({
    mutationFn: (data: FormData) => salesService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      queryClient.refetchQueries({ queryKey: ['sales'] })
      queryClient.invalidateQueries({ queryKey: ['stock'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['debtors'] })
      toast.success('Sotuv muvaffaqiyatli qo\'shildi')
      setDialogOpen(false)
      reset({ date: new Date().toISOString().split('T')[0], paymentType: 'CASH', brickType: 'BAKED_BRICK' })
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormData) => salesService.update(editItem!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      queryClient.invalidateQueries({ queryKey: ['stock'] })
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
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      queryClient.invalidateQueries({ queryKey: ['stock'] })
      toast.success('Sotuv o\'chirildi')
      setDeleteId(null)
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
    setDialogOpen(true)
  }

  const onSubmit = (data: FormData) => {
    const payload = {
      ...data,
      customerName: data.customerName?.trim() || undefined,
      customerPhone: data.customerPhone?.trim() || undefined,
      description: data.description?.trim() || undefined,
    }
    if (editItem) updateMutation.mutate(payload)
    else createMutation.mutate(payload)
  }

  const filteredData = paymentTypeFilter === 'ALL'
    ? data?.data ?? []
    : (data?.data ?? []).filter((s: Sale) => s.paymentType === paymentTypeFilter)

  const totalAmount = (data?.data ?? []).reduce((s: number, x: Sale) => s + Number(x.totalAmount), 0)
  const totalQty = (data?.data ?? []).reduce((s: number, x: Sale) => s + x.quantity, 0)

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
      cell: (r: Sale) => r.totalWorkerCost ? (
        <div className="text-sm">
          <div className="font-medium">{formatCurrency(Number(r.totalWorkerCost))}</div>
          <div className="text-xs text-muted-foreground">
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
          <Button onClick={() => { setEditItem(null); reset({ date: new Date().toISOString().split('T')[0], paymentType: 'CASH', brickType: 'BAKED_BRICK' }); setDialogOpen(true) }}>
            <Plus className="h-4 w-4 mr-1" /> Sotuv qo&apos;shish
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard title="Jami sotuvlar" value={data?.meta.total ?? 0} icon={ShoppingCart} color="emerald" format="number" suffix="ta" />
        <StatsCard title="Jami summa" value={totalAmount} icon={ShoppingCart} color="blue" />
        <StatsCard title="Jami miqdor" value={totalQty} icon={ShoppingCart} color="purple" format="number" suffix="dona" />
      </div>


      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Mijoz nomi bo'yicha..." className="sm:max-w-sm" />
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
              {data && <Pagination page={page} totalPages={data.meta.totalPages} total={data.meta.total} limit={limit} onPageChange={setPage} />}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[500px] max-h-[88vh] overflow-hidden p-0">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle>{editItem ? 'Sotuvni tahrirlash' : "Sotuv qo'shish"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="max-h-[calc(88vh-68px)] overflow-y-auto px-4 pb-0 space-y-3 text-sm">
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

            <div className="grid grid-cols-2 gap-3">
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
              <div className="rounded-lg bg-primary/10 p-2.5 text-sm">
                <span className="text-muted-foreground">Jami summa: </span>
                <span className="font-bold text-primary">{formatCurrency(total)}</span>
              </div>
            )}

            <div className="rounded-lg border border-dashed p-3 space-y-2">
              <p data-sales-worker-payment="true" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ishchi puli (sotuv/yuklash)</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>1 dona uchun narx (so&apos;m)</Label>
                  <Input {...register('workerRatePerBrick')} type="number" placeholder="20" />
                </div>
                <div className="space-y-2">
                  <Label>Berildi (so&apos;m)</Label>
                  <Input {...register('workerPaidAmount')} type="number" placeholder="0" />
                </div>
              </div>
              {totalWorkerCost > 0 && (
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-md bg-muted px-2 py-2 text-center">
                    <div className="text-xs text-muted-foreground">Hisoblandi</div>
                    <div className="font-semibold">{formatCurrency(totalWorkerCost)}</div>
                  </div>
                  <div className="rounded-md bg-emerald-50 dark:bg-emerald-900/20 px-2 py-2 text-center">
                    <div className="text-xs text-muted-foreground">Berildi</div>
                    <div className="font-semibold text-emerald-600">{formatCurrency(workerPaid)}</div>
                  </div>
                  <div className="rounded-md bg-red-50 dark:bg-red-900/20 px-2 py-2 text-center">
                    <div className="text-xs text-muted-foreground">Qarz</div>
                    <div className="font-semibold text-red-500">{formatCurrency(Math.max(0, workerDebt))}</div>
                  </div>
                </div>
              )}
            </div>

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

            <div className="grid grid-cols-2 gap-3">
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

            <DialogFooter className="sticky bottom-0 -mx-4 mt-2 border-t bg-background px-4 py-2.5">
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
        title="Sotuvni o'chirishni tasdiqlang"
        description="Ombor miqdori tiklanadi."
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
