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
  const totalPrevDebt = Number(qachigarStats.debt ?? 0)

  const totalOwed = todayCost + totalPrevDebt
  const remainingAfterPayment = Math.max(0, totalOwed - watchedPaid)
  const overpaymentFromPrev = Math.max(0, watchedPaid - todayCost)

  const { data: payments, isLoading } = useQuery({
    queryKey: ['worker-payments-qachigar', page, limit],
    queryFn: () => workerPaymentsService.getAll({ page, limit } as Parameters<typeof workerPaymentsService.getAll>[0]),
  })

  // Filter QACHIGAR client-side since category param may be stripped by DTO whitelist
  const allPayments = (payments?.data ?? []).filter((p) => p.category === 'QACHIGAR')
  const totalPages = Math.ceil(allPayments.length / limit) || 1

  const createMutation = useMutation({
    mutationFn: (d: FormData) =>
      workerPaymentsService.create({
        workerName: 'Qachigar',
        category: 'QACHIGAR',
        amount: bakedCount * d.ratePerBrick,
        paidAmount: d.paidAmount,
        date: d.date,
        month: new Date(d.date).getMonth() + 1,
        year: new Date(d.date).getFullYear(),
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
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> To&apos;lov qo&apos;shish
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard title="Jami hisoblangan" value={Number(qachigarStats.amount)} icon={HardHat} color="amber" />
        <StatsCard title="Jami to'langan" value={Number(qachigarStats.paid)} icon={HardHat} color="emerald" />
        <StatsCard title="Jami qarz" value={Number(qachigarStats.debt)} icon={HardHat} color="red" />
      </div>

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
              {payments && (
                <Pagination page={page} totalPages={totalPages} total={allPayments.length} limit={limit} onPageChange={setPage} />
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
                    <Select defaultValue="HUMBUZ_1" onValueChange={(v) => setValue('kilnName', v as KilnName)}>
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
                disabled={isSubmitting || createMutation.isPending || updateMutation.isPending || (!editItem && bakedCount === 0)}
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
    </div>
  )
}
