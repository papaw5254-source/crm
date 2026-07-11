'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Flame, Pencil, Trash2, AlertCircle, HardHat } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { kilnService } from '@/services/kiln.service'
import { workerPaymentsService } from '@/services/worker-payments.service'
import { PageHeader } from '@/components/shared/page-header'
import { StatsCard } from '@/components/shared/stats-card'
import { DataTable } from '@/components/shared/data-table'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { formatDate, formatNumber, formatCurrency, kilnNameLabel, rawBrickSourceLabel, getErrorMessage } from '@/lib/utils'
import { useAuth } from '@/providers/auth-provider'
import type { KilnOperation, KilnName, WorkerPayment } from '@/types'

const schema = z.object({
  kilnName: z.enum(['HUMBUZ_1', 'HUMBUZ_2', 'HUMBUZ_3']),
  rawBricksEntered: z.coerce.number().min(0).optional(),
  bakedBricksOutput: z.coerce.number().min(0).optional(),
  rawBrickSource: z.enum(['FIELD', 'RESERVE']).optional(),
  responsibleWorker: z.string().optional(),
  date: z.string().min(1, 'Sana kiritilishi shart'),
  description: z.string().optional(),
  rawWorkerRatePerBrick: z.coerce.number().min(0).optional(),
  bakedWorkerRatePerBrick: z.coerce.number().min(0).optional(),
  workerPaidAmount: z.coerce.number().min(0).optional(),
})
type FormData = z.infer<typeof schema>


const KILNS: KilnName[] = ['HUMBUZ_1', 'HUMBUZ_2', 'HUMBUZ_3']
const now = new Date()
const THIS_MONTH = now.getMonth() + 1
const THIS_YEAR = now.getFullYear()

