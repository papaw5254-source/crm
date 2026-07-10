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
import { formatDate, formatNumber, formatCurrency, getErrorMessage } from '@/lib/utils'
import { useDebounce } from '@/hooks/use-debounce'
import { usePagination } from '@/hooks/use-pagination'
import { useAuth } from '@/providers/auth-provider'
import type { InventoryIncome } from '@/types'

// ── Inventory income form ────────────────────────────────────────────────────
const schema = z.object({
  quantity: z.coerce.number().min(1, "Miqdor 1 dan katta bo'lishi kerak"),
  description: z.string().optional(),
  date: z.string().min(1, 'Sana kiritilishi shart'),
  workerRatePerBrick: z.coerce.number().min(0).optional(),
  workerPaidAmount: z.coerce.number().min(0).optional(),
})
type FormData = z.infer<typeof schema>

// ── Press eski qarz form ─────────────────────────────────────────────────────
const pressEskiSchema = z.object({
  date: z.string().min(1),
  oldDebt: z.coerce.number().min(0),
})
type PressEskiForm = z.infer<typeof pressEskiSchema>

// ── Worker section stats ─────────────────────────────────────────────────────
function WorkerStatsSection({
  title,
  stats,
  onAdd,
  addLabel,
}: {
  title: string
  stats: { amount: number; paid: number; debt: number; carriedDebt: number }
  onAdd: () => void
  addLabel: string
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <HardHat className="h-4 w-4" /> {title}
        </h3>
        <Button variant="outline" size="sm" onClick={onAdd}>
          <Plus className="h-3.5 w-3.5 mr-1" /> {addLabel}
        </Button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatsCard title="Bu oy hisoblangan" value={Number(stats.amount)} icon={HardHat} color="amber" />
        <StatsCard title="Berildi" value={Number(stats.paid)} icon={HardHat} color="emerald" />
        <StatsCard title="Oldingi qarz" value={Number(stats.carriedDebt)} icon={HardHat} color="slate" />
        <StatsCard title="Jami qarz" value={Number(stats.debt)} icon={HardHat} color="red" />
      </div>
    </div>
  )
}

