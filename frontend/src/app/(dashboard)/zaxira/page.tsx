'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Warehouse, ArrowUp, ArrowDown, ShoppingCart, Trash2, Pencil } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { reserveService } from '@/services/reserve.service'
import { salesService } from '@/services/sales.service'
import { workerPaymentsService } from '@/services/worker-payments.service'
import { PageHeader } from '@/components/shared/page-header'
import { StatsCard } from '@/components/shared/stats-card'
import { DataTable } from '@/components/shared/data-table'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { Pagination } from '@/components/shared/pagination'
import { EmptyState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn, formatDate, formatNumber, formatCurrency, brickTypeLabel, brickTypeColor, reserveMovementTypeLabel, reserveMovementTypeColor, paymentTypeLabel, paymentTypeColor, getErrorMessage } from '@/lib/utils'
import { usePagination } from '@/hooks/use-pagination'
import type { ReserveMovement, BrickType, ReserveMovementType, Sale, WorkerPayment } from '@/types'

// ─── Movement form ────────────────────────────────────────────────────────────
const movementSchema = z.object({
  brickType: z.enum(['RAW_BRICK', 'BAKED_BRICK']),
  movementType: z.enum(['ADD', 'REMOVE', 'SALE', 'TO_KILN', 'ADJUSTMENT']),
  quantity: z.coerce.number().min(1, "Miqdor 0 dan katta bo'lishi kerak"),
  reason: z.string().optional(),
  date: z.string().min(1, 'Sana kiritilishi shart'),
  workerRatePerBrick: z.coerce.number().min(0).optional(),
  workerPaidAmount: z.coerce.number().min(0).optional(),
  workerOldDebt: z.coerce.number().min(0).optional(),
})
type MovementForm = z.infer<typeof movementSchema>

// ─── Reserve sale form ────────────────────────────────────────────────────────
const saleSchema = z.object({
  brickType: z.enum(['RAW_BRICK', 'BAKED_BRICK']),
  quantity: z.coerce.number().min(1, "Miqdor 0 dan katta bo'lishi kerak"),
  pricePerBrick: z.coerce.number().min(1, "Narx 0 dan katta bo'lishi kerak"),
  paymentType: z.enum(['CASH', 'CARD', 'DEBT', 'BANK_TRANSFER']),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  description: z.string().optional(),
  date: z.string().min(1, 'Sana kiritilishi shart'),
  workerRatePerBrick: z.coerce.number().min(0).optional(),
  workerPaidAmount: z.coerce.number().min(0).optional(),
})
type SaleForm = z.infer<typeof saleSchema>

const MOVEMENT_TYPES: ReserveMovementType[] = ['ADD', 'REMOVE', 'SALE', 'TO_KILN', 'ADJUSTMENT']

