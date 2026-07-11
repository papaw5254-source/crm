'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, HardHat, Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { workerPaymentsService } from '@/services/worker-payments.service'
import { PageHeader } from '@/components/shared/page-header'
import { StatsCard } from '@/components/shared/stats-card'
import { DataTable } from '@/components/shared/data-table'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { formatDate, formatCurrency, getErrorMessage } from '@/lib/utils'
import type { WorkerPayment } from '@/types'

const WORKERS = [
  { key: 'Eshikchi-1', label: '1-xumbuz' },
  { key: 'Eshikchi-2', label: '2-xumbuz' },
  { key: 'Eshikchi-3', label: '3-xumbuz' },
]

const schema = z.object({
  workerKey: z.string().min(1, 'Ishchini tanlang'),
  date: z.string().min(1, 'Sana kiriting'),
  amount: z.coerce.number().min(1, 'Miqdor kiriting'),
  paid: z.coerce.number().min(0).optional(),
  description: z.string().optional(),
})
type FormData = z.infer<typeof schema>

const eskiQarzSchema = z.object({
  workerKey: z.string().min(1, 'Ishchini tanlang'),
  date: z.string().min(1),
  oldDebt: z.coerce.number().min(1, 'Miqdor kiriting'),
})
type EskiQarzForm = z.infer<typeof eskiQarzSchema>

const now = new Date()
const THIS_MONTH = now.getMonth() + 1
const THIS_YEAR = now.getFullYear()
const today = now.toISOString().split('T')[0]

