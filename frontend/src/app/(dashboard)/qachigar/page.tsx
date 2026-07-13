'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, HardHat, Pencil, Trash2, Info } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { kilnService } from '@/services/kiln.service'
import { workerPaymentsService } from '@/services/worker-payments.service'
import { PageHeader } from '@/components/shared/page-header'
import { StatsCard } from '@/components/shared/stats-card'
import { DataTable } from '@/components/shared/data-table'
import { Pagination } from '@/components/shared/pagination'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate, formatNumber, formatCurrency, kilnNameLabel, getErrorMessage } from '@/lib/utils'
import { usePagination } from '@/hooks/use-pagination'
import { useAuth } from '@/providers/auth-provider'
import type { WorkerPayment, KilnName } from '@/types'

const schema = z.object({
  date: z.string().min(1, 'Sana kiritilishi shart'),
  kilnName: z.enum(['HUMBUZ_1', 'HUMBUZ_2', 'HUMBUZ_3']),
  ratePerBrick: z.coerce.number().min(1, 'Narx kiritilishi shart'),
  paidAmount: z.coerce.number().min(0).default(0),
})
type FormData = z.infer<typeof schema>

const KILNS: KilnName[] = ['HUMBUZ_1', 'HUMBUZ_2', 'HUMBUZ_3']

