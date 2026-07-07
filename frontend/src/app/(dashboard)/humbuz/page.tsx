'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Flame, Pencil, Trash2, AlertCircle } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { kilnService } from '@/services/kiln.service'
import { stockService } from '@/services/stock.service'
import { PageHeader } from '@/components/shared/page-header'
import { StatsCard } from '@/components/shared/stats-card'
import { DataTable } from '@/components/shared/data-table'
import { WorkerPaymentsPanel } from '@/components/shared/worker-payments-panel'
import { Pagination } from '@/components/shared/pagination'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatDate, formatNumber, formatCurrency, kilnNameLabel, rawBrickSourceLabel, getErrorMessage } from '@/lib/utils'
import { usePagination } from '@/hooks/use-pagination'
import { useAuth } from '@/providers/auth-provider'
import type { KilnOperation, KilnName } from '@/types'

const schema = z.object({
  kilnName: z.enum(['HUMBUZ_1', 'HUMBUZ_2', 'HUMBUZ_3']),
  rawBricksEntered: z.coerce.number().min(0).optional(),
  bakedBricksOutput: z.coerce.number().min(0).optional(),
  rawBrickSource: z.enum(['FIELD', 'RESERVE']).optional(),
  responsibleWorker: z.string().optional(),
  date: z.string().min(1, 'Sana kiritilishi shart'),
  description: z.string().optional(),
  workerRatePerBrick: z.coerce.number().min(0).optional(),
  workerPaidAmount: z.coerce.number().min(0).optional(),
  rawWorkerRatePerBrick: z.coerce.number().min(0).optional(),
  rawWorkerPaidAmount: z.coerce.number().min(0).optional(),
  bakedWorkerRatePerBrick: z.coerce.number().min(0).optional(),
  bakedWorkerPaidAmount: z.coerce.number().min(0).optional(),
})
type FormData = z.infer<typeof schema>

const KILNS: KilnName[] = ['HUMBUZ_1', 'HUMBUZ_2', 'HUMBUZ_3']

