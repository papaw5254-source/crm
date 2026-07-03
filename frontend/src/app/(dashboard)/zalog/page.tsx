'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Wallet, Truck, Trash2, Eye, XCircle } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { prepaymentsService } from '@/services/prepayments.service'
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
import { formatDate, formatCurrency, formatNumber, brickTypeLabel, prepaymentStatusLabel, prepaymentStatusColor, getErrorMessage } from '@/lib/utils'
import { useDebounce } from '@/hooks/use-debounce'
import { usePagination } from '@/hooks/use-pagination'
import { useAuth } from '@/providers/auth-provider'
import type { Prepayment, PrepaymentDelivery, PrepaymentStatus, BrickType } from '@/types'

const today = () => new Date().toISOString().split('T')[0]

const createSchema = z.object({
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  brickType: z.enum(['RAW_BRICK', 'BAKED_BRICK']),
  quantity: z.coerce.number().min(1, "Miqdor 0 dan katta bo'lishi kerak"),
  pricePerBrick: z.coerce.number().min(0.01, "Narx 0 dan katta bo'lishi kerak"),
  paidAmount: z.coerce.number().min(0),
  date: z.string().min(1, 'Sana kiritilishi shart'),
  description: z.string().optional(),
})

const deliverSchema = z.object({
  quantity: z.coerce.number().min(1, "Miqdor 0 dan katta bo'lishi kerak"),
  date: z.string().min(1, 'Sana kiritilishi shart'),
  description: z.string().optional(),
})

type CreateFormData = z.infer<typeof createSchema>
type DeliverFormData = z.infer<typeof deliverSchema>

