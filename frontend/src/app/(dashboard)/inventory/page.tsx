'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, PackagePlus, Pencil, Trash2, HardHat } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { inventoryService } from '@/services/inventory.service'
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { formatDate, formatNumber, formatCurrency, getErrorMessage } from '@/lib/utils'
import { useDebounce } from '@/hooks/use-debounce'
import { usePagination } from '@/hooks/use-pagination'
import { useAuth } from '@/providers/auth-provider'
import type { InventoryIncome } from '@/types'

const schema = z.object({
  quantity: z.coerce.number().min(1, "Miqdor 1 dan katta bo'lishi kerak"),
  description: z.string().optional(),
  date: z.string().min(1, "Sana kiritilishi shart"),
  workerRatePerBrick: z.coerce.number().min(0).optional(),
  workerPaidAmount: z.coerce.number().min(0).optional(),
  workerOldDebt: z.coerce.number().min(0).optional(),
  kretkachRatePerBrick: z.coerce.number().min(0).optional(),
  kretkachPaidAmount: z.coerce.number().min(0).optional(),
  kretkachOldDebt: z.coerce.number().min(0).optional(),
  eshkiDailyAmount: z.coerce.number().min(0).optional(),
  eshkiPaidAmount: z.coerce.number().min(0).optional(),
  eshkiOldDebt: z.coerce.number().min(0).optional(),
})

type FormData = z.infer<typeof schema>