export default function QachigarPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editItem, setEditItem] = useState<WorkerPayment | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteEskiQarzId, setDeleteEskiQarzId] = useState<string | null>(null)
  const [debtDialogOpen, setDebtDialogOpen] = useState(false)
  const [debtDateState, setDebtDateState] = useState(new Date().toISOString().split('T')[0])
  const [debtAmountStr, setDebtAmountStr] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const { page, limit, setPage } = usePagination()

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      kilnName: 'HUMBUZ_1',
      paidAmount: 0,
    },
  })

  const watchedDate = watch('date')
  const watchedKiln = watch('kilnName')
  const watchedRate = watch('ratePerBrick') || 0
  const watchedPaid = watch('paidAmount') || 0

  // Dedicated endpoint — avoids DTO whitelist issues and createdBy join errors
  const { data: bakedOutput, isFetching: loadingBaked } = useQuery({
    queryKey: ['kiln-baked-output', watchedDate, watchedKiln],
    queryFn: () => kilnService.getBakedOutput(watchedDate, watchedKiln),
    enabled: dialogOpen && !editItem && !!watchedDate && !!watchedKiln,
    staleTime: 0,
  })
  const bakedCount = bakedOutput ?? 0

  const todayCost = bakedCount * watchedRate

  // Previous debt comes from the report — no extra query needed
  const { data: report } = useQuery({
    queryKey: ['worker-payments-report'],
    queryFn: () => workerPaymentsService.getReport(),
  })
  const qachigarStats = report?.byCategory?.QACHIGAR ?? { amount: 0, paid: 0, debt: 0 }
  const totalEarned = Number(qachigarStats.amount)
  const totalPaidStat = Number(qachigarStats.paid)
  const totalRemainingDebt = Number(qachigarStats.debt)
  // Derived: debtFromPreviousMonth sum = totalDebt + totalPaid - totalEarned
  const totalPrevDebtStat = Math.max(0, totalRemainingDebt + totalPaidStat - totalEarned)
  // For dialog overpayment display: current remaining debt = Jami qarz
  const totalPrevDebt = totalRemainingDebt

  const totalOwed = todayCost + totalPrevDebt
  const remainingAfterPayment = Math.max(0, totalOwed - watchedPaid)
  const overpaymentFromPrev = Math.max(0, watchedPaid - todayCost)

  // Fetch all records with a large limit — category param is stripped by DTO whitelist,
  // so we filter QACHIGAR client-side from the full result set
  const { data: payments, isLoading } = useQuery({
    queryKey: ['worker-payments-qachigar'],
    queryFn: () => workerPaymentsService.getAll({ limit: 500, sortBy: 'date', sortOrder: 'DESC' } as Parameters<typeof workerPaymentsService.getAll>[0]),
  })

  const filteredAll = (payments?.data ?? []).filter((p: WorkerPayment) => p.category === 'QACHIGAR')
  const eskiQarzEntries = filteredAll.filter((r: WorkerPayment) => !r.sourceId && Number(r.debtFromPreviousMonth) > 0)
  const regularPayments = filteredAll.filter((r: WorkerPayment) =>
    (Number(r.amount) > 0 || Number(r.paidAmount) > 0) && (!filterDate || r.date === filterDate)
  )
  const totalPages = Math.ceil(regularPayments.length / limit) || 1
  const allPayments = regularPayments.slice((page - 1) * limit, page * limit)

  const createMutation = useMutation({
    mutationFn: (d: FormData) =>
      workerPaymentsService.create({
        workerName: 'Qachigar',
        category: 'QACHIGAR',
        amount: bakedCount * d.ratePerBrick,
        paidAmount: d.paidAmount,
        date: d.date,
        description: `Qachigar: ${bakedCount} dona pishgan g'isht (${d.ratePerBrick} so'm/dona) - ${kilnNameLabel(d.kilnName)}`,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worker-payments-qachigar'] })
      queryClient.invalidateQueries({ queryKey: ['worker-payments-report'] })
      toast.success("Qachigar to'lovi qo'shildi")
      setDialogOpen(false)
      reset({ date: new Date().toISOString().split('T')[0], kilnName: 'HUMBUZ_1', paidAmount: 0 })
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const updateMutation = useMutation({
    mutationFn: (d: FormData) =>
      workerPaymentsService.update(editItem!.id, { paidAmount: d.paidAmount, date: d.date }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worker-payments-qachigar'] })
      queryClient.invalidateQueries({ queryKey: ['worker-payments-report'] })
      toast.success("Qachigar to'lovi yangilandi")
      setEditItem(null)
      setDialogOpen(false)
      reset()
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => workerPaymentsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worker-payments-qachigar'] })
      queryClient.invalidateQueries({ queryKey: ['worker-payments-report'] })
      toast.success("To'lov o'chirildi")
      setDeleteId(null)
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const deleteEskiQarzMutation = useMutation({
    mutationFn: (id: string) => workerPaymentsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worker-payments-qachigar'] })
      queryClient.invalidateQueries({ queryKey: ['worker-payments-report'] })
      toast.success("Eski qarz o'chirildi")
      setDeleteEskiQarzId(null)
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const oldDebtMutation = useMutation({
    mutationFn: ({ date, amount }: { date: string; amount: number }) =>
      workerPaymentsService.create({
        workerName: 'Qachigar',
        category: 'QACHIGAR',
        amount: 0,
        paidAmount: 0,
        debtFromPreviousMonth: amount,
        date,
        description: `Eski qarz: ${formatCurrency(amount)}`,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worker-payments-qachigar'] })
      queryClient.invalidateQueries({ queryKey: ['worker-payments-report'] })
      toast.success("Eski qarz qo'shildi")
      setDebtDialogOpen(false)
      setDebtAmountStr('')
      setDebtDateState(new Date().toISOString().split('T')[0])
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const openCreate = () => {
    setEditItem(null)
    reset({ date: new Date().toISOString().split('T')[0], kilnName: 'HUMBUZ_1', paidAmount: 0 })
    setDialogOpen(true)
  }

  const openEdit = (item: WorkerPayment) => {
    setEditItem(item)
    setValue('date', item.date)
    setValue('paidAmount', Number(item.paidAmount))
    setDialogOpen(true)
  }

  const columns = [
    {
      key: 'date',
      header: 'Sana',
      cell: (r: WorkerPayment) => <span className="font-medium">{formatDate(r.date)}</span>,
    },
    {
      key: 'desc',
      header: 'Xumbuz / Miqdor',
      cell: (r: WorkerPayment) => {
        const desc = r.description || ''
        const kilnMatch = desc.match(/HUMBUZ_\d/)
        const bricksMatch = desc.match(/(\d[\d ,]*) dona/)
        return (
          <div>
            {kilnMatch && (
              <Badge className="mb-1 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-0 text-xs">
                {kilnNameLabel(kilnMatch[0] as KilnName)}
              </Badge>
            )}
            {bricksMatch && <p className="text-sm font-medium">{bricksMatch[1]} dona pishgan</p>}
          </div>
        )
      },
    },
    {
      key: 'amount',
      header: 'Hisoblangan',
      cell: (r: WorkerPayment) => <span className="font-semibold">{formatCurrency(Number(r.amount))}</span>,
    },
    {
      key: 'paid',
      header: "To'langan",
      cell: (r: WorkerPayment) => (
        <span className="font-medium text-emerald-600 dark:text-emerald-400">
          {formatCurrency(Number(r.paidAmount))}
        </span>
      ),
    },
    {
      key: 'debt',
      header: 'Qarz',
      cell: (r: WorkerPayment) =>
        Number(r.remainingDebt) > 0 ? (
          <span className="font-semibold text-red-500">{formatCurrency(Number(r.remainingDebt))}</span>
        ) : (
          <span className="text-emerald-600 text-sm">✓ To&apos;liq</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      cell: (r: WorkerPayment) => (
        <div className="flex gap-1 justify-end">
          <Button variant="ghost" size="icon-sm" onClick={() => openEdit(r)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
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
        title="Qachigar to'lovlari"
        description="Xumbuzda pishgan g'isht uchun qachigar ishchi to'lovlari"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setDebtDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Eski qarz qo&apos;shish
            </Button>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" /> To&apos;lov qo&apos;shish
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Bu oy hisoblangan" value={totalEarned} icon={HardHat} color="amber" />
        <StatsCard title="Berildi" value={totalPaidStat} icon={HardHat} color="emerald" />
        <StatsCard title="Oldingi qarz" value={totalPrevDebtStat} icon={HardHat} color="amber" />
        <StatsCard title="Jami qarz" value={totalRemainingDebt} icon={HardHat} color="red" />
      </div>

      {/* Sana bo'yicha filtr */}
      <div className="flex items-center gap-2">
        <Input type="date" value={filterDate} onChange={(e) => { setFilterDate(e.target.value); setPage(1) }} className="w-40" />
        {filterDate && (
          <Button variant="outline" size="sm" onClick={() => { setFilterDate(''); setPage(1) }}>✕ Tozalash</Button>
        )}
      </div>

      {filterDate && (
        <div className="grid grid-cols-2 gap-4">
          <StatsCard
            title={`${formatDate(filterDate)} — hisoblangan`}
            value={regularPayments.reduce((s: number, r: WorkerPayment) => s + Number(r.amount), 0)}
            icon={HardHat} color="amber"
          />
          <StatsCard
            title={`${formatDate(filterDate)} — berildi`}
            value={regularPayments.reduce((s: number, r: WorkerPayment) => s + Number(r.paidAmount), 0)}
            icon={HardHat} color="emerald"
          />
        </div>
      )}

      {eskiQarzEntries.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h4 className="text-sm font-semibold text-muted-foreground mb-3">Eski qarz ro&apos;yxati</h4>
            {eskiQarzEntries.map((r: WorkerPayment) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-3 py-2">
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground">{formatDate(r.date)}</span>
                  <span className="font-bold text-amber-700 dark:text-amber-400">{formatCurrency(Number(r.debtFromPreviousMonth))}</span>
                  {r.description && <span className="text-xs text-muted-foreground">{r.description}</span>}
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteEskiQarzId(r.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-4">
          {allPayments.length === 0 && !isLoading ? (
            <EmptyState
              icon={HardHat}
              title="To'lovlar yo'q"
              description="Birinchi qachigar to'lovini qo'shing"
              action={<Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" />To&apos;lov qo&apos;shish</Button>}
            />
          ) : (
            <>
              <DataTable columns={columns} data={allPayments} loading={isLoading} />
              {filteredAll.length > limit && (
                <Pagination page={page} totalPages={totalPages} total={filteredAll.length} limit={limit} onPageChange={setPage} />
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editItem ? "To'lovni yangilash" : "Qachigar to'lovi qo'shish"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit((d) => (editItem ? updateMutation.mutate(d) : createMutation.mutate(d)))} className="space-y-4">

            {/* ── Edit mode ── */}
            {editItem && (
              <>
                <div className="space-y-2">
                  <Label>Sana</Label>
                  <Input {...register('date')} type="date" />
                </div>
                <div className="rounded-lg bg-muted/50 border p-3">
                  <p className="text-xs text-muted-foreground mb-1">To&apos;lov ma&apos;lumoti:</p>
                  <p className="text-sm font-medium">{editItem.description}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <div>Hisoblangan: <strong>{formatCurrency(Number(editItem.amount))}</strong></div>
                    <div className="text-red-500">Qarz: <strong>{formatCurrency(Number(editItem.remainingDebt))}</strong></div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>To&apos;langan summa (so&apos;m)</Label>
                  <Input {...register('paidAmount')} type="number" placeholder="0" />
                </div>
              </>
            )}

            {/* ── Create mode ── */}
            {!editItem && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Sana *</Label>
                    <Input {...register('date')} type="date" />
                    {errors.date && <p className="text-destructive text-xs">{errors.date.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Xumbuz *</Label>
                    <Select defaultValue="HUMBUZ_1" onValueChange={(v: string) => setValue('kilnName', v as KilnName)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {KILNS.map((k) => <SelectItem key={k} value={k}>{kilnNameLabel(k)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Baked bricks result */}
                <div className="rounded-lg bg-muted/50 border p-3">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">
                    Shu sanada pishgan g&apos;isht:
                  </p>
                  {loadingBaked ? (
                    <p className="text-sm text-muted-foreground animate-pulse">Yuklanmoqda...</p>
                  ) : bakedOutput !== undefined ? (
                    bakedCount > 0 ? (
                      <p className="text-2xl font-bold text-emerald-600">{formatNumber(bakedCount)} dona</p>
                    ) : (
                      <p className="text-sm text-amber-600">
                        {kilnNameLabel(watchedKiln)} da {watchedDate} sanasida pishgan g&apos;isht topilmadi
                      </p>
                    )
                  ) : (
                    <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>
                  )}
                </div>

                {/* Previous debt */}
                {totalPrevDebt > 0 && (
                  <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 flex gap-2">
                    <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-semibold text-amber-800 dark:text-amber-300">
                        Oldingi qarz: {formatCurrency(totalPrevDebt)}
                      </p>
                      <p className="text-amber-700 dark:text-amber-400 text-xs mt-0.5">
                        Bugungi ishdan ko&apos;proq to&apos;lasangiz, ortiqchasi oldingi qarzdan ayriladi
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>1 dona uchun narx (so&apos;m) *</Label>
                  <Input {...register('ratePerBrick')} type="number" placeholder="Masalan: 25" />
                  {errors.ratePerBrick && <p className="text-destructive text-xs">{errors.ratePerBrick.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label>Bugun to&apos;langan (so&apos;m)</Label>
                  <Input {...register('paidAmount')} type="number" placeholder="0" />
                </div>

                {/* Summary */}
                {bakedCount > 0 && watchedRate > 0 && (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-md bg-muted px-3 py-2">
                      <div className="text-xs text-muted-foreground">Bugungi ish</div>
                      <div className="font-semibold">{formatCurrency(todayCost)}</div>
                      <div className="text-xs text-muted-foreground">{formatNumber(bakedCount)} × {formatNumber(watchedRate)}</div>
                    </div>
                    {totalPrevDebt > 0 && (
                      <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 px-3 py-2">
                        <div className="text-xs text-muted-foreground">Oldingi qarz</div>
                        <div className="font-semibold text-amber-700 dark:text-amber-400">{formatCurrency(totalPrevDebt)}</div>
                      </div>
                    )}
                    <div className="rounded-md bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2">
                      <div className="text-xs text-muted-foreground">To&apos;landi</div>
                      <div className="font-semibold text-emerald-600">{formatCurrency(watchedPaid)}</div>
                      {overpaymentFromPrev > 0 && totalPrevDebt > 0 && (
                        <div className="text-xs text-emerald-500">+{formatCurrency(Math.min(overpaymentFromPrev, totalPrevDebt))} qarzdan</div>
                      )}
                    </div>
                    <div className="rounded-md bg-red-50 dark:bg-red-900/20 px-3 py-2">
                      <div className="text-xs text-muted-foreground">Qolgan qarz</div>
                      <div className="font-semibold text-red-500">{formatCurrency(remainingAfterPayment)}</div>
                    </div>
                  </div>
                )}
              </>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Bekor qilish</Button>
              <Button
                type="submit"
                disabled={
                  isSubmitting || createMutation.isPending || updateMutation.isPending ||
                  (!editItem && bakedCount === 0)
                }
              >
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

      <ConfirmDialog
        open={!!deleteEskiQarzId}
        onOpenChange={(o) => !o && setDeleteEskiQarzId(null)}
        title="Eski qarzni o'chirishni tasdiqlang"
        description="Bu amal orqaga qaytarib bo'lmaydi."
        onConfirm={() => deleteEskiQarzId && deleteEskiQarzMutation.mutate(deleteEskiQarzId)}
        loading={deleteEskiQarzMutation.isPending}
      />

      <Dialog open={debtDialogOpen} onOpenChange={(o: boolean) => { setDebtDialogOpen(o); if (!o) { setDebtAmountStr(''); setDebtDateState(new Date().toISOString().split('T')[0]) } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eski qarz qo&apos;shish</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Sana</Label>
              <Input type="date" value={debtDateState} onChange={(e) => setDebtDateState(e.target.value)} />
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
              onClick={() => oldDebtMutation.mutate({ date: debtDateState, amount: Number(debtAmountStr) })}
            >
              {oldDebtMutation.isPending ? 'Saqlanmoqda...' : "Qo'shish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