export default function HumbuzPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const queryClient = useQueryClient()
  const [kilnFilter, setKilnFilter] = useState<KilnName | 'ALL'>('ALL')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editItem, setEditItem] = useState<KilnOperation | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const { page, limit, setPage } = usePagination()

  const { data, isLoading } = useQuery({
    queryKey: ['kiln-operations', page, limit],
    queryFn: () =>
      kilnService.getAll({
        page,
        limit,
      }),
  })

  const { data: stocks = [] } = useQuery({
    queryKey: ['stock'],
    queryFn: () => stockService.getStock(),
  })

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { date: new Date().toISOString().split('T')[0], kilnName: 'HUMBUZ_1' },
  })

  const rawBricksEntered = watch('rawBricksEntered') ?? 0
  const bakedBricksOutput = watch('bakedBricksOutput') ?? 0
  const rawWorkerRate = watch('rawWorkerRatePerBrick') || 0
  const rawWorkerPaid = watch('rawWorkerPaidAmount') || 0
  const bakedWorkerRate = watch('bakedWorkerRatePerBrick') || 0
  const bakedWorkerPaid = watch('bakedWorkerPaidAmount') || 0
  const rawWorkerCost = rawBricksEntered * rawWorkerRate
  const bakedWorkerCost = bakedBricksOutput * bakedWorkerRate
  const totalWorkerCost = rawWorkerCost + bakedWorkerCost
  const totalWorkerPaid = rawWorkerPaid
  const workerDebt = Math.max(0, totalWorkerCost - totalWorkerPaid - bakedWorkerPaid)

  const createMutation = useMutation({
    mutationFn: (d: FormData) => kilnService.create(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kiln-operations'] })
      queryClient.refetchQueries({ queryKey: ['kiln-operations'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['reserve'] })
      queryClient.invalidateQueries({ queryKey: ['stock'] })
      queryClient.invalidateQueries({ queryKey: ['worker-payments-report'] })
      queryClient.refetchQueries({ queryKey: ['worker-payments-report'] })
      queryClient.invalidateQueries({ queryKey: ['worker-payments-panel'] })
      queryClient.refetchQueries({ queryKey: ['worker-payments-panel'] })
      toast.success("Humbuz operatsiyasi qo'shildi")
      setDialogOpen(false)
      reset({ date: new Date().toISOString().split('T')[0], kilnName: 'HUMBUZ_1' })
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const updateMutation = useMutation({
    mutationFn: (d: FormData) => kilnService.update(editItem!.id, d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kiln-operations'] })
      queryClient.refetchQueries({ queryKey: ['kiln-operations'] })
      queryClient.invalidateQueries({ queryKey: ['stock'] })
      queryClient.invalidateQueries({ queryKey: ['worker-payments-report'] })
      queryClient.refetchQueries({ queryKey: ['worker-payments-report'] })
      queryClient.invalidateQueries({ queryKey: ['worker-payments-panel'] })
      queryClient.refetchQueries({ queryKey: ['worker-payments-panel'] })
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
      queryClient.invalidateQueries({ queryKey: ['kiln-operations'] })
      queryClient.invalidateQueries({ queryKey: ['stock'] })
      queryClient.invalidateQueries({ queryKey: ['worker-payments-report'] })
      queryClient.invalidateQueries({ queryKey: ['worker-payments-panel'] })
      toast.success("Operatsiya o'chirildi")
      setDeleteId(null)
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const openEdit = (item: KilnOperation) => {
    setEditItem(item)
    setValue('kilnName', item.kilnName)
    setValue('rawBricksEntered', item.rawBricksEntered)
    setValue('bakedBricksOutput', item.bakedBricksOutput)
    if (item.rawBrickSource) setValue('rawBrickSource', item.rawBrickSource)
    setValue('responsibleWorker', item.responsibleWorker || '')
    setValue('date', item.date)
    setValue('description', item.description || '')
    setValue('rawWorkerRatePerBrick', Number(item.rawWorkerRatePerBrick ?? item.workerRatePerBrick ?? 0))
    setValue('rawWorkerPaidAmount', Number(item.rawWorkerPaidAmount ?? item.workerPaidAmount ?? 0))
    setValue('bakedWorkerRatePerBrick', Number(item.bakedWorkerRatePerBrick ?? item.workerRatePerBrick ?? 0))
    setValue('bakedWorkerPaidAmount', 0)
    setDialogOpen(true)
  }

  const openCreate = () => {
    setEditItem(null)
    reset({ date: new Date().toISOString().split('T')[0], kilnName: 'HUMBUZ_1' })
    setDialogOpen(true)
  }

  const allOps = Array.isArray(data)
    ? data
    : Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.data?.data)
        ? data.data.data
        : Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data?.results)
            ? data.results
            : []
  const visibleOps = kilnFilter === 'ALL'
    ? allOps
    : allOps.filter((operation: KilnOperation) => {
      const values = [
        operation.kilnName,
        operation.kiln,
        operation.kilnId,
        operation.humbuz,
        operation.humbuzName,
        operation.humbuzId,
      ].map((value) => String(value || '').toLowerCase())

      const filterValue = String(kilnFilter).toLowerCase()
      const labelValue = kilnNameLabel(kilnFilter as KilnName).toLowerCase()
      const numberValue = filterValue.replace(/\D/g, '')

      return values.some((value) =>
        value === filterValue ||
        value === labelValue ||
        value.includes(filterValue) ||
        value.includes(labelValue) ||
        (numberValue && (value === numberValue || value.includes(`${numberValue}-`) || value.includes(`${numberValue} humbuz`))),
      )
    })
  const totalRawIn = allOps.reduce((s: number, x: KilnOperation) => s + Number(x.rawBricksEntered), 0)
  const totalBakedOut = allOps.reduce((s: number, x: KilnOperation) => s + Number(x.bakedBricksOutput), 0)
  const meta = data?.meta ?? data?.data?.meta
  const stockList = Array.isArray(stocks) ? stocks : stocks ? [stocks] : []
  const rawStock = stockList.find((stock) => stock.brickType === 'RAW_BRICK')?.quantity ?? 0
  const bakedStock = stockList.find((stock) => stock.brickType === 'BAKED_BRICK')?.quantity ?? 0

  const columns = [
    { key: 'date', header: 'Sana', cell: (r: KilnOperation) => <span className="font-medium">{formatDate(r.date)}</span> },
    {
      key: 'kiln',
      header: 'Humbuz',
      cell: (r: KilnOperation) => (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
          <Flame className="h-3 w-3" />
          {kilnNameLabel(r.kilnName)}
        </span>
      ),
    },
    {
      key: 'rawIn',
      header: "Xom kirdi",
      cell: (r: KilnOperation) => (
        <div>
          <span className="font-medium">{r.rawBricksEntered > 0 ? formatNumber(r.rawBricksEntered) + ' dona' : '—'}</span>
          {r.rawBrickSource && (
            <p className="text-xs text-muted-foreground">{rawBrickSourceLabel(r.rawBrickSource)}</p>
          )}
        </div>
      ),
    },
    {
      key: 'bakedOut',
      header: "Pishgan chiqdi",
      cell: (r: KilnOperation) => (
        <span className="font-medium text-emerald-600 dark:text-emerald-400">
          {r.bakedBricksOutput > 0 ? formatNumber(r.bakedBricksOutput) + ' dona' : '—'}
        </span>
      ),
    },
    {
      key: 'workerCost',
      header: 'Ishchi puli',
      cell: (r: KilnOperation) => r.totalWorkerCost ? (
        <div className="text-sm">
          <div className="font-medium">{formatCurrency(Number(r.totalWorkerCost))}</div>
          <div className="space-y-0.5 text-xs text-muted-foreground">
            {Number(r.rawWorkerTotalCost ?? 0) > 0 && (
              <p>
                Kirdi: {formatCurrency(Number(r.rawWorkerTotalCost))}
                  <span className="text-emerald-600 ml-1">Jami berildi: {formatCurrency(Number(r.rawWorkerPaidAmount ?? 0))}</span>
              </p>
            )}
            {Number(r.bakedWorkerTotalCost ?? 0) > 0 && (
              <p>
                Chiqdi: {formatCurrency(Number(r.bakedWorkerTotalCost))}
              </p>
            )}
            {Number(r.workerDebt) > 0 && <p className="text-red-500">Qarz: {formatCurrency(Number(r.workerDebt))}</p>}
          </div>
        </div>
      ) : <span className="text-muted-foreground text-xs">—</span>,
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
        description="3 ta humbuz operatsiyalari"
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> Operatsiya qo&apos;shish
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard title="Jami operatsiyalar" value={meta?.total ?? allOps.length ?? 0} icon={Flame} color="amber" format="number" suffix="ta" />
        <StatsCard title="Jami xom kirdi" value={totalRawIn} icon={Flame} color="red" format="number" suffix="dona" />
        <StatsCard title="Jami pishgan chiqdi" value={totalBakedOut} icon={Flame} color="emerald" format="number" suffix="dona" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Xom g&apos;isht</p>
              <p className="text-xs text-muted-foreground">Humbuzga kirdi: {formatNumber(totalRawIn)} dona</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pishgan g&apos;isht</p>
              <p className="text-xs text-muted-foreground">Humbuzdan chiqdi: {formatNumber(totalBakedOut)} dona</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <WorkerPaymentsPanel title="Ishchi puli (Humbuz)" categories={['HUMBUZ_KIRDI_CHIQDI']} />

      {/* Kiln tabs */}
      <Tabs value={kilnFilter} onValueChange={(v: string) => { setKilnFilter(v as KilnName | 'ALL'); setPage(1) }}>
        <TabsList>
          <TabsTrigger value="ALL">Barchasi</TabsTrigger>
          {KILNS.map((k) => (
            <TabsTrigger key={k} value={k}>{kilnNameLabel(k)}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={kilnFilter} className="mt-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              {visibleOps.length === 0 && !isLoading ? (
                <EmptyState
                  icon={Flame}
                  title="Operatsiya yo'q"
                  description="Birinchi humbuz operatsiyasini qo'shing"
                  action={<Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" />Operatsiya qo&apos;shish</Button>}
                />
              ) : (
                <>
                  <DataTable columns={columns} data={visibleOps} loading={isLoading} />
                  {meta && <Pagination page={page} totalPages={meta.totalPages ?? 1} total={meta.total ?? allOps.length} limit={limit} onPageChange={setPage} />}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[500px] max-h-[88vh] overflow-hidden p-0">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle>{editItem ? 'Operatsiyani tahrirlash' : "Operatsiya qo'shish"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit((d) => editItem ? updateMutation.mutate(d) : createMutation.mutate(d))} className="max-h-[calc(88vh-68px)] overflow-y-auto px-4 pb-0 space-y-3 text-sm">
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
              <div className="space-y-2">
                <Label>Xom g&apos;isht kirdi (dona)</Label>
                <Input {...register('rawBricksEntered')} type="number" placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>Pishgan g&apos;isht chiqdi (dona)</Label>
                <Input {...register('bakedBricksOutput')} type="number" placeholder="0" />
              </div>
            </div>

            {Number(rawBricksEntered) > 0 && (
              <div className="space-y-2">
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

            <div className="space-y-2">
              <Label>Izoh</Label>
              <Input {...register('description')} placeholder="Qo'shimcha ma'lumot..." />
            </div>

            <div className="rounded-lg border border-dashed p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Ishchi puli (kirdi + chiqdi umumiy)
              </p>

              {totalWorkerCost > 0 && (
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-md bg-muted px-3 py-2 text-center">
                    <div className="text-muted-foreground">Jami hisoblandi</div>
                    <div className="font-semibold">{formatCurrency(totalWorkerCost)}</div>
                  </div>
                  <div className="rounded-md bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 text-center">
                    <div className="text-muted-foreground">Jami berildi</div>
                    <div className="font-semibold text-emerald-600">{formatCurrency(totalWorkerPaid)}</div>
                  </div>
                  <div className="rounded-md bg-red-50 dark:bg-red-900/20 px-3 py-2 text-center">
                    <div className="text-muted-foreground">Jami qarz</div>
                    <div className="font-semibold text-red-500">{formatCurrency(workerDebt)}</div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="rounded-md bg-muted/40 p-3 space-y-2">
                  <p className="text-sm font-medium">Kirgan xom g'isht</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>1 dona narxi</Label>
                      <Input {...register('rawWorkerRatePerBrick')} type="number" placeholder="20" />
                    </div>
                      <div className="space-y-1.5">
                        <Label>Umumiy berildi</Label>
                        <Input {...register('rawWorkerPaidAmount')} type="number" placeholder="0" />
                      </div>
                  </div>
                  {rawWorkerCost > 0 && (
                    <div className="rounded-md bg-background px-3 py-2 text-xs">
                      <div className="flex justify-between"><span className="text-muted-foreground">Hisoblandi</span><b>{formatCurrency(rawWorkerCost)}</b></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Qarz</span><b className="text-red-500">{formatCurrency(workerDebt)}</b></div>
                    </div>
                  )}
                </div>

                <div className="rounded-md bg-muted/40 p-3 space-y-2">
                  <p className="text-sm font-medium">Chiqqan pishgan g'isht</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>1 dona narxi</Label>
                      <Input {...register('bakedWorkerRatePerBrick')} type="number" placeholder="30" />
                    </div>
                  </div>
                  {bakedWorkerCost > 0 && (
                    <div className="rounded-md bg-background px-3 py-2 text-xs">
                      <div className="flex justify-between"><span className="text-muted-foreground">Hisoblandi</span><b>{formatCurrency(bakedWorkerCost)}</b></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Qarz</span><b className="text-red-500">{formatCurrency(workerDebt)}</b></div>
                    </div>
                  )}
                </div>
              </div>

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
        title="Operatsiyani o'chirishni tasdiqlang"
        description="Bu amal orqaga qaytarib bo'lmaydi."
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