export default function InventoryPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editItem, setEditItem] = useState<InventoryIncome | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // press eski qarz
  const [pressDebtDialogOpen, setPressDebtDialogOpen] = useState(false)
  const [pressDebtAmountStr, setPressDebtAmountStr] = useState('')
  const [pressDebtDate, setPressDebtDate] = useState(new Date().toISOString().split('T')[0])

  // kretkachi eski qarz
  const [kretkachDebtDialogOpen, setKretkachDebtDialogOpen] = useState(false)
  const [kretkachDebtAmountStr, setKretkachDebtAmountStr] = useState('')
  const [kretkachDebtDate, setKretkachDebtDate] = useState(new Date().toISOString().split('T')[0])

  // eshki eski qarz
  const [eshkiDebtDialogOpen, setEshkiDebtDialogOpen] = useState(false)
  const [eshkiDebtAmountStr, setEshkiDebtAmountStr] = useState('')
  const [eshkiDebtDate, setEshkiDebtDate] = useState(new Date().toISOString().split('T')[0])

  const { page, limit, setPage } = usePagination()
  const debouncedSearch = useDebounce(search)

  const { data, isLoading } = useQuery({
    queryKey: ['inventory', page, limit, debouncedSearch],
    queryFn: () => inventoryService.getAll({ page, limit, search: debouncedSearch }),
  })

  const { data: wpReport } = useQuery({
    queryKey: ['worker-payments-report'],
    queryFn: () => workerPaymentsService.getReport(),
  })
  const pressStats = wpReport?.byCategory?.PRESS ?? { amount: 0, paid: 0, debt: 0 }
  const kretkachStats = wpReport?.byCategory?.KRETKACHI ?? { amount: 0, paid: 0, debt: 0 }
  const eshkiStats = wpReport?.byCategory?.ESHKI ?? { amount: 0, paid: 0, debt: 0 }

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { date: new Date().toISOString().split('T')[0] },
  })

  // Press watches
  const watchedQty = watch('quantity') || 0
  const watchedRate = watch('workerRatePerBrick') || 0
  const watchedPaid = watch('workerPaidAmount') || 0
  const watchedOldDebt = watch('workerOldDebt') || 0
  const totalWorkerCost = watchedQty * watchedRate
  const workerDebt = Math.max(0, watchedOldDebt + totalWorkerCost - watchedPaid)

  // Kretkachi watches
  const watchedKretkachRate = watch('kretkachRatePerBrick') || 0
  const watchedKretkachPaid = watch('kretkachPaidAmount') || 0
  const watchedKretkachOldDebt = watch('kretkachOldDebt') || 0
  const totalKretkachCost = watchedQty * watchedKretkachRate
  const kretkachDebt = Math.max(0, watchedKretkachOldDebt + totalKretkachCost - watchedKretkachPaid)

  // Eshki watches
  const watchedEshkiDaily = watch('eshkiDailyAmount') || 0
  const watchedEshkiPaid = watch('eshkiPaidAmount') || 0
  const watchedEshkiOldDebt = watch('eshkiOldDebt') || 0
  const eshkiDebt = Math.max(0, watchedEshkiOldDebt + watchedEshkiDaily - watchedEshkiPaid)

  const invalidateWorkerPayments = () => {
    queryClient.invalidateQueries({ queryKey: ['worker-payments-report'] })
    queryClient.invalidateQueries({ queryKey: ['worker-payments'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const pressOldDebtMutation = useMutation({
    mutationFn: ({ date, amount }: { date: string; amount: number }) =>
      workerPaymentsService.create({
        workerName: 'Ishchilar (press)',
        category: 'PRESS',
        amount: 0,
        paidAmount: 0,
        debtFromPreviousMonth: amount,
        date,
        description: `Eski qarz: ${amount.toLocaleString()} so'm`,
      }),
    onSuccess: () => {
      invalidateWorkerPayments()
      toast.success("Press eski qarz qo'shildi")
      setPressDebtDialogOpen(false)
      setPressDebtAmountStr('')
      setPressDebtDate(new Date().toISOString().split('T')[0])
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const kretkachOldDebtMutation = useMutation({
    mutationFn: ({ date, amount }: { date: string; amount: number }) =>
      workerPaymentsService.create({
        workerName: 'Kretkachi',
        category: 'KRETKACHI',
        amount: 0,
        paidAmount: 0,
        debtFromPreviousMonth: amount,
        date,
        description: `Eski qarz: ${amount.toLocaleString()} so'm`,
      }),
    onSuccess: () => {
      invalidateWorkerPayments()
      toast.success("Kretkachi eski qarz qo'shildi")
      setKretkachDebtDialogOpen(false)
      setKretkachDebtAmountStr('')
      setKretkachDebtDate(new Date().toISOString().split('T')[0])
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const eshkiOldDebtMutation = useMutation({
    mutationFn: ({ date, amount }: { date: string; amount: number }) =>
      workerPaymentsService.create({
        workerName: 'Eshki',
        category: 'ESHKI',
        amount: 0,
        paidAmount: 0,
        debtFromPreviousMonth: amount,
        date,
        description: `Eski qarz: ${amount.toLocaleString()} so'm`,
      }),
    onSuccess: () => {
      invalidateWorkerPayments()
      toast.success("Eshki eski qarz qo'shildi")
      setEshkiDebtDialogOpen(false)
      setEshkiDebtAmountStr('')
      setEshkiDebtDate(new Date().toISOString().split('T')[0])
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const createMutation = useMutation({
    mutationFn: (data: FormData) => inventoryService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      queryClient.invalidateQueries({ queryKey: ['stock'] })
      invalidateWorkerPayments()
      toast.success("Kirim muvaffaqiyatli qo'shildi")
      setDialogOpen(false)
      reset({ date: new Date().toISOString().split('T')[0] })
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormData) => inventoryService.update(editItem!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      queryClient.invalidateQueries({ queryKey: ['stock'] })
      invalidateWorkerPayments()
      toast.success('Kirim yangilandi')
      setEditItem(null)
      setDialogOpen(false)
      reset()
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => inventoryService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      queryClient.invalidateQueries({ queryKey: ['stock'] })
      invalidateWorkerPayments()
      toast.success("Kirim o'chirildi")
      setDeleteId(null)
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const openEdit = (item: InventoryIncome) => {
    setEditItem(item)
    setValue('quantity', item.quantity)
    setValue('description', item.description || '')
    setValue('date', item.date)
    setValue('workerRatePerBrick', Number(item.workerRatePerBrick ?? 0) || undefined)
    setValue('workerPaidAmount', Number(item.workerPaidAmount ?? 0) || undefined)
    setValue('workerOldDebt', Number(item.workerOldDebt ?? 0) || undefined)
    setValue('kretkachRatePerBrick', Number(item.kretkachRatePerBrick ?? 0) || undefined)
    setValue('kretkachPaidAmount', Number(item.kretkachPaidAmount ?? 0) || undefined)
    setValue('kretkachOldDebt', Number(item.kretkachOldDebt ?? 0) || undefined)
    setValue('eshkiDailyAmount', Number(item.eshkiDailyAmount ?? 0) || undefined)
    setValue('eshkiPaidAmount', Number(item.eshkiPaidAmount ?? 0) || undefined)
    setValue('eshkiOldDebt', Number(item.eshkiOldDebt ?? 0) || undefined)
    setDialogOpen(true)
  }

  const openCreate = () => {
    setEditItem(null)
    reset({ date: new Date().toISOString().split('T')[0] })
    setDialogOpen(true)
  }

  const onSubmit = (data: FormData) => {
    if (editItem) updateMutation.mutate(data)
    else createMutation.mutate(data)
  }

  const columns = [
    {
      key: 'date',
      header: 'Sana',
      cell: (row: InventoryIncome) => <span className="font-medium">{formatDate(row.date)}</span>,
    },
    {
      key: 'quantity',
      header: 'Miqdor (dona)',
      cell: (row: InventoryIncome) => <span className="font-semibold text-primary">{formatNumber(row.quantity)}</span>,
    },
    {
      key: 'pressWorker',
      header: 'Press puli',
      cell: (row: InventoryIncome) => row.totalWorkerCost ? (
        <div className="text-sm">
          <div className="font-medium">{formatCurrency(Number(row.totalWorkerCost))}</div>
          <div className="text-xs text-muted-foreground">
            <span className="text-emerald-600">Berildi: {formatCurrency(Number(row.workerPaidAmount ?? 0))}</span>
            {Number(row.workerDebt) > 0 && <span className="text-red-500 ml-1">Qarz: {formatCurrency(Number(row.workerDebt))}</span>}
          </div>
        </div>
      ) : <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'kretkach',
      header: 'Kretkachi puli',
      cell: (row: InventoryIncome) => row.totalKretkachCost ? (
        <div className="text-sm">
          <div className="font-medium">{formatCurrency(Number(row.totalKretkachCost))}</div>
          <div className="text-xs text-muted-foreground">
            <span className="text-emerald-600">Berildi: {formatCurrency(Number(row.kretkachPaidAmount ?? 0))}</span>
            {Number(row.kretkachDebt) > 0 && <span className="text-red-500 ml-1">Qarz: {formatCurrency(Number(row.kretkachDebt))}</span>}
          </div>
        </div>
      ) : <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'eshki',
      header: 'Eshki puli',
      cell: (row: InventoryIncome) => Number(row.eshkiDailyAmount) > 0 || Number(row.eshkiOldDebt) > 0 ? (
        <div className="text-sm">
          <div className="font-medium">{formatCurrency(Number(row.eshkiDailyAmount ?? 0))}</div>
          <div className="text-xs text-muted-foreground">
            <span className="text-emerald-600">Berildi: {formatCurrency(Number(row.eshkiPaidAmount ?? 0))}</span>
            {Number(row.eshkiDebt) > 0 && <span className="text-red-500 ml-1">Qarz: {formatCurrency(Number(row.eshkiDebt))}</span>}
          </div>
        </div>
      ) : <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'description',
      header: 'Izoh',
      cell: (row: InventoryIncome) => <span className="text-muted-foreground">{row.description || '—'}</span>,
    },
    {
      key: 'createdBy',
      header: "Qo'shgan",
      cell: (row: InventoryIncome) => <span className="text-sm">{row.createdBy?.fullName || '—'}</span>,
    },
    {
      key: 'actions',
      header: '',
      cell: (row: InventoryIncome) => (
        <div className="flex items-center gap-1 justify-end">
          <Button variant="ghost" size="icon-sm" onClick={() => openEdit(row)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          {isAdmin && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleteId(row.id)}
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
        title="Kirim (Ishlab chiqarish)"
        description="Ombordagi g'isht kirimi boshqaruvi"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setPressDebtDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Press eski qarz
            </Button>
            <Button variant="outline" onClick={() => setKretkachDebtDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Kretkachi eski qarz
            </Button>
            <Button variant="outline" onClick={() => setEshkiDebtDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Eshki eski qarz
            </Button>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" />
              Kirim qo&apos;shish
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-1 gap-4">
        <StatsCard title="Jami kirimlar" value={data?.meta?.total ?? 0} icon={PackagePlus} color="emerald" format="number" suffix="ta" />
      </div>

      {/* Press worker stats */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <HardHat className="h-4 w-4" /> Ishchi puli (Press)
          </h3>
          <Link href="/ishchilar" className="text-sm text-primary hover:underline font-medium">
            Barchasini ko&apos;rish →
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Link href="/ishchilar"><StatsCard title="Hisoblangan" value={Number(pressStats.amount)} icon={HardHat} color="amber" /></Link>
          <Link href="/ishchilar"><StatsCard title="To'langan" value={Number(pressStats.paid)} icon={HardHat} color="emerald" /></Link>
          <Link href="/ishchilar"><StatsCard title="Qarz" value={Number(pressStats.debt)} icon={HardHat} color="red" /></Link>
        </div>
      </div>

      {/* Kretkachi worker stats */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <HardHat className="h-4 w-4" /> Ishchi puli (Kretkachi)
          </h3>
          <Link href="/ishchilar" className="text-sm text-primary hover:underline font-medium">
            Barchasini ko&apos;rish →
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Link href="/ishchilar"><StatsCard title="Hisoblangan" value={Number(kretkachStats.amount)} icon={HardHat} color="amber" /></Link>
          <Link href="/ishchilar"><StatsCard title="To'langan" value={Number(kretkachStats.paid)} icon={HardHat} color="emerald" /></Link>
          <Link href="/ishchilar"><StatsCard title="Qarz" value={Number(kretkachStats.debt)} icon={HardHat} color="red" /></Link>
        </div>
      </div>

      {/* Eshki worker stats */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <HardHat className="h-4 w-4" /> Ishchi puli (Eshki)
          </h3>
          <Link href="/ishchilar" className="text-sm text-primary hover:underline font-medium">
            Barchasini ko&apos;rish →
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Link href="/ishchilar"><StatsCard title="Hisoblangan" value={Number(eshkiStats.amount)} icon={HardHat} color="amber" /></Link>
          <Link href="/ishchilar"><StatsCard title="To'langan" value={Number(eshkiStats.paid)} icon={HardHat} color="emerald" /></Link>
          <Link href="/ishchilar"><StatsCard title="Qarz" value={Number(eshkiStats.debt)} icon={HardHat} color="red" /></Link>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <SearchInput
            value={search}
            onChange={(v) => { setSearch(v); setPage(1) }}
            placeholder="Izoh bo'yicha qidirish..."
            className="max-w-sm"
          />

          {data?.data.length === 0 && !isLoading ? (
            <EmptyState
              icon={PackagePlus}
              title="Kirim yo'q"
              description="Birinchi kirimni qo'shing"
              action={<Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" />Kirim qo&apos;shish</Button>}
            />
          ) : (
            <>
              <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} />
              {data?.meta && (
                <Pagination
                  page={page}
                  totalPages={data.meta.totalPages}
                  total={data.meta.total}
                  limit={limit}
                  onPageChange={setPage}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editItem ? 'Kirimni tahrirlash' : "Kirim qo'shish"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Miqdor (dona) *</Label>
                <Input {...register('quantity')} type="number" placeholder="10000" />
                {errors.quantity && <p className="text-destructive text-xs">{errors.quantity.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Sana *</Label>
                <Input {...register('date')} type="date" />
                {errors.date && <p className="text-destructive text-xs">{errors.date.message}</p>}
              </div>
            </div>

            {/* Press section */}
            <div className="rounded-lg border border-dashed p-3 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Press ishchi puli (ixtiyoriy)</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Oldingi qarz (so&apos;m)</Label>
                  <Input {...register('workerOldDebt')} type="number" placeholder="0" />
                </div>
                <div className="space-y-2">
                  <Label>1 dona narx (so&apos;m)</Label>
                  <Input {...register('workerRatePerBrick')} type="number" placeholder="30" />
                </div>
                <div className="space-y-2">
                  <Label>Bugun berildi (so&apos;m)</Label>
                  <Input {...register('workerPaidAmount')} type="number" placeholder="0" />
                </div>
              </div>
              {(totalWorkerCost > 0 || watchedOldDebt > 0) && (
                <div className="grid grid-cols-4 gap-2 text-sm">
                  {watchedOldDebt > 0 && (
                    <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-center">
                      <div className="text-xs text-muted-foreground">Oldingi qarz</div>
                      <div className="font-semibold text-amber-700 dark:text-amber-400">{formatCurrency(watchedOldDebt)}</div>
                    </div>
                  )}
                  <div className={`rounded-md bg-muted px-3 py-2 text-center ${watchedOldDebt > 0 ? '' : 'col-span-2'}`}>
                    <div className="text-xs text-muted-foreground">Bugungi ish</div>
                    <div className="font-semibold">{formatCurrency(totalWorkerCost)}</div>
                  </div>
                  <div className="rounded-md bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 text-center">
                    <div className="text-xs text-muted-foreground">Berildi</div>
                    <div className="font-semibold text-emerald-600">{formatCurrency(watchedPaid)}</div>
                  </div>
                  <div className="rounded-md bg-red-50 dark:bg-red-900/20 px-3 py-2 text-center">
                    <div className="text-xs text-muted-foreground">Jami qarz</div>
                    <div className="font-semibold text-red-500">{formatCurrency(workerDebt)}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Kretkachi section */}
            <div className="rounded-lg border border-dashed border-orange-300 dark:border-orange-700 p-3 space-y-3">
              <p className="text-xs font-medium text-orange-600 dark:text-orange-400 uppercase tracking-wide">Kretkachi puli (ixtiyoriy)</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Oldingi qarz (so&apos;m)</Label>
                  <Input {...register('kretkachOldDebt')} type="number" placeholder="0" />
                </div>
                <div className="space-y-2">
                  <Label>1 dona narx (so&apos;m)</Label>
                  <Input {...register('kretkachRatePerBrick')} type="number" placeholder="20" />
                </div>
                <div className="space-y-2">
                  <Label>Bugun berildi (so&apos;m)</Label>
                  <Input {...register('kretkachPaidAmount')} type="number" placeholder="0" />
                </div>
              </div>
              {(totalKretkachCost > 0 || watchedKretkachOldDebt > 0) && (
                <div className="grid grid-cols-4 gap-2 text-sm">
                  {watchedKretkachOldDebt > 0 && (
                    <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-center">
                      <div className="text-xs text-muted-foreground">Oldingi qarz</div>
                      <div className="font-semibold text-amber-700 dark:text-amber-400">{formatCurrency(watchedKretkachOldDebt)}</div>
                    </div>
                  )}
                  <div className={`rounded-md bg-muted px-3 py-2 text-center ${watchedKretkachOldDebt > 0 ? '' : 'col-span-2'}`}>
                    <div className="text-xs text-muted-foreground">Bugungi ish</div>
                    <div className="font-semibold">{formatCurrency(totalKretkachCost)}</div>
                  </div>
                  <div className="rounded-md bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 text-center">
                    <div className="text-xs text-muted-foreground">Berildi</div>
                    <div className="font-semibold text-emerald-600">{formatCurrency(watchedKretkachPaid)}</div>
                  </div>
                  <div className="rounded-md bg-red-50 dark:bg-red-900/20 px-3 py-2 text-center">
                    <div className="text-xs text-muted-foreground">Jami qarz</div>
                    <div className="font-semibold text-red-500">{formatCurrency(kretkachDebt)}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Eshki section */}
            <div className="rounded-lg border border-dashed border-blue-300 dark:border-blue-700 p-3 space-y-3">
              <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide">Eshki puli — kunlik (ixtiyoriy)</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Oldingi qarz (so&apos;m)</Label>
                  <Input {...register('eshkiOldDebt')} type="number" placeholder="0" />
                </div>
                <div className="space-y-2">
                  <Label>Kunlik to&apos;lov (so&apos;m)</Label>
                  <Input {...register('eshkiDailyAmount')} type="number" placeholder="80000" />
                </div>
                <div className="space-y-2">
                  <Label>Bugun berildi (so&apos;m)</Label>
                  <Input {...register('eshkiPaidAmount')} type="number" placeholder="0" />
                </div>
              </div>
              {(watchedEshkiDaily > 0 || watchedEshkiOldDebt > 0) && (
                <div className="grid grid-cols-4 gap-2 text-sm">
                  {watchedEshkiOldDebt > 0 && (
                    <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-center">
                      <div className="text-xs text-muted-foreground">Oldingi qarz</div>
                      <div className="font-semibold text-amber-700 dark:text-amber-400">{formatCurrency(watchedEshkiOldDebt)}</div>
                    </div>
                  )}
                  <div className={`rounded-md bg-muted px-3 py-2 text-center ${watchedEshkiOldDebt > 0 ? '' : 'col-span-2'}`}>
                    <div className="text-xs text-muted-foreground">Bugungi ish</div>
                    <div className="font-semibold">{formatCurrency(watchedEshkiDaily)}</div>
                  </div>
                  <div className="rounded-md bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 text-center">
                    <div className="text-xs text-muted-foreground">Berildi</div>
                    <div className="font-semibold text-emerald-600">{formatCurrency(watchedEshkiPaid)}</div>
                  </div>
                  <div className="rounded-md bg-red-50 dark:bg-red-900/20 px-3 py-2 text-center">
                    <div className="text-xs text-muted-foreground">Jami qarz</div>
                    <div className="font-semibold text-red-500">{formatCurrency(eshkiDebt)}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Izoh</Label>
              <Input {...register('description')} placeholder="Kunlik ishlab chiqarish..." />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Bekor qilish
              </Button>
              <Button
                type="submit"
                loading={isSubmitting || createMutation.isPending || updateMutation.isPending}
              >
                {editItem ? 'Saqlash' : "Qo'shish"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Kirimni o'chirishni tasdiqlang"
        description="Bu amal orqaga qaytarib bo'lmaydi. Ombor miqdori ham kamayadi."
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        loading={deleteMutation.isPending}
      />

      {/* Press eski qarz dialog */}
      <Dialog open={pressDebtDialogOpen} onOpenChange={(o: boolean) => { setPressDebtDialogOpen(o); if (!o) { setPressDebtAmountStr(''); setPressDebtDate(new Date().toISOString().split('T')[0]) } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Press eski qarz qo&apos;shish</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Sana</Label>
              <Input type="date" value={pressDebtDate} onChange={(e) => setPressDebtDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Qarz miqdori (so&apos;m)</Label>
              <Input type="number" placeholder="0" value={pressDebtAmountStr} onChange={(e) => setPressDebtAmountStr(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPressDebtDialogOpen(false)}>Bekor qilish</Button>
            <Button
              disabled={!pressDebtAmountStr || Number(pressDebtAmountStr) <= 0 || pressOldDebtMutation.isPending}
              onClick={() => pressOldDebtMutation.mutate({ date: pressDebtDate, amount: Number(pressDebtAmountStr) })}
            >
              {pressOldDebtMutation.isPending ? 'Saqlanmoqda...' : "Qo'shish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Kretkachi eski qarz dialog */}
      <Dialog open={kretkachDebtDialogOpen} onOpenChange={(o: boolean) => { setKretkachDebtDialogOpen(o); if (!o) { setKretkachDebtAmountStr(''); setKretkachDebtDate(new Date().toISOString().split('T')[0]) } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Kretkachi eski qarz qo&apos;shish</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Sana</Label>
              <Input type="date" value={kretkachDebtDate} onChange={(e) => setKretkachDebtDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Qarz miqdori (so&apos;m)</Label>
              <Input type="number" placeholder="0" value={kretkachDebtAmountStr} onChange={(e) => setKretkachDebtAmountStr(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKretkachDebtDialogOpen(false)}>Bekor qilish</Button>
            <Button
              disabled={!kretkachDebtAmountStr || Number(kretkachDebtAmountStr) <= 0 || kretkachOldDebtMutation.isPending}
              onClick={() => kretkachOldDebtMutation.mutate({ date: kretkachDebtDate, amount: Number(kretkachDebtAmountStr) })}
            >
              {kretkachOldDebtMutation.isPending ? 'Saqlanmoqda...' : "Qo'shish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Eshki eski qarz dialog */}
      <Dialog open={eshkiDebtDialogOpen} onOpenChange={(o: boolean) => { setEshkiDebtDialogOpen(o); if (!o) { setEshkiDebtAmountStr(''); setEshkiDebtDate(new Date().toISOString().split('T')[0]) } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eshki eski qarz qo&apos;shish</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Sana</Label>
              <Input type="date" value={eshkiDebtDate} onChange={(e) => setEshkiDebtDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Qarz miqdori (so&apos;m)</Label>
              <Input type="number" placeholder="0" value={eshkiDebtAmountStr} onChange={(e) => setEshkiDebtAmountStr(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEshkiDebtDialogOpen(false)}>Bekor qilish</Button>
            <Button
              disabled={!eshkiDebtAmountStr || Number(eshkiDebtAmountStr) <= 0 || eshkiOldDebtMutation.isPending}
              onClick={() => eshkiOldDebtMutation.mutate({ date: eshkiDebtDate, amount: Number(eshkiDebtAmountStr) })}
            >
              {eshkiOldDebtMutation.isPending ? 'Saqlanmoqda...' : "Qo'shish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