export default function InventoryPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editItem, setEditItem] = useState<InventoryIncome | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [pressDialogOpen, setPressDialogOpen] = useState(false)

  const { page, limit, setPage } = usePagination()
  const debouncedSearch = useDebounce(search)

  const thisMonth = new Date().getMonth() + 1
  const thisYear = new Date().getFullYear()
  const today = new Date().toISOString().split('T')[0]

  const { data, isLoading } = useQuery({
    queryKey: ['inventory', page, limit, debouncedSearch],
    queryFn: () => inventoryService.getAll({ page, limit, search: debouncedSearch }),
  })

  const { data: wpReport } = useQuery({
    queryKey: ['worker-payments-report', thisMonth, thisYear],
    queryFn: () => workerPaymentsService.getReport({ month: thisMonth, year: thisYear }),
  })

  const emptyStats = { amount: 0, paid: 0, debt: 0, carriedDebt: 0 }
  const pressStats = wpReport?.byCategory?.PRESS ?? emptyStats

  // ── Inventory form ──────────────────────────────────────────────────────────
  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { date: today },
  })

  const watchedQty = watch('quantity') || 0
  const watchedRate = watch('workerRatePerBrick') || 0
  const watchedPaid = watch('workerPaidAmount') || 0
  const totalWorkerCost = watchedQty * watchedRate
  const workerDebt = Math.max(0, totalWorkerCost - watchedPaid)

  // ── Press eski qarz form ────────────────────────────────────────────────────
  const pressEskiForm = useForm<PressEskiForm>({
    resolver: zodResolver(pressEskiSchema),
    defaultValues: { date: today, oldDebt: 0 },
  })

  const invalidateWorkerPayments = () => {
    queryClient.invalidateQueries({ queryKey: ['worker-payments-report'] })
    queryClient.invalidateQueries({ queryKey: ['worker-payments'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  // ── Mutations ───────────────────────────────────────────────────────────────
  const pressEskiMutation = useMutation({
    mutationFn: (d: PressEskiForm) => workerPaymentsService.create({
      workerName: 'Ishchilar (press)',
      category: 'PRESS',
      amount: 0,
      paidAmount: 0,
      debtFromPreviousMonth: d.oldDebt || 0,
      month: d.date.slice(0, 7),
      date: d.date,
    }),
    onSuccess: () => {
      invalidateWorkerPayments()
      toast.success("Eski qarz qo'shildi")
      setPressDialogOpen(false)
      pressEskiForm.reset({ date: today, oldDebt: 0 })
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
      reset({ date: today })
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
    setDialogOpen(true)
  }

  const openCreate = () => {
    setEditItem(null)
    reset({ date: today })
    setDialogOpen(true)
  }

  const onSubmit = (data: FormData) => {
    if (editItem) updateMutation.mutate(data)
    else createMutation.mutate(data)
  }

  // ── Table columns ───────────────────────────────────────────────────────────
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
            <Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(row.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  // ── Calculator row helper ────────────────────────────────────────────────────
  function CalcRow({ amount: a, paid: p, debt: d }: { amount: number; paid: number; debt: number }) {
    return (
      <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-2 text-xs text-center">
        <div>
          <div className="text-muted-foreground">Hisoblangan</div>
          <div className="font-semibold">{formatCurrency(a)}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Berildi</div>
          <div className="font-semibold text-emerald-600">{formatCurrency(p)}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Jami qarz</div>
          <div className={`font-bold ${d > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(d)}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kirim (Ishlab chiqarish)"
        description="Ombordagi g'isht kirimi boshqaruvi"
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />
            Kirim qo&apos;shish
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-1 gap-4">
        <StatsCard title="Jami kirimlar" value={data?.meta?.total ?? 0} icon={PackagePlus} color="emerald" format="number" suffix="ta" />
      </div>

      {/* Press stats */}
      <WorkerStatsSection
        title="Ishchi puli — Press"
        stats={pressStats as { amount: number; paid: number; debt: number; carriedDebt: number }}
        onAdd={() => setPressDialogOpen(true)}
        addLabel="Eski qarz qo'shish"
      />

      {/* Kirim table */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Izoh bo'yicha qidirish..." className="max-w-sm" />
          {data?.data.length === 0 && !isLoading ? (
            <EmptyState icon={PackagePlus} title="Kirim yo'q" description="Birinchi kirimni qo'shing"
              action={<Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" />Kirim qo&apos;shish</Button>}
            />
          ) : (
            <>
              <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} />
              {data?.meta && <Pagination page={page} totalPages={data.meta.totalPages} total={data.meta.total} limit={limit} onPageChange={setPage} />}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Inventory create/edit dialog ──────────────────────────────────── */}
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

            {/* Press section only */}
            <div className="rounded-lg border border-dashed p-3 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Press ishchi puli (ixtiyoriy)</p>
              <div className="space-y-2">
                <Label>1 dona narx</Label>
                <Input {...register('workerRatePerBrick')} type="number" placeholder="30" />
              </div>
              <div className="space-y-2">
                <Label>Berildi</Label>
                <Input {...register('workerPaidAmount')} type="number" placeholder="0" />
              </div>
              {totalWorkerCost > 0 && (
                <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-2 text-xs text-center">
                  <div>
                    <div className="text-muted-foreground">Hisoblandi</div>
                    <div className="font-semibold">{formatCurrency(totalWorkerCost)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Berildi</div>
                    <div className="font-semibold text-emerald-600">{formatCurrency(watchedPaid)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Jami qarz</div>
                    <div className="font-bold text-red-600">{formatCurrency(workerDebt)}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Izoh</Label>
              <Input {...register('description')} placeholder="Kunlik ishlab chiqarish..." />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Bekor qilish</Button>
              <Button type="submit" loading={isSubmitting || createMutation.isPending || updateMutation.isPending}>
                {editItem ? 'Saqlash' : "Qo'shish"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Press eski qarz dialog ───────────────────────────────────────────── */}
      <Dialog open={pressDialogOpen} onOpenChange={setPressDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Eski qarz qo&apos;shish (Press)</DialogTitle></DialogHeader>
          <form onSubmit={pressEskiForm.handleSubmit((d) => pressEskiMutation.mutate(d))} className="space-y-4">
            <div className="space-y-2">
              <Label>Sana</Label>
              <Input {...pressEskiForm.register('date')} type="date" />
            </div>
            <div className="space-y-2">
              <Label>Eski qarz miqdori (so&apos;m)</Label>
              <Input {...pressEskiForm.register('oldDebt')} type="number" placeholder="0" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPressDialogOpen(false)}>Bekor qilish</Button>
              <Button type="submit" loading={pressEskiMutation.isPending}>Saqlash</Button>
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
    </div>
  )
}
