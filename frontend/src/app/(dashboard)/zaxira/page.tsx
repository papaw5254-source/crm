'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Warehouse, ArrowUp, ArrowDown, ShoppingCart, Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { reserveService } from '@/services/reserve.service'
import { salesService } from '@/services/sales.service'
import { PageHeader } from '@/components/shared/page-header'
import { StatsCard } from '@/components/shared/stats-card'
import { DataTable } from '@/components/shared/data-table'
import { Pagination } from '@/components/shared/pagination'
import { EmptyState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn, formatDate, formatNumber, brickTypeLabel, brickTypeColor, reserveMovementTypeLabel, reserveMovementTypeColor, getErrorMessage } from '@/lib/utils'
import { usePagination } from '@/hooks/use-pagination'
import type { ReserveMovement, BrickType, ReserveMovementType, Sale, PaymentType } from '@/types'

// ─── Movement form ────────────────────────────────────────────────────────────
const movementSchema = z.object({
  brickType: z.enum(['RAW_BRICK', 'BAKED_BRICK']),
  movementType: z.enum(['ADD', 'REMOVE', 'SALE', 'TO_KILN', 'ADJUSTMENT']),
  quantity: z.coerce.number().min(1, "Miqdor 0 dan katta bo'lishi kerak"),
  reason: z.string().optional(),
  date: z.string().min(1, 'Sana kiritilishi shart'),
})
type MovementForm = z.infer<typeof movementSchema>

// ─── Reserve sale form ────────────────────────────────────────────────────────
const saleSchema = z.object({
  brickType: z.enum(['RAW_BRICK', 'BAKED_BRICK']),
  quantity: z.coerce.number().min(1, "Miqdor 0 dan katta bo'lishi kerak"),
  pricePerBrick: z.coerce.number().min(1, "Narx 0 dan katta bo'lishi kerak"),
  paymentType: z.enum(['CASH', 'CARD', 'DEBT']),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  description: z.string().optional(),
  date: z.string().min(1, 'Sana kiritilishi shart'),
})
type SaleForm = z.infer<typeof saleSchema>

const MOVEMENT_TYPES: ReserveMovementType[] = ['ADD', 'REMOVE', 'SALE', 'TO_KILN', 'ADJUSTMENT']

const paymentLabel = (t: string) =>
  t === 'CASH' ? 'Naqd' : t === 'CARD' ? 'Karta' : t === 'DEBT' ? 'Nasiya' : t

const paymentColor = (t: string) =>
  t === 'CASH'
    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
    : t === 'CARD'
      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'