export default function HumbuzPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const queryClient = useQueryClient()
  const [kilnFilter, setKilnFilter] = useState<KilnName | 'ALL'>('ALL')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editItem, setEditItem] = useState<KilnOperation | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [debtDialogOpen, setDebtDialogOpen] = useState(false)
  const [debtAmountStr, setDebtAmountStr] = useState('')
  const [debtDate, setDebtDate] = useState(new Date().toISOString().split('T')[0])
  const [deleteWpId, setDeleteWpId] = useState<string | null>(null)

  const { data: allOpsData, isLoading, error: opsError } = useQuery({
    queryKey: ['kiln-operations-all'],
    queryFn: () => kilnService.getAll({ page: 1, limit: 9999 }),
    retry: false,
  })

  const { data: wpReport } = useQuery({
    queryKey: ['worker-payments-report', THIS_MONTH, THIS_YEAR],
    queryFn: () => workerPaymentsService.getReport({ month: THIS_MONTH, year: THIS_YEAR }),
  })
  const humbuzStats = wpReport?.byCategory?.HUMBUZ_KIRDI_CHIQDI ?? { amount: 0, paid: 0, debt: 0, carriedDebt: 0 }

  const { data: eskiQarzData } = useQuery({
    queryKey: ['worker-payments', 'HUMBUZ_KIRDI_CHIQDI', 'eski-qarz'],
    queryFn: () => workerPaymentsService.getAll({ category: 'HUMBUZ_KIRDI_CHIQDI', limit: 200 }),
  })
  const eskiQarzList = (eskiQarzData?.data ?? []).filter(
    (r: WorkerPayment) => !r.sourceId && Number(r.debtFromPreviousMonth) > 0
  )

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { date: new Date().toISOString().split('T')[0], kilnName: 'HUMBUZ_1' },
  })

  const rawBricksEntered = Number(watch('rawBricksEntered') ?? 0)
  const bakedBricksOutput = Number(watch('bakedBricksOutput') ?? 0)
  const watchedRawRate = watch('rawWorkerRatePerBrick') || 0
  const watchedBakedRate = watch('bakedWorkerRatePerBrick') || 0
  const watchedTotalPaid = watch('workerPaidAmount') || 0
  const rawWorkerCost = rawBricksEntered > 0 && watchedRawRate > 0 ? rawBricksEntered * watchedRawRate : 0
  const bakedWorkerCost = bakedBricksOutput > 0 && watchedBakedRate > 0 ? bakedBricksOutput * watchedBakedRate : 0
  const totalWorkerCost = rawWorkerCost + bakedWorkerCost
  const totalDebt = Math.max(0, totalWorkerCost - watchedTotalPaid)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['kiln-operations-all'] })
    queryClient.invalidateQueries({ queryKey: ['worker-payments-report'] })

    queryClient.invalidateQueries({ queryKey: ['worker-payments'] })
    queryClient.invalidateQueries({ queryKey: ['worker-payments-qachigar'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const createMutation = useMutation({
    mutationFn: (d: FormData) => kilnService.create(d),
    onSuccess: () => {
      invalidate()
      queryClient.invalidateQueries({ queryKey: ['reserve'] })
      toast.success("Humbuz operatsiyasi qo'shildi")
      setDialogOpen(false)
      reset({ date: new Date().toISOString().split('T')[0], kilnName: 'HUMBUZ_1' })
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const updateMutation = useMutation({
    mutationFn: (d: FormData) => kilnService.update(editItem!.id, d),
    onSuccess: () => {
      invalidate()
      toast.success('Humbuz operatsiyasi yangilandi')
      setEditItem(null)
      setDialogOpen(false)
      reset()
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => kilnService.delete(id),
    onSuccess: () => {
      invalidate()
      toast.success("Operatsiya o'chirildi")
      setDeleteId(null)
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const deleteWpMutation = useMutation({
    mutationFn: (id: string) => workerPaymentsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worker-payments'] })
      queryClient.invalidateQueries({ queryKey: ['worker-payments-report'] })
      toast.success("O'chirildi")
      setDeleteWpId(null)
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const oldDebtMutation = useMutation({
    mutationFn: ({ date, amount }: { date: string; amount: number }) =>
      workerPaymentsService.create({
        workerName: 'Humbuz ishchi',
        category: 'HUMBUZ_KIRDI_CHIQDI',
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

  const openCreate = () => {
    setEditItem(null)
    reset({ date: new Date().toISOString().split('T')[0], kilnName: 'HUMBUZ_1' })
    setDialogOpen(true)
  }

  const openEdit = (item: KilnOperation) => {
    setEditItem(item)
    setValue('kilnName', item.kilnName)
    setValue('rawBricksEntered', item.rawBricksEntered)
    setValue('bakedBricksOutput', item.bakedBricksOutput)
    if (item.rawBrickSource) setValue('rawBrickSource', item.rawBrickSource)
    setValue('responsibleWorker', item.responsibleWorker || '')
    setValue('date', item.date)
    setValue('description', item.description || '')
    setValue('rawWorkerRatePerBrick', Number(item.rawWorkerRatePerBrick ?? 0) || undefined)
    setValue('bakedWorkerRatePerBrick', Number(item.bakedWorkerRatePerBrick ?? 0) || undefined)
    const combinedPaid = (Number(item.rawWorkerPaidAmount ?? 0) + Number(item.bakedWorkerPaidAmount ?? 0)) || undefined
    setValue('workerPaidAmount', combinedPaid)
    setDialogOpen(true)
  }

  const allOpsRaw = (allOpsData?.data ?? []) as KilnOperation[]
  const allOps = kilnFilter === 'ALL' ? allOpsRaw : allOpsRaw.filter((op) => op.kilnName === kilnFilter)
  const totalRawIn = allOps.reduce((s: number, x: KilnOperation) => s + Number(x.rawBricksEntered), 0)
  const totalBakedOut = allOps.reduce((s: number, x: KilnOperation) => s + Number(x.bakedBricksOutput), 0)

  const columns = [
    { key: 'date', header: 'Sana', cell: (r: KilnOperation) => <span className="font-medium">{formatDate(r.date)}</span> },
    {
      key: 'kiln',
      header: 'Humbuz',
      cell: (r: KilnOperation) => (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
          <Flame className="h-3 w-3" />{kilnNameLabel(r.kilnName)}
        </span>
      ),
    },
    {
      key: 'rawIn',
      header: 'Xom kirdi',
      cell: (r: KilnOperation) => (
        <div>
          <span className="font-medium">{r.rawBricksEntered > 0 ? formatNumber(r.rawBricksEntered) + ' dona' : '—'}</span>
          {r.rawBrickSource && <p className="text-xs text-muted-foreground">{rawBrickSourceLabel(r.rawBrickSource)}</p>}
        </div>
      ),
    },
    {
      key: 'bakedOut',
      header: 'Pishgan chiqdi',
      cell: (r: KilnOperation) => (
        <span className="font-medium text-emerald-600 dark:text-emerald-400">
          {r.bakedBricksOutput > 0 ? formatNumber(r.bakedBricksOutput) + ' dona' : '—'}
        </span>
      ),
    },
    {
      key: 'workerCost',
      header: 'Ishchi puli',
      cell: (r: KilnOperation) => {
        const total = Number(r.totalWorkerCost ?? 0)
        const paid = Number(r.workerPaidAmount ?? 0)
        const debt = Number(r.workerDebt ?? 0)
        if (!total && !debt) return <span className="text-muted-foreground text-xs">—</span>
        return (
          <div className="text-xs space-y-0.5">
            <div className="font-semibold">{formatCurrency(total)}</div>
            {paid > 0 && <div className="text-emerald-600">Berildi: {formatCurrency(paid)}</div>}
            {debt > 0 && <div className="text-red-500">Qarz: {formatCurrency(debt)}</div>}
          </div>
        )
      },
    },
    { key: 'desc', header: 'Izoh', cell: (r: KilnOperation) => <span className="text-sm text-muted-foreground">{r.description || '—'}</span> },
    {
      key: 'actions',
      header: '',
      cell: (r: KilnOperation) => (
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
        title="Humbuz boshqaruvi"
        description="3 ta humbuz (1, 2, 3)"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setDebtDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Eski qarz qo&apos;shish
            </Button>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" /> Operatsiya qo&apos;shish
            </Button>
          </div>
        }
      />

      {/* DEBUG - remove after fix */}
      <div className="bg-yellow-50 border border-yellow-300 rounded p-2 text-xs text-yellow-800 space-y-1 break-all">
        <div>isLoading: {String(isLoading)} | opsError: {opsError ? getErrorMessage(opsError) : 'yo\'q'}</div>
        <div>allOpsData type: {Array.isArray(allOpsData) ? 'ARRAY' : typeof allOpsData} | allOpsData keys: {allOpsData ? Object.keys(allOpsData as object).join(',') : 'undefined'}</div>
        <div>allOpsRaw.length: {allOpsRaw.length} | meta.total: {allOpsData?.meta?.total ?? '?'}</div>
      </div>

      {/* Kiln stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard title="Jami operatsiyalar" value={allOps.length} icon={Flame} color="amber" format="number" suffix="ta" />
        <StatsCard title="Jami xom kirdi" value={totalRawIn} icon={Flame} color="red" format="number" suffix="dona" />
        <StatsCard title="Jami pishgan chiqdi" value={totalBakedOut} icon={Flame} color="emerald" format="number" suffix="dona" />
      </div>

      {/* Worker payment stats — 4 cards */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <HardHat className="h-4 w-4" /> Ishchi puli (Humbuz) — bu oy
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatsCard title="Bu oy hisoblandi" value={Number(humbuzStats.amount)} icon={HardHat} color="amber" />
          <StatsCard title="Berildi" value={Number(humbuzStats.paid)} icon={HardHat} color="emerald" />
          <StatsCard title="Avvalgi qarz" value={Number(humbuzStats.carriedDebt)} icon={HardHat} color="blue" />
          <StatsCard title="Jami qarz" value={Number(humbuzStats.debt)} icon={HardHat} color="red" />
        </div>
      </div>

      {/* Eski qarz ro'yxati */}
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
                  {isAdmin && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 w-7 p-0"
                      onClick={() => setDeleteWpId(r.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Kiln filter tabs */}
      <div className="flex gap-1 border-b">
        {([{ key: 'ALL', label: 'Barchasi' }, ...KILNS.map((k) => ({ key: k, label: kilnNameLabel(k) }))] as { key: string; label: string }[]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setKilnFilter(tab.key as KilnName | 'ALL')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              kilnFilter === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          {allOps.length === 0 && !isLoading ? (
            <EmptyState
              icon={Flame}
              title="Operatsiya yo'q"
              description="Birinchi humbuz operatsiyasini qo'shing"
              action={<Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" />Operatsiya qo&apos;shish</Button>}
            />
          ) : (
            <DataTable columns={columns} data={allOps} loading={isLoading} />
          )}
        </CardContent>
      </Card>

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg flex flex-col max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editItem ? 'Operatsiyani tahrirlash' : "Operatsiya qo'shish"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit((d) => editItem ? updateMutation.mutate(d) : createMutation.mutate(d))} className="flex flex-col flex-1 min-h-0">
            <div className="overflow-y-auto flex-1 space-y-3 pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Humbuz *</Label>
                <Select defaultValue="HUMBUZ_1" onValueChange={(v: string) => setValue('kilnName', v as KilnName)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {KILNS.map((k) => <SelectItem key={k} value={k}>{kilnNameLabel(k)}</SelectItem>)}
                  </SelectContent>
                </Select>
                {errors.kilnName && <p className="text-destructive text-xs">{errors.kilnName.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Sana *</Label>
                <Input {...register('date')} type="date" />
                {errors.date && <p className="text-destructive text-xs">{errors.date.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Xom g&apos;isht kirdi (dona)</Label>
                <Input {...register('rawBricksEntered')} type="number" placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label>Pishgan g&apos;isht chiqdi (dona)</Label>
                <Input {...register('bakedBricksOutput')} type="number" placeholder="0" />
              </div>
            </div>

            {rawBricksEntered > 0 && (
              <div className="space-y-1.5">
                <Label>Xom g&apos;isht manbai</Label>
                <Select onValueChange={(v: string) => setValue('rawBrickSource', v as 'FIELD' | 'RESERVE')}>
                  <SelectTrigger><SelectValue placeholder="Manbani tanlang" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FIELD">Daladan</SelectItem>
                    <SelectItem value="RESERVE">Zaxiradan</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Xom g&apos;isht kiritilganda manba ko&apos;rsatilishi shart
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Izoh</Label>
              <Input {...register('description')} placeholder="Qo'shimcha ma'lumot..." />
            </div>

            {/* Ishchi puli — unified section */}
            {(rawBricksEntered > 0 || bakedBricksOutput > 0) && (
              <div className="rounded-lg border border-dashed border-purple-400 px-3 py-2 space-y-2">
                <p className="text-xs font-semibold text-purple-600">Ishchi puli (ixtiyoriy)</p>
                <div className={`grid gap-2 ${rawBricksEntered > 0 && bakedBricksOutput > 0 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  {rawBricksEntered > 0 && (
                    <div className="space-y-0.5">
                      <Label className="text-xs text-muted-foreground">Kirdi (xom, 1 dona)</Label>
                      <Input {...register('rawWorkerRatePerBrick')} type="number" placeholder="20" className="h-8 text-sm" />
                    </div>
                  )}
                  {bakedBricksOutput > 0 && (
                    <div className="space-y-0.5">
                      <Label className="text-xs text-muted-foreground">Chiqdi (pishgan, 1 dona)</Label>
                      <Input {...register('bakedWorkerRatePerBrick')} type="number" placeholder="30" className="h-8 text-sm" />
                    </div>
                  )}
                  <div className="space-y-0.5">
                    <Label className="text-xs text-muted-foreground">Berildi (so&apos;m)</Label>
                    <Input {...register('workerPaidAmount')} type="number" placeholder="0" className="h-8 text-sm" />
                  </div>
                </div>
                {totalWorkerCost > 0 && (
                  <div className="grid grid-cols-2 gap-1 bg-purple-50 dark:bg-purple-950/20 rounded px-2 py-1 text-xs">
                    {rawWorkerCost > 0 && <div>Kirdi: <span className="font-semibold">{formatCurrency(rawWorkerCost)}</span></div>}
                    {bakedWorkerCost > 0 && <div>Chiqdi: <span className="font-semibold">{formatCurrency(bakedWorkerCost)}</span></div>}
                    <div>Jami: <span className="font-semibold">{formatCurrency(totalWorkerCost)}</span></div>
                    <div>Berildi: <span className="font-semibold text-emerald-600">{formatCurrency(watchedTotalPaid)}</span></div>
                    <div className="col-span-2">Qarz: <span className={`font-bold ${totalDebt > 0 ? 'text-red-500' : 'text-emerald-600'}`}>{formatCurrency(totalDebt)}</span></div>
                  </div>
                )}
              </div>
            )}
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

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Operatsiyani o'chirishni tasdiqlang"
        description="Bu amal orqaga qaytarib bo'lmaydi."
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        loading={deleteMutation.isPending}
      />

      <ConfirmDialog
        open={!!deleteWpId}
        onOpenChange={(o: boolean) => !o && setDeleteWpId(null)}
        title="Eski qarzni o'chirishni tasdiqlang"
        description="Bu amal orqaga qaytarib bo'lmaydi."
        onConfirm={() => deleteWpId && deleteWpMutation.mutate(deleteWpId)}
        loading={deleteWpMutation.isPending}
      />

      {/* Eski qarz dialog */}
      <Dialog open={debtDialogOpen} onOpenChange={(o: boolean) => { setDebtDialogOpen(o); if (!o) { setDebtAmountStr(''); setDebtDate(new Date().toISOString().split('T')[0]) } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eski qarz qo&apos;shish (Humbuz)</DialogTitle>
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
    </div>
  )
}