export default function ZaxiraPage() {
  const queryClient = useQueryClient()

  // movement tab state
  const [brickTypeFilter, setBrickTypeFilter] = useState<BrickType | 'ALL'>('ALL')
  const [movementDialogOpen, setMovementDialogOpen] = useState(false)
  const [editMovement, setEditMovement] = useState<ReserveMovement | null>(null)
  const { page: movPage, limit: movLimit, setPage: setMovPage } = usePagination()

  // sale tab state
  const [saleDialogOpen, setSaleDialogOpen] = useState(false)
  const { page: salePage, limit: saleLimit, setPage: setSalePage } = usePagination()

  // eski qarz — harakati
  const [debtDialogOpen, setDebtDialogOpen] = useState(false)
  const [debtAmountStr, setDebtAmountStr] = useState('')
  const [debtDate, setDebtDate] = useState(new Date().toISOString().split('T')[0])
  // eski qarz — sotuv
  const [saleDebtDialogOpen, setSaleDebtDialogOpen] = useState(false)
  const [saleDebtAmountStr, setSaleDebtAmountStr] = useState('')
  const [saleDebtDate, setSaleDebtDate] = useState(new Date().toISOString().split('T')[0])
  const [deleteWpId, setDeleteWpId] = useState<string | null>(null)

  const now = new Date()
  const THIS_MONTH = now.getMonth() + 1
  const THIS_YEAR = now.getFullYear()

  // ─── Queries ───────────────────────────────────────────────────────────────
  const { data: wpReport } = useQuery({
    queryKey: ['worker-payments-report', THIS_MONTH, THIS_YEAR],
    queryFn: () => workerPaymentsService.getReport({ month: THIS_MONTH, year: THIS_YEAR }),
  })

  const { data: eskiQarzData } = useQuery({
    queryKey: ['worker-payments', 'RESERVE-eski-qarz'],
    queryFn: () => workerPaymentsService.getAll({ category: 'RESERVE_RAW_LOADING', limit: 100 }),
  })
  const eskiQarzList = (eskiQarzData?.data ?? []).filter(
    (r: WorkerPayment) => !r.sourceId && Number(r.debtFromPreviousMonth) > 0
  )

  const { data: eskiSaleQarzData } = useQuery({
    queryKey: ['worker-payments', 'RESERVE_SALE-eski-qarz'],
    queryFn: () => workerPaymentsService.getAll({ category: 'RESERVE_SALE_LOADING', limit: 100 }),
  })
  const eskiSaleQarzList = (eskiSaleQarzData?.data ?? []).filter(
    (r: WorkerPayment) => !r.sourceId && Number(r.debtFromPreviousMonth) > 0
  )

  const emptyStats = { amount: 0, paid: 0, debt: 0, carriedDebt: 0 }
  const reserveCategories = ['RESERVE_RAW_LOADING', 'RESERVE_BAKED_LOADING', 'ROAD_PAYMENT']
  const wpStatsRaw = reserveCategories.reduce(
    (acc, cat) => {
      const row = wpReport?.byCategory?.[cat]
      if (row) {
        acc.amount += Number(row.amount)
        acc.paid += Number(row.paid)
        acc.debt += Number(row.debt)
        acc.carriedDebt += Number(row.carriedDebt)
      }
      return acc
    },
    { ...emptyStats }
  )
  const eskiQarzCarriedDebt = eskiQarzList.reduce((acc: number, r: WorkerPayment) => acc + Number(r.debtFromPreviousMonth), 0)
  const wpStats = { ...wpStatsRaw, carriedDebt: eskiQarzCarriedDebt }

  const eskiSaleQarzCarriedDebt = eskiSaleQarzList.reduce((acc: number, r: WorkerPayment) => acc + Number(r.debtFromPreviousMonth), 0)
  const saleLoadingStats = (() => {
    const row = wpReport?.byCategory?.['RESERVE_SALE_LOADING']
    if (!row) return { ...emptyStats, carriedDebt: eskiSaleQarzCarriedDebt }
    return { amount: Number(row.amount), paid: Number(row.paid), debt: Number(row.debt), carriedDebt: eskiSaleQarzCarriedDebt }
  })()

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
      }),
  })

  const { data: reserveSales, isLoading: salesLoading } = useQuery({
    queryKey: ['reserve-sales', salePage, saleLimit, true],
    queryFn: () => salesService.getAll({ page: salePage, limit: saleLimit, isReserveSale: true }),
  })

  // ─── Movement form ─────────────────────────────────────────────────────────
  const movForm = useForm<MovementForm>({
    resolver: zodResolver(movementSchema),
    defaultValues: { date: new Date().toISOString().split('T')[0], brickType: 'RAW_BRICK', movementType: 'ADD' },
  })

  const movMutation = useMutation({
    mutationFn: (d: MovementForm) =>
      editMovement
        ? reserveService.update(editMovement.id, { ...d, movementType: 'ADD' })
        : reserveService.create({ ...d, movementType: 'ADD' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reserve-movements'] })
      queryClient.invalidateQueries({ queryKey: ['reserve-balance'] })
      queryClient.invalidateQueries({ queryKey: ['worker-payments-report'] })
      queryClient.invalidateQueries({ queryKey: ['worker-payments-panel'] })
      queryClient.invalidateQueries({ queryKey: ['worker-payments'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success(editMovement ? 'Zaxira harakati yangilandi' : "Zaxira harakati qo'shildi")
      setMovementDialogOpen(false)
      setEditMovement(null)
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
  const watchedSaleWorkerRate = saleForm.watch('workerRatePerBrick') || 0
  const watchedSaleWorkerPaid = saleForm.watch('workerPaidAmount') || 0
  const totalSaleWorkerCost = watchedSaleQty * watchedSaleWorkerRate
  const saleWorkerDebt = totalSaleWorkerCost - watchedSaleWorkerPaid

  const watchedMovRate = movForm.watch('workerRatePerBrick') || 0
  const watchedMovPaid = movForm.watch('workerPaidAmount') || 0
  const watchedMovOldDebt = movForm.watch('workerOldDebt') || 0
  const watchedMovQty = movForm.watch('quantity') || 0
  const totalMovWorkerCost = watchedMovQty * watchedMovRate
  const movWorkerDebt = Math.max(0, watchedMovOldDebt + totalMovWorkerCost - watchedMovPaid)
  const rawReserveBalance = Number(balance?.rawBrick ?? balance?.RAW_BRICK ?? 0)
  const bakedReserveBalance = Number(balance?.bakedBrick ?? balance?.BAKED_BRICK ?? 0)
  const movementRowsAll = Array.isArray(movements?.data) ? movements.data : []
  const movementRows = brickTypeFilter === 'ALL'
    ? movementRowsAll
    : movementRowsAll.filter((movement: ReserveMovement) => movement?.brickType === brickTypeFilter)
  const movementTotal = Number(movements?.meta?.total ?? movementRows.length ?? 0)
  const reserveSalesData = reserveSales as any
  const reserveSalesInner = reserveSalesData?.data
  const reserveSaleRowsAll = Array.isArray(reserveSalesData)
    ? reserveSalesData
    : Array.isArray(reserveSalesInner)
      ? reserveSalesInner
      : Array.isArray(reserveSalesInner?.data)
        ? reserveSalesInner.data
        : []
  const isReserveSaleTruthy = (v: unknown) => v === true || v === 'true' || v === 1 || v === 't'
  const reserveSaleRows = reserveSaleRowsAll.filter((sale: Sale) => isReserveSaleTruthy((sale as any)?.isReserveSale))
  const reserveSaleMeta = reserveSalesData?.meta ?? reserveSalesInner?.meta

  const openMovementCreate = () => {
    setEditMovement(null)
    movForm.reset({ date: new Date().toISOString().split('T')[0], brickType: 'RAW_BRICK', movementType: 'ADD' })
    setMovementDialogOpen(true)
  }

  const openMovementEdit = (movement: ReserveMovement) => {
    setEditMovement(movement)
    movForm.reset({
      date: movement.date,
      brickType: movement.brickType,
      movementType: 'ADD',
      quantity: Number(movement.quantity),
      reason: movement.reason || '',
      workerRatePerBrick: Number(movement.workerRatePerBrick || 0),
      workerPaidAmount: Number(movement.workerPaidAmount || 0),
      workerOldDebt: Number(movement.workerOldDebt ?? 0) || undefined,
    })
    setMovementDialogOpen(true)
  }

  const saleMutation = useMutation({
    mutationFn: (d: SaleForm) =>
      salesService.create({
        ...d,
        customerName: d.customerName?.trim() || undefined,
        customerPhone: d.customerPhone?.trim() || undefined,
        description: d.description?.trim() || undefined,
        isReserveSale: true,
      }),
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['reserve-sales'] })
        queryClient.invalidateQueries({ queryKey: ['reserve-balance'] })
        queryClient.invalidateQueries({ queryKey: ['reserve-movements'] })
        queryClient.invalidateQueries({ queryKey: ['worker-payments-report'] })
        queryClient.invalidateQueries({ queryKey: ['worker-payments-panel'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['bank-transfer-firms'] })
      queryClient.invalidateQueries({ queryKey: ['debt-firms'] })
      queryClient.invalidateQueries({ queryKey: ['firm-names'] })
      toast.success('Sotuv qo\'shildi')
      setSaleDialogOpen(false)
      saleForm.reset({ date: new Date().toISOString().split('T')[0], brickType: 'BAKED_BRICK', paymentType: 'CASH' })
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const deleteMovementMutation = useMutation({
    mutationFn: (id: string) => reserveService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reserve-movements'] })
      queryClient.invalidateQueries({ queryKey: ['reserve-balance'] })
      queryClient.invalidateQueries({ queryKey: ['worker-payments-report'] })
      queryClient.invalidateQueries({ queryKey: ['worker-payments-panel'] })
      queryClient.invalidateQueries({ queryKey: ['worker-payments'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success("Harakat o'chirildi")
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const deleteWpMutation = useMutation({
    mutationFn: (id: string) => workerPaymentsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worker-payments'] })
      queryClient.invalidateQueries({ queryKey: ['worker-payments-report'] })
      toast.success("Eski qarz o'chirildi")
      setDeleteWpId(null)
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const oldDebtMutation = useMutation({
    mutationFn: ({ date, amount }: { date: string; amount: number }) =>
      workerPaymentsService.create({
        workerName: 'Zaxira ishchi',
        category: 'RESERVE_RAW_LOADING',
        amount: 0,
        paidAmount: 0,
        debtFromPreviousMonth: amount,
        date,
        description: `Eski qarz: ${amount.toLocaleString()} so'm`,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worker-payments-report'] })
      queryClient.invalidateQueries({ queryKey: ['worker-payments'] })
      toast.success("Eski qarz qo'shildi")
      setDebtDialogOpen(false)
      setDebtAmountStr('')
      setDebtDate(new Date().toISOString().split('T')[0])
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const saleOldDebtMutation = useMutation({
    mutationFn: ({ date, amount }: { date: string; amount: number }) =>
      workerPaymentsService.create({
        workerName: 'Zaxira sotuv ishchi',
        category: 'RESERVE_SALE_LOADING',
        amount: 0,
        paidAmount: 0,
        debtFromPreviousMonth: amount,
        date,
        description: `Eski qarz: ${amount.toLocaleString()} so'm`,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worker-payments-report'] })
      queryClient.invalidateQueries({ queryKey: ['worker-payments'] })
      toast.success("Eski qarz qo'shildi")
      setSaleDebtDialogOpen(false)
      setSaleDebtAmountStr('')
      setSaleDebtDate(new Date().toISOString().split('T')[0])
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const deleteSaleMutation = useMutation({
    mutationFn: (id: string) => salesService.delete(id),
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['reserve-sales'] })
        queryClient.invalidateQueries({ queryKey: ['reserve-balance'] })
        queryClient.invalidateQueries({ queryKey: ['reserve-movements'] })
        queryClient.invalidateQueries({ queryKey: ['worker-payments-report'] })
        queryClient.invalidateQueries({ queryKey: ['worker-payments-panel'] })
        queryClient.invalidateQueries({ queryKey: ['dashboard'] })
        queryClient.invalidateQueries({ queryKey: ['bank-transfer-firms'] })
        queryClient.invalidateQueries({ queryKey: ['debt-firms'] })
        queryClient.invalidateQueries({ queryKey: ['firm-names'] })
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
    {
      key: 'actions',
      header: '',
      cell: (r: ReserveMovement) => (
        <div className="flex justify-end gap-1">
          {r.movementType === 'ADD' && (
            <Button size="sm" variant="ghost" onClick={() => openMovementEdit(r)}>
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => { if (confirm("Harakatni o'chirishni tasdiqlaysizmi?")) deleteMovementMutation.mutate(r.id) }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
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
        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${paymentTypeColor(r.paymentType)}`}>
          {paymentTypeLabel(r.paymentType)}
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
        actions={
          <Button variant="outline" onClick={() => setDebtDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Eski qarz qo&apos;shish
          </Button>
        }
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
                  <p className="text-3xl font-bold">{formatNumber(rawReserveBalance)}</p>
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
                  <p className="text-3xl font-bold">{formatNumber(bakedReserveBalance)}</p>
                <p className="text-sm text-muted-foreground mt-0.5">dona</p>
              </>
            )}
            <div className="absolute right-4 top-4 h-12 w-12 flex items-center justify-center rounded-xl bg-red-100 dark:bg-red-900/30">
              <Warehouse className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Warehouse className="h-4 w-4" /> Ishchi puli (Zaxira harakati) — bu oy
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatsCard title="Bu oy hisoblangan" value={wpStats.amount} icon={Warehouse} color="amber" />
          <StatsCard title="Berildi" value={wpStats.paid} icon={Warehouse} color="emerald" />
          <StatsCard title="Oldingi qarz" value={wpStats.carriedDebt} icon={Warehouse} color="slate" />
          <StatsCard title="Jami qarz" value={wpStats.debt} icon={Warehouse} color="red" />
        </div>
        {eskiQarzList.length > 0 && (
          <Card>
            <CardContent className="p-4 space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground mb-3">Eski qarz ro&apos;yxati</h4>
              {(eskiQarzList as WorkerPayment[]).map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-3 py-2">
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-muted-foreground">{formatDate(r.date)}</span>
                    <span className="font-bold text-amber-700 dark:text-amber-400">{formatCurrency(Number(r.debtFromPreviousMonth))}</span>
                    {r.description && <span className="text-xs text-muted-foreground">{r.description}</span>}
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteWpId(r.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" /> Ishchi puli (Zaxira sotuv) — bu oy
          </h3>
          <Button variant="outline" size="sm" onClick={() => setSaleDebtDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Eski qarz
          </Button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatsCard title="Bu oy hisoblangan" value={saleLoadingStats.amount} icon={ShoppingCart} color="amber" />
          <StatsCard title="Berildi" value={saleLoadingStats.paid} icon={ShoppingCart} color="emerald" />
          <StatsCard title="Oldingi qarz" value={saleLoadingStats.carriedDebt} icon={ShoppingCart} color="slate" />
          <StatsCard title="Jami qarz" value={saleLoadingStats.debt} icon={ShoppingCart} color="red" />
        </div>
        {eskiSaleQarzList.length > 0 && (
          <Card>
            <CardContent className="p-4 space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground mb-3">Eski qarz ro&apos;yxati (sotuv)</h4>
              {(eskiSaleQarzList as WorkerPayment[]).map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-3 py-2">
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-muted-foreground">{formatDate(r.date)}</span>
                    <span className="font-bold text-amber-700 dark:text-amber-400">{formatCurrency(Number(r.debtFromPreviousMonth))}</span>
                    {r.description && <span className="text-xs text-muted-foreground">{r.description}</span>}
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteWpId(r.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
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
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 flex-1">
                <StatsCard title="Jami harakatlar" value={movementTotal} icon={Warehouse} color="blue" format="number" suffix="ta" />
                <StatsCard title="Jami zaxira" value={rawReserveBalance + bakedReserveBalance} icon={Warehouse} color="emerald" format="number" suffix="dona" />
                <StatsCard title="Xom g'isht" value={rawReserveBalance} icon={Warehouse} color="amber" format="number" suffix="dona" />
                <StatsCard title="Pishgan g'isht" value={bakedReserveBalance} icon={Warehouse} color="red" format="number" suffix="dona" />
              </div>
            <Button
              className="ml-4 shrink-0"
              onClick={openMovementCreate}
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
                    {movementRows.length === 0 && !movLoading ? (
                    <EmptyState
                        icon={Warehouse}
                        title="Harakat yo'q"
                        description="Birinchi zaxira harakatini qo'shing"
                        action={<Button onClick={openMovementCreate}><Plus className="h-4 w-4 mr-1" />Harakat qo&apos;shish</Button>}
                      />
                  ) : (
                    <>
                        <DataTable columns={movColumns} data={movementRows} loading={movLoading} />
                        {movements && <Pagination page={movPage} totalPages={movements.meta?.totalPages ?? 1} total={movementTotal} limit={movLimit} onPageChange={setMovPage} />}
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
                <StatsCard title="Jami sotuvlar" value={reserveSaleMeta?.total ?? reserveSaleRows.length} icon={ShoppingCart} color="emerald" format="number" suffix="ta" />
                <StatsCard
                  title="Jami summa"
                  value={reserveSaleRows.reduce((s: number, x: Sale) => s + Number(x.totalAmount), 0)}
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
                {reserveSaleRows.length === 0 && !salesLoading ? (
                <EmptyState
                  icon={ShoppingCart}
                  title="Sotuv yo'q"
                  description="Zaxiradan birinchi sotuvni qo'shing"
                  action={<Button onClick={() => setSaleDialogOpen(true)}><Plus className="h-4 w-4 mr-1" />Sotuv qo&apos;shish</Button>}
                />
              ) : (
                <>
                    <DataTable columns={saleColumns} data={reserveSaleRows} loading={salesLoading} />
                    {reserveSaleMeta && <Pagination page={salePage} totalPages={reserveSaleMeta.totalPages ?? 1} total={reserveSaleMeta.total ?? reserveSaleRows.length} limit={saleLimit} onPageChange={setSalePage} />}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Movement Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={movementDialogOpen} onOpenChange={(open: boolean) => { setMovementDialogOpen(open); if (!open) setEditMovement(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editMovement ? 'Zaxira harakatini tahrirlash' : "Zaxira harakati qo'shish"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={movForm.handleSubmit((d) => movMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>G&apos;isht turi *</Label>
                <Select value={movForm.watch('brickType') || 'RAW_BRICK'} onValueChange={(v: string) => movForm.setValue('brickType', v as BrickType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RAW_BRICK">Xom g&apos;isht</SelectItem>
                    <SelectItem value="BAKED_BRICK">Pishgan g&apos;isht</SelectItem>
                  </SelectContent>
                </Select>
              </div>
                <div className="hidden">
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
            <div className="rounded-lg border border-dashed p-3 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ishchi puli (ixtiyoriy)</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>1 dona uchun narx (so&apos;m)</Label>
                  <Input {...movForm.register('workerRatePerBrick')} type="number" placeholder="25" />
                </div>
                <div className="space-y-2">
                  <Label>Bugun berildi (so&apos;m)</Label>
                  <Input {...movForm.register('workerPaidAmount')} type="number" placeholder="0" />
                </div>
              </div>
              {totalMovWorkerCost > 0 && (
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="rounded-md bg-muted px-3 py-2 text-center">
                    <div className="text-xs text-muted-foreground">Bugungi ish</div>
                    <div className="font-semibold">{formatCurrency(totalMovWorkerCost)}</div>
                  </div>
                  <div className="rounded-md bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 text-center">
                    <div className="text-xs text-muted-foreground">Berildi</div>
                    <div className="font-semibold text-emerald-600">{formatCurrency(watchedMovPaid)}</div>
                  </div>
                  <div className="rounded-md bg-red-50 dark:bg-red-900/20 px-3 py-2 text-center">
                    <div className="text-xs text-muted-foreground">Jami qarz</div>
                    <div className="font-semibold text-red-500">{formatCurrency(movWorkerDebt)}</div>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setMovementDialogOpen(false); setEditMovement(null) }}>Bekor qilish</Button>
              <Button type="submit" disabled={movMutation.isPending}>
                {movMutation.isPending ? 'Saqlanmoqda...' : editMovement ? 'Saqlash' : "Qo'shish"}
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
                <Select defaultValue="CASH" onValueChange={(v: string) => saleForm.setValue('paymentType', v as 'CASH' | 'CARD' | 'DEBT' | 'BANK_TRANSFER')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Naqd</SelectItem>
                    <SelectItem value="CARD">Karta</SelectItem>
                    <SelectItem value="DEBT">Nasiya</SelectItem>
                    <SelectItem value="BANK_TRANSFER">Perechisleniya</SelectItem>
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

              <div className="rounded-lg border border-dashed p-3 space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ishchi puli (zaxira sotuv)</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>1 dona uchun narx (so&apos;m)</Label>
                    <Input {...saleForm.register('workerRatePerBrick')} type="number" placeholder="25" />
                  </div>
                  <div className="space-y-2">
                    <Label>Bugun berildi (so&apos;m)</Label>
                    <Input {...saleForm.register('workerPaidAmount')} type="number" placeholder="0" />
                  </div>
                </div>
                {totalSaleWorkerCost > 0 && (
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="rounded-md bg-muted px-3 py-2 text-center">
                      <div className="text-xs text-muted-foreground">Jami ishchi puli</div>
                      <div className="font-semibold">{formatCurrency(totalSaleWorkerCost)}</div>
                    </div>
                    <div className="rounded-md bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 text-center">
                      <div className="text-xs text-muted-foreground">Berildi</div>
                      <div className="font-semibold text-emerald-600">{formatCurrency(watchedSaleWorkerPaid)}</div>
                    </div>
                    <div className="rounded-md bg-red-50 dark:bg-red-900/20 px-3 py-2 text-center">
                      <div className="text-xs text-muted-foreground">Zavod qarzi</div>
                      <div className="font-semibold text-red-500">{formatCurrency(Math.max(0, saleWorkerDebt))}</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{saleForm.watch('paymentType') === 'BANK_TRANSFER' ? 'Firma nomi' : 'Xaridor ismi'}</Label>
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

      {/* Eski qarz dialog — harakati */}
      <Dialog open={debtDialogOpen} onOpenChange={(o: boolean) => { setDebtDialogOpen(o); if (!o) { setDebtAmountStr(''); setDebtDate(new Date().toISOString().split('T')[0]) } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eski qarz qo&apos;shish (Zaxira harakati)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Sana</Label>
              <Input type="date" value={debtDate} onChange={(e) => setDebtDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Qarz miqdori (so&apos;m)</Label>
              <Input type="number" placeholder="0" value={debtAmountStr} onChange={(e) => setDebtAmountStr(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDebtDialogOpen(false)}>Bekor qilish</Button>
            <Button
              disabled={!debtAmountStr || Number(debtAmountStr) <= 0 || oldDebtMutation.isPending}
              onClick={() => oldDebtMutation.mutate({ date: debtDate, amount: Number(debtAmountStr) })}
            >
              {oldDebtMutation.isPending ? 'Saqlanmoqda...' : "Qo'shish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Eski qarz dialog — sotuv */}
      <Dialog open={saleDebtDialogOpen} onOpenChange={(o: boolean) => { setSaleDebtDialogOpen(o); if (!o) { setSaleDebtAmountStr(''); setSaleDebtDate(new Date().toISOString().split('T')[0]) } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eski qarz qo&apos;shish (Zaxira sotuv)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Sana</Label>
              <Input type="date" value={saleDebtDate} onChange={(e) => setSaleDebtDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Qarz miqdori (so&apos;m)</Label>
              <Input type="number" placeholder="0" value={saleDebtAmountStr} onChange={(e) => setSaleDebtAmountStr(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaleDebtDialogOpen(false)}>Bekor qilish</Button>
            <Button
              disabled={!saleDebtAmountStr || Number(saleDebtAmountStr) <= 0 || saleOldDebtMutation.isPending}
              onClick={() => saleOldDebtMutation.mutate({ date: saleDebtDate, amount: Number(saleDebtAmountStr) })}
            >
              {saleOldDebtMutation.isPending ? 'Saqlanmoqda...' : "Qo'shish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteWpId}
        onOpenChange={(o: boolean) => !o && setDeleteWpId(null)}
        title="Eski qarzni o'chirishni tasdiqlang"
        description="Bu amal orqaga qaytarib bo'lmaydi."
        onConfirm={() => deleteWpId && deleteWpMutation.mutate(deleteWpId)}
        loading={deleteWpMutation.isPending}
      />
    </div>
  )
}