export default function ZaxiraPage() {
  const queryClient = useQueryClient()

  // movement tab state
  const [brickTypeFilter, setBrickTypeFilter] = useState<BrickType | 'ALL'>('ALL')
  const [movementDialogOpen, setMovementDialogOpen] = useState(false)
  const { page: movPage, limit: movLimit, setPage: setMovPage } = usePagination()

  // sale tab state
  const [saleDialogOpen, setSaleDialogOpen] = useState(false)
  const { page: salePage, limit: saleLimit, setPage: setSalePage } = usePagination()

  // ─── Queries ───────────────────────────────────────────────────────────────
  const { data: balance, isLoading: balanceLoading } = useQuery({
    queryKey: ['reserve-balance'],
    queryFn: reserveService.getBalance,
    refetchInterval: 30000,
  })

  const { data: movements, isLoading: movLoading } = useQuery({
    queryKey: ['reserve-movements', movPage, movLimit, brickTypeFilter],
    queryFn: () =>
      reserveService.getAll({
        page: movPage,
        limit: movLimit,
        brickType: brickTypeFilter !== 'ALL' ? brickTypeFilter : undefined,
      }),
  })

  const { data: reserveSales, isLoading: salesLoading } = useQuery({
    queryKey: ['reserve-sales', salePage, saleLimit],
    queryFn: () => salesService.getAll({ page: salePage, limit: saleLimit, isReserveSale: true }),
  })

  // ─── Movement form ─────────────────────────────────────────────────────────
  const movForm = useForm<MovementForm>({
    resolver: zodResolver(movementSchema),
    defaultValues: { date: new Date().toISOString().split('T')[0], brickType: 'RAW_BRICK', movementType: 'ADD' },
  })

  const movMutation = useMutation({
    mutationFn: (d: MovementForm) => reserveService.create(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reserve-movements'] })
      queryClient.invalidateQueries({ queryKey: ['reserve-balance'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success("Zaxira harakati qo'shildi")
      setMovementDialogOpen(false)
      movForm.reset({ date: new Date().toISOString().split('T')[0], brickType: 'RAW_BRICK', movementType: 'ADD' })
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  // ─── Sale form ─────────────────────────────────────────────────────────────
  const saleForm = useForm<SaleForm>({
    resolver: zodResolver(saleSchema),
    defaultValues: { date: new Date().toISOString().split('T')[0], brickType: 'BAKED_BRICK', paymentType: 'CASH' },
  })
  const watchedSaleQty = saleForm.watch('quantity') || 0
  const watchedSalePrice = saleForm.watch('pricePerBrick') || 0
  const totalAmount = watchedSaleQty * watchedSalePrice

  const saleMutation = useMutation({
    mutationFn: (d: SaleForm) =>
      salesService.create({ ...d, isReserveSale: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reserve-sales'] })
      queryClient.invalidateQueries({ queryKey: ['reserve-balance'] })
      queryClient.invalidateQueries({ queryKey: ['reserve-movements'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Sotuv qo\'shildi')
      setSaleDialogOpen(false)
      saleForm.reset({ date: new Date().toISOString().split('T')[0], brickType: 'BAKED_BRICK', paymentType: 'CASH' })
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const deleteSaleMutation = useMutation({
    mutationFn: (id: string) => salesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reserve-sales'] })
      queryClient.invalidateQueries({ queryKey: ['reserve-balance'] })
      queryClient.invalidateQueries({ queryKey: ['reserve-movements'] })
      toast.success('Sotuv o\'chirildi')
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  // ─── Table columns ─────────────────────────────────────────────────────────
  const movColumns = [
    { key: 'date', header: 'Sana', cell: (r: ReserveMovement) => <span className="font-medium">{formatDate(r.date)}</span> },
    {
      key: 'brickType',
      header: "G'isht turi",
      cell: (r: ReserveMovement) => (
        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${brickTypeColor(r.brickType)}`}>
          {brickTypeLabel(r.brickType)}
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Harakat',
      cell: (r: ReserveMovement) => (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${reserveMovementTypeColor(r.movementType)}`}>
          {r.movementType === 'ADD' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
          {reserveMovementTypeLabel(r.movementType)}
        </span>
      ),
    },
    {
      key: 'qty',
      header: 'Miqdor',
      cell: (r: ReserveMovement) => (
        <span className={cn('font-semibold', r.movementType === 'ADD' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
          {r.movementType === 'ADD' ? '+' : '-'}{formatNumber(r.quantity)} dona
        </span>
      ),
    },
    { key: 'prev', header: 'Avvalgi', cell: (r: ReserveMovement) => <span className="text-sm text-muted-foreground">{formatNumber(r.previousQuantity)}</span> },
    { key: 'new', header: 'Yangi', cell: (r: ReserveMovement) => <span className="font-medium">{formatNumber(r.newQuantity)}</span> },
    { key: 'reason', header: 'Sabab', cell: (r: ReserveMovement) => <span className="text-sm text-muted-foreground">{r.reason || '—'}</span> },
  ]

  const saleColumns = [
    { key: 'date', header: 'Sana', cell: (r: Sale) => <span className="font-medium">{formatDate(r.date)}</span> },
    {
      key: 'brickType',
      header: "G'isht turi",
      cell: (r: Sale) => (
        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${brickTypeColor(r.brickType ?? 'BAKED_BRICK')}`}>
          {brickTypeLabel(r.brickType ?? 'BAKED_BRICK')}
        </span>
      ),
    },
    { key: 'qty', header: 'Miqdor', cell: (r: Sale) => <span className="font-semibold">{formatNumber(r.quantity)} dona</span> },
    { key: 'price', header: 'Narx/dona', cell: (r: Sale) => <span>{formatNumber(r.pricePerBrick)} so'm</span> },
    { key: 'total', header: 'Jami', cell: (r: Sale) => <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatNumber(r.totalAmount)} so'm</span> },
    {
      key: 'payment',
      header: "To'lov",
      cell: (r: Sale) => (
        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${paymentColor(r.paymentType)}`}>
          {paymentLabel(r.paymentType)}
        </span>
      ),
    },
    { key: 'customer', header: 'Xaridor', cell: (r: Sale) => <span className="text-sm">{r.customerName || '—'}</span> },
    {
      key: 'actions',
      header: '',
      cell: (r: Sale) => (
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={() => { if (confirm('Sotuvni o\'chirishni tasdiqlaysizmi?')) deleteSaleMutation.mutate(r.id) }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Zaxira boshqaruvi"
        description="Xom va pishgan g'isht zaxirasi"
      />

      {/* Balance Cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="relative overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Xom g&apos;isht zaxirasi</CardTitle>
          </CardHeader>
          <CardContent>
            {balanceLoading ? (
              <div className="h-8 w-32 bg-muted animate-pulse rounded" />
            ) : (
              <>
                <p className="text-3xl font-bold">{formatNumber(balance?.rawBrick ?? 0)}</p>
                <p className="text-sm text-muted-foreground mt-0.5">dona</p>
              </>
            )}
            <div className="absolute right-4 top-4 h-12 w-12 flex items-center justify-center rounded-xl bg-orange-100 dark:bg-orange-900/30">
              <Warehouse className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Pishgan g&apos;isht zaxirasi</CardTitle>
          </CardHeader>
          <CardContent>
            {balanceLoading ? (
              <div className="h-8 w-32 bg-muted animate-pulse rounded" />
            ) : (
              <>
                <p className="text-3xl font-bold">{formatNumber(balance?.bakedBrick ?? 0)}</p>
                <p className="text-sm text-muted-foreground mt-0.5">dona</p>
              </>
            )}
            <div className="absolute right-4 top-4 h-12 w-12 flex items-center justify-center rounded-xl bg-red-100 dark:bg-red-900/30">
              <Warehouse className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="harakatlar">
        <TabsList>
          <TabsTrigger value="harakatlar"><Warehouse className="h-4 w-4 mr-1.5" />Harakatlar</TabsTrigger>
          <TabsTrigger value="sotuv"><ShoppingCart className="h-4 w-4 mr-1.5" />Sotuv</TabsTrigger>
        </TabsList>

        {/* ── Harakatlar tab ─────────────────────────────────────────────────── */}
        <TabsContent value="harakatlar" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
              <StatsCard title="Jami harakatlar" value={movements?.meta.total ?? 0} icon={Warehouse} color="blue" format="number" suffix="ta" />
              <StatsCard title="Jami zaxira" value={(balance?.rawBrick ?? 0) + (balance?.bakedBrick ?? 0)} icon={Warehouse} color="emerald" format="number" suffix="dona" />
            </div>
            <Button
              className="ml-4 shrink-0"
              onClick={() => {
                movForm.reset({ date: new Date().toISOString().split('T')[0], brickType: 'RAW_BRICK', movementType: 'ADD' })
                setMovementDialogOpen(true)
              }}
            >
              <Plus className="h-4 w-4 mr-1" /> Harakat qo&apos;shish
            </Button>
          </div>

          <Tabs value={brickTypeFilter} onValueChange={(v: string) => { setBrickTypeFilter(v as BrickType | 'ALL'); setMovPage(1) }}>
            <TabsList>
              <TabsTrigger value="ALL">Barchasi</TabsTrigger>
              <TabsTrigger value="RAW_BRICK">Xom g&apos;isht</TabsTrigger>
              <TabsTrigger value="BAKED_BRICK">Pishgan g&apos;isht</TabsTrigger>
            </TabsList>
            <TabsContent value={brickTypeFilter} className="mt-4">
              <Card>
                <CardContent className="p-4">
                  {(movements?.data ?? []).length === 0 && !movLoading ? (
                    <EmptyState
                      icon={Warehouse}
                      title="Harakat yo'q"
                      description="Birinchi zaxira harakatini qo'shing"
                      action={<Button onClick={() => setMovementDialogOpen(true)}><Plus className="h-4 w-4 mr-1" />Harakat qo&apos;shish</Button>}
                    />
                  ) : (
                    <>
                      <DataTable columns={movColumns} data={movements?.data ?? []} loading={movLoading} />
                      {movements && <Pagination page={movPage} totalPages={movements.meta.totalPages} total={movements.meta.total} limit={movLimit} onPageChange={setMovPage} />}
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* ── Sotuv tab ──────────────────────────────────────────────────────── */}
        <TabsContent value="sotuv" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
              <StatsCard title="Jami sotuvlar" value={reserveSales?.meta.total ?? 0} icon={ShoppingCart} color="emerald" format="number" suffix="ta" />
              <StatsCard
                title="Jami summa"
                value={(reserveSales?.data ?? []).reduce((s: number, x: Sale) => s + Number(x.totalAmount), 0)}
                icon={ShoppingCart}
                color="blue"
                format="currency"
                suffix="so'm"
              />
            </div>
            <Button
              className="ml-4 shrink-0"
              onClick={() => {
                saleForm.reset({ date: new Date().toISOString().split('T')[0], brickType: 'BAKED_BRICK', paymentType: 'CASH' })
                setSaleDialogOpen(true)
              }}
            >
              <Plus className="h-4 w-4 mr-1" /> Sotuv qo&apos;shish
            </Button>
          </div>

          <Card>
            <CardContent className="p-4">
              {(reserveSales?.data ?? []).length === 0 && !salesLoading ? (
                <EmptyState
                  icon={ShoppingCart}
                  title="Sotuv yo'q"
                  description="Zaxiradan birinchi sotuvni qo'shing"
                  action={<Button onClick={() => setSaleDialogOpen(true)}><Plus className="h-4 w-4 mr-1" />Sotuv qo&apos;shish</Button>}
                />
              ) : (
                <>
                  <DataTable columns={saleColumns} data={reserveSales?.data ?? []} loading={salesLoading} />
                  {reserveSales && <Pagination page={salePage} totalPages={reserveSales.meta.totalPages} total={reserveSales.meta.total} limit={saleLimit} onPageChange={setSalePage} />}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Movement Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={movementDialogOpen} onOpenChange={setMovementDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Zaxira harakati qo&apos;shish</DialogTitle>
          </DialogHeader>
          <form onSubmit={movForm.handleSubmit((d) => movMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>G&apos;isht turi *</Label>
                <Select defaultValue="RAW_BRICK" onValueChange={(v: string) => movForm.setValue('brickType', v as BrickType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RAW_BRICK">Xom g&apos;isht</SelectItem>
                    <SelectItem value="BAKED_BRICK">Pishgan g&apos;isht</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Harakat turi *</Label>
                <Select defaultValue="ADD" onValueChange={(v: string) => movForm.setValue('movementType', v as ReserveMovementType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MOVEMENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{reserveMovementTypeLabel(t)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Miqdor (dona) *</Label>
                <Input {...movForm.register('quantity')} type="number" placeholder="1000" />
                {movForm.formState.errors.quantity && <p className="text-destructive text-xs">{movForm.formState.errors.quantity.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Sana *</Label>
                <Input {...movForm.register('date')} type="date" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Sabab / Izoh</Label>
              <Input {...movForm.register('reason')} placeholder="Harakat sababi..." />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setMovementDialogOpen(false)}>Bekor qilish</Button>
              <Button type="submit" disabled={movMutation.isPending}>
                {movMutation.isPending ? 'Saqlanmoqda...' : "Qo'shish"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Sale Dialog ─────────────────────────────────────────────────────── */}
      <Dialog open={saleDialogOpen} onOpenChange={setSaleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Zaxiradan sotuv</DialogTitle>
          </DialogHeader>
          <form onSubmit={saleForm.handleSubmit((d) => saleMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>G&apos;isht turi *</Label>
                <Select defaultValue="BAKED_BRICK" onValueChange={(v: string) => saleForm.setValue('brickType', v as 'RAW_BRICK' | 'BAKED_BRICK')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RAW_BRICK">Xom g&apos;isht</SelectItem>
                    <SelectItem value="BAKED_BRICK">Pishgan g&apos;isht</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>To&apos;lov turi *</Label>
                <Select defaultValue="CASH" onValueChange={(v: string) => saleForm.setValue('paymentType', v as 'CASH' | 'CARD' | 'DEBT')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Naqd</SelectItem>
                    <SelectItem value="CARD">Karta</SelectItem>
                    <SelectItem value="DEBT">Nasiya</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Miqdor (dona) *</Label>
                <Input {...saleForm.register('quantity')} type="number" placeholder="1000" />
                {saleForm.formState.errors.quantity && <p className="text-destructive text-xs">{saleForm.formState.errors.quantity.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Narx (1 dona, so&apos;m) *</Label>
                <Input {...saleForm.register('pricePerBrick')} type="number" placeholder="450" />
                {saleForm.formState.errors.pricePerBrick && <p className="text-destructive text-xs">{saleForm.formState.errors.pricePerBrick.message}</p>}
              </div>
            </div>

            {totalAmount > 0 && (
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2 text-sm">
                <span className="text-muted-foreground">Jami summa: </span>
                <span className="font-bold text-emerald-700 dark:text-emerald-400">{formatNumber(totalAmount)} so&apos;m</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Xaridor ismi</Label>
                <Input {...saleForm.register('customerName')} placeholder="Ahmadjon Toshmatov" />
              </div>
              <div className="space-y-2">
                <Label>Telefon</Label>
                <Input {...saleForm.register('customerPhone')} placeholder="+998901234567" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sana *</Label>
                <Input {...saleForm.register('date')} type="date" />
              </div>
              <div className="space-y-2">
                <Label>Izoh</Label>
                <Input {...saleForm.register('description')} placeholder="Qo'shimcha ma'lumot..." />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSaleDialogOpen(false)}>Bekor qilish</Button>
              <Button type="submit" disabled={saleMutation.isPending}>
                {saleMutation.isPending ? 'Saqlanmoqda...' : 'Sotish'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