export default function EshikchPage() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [eskiQarzOpen, setEskiQarzOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteWpId, setDeleteWpId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>('all')

  const { data: wpReport } = useQuery({
    queryKey: ['worker-payments-report', THIS_MONTH, THIS_YEAR],
    queryFn: () => workerPaymentsService.getReport({ month: THIS_MONTH, year: THIS_YEAR }),
  })
  const emptyStats = { amount: 0, paid: 0, debt: 0, carriedDebt: 0 }

  const { data: payments, isLoading } = useQuery({
    queryKey: ['worker-payments', 'ESHIKCHI', THIS_MONTH, THIS_YEAR],
    queryFn: () => workerPaymentsService.getAll({ category: 'ESHIKCHI', month: THIS_MONTH, year: THIS_YEAR, limit: 200 }),
  })

  const { data: eskiQarzData } = useQuery({
    queryKey: ['worker-payments', 'ESHIKCHI', 'eski-qarz'],
    queryFn: () => workerPaymentsService.getAll({ category: 'ESHIKCHI', limit: 100 }),
  })

  const allPayments: WorkerPayment[] = payments?.data ?? []
  const regularPayments = allPayments.filter(
    (r) => Number(r.amount) > 0 || Number(r.paidAmount) > 0
  )

  const eskiQarzList = (eskiQarzData?.data ?? []).filter(
    (r: WorkerPayment) => !r.sourceId && Number(r.debtFromPreviousMonth) > 0
  )

  const activeWorkerLabel = WORKERS.find((w) => w.key === activeTab)?.label
  const knownWorkerKeys = new Set(WORKERS.map((w) => w.key))
  const knownWorkerLabels = new Set(WORKERS.map((w) => w.label))

  const workerMatch = (workerName: string) =>
    workerName === activeTab ||
    workerName === activeWorkerLabel ||
    (!knownWorkerKeys.has(workerName) && !knownWorkerLabels.has(workerName))

  const filtered = activeTab === 'all'
    ? regularPayments
    : regularPayments.filter((p) => workerMatch(p.workerName))

  const filteredEskiQarz = activeTab === 'all'
    ? eskiQarzList
    : eskiQarzList.filter((r) => workerMatch(r.workerName))

  const calcStats = (list: WorkerPayment[], ekList: WorkerPayment[]) => {
    const amount = list.reduce((acc, r) => acc + Number(r.amount), 0)
    const paid = list.reduce((acc, r) => acc + Number(r.paidAmount), 0)
    const regularDebt = list.reduce((acc, r) => acc + Number(r.remainingDebt), 0)
    const carriedDebt = ekList.reduce((acc, r) => acc + Number(r.debtFromPreviousMonth), 0)
    const eskiRemainingDebt = ekList.reduce((acc, r) => acc + Number(r.remainingDebt), 0)
    return { amount, paid, carriedDebt, debt: regularDebt + eskiRemainingDebt }
  }

  const displayStats = activeTab === 'all'
    ? (wpReport?.byCategory?.ESHIKCHI ?? emptyStats)
    : calcStats(filtered, filteredEskiQarz)

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { workerKey: 'Eshikchi-1', date: today, amount: 0, paid: 0, description: '' },
  })
  const amountVal = form.watch('amount') || 0
  const paidVal = form.watch('paid') || 0
  const debt = Math.max(0, amountVal - paidVal)

  const eskiQarzForm = useForm<EskiQarzForm>({
    resolver: zodResolver(eskiQarzSchema),
    defaultValues: { workerKey: 'Eshikchi-1', date: today, oldDebt: 0 },
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['worker-payments-report'] })
    queryClient.invalidateQueries({ queryKey: ['worker-payments'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    queryClient.invalidateQueries({ queryKey: ['worker-payments', 'ESHIKCHI', 'eski-qarz'] })
  }

  const createMutation = useMutation({
    mutationFn: (d: FormData) => {
      const worker = WORKERS.find((w) => w.key === d.workerKey)
      return workerPaymentsService.create({
        workerName: d.workerKey,
        category: 'ESHIKCHI',
        amount: d.amount,
        paidAmount: d.paid || 0,
        debtFromPreviousMonth: 0,
        month: d.date.slice(0, 7),
        date: d.date,
        description: d.description || (worker ? worker.label : d.workerKey),
      })
    },
    onSuccess: () => {
      invalidate()
      toast.success("To'lov qo'shildi")
      setDialogOpen(false)
      form.reset({ workerKey: 'Eshikchi-1', date: today, amount: 0, paid: 0, description: '' })
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const eskiQarzMutation = useMutation({
    mutationFn: (d: EskiQarzForm) => workerPaymentsService.create({
      workerName: d.workerKey,
      category: 'ESHIKCHI',
      amount: 0,
      paidAmount: 0,
      debtFromPreviousMonth: d.oldDebt,
      month: d.date.slice(0, 7),
      date: d.date,
    }),
    onSuccess: () => {
      invalidate()
      toast.success("Eski qarz qo'shildi")
      setEskiQarzOpen(false)
      eskiQarzForm.reset({ workerKey: 'Eshikchi-1', date: today, oldDebt: 0 })
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => workerPaymentsService.delete(id),
    onSuccess: () => {
      invalidate()
      toast.success("O'chirildi")
      setDeleteId(null)
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const deleteWpMutation = useMutation({
    mutationFn: (id: string) => workerPaymentsService.delete(id),
    onSuccess: () => {
      invalidate()
      toast.success("Eski qarz o'chirildi")
      setDeleteWpId(null)
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const workerLabel = (name: string) => WORKERS.find((w) => w.key === name)?.label ?? name

  const columns = [
    { key: 'date', header: 'Sana', cell: (r: WorkerPayment) => formatDate(r.date) },
    {
      key: 'worker', header: 'Ishchi', cell: (r: WorkerPayment) => (
        <span className="font-medium text-sm">{workerLabel(r.workerName)}</span>
      ),
    },
    {
      key: 'amount', header: 'Kunlik', cell: (r: WorkerPayment) => (
        <span className="font-semibold">{Number(r.amount) > 0 ? formatCurrency(Number(r.amount)) : '—'}</span>
      ),
    },
    {
      key: 'paid', header: 'Berildi', cell: (r: WorkerPayment) => (
        <span className="text-emerald-600">{Number(r.paidAmount) > 0 ? formatCurrency(Number(r.paidAmount)) : '—'}</span>
      ),
    },
    {
      key: 'debt', header: 'Qarz', cell: (r: WorkerPayment) => (
        <span className={Number(r.remainingDebt) > 0 ? 'text-red-600 font-semibold' : 'text-muted-foreground'}>
          {formatCurrency(Number(r.remainingDebt))}
        </span>
      ),
    },
    {
      key: 'actions', header: '', cell: (r: WorkerPayment) => (
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(r.id)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Eshikchi"
        description="Eshikchi (xumbuz) ishchi puli boshqaruvi"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEskiQarzOpen(true)}>
              Eski qarz qo&apos;shish
            </Button>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> To&apos;lov qo&apos;shish
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatsCard title="Bu oy hisoblangan" value={Number(displayStats.amount)} icon={HardHat} color="amber" />
        <StatsCard title="Berildi" value={Number(displayStats.paid)} icon={HardHat} color="emerald" />
        <StatsCard title="Oldingi qarz" value={Number(displayStats.carriedDebt)} icon={HardHat} color="slate" />
        <StatsCard title="Jami qarz" value={Number(displayStats.debt)} icon={HardHat} color="red" />
      </div>

      {/* Eski qarz list */}
      {eskiQarzList.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h4 className="text-sm font-semibold text-muted-foreground mb-3">Eski qarz ro&apos;yxati</h4>
            {filteredEskiQarz.length > 0 ? filteredEskiQarz.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-3 py-2">
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground">{formatDate(r.date)}</span>
                  <span className="font-medium text-amber-700 dark:text-amber-400">{workerLabel(r.workerName)}</span>
                  <span className="font-bold">{formatCurrency(Number(r.debtFromPreviousMonth))}</span>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteWpId(r.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )) : (
              <p className="text-xs text-muted-foreground text-center py-2">Bu ishchi uchun eski qarz yo&apos;q</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {[{ key: 'all', label: 'Barchasi' }, ...WORKERS].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-4">
          <DataTable columns={columns} data={filtered} loading={isLoading} />
        </CardContent>
      </Card>

      {/* To'lov dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o: boolean) => { setDialogOpen(o); if (!o) form.reset({ workerKey: 'Eshikchi-1', date: today, amount: 0, paid: 0, description: '' }) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Eshikchi to&apos;lov qo&apos;shish</DialogTitle></DialogHeader>
          <form onSubmit={form.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
            <div className="space-y-2">
              <Label>Ishchi *</Label>
              <div className="flex gap-2">
                {WORKERS.map((w) => (
                  <button
                    key={w.key}
                    type="button"
                    onClick={() => form.setValue('workerKey', w.key)}
                    className={`flex-1 py-1.5 rounded-md border text-sm font-medium transition-colors ${
                      form.watch('workerKey') === w.key
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background border-input hover:bg-muted'
                    }`}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Sana *</Label>
              <Input {...form.register('date')} type="date" />
            </div>

            <div className="space-y-2">
              <Label>Kunlik miqdor (so&apos;m) *</Label>
              <Input {...form.register('amount')} type="number" placeholder="0" />
              {form.formState.errors.amount && (
                <p className="text-destructive text-xs">{form.formState.errors.amount.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Berildi (so&apos;m)</Label>
              <Input {...form.register('paid')} type="number" placeholder="0" />
            </div>

            <div className="space-y-2">
              <Label>Izoh (ixtiyoriy)</Label>
              <Input {...form.register('description')} placeholder="masalan: 2 kunlik..." />
            </div>

            {amountVal > 0 && (
              <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-2 text-xs text-center">
                <div><div className="text-muted-foreground">Kunlik</div><div className="font-semibold">{formatCurrency(amountVal)}</div></div>
                <div><div className="text-muted-foreground">Berildi</div><div className="font-semibold text-emerald-600">{formatCurrency(paidVal)}</div></div>
                <div><div className="text-muted-foreground">Jami qarz</div><div className={`font-bold ${debt > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(debt)}</div></div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Bekor qilish</Button>
              <Button type="submit" loading={createMutation.isPending}>Saqlash</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Eski qarz dialog */}
      <Dialog open={eskiQarzOpen} onOpenChange={(o: boolean) => { setEskiQarzOpen(o); if (!o) eskiQarzForm.reset({ workerKey: 'Eshikchi-1', date: today, oldDebt: 0 }) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Eski qarz qo&apos;shish</DialogTitle></DialogHeader>
          <form onSubmit={eskiQarzForm.handleSubmit((d) => eskiQarzMutation.mutate(d))} className="space-y-4">
            <div className="space-y-2">
              <Label>Ishchi *</Label>
              <div className="flex gap-2">
                {WORKERS.map((w) => (
                  <button
                    key={w.key}
                    type="button"
                    onClick={() => eskiQarzForm.setValue('workerKey', w.key)}
                    className={`flex-1 py-1.5 rounded-md border text-sm font-medium transition-colors ${
                      eskiQarzForm.watch('workerKey') === w.key
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background border-input hover:bg-muted'
                    }`}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
              {eskiQarzForm.formState.errors.workerKey && (
                <p className="text-destructive text-xs">{eskiQarzForm.formState.errors.workerKey.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Eski qarz miqdori (so&apos;m) *</Label>
              <Input {...eskiQarzForm.register('oldDebt')} type="number" placeholder="0" />
              {eskiQarzForm.formState.errors.oldDebt && (
                <p className="text-destructive text-xs">{eskiQarzForm.formState.errors.oldDebt.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Sana</Label>
              <Input {...eskiQarzForm.register('date')} type="date" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEskiQarzOpen(false)}>Bekor qilish</Button>
              <Button type="submit" loading={eskiQarzMutation.isPending}>Saqlash</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o: boolean) => !o && setDeleteId(null)}
        title="To'lovni o'chirishni tasdiqlang"
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
    </div>
  )
}