export default function ZalogPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<PrepaymentStatus | 'ALL'>('ALL')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deliverOpen, setDeliverOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<Prepayment | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [cancelId, setCancelId] = useState<string | null>(null)
  const { page, limit, setPage } = usePagination()
  const debouncedSearch = useDebounce(search)

  const { data, isLoading } = useQuery({
    queryKey: ['prepayments', page, limit, debouncedSearch, statusFilter],
    queryFn: () =>
      prepaymentsService.getAll({
        page,
        limit,
        search: debouncedSearch,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
      }),
  })

  const { data: deliveries } = useQuery({
    queryKey: ['prepayment-deliveries', selectedItem?.id],
    queryFn: () => prepaymentsService.getDeliveries(selectedItem!.id),
    enabled: !!selectedItem && detailOpen,
  })

  const createForm = useForm<CreateFormData>({
    resolver: zodResolver(createSchema),
    defaultValues: { brickType: 'BAKED_BRICK', paidAmount: 0, date: today() },
  })

  const deliverForm = useForm<DeliverFormData>({
    resolver: zodResolver(deliverSchema),
    defaultValues: { quantity: 1, date: today() },
  })

  const createMutation = useMutation({
    mutationFn: (d: CreateFormData) => prepaymentsService.create(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prepayments'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success("Zalog qo'shildi")
      setDialogOpen(false)
      createForm.reset({ brickType: 'BAKED_BRICK', paidAmount: 0, date: today() })
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const deliverMutation = useMutation({
    mutationFn: (d: DeliverFormData) => prepaymentsService.deliver(selectedItem!.id, d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prepayments'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['prepayment-deliveries', selectedItem?.id] })
      toast.success("G'isht yetkazildi")
      setDeliverOpen(false)
      deliverForm.reset({ quantity: 1, date: today() })
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => prepaymentsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prepayments'] })
      toast.success("Zalog o'chirildi")
      setDeleteId(null)
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => prepaymentsService.update(id, { status: 'CANCELLED' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prepayments'] })
      toast.success('Zalog bekor qilindi')
      setCancelId(null)
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const qty = createForm.watch('quantity')
  const price = createForm.watch('pricePerBrick')
  const totalAmt = (qty || 0) * (price || 0)

  const allItems = data?.data ?? []
  const totalActive = allItems.filter((x: Prepayment) => x.status === 'ACTIVE').length
  const totalPaid = allItems.reduce((s: number, x: Prepayment) => s + Number(x.paidAmount), 0)

  const STATUS_OPTIONS: (PrepaymentStatus | 'ALL')[] = ['ALL', 'ACTIVE', 'COMPLETED', 'CANCELLED']

  const columns = [
    {
      key: 'customer',
      header: 'Mijoz',
      cell: (r: Prepayment) => (
        <div>
          <p className="font-medium text-sm">{r.customerName}</p>
          <p className="text-xs text-muted-foreground">{r.customerPhone || '—'}</p>
        </div>
      ),
    },
    {
      key: 'brickType',
      header: "G'isht turi",
      cell: (r: Prepayment) => <span className="text-xs font-medium">{brickTypeLabel(r.brickType)}</span>,
    },
    {
      key: 'qty',
      header: 'Miqdor',
      cell: (r: Prepayment) => (
        <div>
          <p className="font-medium text-sm">{formatNumber(r.remainingQuantity)} / {formatNumber(r.quantity)}</p>
          <p className="text-xs text-muted-foreground">Qolgan / Jami</p>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Pul',
      cell: (r: Prepayment) => (
        <div>
          <p className="font-semibold text-sm text-emerald-600 dark:text-emerald-400">{formatCurrency(Number(r.paidAmount))}</p>
          <p className="text-xs text-muted-foreground">Qolgan: {formatCurrency(Number(r.remainingAmount))}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (r: Prepayment) => (
        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${prepaymentStatusColor(r.status)}`}>
          {prepaymentStatusLabel(r.status)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      cell: (r: Prepayment) => (
        <div className="flex gap-1 justify-end">
          <Button variant="ghost" size="icon-sm" onClick={() => { setSelectedItem(r); setDetailOpen(true) }}>
            <Eye className="h-3.5 w-3.5" />
          </Button>
          {r.status === 'ACTIVE' && (
            <Button
              variant="ghost"
              size="icon-sm"
              title="G'isht yetkazish"
              onClick={() => {
                setSelectedItem(r)
                deliverForm.reset({ quantity: 1, date: today() })
                setDeliverOpen(true)
              }}
            >
              <Truck className="h-3.5 w-3.5 text-emerald-600" />
            </Button>
          )}
          {isAdmin && r.status === 'ACTIVE' && (
            <Button
              variant="ghost"
              size="icon-sm"
              title="Zalogni bekor qilish"
              className="text-orange-500 hover:text-orange-600"
              onClick={() => setCancelId(r.id)}
            >
              <XCircle className="h-3.5 w-3.5" />
            </Button>
          )}
          {isAdmin && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleteId(r.id)}
            >
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
        title="Zalog / Oldindan to'lov"
        description="Mijozlarning oldindan to'lovlari va g'isht yetkazish"
        actions={
          <Button onClick={() => { createForm.reset({ brickType: 'BAKED_BRICK', paidAmount: 0, date: today() }); setDialogOpen(true) }}>
            <Plus className="h-4 w-4 mr-1" /> Zalog qo&apos;shish
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard title="Jami zaloglar" value={data?.meta.total ?? 0} icon={Wallet} color="blue" format="number" suffix="ta" />
        <StatsCard title="Faol zaloglar" value={totalActive} icon={Wallet} color="amber" format="number" suffix="ta" />
        <StatsCard title="Jami to'langan" value={totalPaid} icon={Wallet} color="emerald" />
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <SearchInput
              value={search}
              onChange={(v) => { setSearch(v); setPage(1) }}
              placeholder="Mijoz ismi bo'yicha..."
              className="sm:max-w-sm"
            />
            <div className="flex gap-2 flex-wrap">
              {STATUS_OPTIONS.map((s) => (
                <Button
                  key={s}
                  variant={statusFilter === s ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setStatusFilter(s); setPage(1) }}
                >
                  {s === 'ALL' ? 'Barchasi' : prepaymentStatusLabel(s)}
                </Button>
              ))}
            </div>
          </div>

          {allItems.length === 0 && !isLoading ? (
            <EmptyState
              icon={Wallet}
              title="Zalog yo'q"
              description="Birinchi zalogni qo'shing"
              action={<Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-1" />Zalog qo&apos;shish</Button>}
            />
          ) : (
            <>
              <DataTable columns={columns} data={allItems} loading={isLoading} />
              {data && <Pagination page={page} totalPages={data.meta.totalPages} total={data.meta.total} limit={limit} onPageChange={setPage} />}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Create Dialog ─────────────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Zalog qo&apos;shish</DialogTitle>
          </DialogHeader>
          <form onSubmit={createForm.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mijoz ismi</Label>
                <Input {...createForm.register('customerName')} placeholder="Ahmadjon" />
              </div>
              <div className="space-y-2">
                <Label>Telefon</Label>
                <Input {...createForm.register('customerPhone')} placeholder="+998..." />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>G&apos;isht turi *</Label>
                <Select defaultValue="BAKED_BRICK" onValueChange={(v: string) => createForm.setValue('brickType', v as BrickType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RAW_BRICK">Xom g&apos;isht</SelectItem>
                    <SelectItem value="BAKED_BRICK">Pishgan g&apos;isht</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Sana *</Label>
                <Input {...createForm.register('date')} type="date" />
                {createForm.formState.errors.date && (
                  <p className="text-destructive text-xs">{createForm.formState.errors.date.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Miqdor (dona) *</Label>
                <Input {...createForm.register('quantity')} type="number" placeholder="10000" />
                {createForm.formState.errors.quantity && (
                  <p className="text-destructive text-xs">{createForm.formState.errors.quantity.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Narx (1 dona, so&apos;m) *</Label>
                <Input {...createForm.register('pricePerBrick')} type="number" step="0.01" placeholder="450" />
                {createForm.formState.errors.pricePerBrick && (
                  <p className="text-destructive text-xs">{createForm.formState.errors.pricePerBrick.message}</p>
                )}
              </div>
            </div>

            {totalAmt > 0 && (
              <div className="rounded-xl bg-primary/10 p-3 text-sm">
                <span className="text-muted-foreground">Jami summa: </span>
                <span className="font-bold text-primary">{formatCurrency(totalAmt)}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label>To&apos;langan summa (zalog)</Label>
              <Input {...createForm.register('paidAmount')} type="number" step="0.01" placeholder="0" />
            </div>

            <div className="space-y-2">
              <Label>Izoh</Label>
              <Input {...createForm.register('description')} placeholder="Qo'shimcha ma'lumot..." />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Bekor qilish</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Saqlanmoqda...' : "Qo'shish"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Deliver Dialog ────────────────────────────────────────────────────── */}
      <Dialog open={deliverOpen} onOpenChange={setDeliverOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>G&apos;isht yetkazish — {selectedItem?.customerName}</DialogTitle>
          </DialogHeader>

          {selectedItem && (
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-muted/30 text-sm mb-1">
              <div>
                <p className="text-xs text-muted-foreground">G&apos;isht turi</p>
                <p className="font-medium">{brickTypeLabel(selectedItem.brickType)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Qolgan miqdor</p>
                <p className="font-semibold text-emerald-600">{formatNumber(selectedItem.remainingQuantity)} dona</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Jami buyurtma</p>
                <p className="font-medium">{formatNumber(selectedItem.quantity)} dona</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Berilgan</p>
                <p className="font-medium">{formatNumber(selectedItem.quantity - selectedItem.remainingQuantity)} dona</p>
              </div>
            </div>
          )}

          <form onSubmit={deliverForm.handleSubmit((d) => deliverMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Berilayotgan miqdor (dona) *</Label>
                <Input {...deliverForm.register('quantity')} type="number" placeholder="1000" />
                {deliverForm.formState.errors.quantity && (
                  <p className="text-destructive text-xs">{deliverForm.formState.errors.quantity.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Yetkazish sanasi *</Label>
                <Input {...deliverForm.register('date')} type="date" />
                {deliverForm.formState.errors.date && (
                  <p className="text-destructive text-xs">{deliverForm.formState.errors.date.message}</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Izoh (yuk joyi va h.k.)</Label>
              <Input {...deliverForm.register('description')} placeholder="Masalan: 5-iyul, Toshkent yo'li..." />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDeliverOpen(false)}>Bekor qilish</Button>
              <Button type="submit" disabled={deliverMutation.isPending}>
                {deliverMutation.isPending ? 'Saqlanmoqda...' : "Yetkazildi"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Detail Dialog ─────────────────────────────────────────────────────── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Zalog tafsiloti — {selectedItem?.customerName}</DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  { label: "G'isht turi", value: brickTypeLabel(selectedItem.brickType) },
                  { label: 'Jami miqdor', value: formatNumber(selectedItem.quantity) + ' dona' },
                  { label: 'Narx/dona', value: formatCurrency(Number(selectedItem.pricePerBrick)) },
                  { label: 'Jami summa', value: formatCurrency(Number(selectedItem.totalAmount)) },
                  { label: "To'langan zalog", value: formatCurrency(Number(selectedItem.paidAmount)) },
                  { label: 'Qolgan qarz', value: formatCurrency(Number(selectedItem.remainingAmount)) },
                  { label: 'Berilgan', value: formatNumber(selectedItem.quantity - selectedItem.remainingQuantity) + ' dona' },
                  { label: 'Qolgan', value: formatNumber(selectedItem.remainingQuantity) + ' dona' },
                ].map(({ label, value }) => (
                  <div key={label} className="p-3 rounded-xl bg-muted/30">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="font-medium mt-0.5">{value}</p>
                  </div>
                ))}
              </div>

              {(deliveries?.length ?? 0) > 0 ? (
                <div>
                  <h3 className="font-semibold text-sm mb-2">Yetkazishlar tarixi</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {deliveries!.map((d: PrepaymentDelivery) => (
                      <div key={d.id} className="flex justify-between items-center p-2.5 rounded-lg bg-muted/30 text-sm">
                        <div>
                          <p className="font-medium">{formatDate(d.deliveredAt ?? d.date)}</p>
                          {d.description && <p className="text-xs text-muted-foreground">{d.description}</p>}
                        </div>
                        <span className="font-semibold text-emerald-600">{formatNumber(d.quantity)} dona</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-2">Hali yetkazish yo&apos;q</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o: boolean) => !o && setDeleteId(null)}
        title="Zalogni o'chirishni tasdiqlang"
        description="Bu amal orqaga qaytarib bo'lmaydi."
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        loading={deleteMutation.isPending}
      />

      <ConfirmDialog
        open={!!cancelId}
        onOpenChange={(o: boolean) => !o && setCancelId(null)}
        title="Zalogni bekor qilishni tasdiqlang"
        description="Status 'Bekor qilindi'ga o'zgaradi. Bu amalni keyinchalik o'zgartirish mumkin emas."
        onConfirm={() => cancelId && cancelMutation.mutate(cancelId)}
        loading={cancelMutation.isPending}
      />
    </div>
  )
}
