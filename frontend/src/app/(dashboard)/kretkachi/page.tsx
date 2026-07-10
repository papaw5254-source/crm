'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, HardHat, Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { workerPaymentsService } from '@/services/worker-payments.service'
import { inventoryService } from '@/services/inventory.service'
import { PageHeader } from '@/components/shared/page-header'
import { StatsCard } from '@/components/shared/stats-card'
import { DataTable } from '@/components/shared/data-table'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { formatDate, formatCurrency, formatNumber, getErrorMessage } from '@/lib/utils'
import type { WorkerPayment, InventoryIncome } from '@/types'

const schema = z.object({
  kirimId: z.string().min(1, 'Kirimni tanlang'),
  ratePerBrick: z.coerce.number().min(0),
  paid: z.coerce.number().min(0).optional(),
})
type FormData = z.infer<typeof schema>

const eskiQarzSchema = z.object({
  date: z.string().min(1),
  oldDebt: z.coerce.number().min(0),
})
type EskiQarzForm = z.infer<typeof eskiQarzSchema>

const now = new Date()
const THIS_MONTH = now.getMonth() + 1
const THIS_YEAR = now.getFullYear()
const today = now.toISOString().split('T')[0]

export default function KretkachPage() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [eskiQarzOpen, setEskiQarzOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data: wpReport } = useQuery({
    queryKey: ['worker-payments-report', THIS_MONTH, THIS_YEAR],
    queryFn: () => workerPaymentsService.getReport({ month: THIS_MONTH, year: THIS_YEAR }),
  })
  const emptyStats = { amount: 0, paid: 0, debt: 0, carriedDebt: 0 }
  const stats = wpReport?.byCategory?.KRETKACHI ?? emptyStats

  const { data: payments, isLoading } = useQuery({
    queryKey: ['worker-payments', 'KRETKACHI', THIS_MONTH, THIS_YEAR],
    queryFn: () => workerPaymentsService.getAll({ category: 'KRETKACHI', month: THIS_MONTH, year: THIS_YEAR, limit: 100 }),
  })

  // Fetch recent kirimlar for selector
  const { data: kirimlar } = useQuery({
    queryKey: ['inventory', 1, 100, ''],
    queryFn: () => inventoryService.getAll({ page: 1, limit: 100 }),
  })

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { kirimId: '', ratePerBrick: 0, paid: 0 },
  })

  const selectedKirimId = form.watch('kirimId')
  const rate = form.watch('ratePerBrick') || 0
  const paid = form.watch('paid') || 0
  const selectedKirim = kirimlar?.data?.find((k: InventoryIncome) => k.id === selectedKirimId)
  const qty = selectedKirim?.quantity || 0
  const amount = qty > 0 && rate > 0 ? qty * rate : 0
  const debt = Math.max(0, amount - paid)

  const eskiQarzForm = useForm<EskiQarzForm>({
    resolver: zodResolver(eskiQarzSchema),
    defaultValues: { date: today, oldDebt: 0 },
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['worker-payments-report'] })
    queryClient.invalidateQueries({ queryKey: ['worker-payments'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const createMutation = useMutation({
    mutationFn: (d: FormData) => {
      if (!selectedKirim) throw new Error('Kirim tanlanmagan')
      return workerPaymentsService.create({
        workerName: 'Kretkachi',
        category: 'KRETKACHI',
        amount,
        paidAmount: d.paid || 0,
        debtFromPreviousMonth: 0,
        month: selectedKirim.date.slice(0, 7),
        date: selectedKirim.date,
        description: `${formatNumber(qty)} dona xom g'isht (${rate} so'm/dona)`,
        sourceType: 'INVENTORY_INCOME_KRETKACH',
        sourceId: selectedKirim.id,
      })
    },
    onSuccess: () => {
      invalidate()
      toast.success("To'lov qo'shildi")
      setDialogOpen(false)
      form.reset({ kirimId: '', ratePerBrick: 0, paid: 0 })
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const eskiQarzMutation = useMutation({
    mutationFn: (d: EskiQarzForm) => workerPaymentsService.create({
      workerName: 'Kretkachi',
      category: 'KRETKACHI',
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
      eskiQarzForm.reset({ date: today, oldDebt: 0 })
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

  const columns = [
    { key: 'date', header: 'Sana', cell: (r: WorkerPayment) => formatDate(r.date) },
    {
      key: 'amount', header: 'Hisoblandi', cell: (r: WorkerPayment) => (
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
      key: 'oldDebt', header: 'Eski qarz', cell: (r: WorkerPayment) => (
        <span className="text-amber-600">{Number(r.debtFromPreviousMonth) > 0 ? formatCurrency(Number(r.debtFromPreviousMonth)) : '—'}</span>
      ),
    },
    { key: 'desc', header: 'Izoh', cell: (r: WorkerPayment) => <span className="text-xs text-muted-foreground">{r.description || '—'}</span> },
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
        title="Kretkachi"
        description="Kretkachi ishchi puli boshqaruvi"
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
        <StatsCard title="Bu oy hisoblangan" value={Number(stats.amount)} icon={HardHat} color="amber" />
        <StatsCard title="Berildi" value={Number(stats.paid)} icon={HardHat} color="emerald" />
        <StatsCard title="Oldingi qarz" value={Number(stats.carriedDebt)} icon={HardHat} color="slate" />
        <StatsCard title="Jami qarz" value={Number(stats.debt)} icon={HardHat} color="red" />
      </div>

      <Card>
        <CardContent className="p-4">
          <DataTable columns={columns} data={payments?.data ?? []} loading={isLoading} />
        </CardContent>
      </Card>

      {/* To'lov dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Kretkachi to&apos;lov qo&apos;shish</DialogTitle></DialogHeader>
          <form onSubmit={form.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
            <div className="space-y-2">
              <Label>Kirimni tanlang *</Label>
              <select
                {...form.register('kirimId')}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">— Kirimni tanlang —</option>
                {(kirimlar?.data ?? []).map((k: InventoryIncome) => (
                  <option key={k.id} value={k.id}>
                    {formatDate(k.date)} — {formatNumber(k.quantity)} dona
                  </option>
                ))}
              </select>
              {form.formState.errors.kirimId && (
                <p className="text-destructive text-xs">{form.formState.errors.kirimId.message}</p>
              )}
            </div>

            {selectedKirim && (
              <div className="rounded-lg bg-muted/40 p-2 text-xs text-muted-foreground">
                Tanlangan: <span className="font-medium text-foreground">{formatDate(selectedKirim.date)}</span>
                {' · '}<span className="font-medium text-primary">{formatNumber(selectedKirim.quantity)} dona</span>
              </div>
            )}

            <div className="space-y-2">
              <Label>1 dona narx (so&apos;m)</Label>
              <Input {...form.register('ratePerBrick')} type="number" placeholder="20" />
            </div>
            <div className="space-y-2">
              <Label>Berildi</Label>
              <Input {...form.register('paid')} type="number" placeholder="0" />
            </div>

            {amount > 0 && (
              <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-2 text-xs text-center">
                <div><div className="text-muted-foreground">Hisoblandi</div><div className="font-semibold">{formatCurrency(amount)}</div></div>
                <div><div className="text-muted-foreground">Berildi</div><div className="font-semibold text-emerald-600">{formatCurrency(paid)}</div></div>
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
      <Dialog open={eskiQarzOpen} onOpenChange={setEskiQarzOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Eski qarz qo&apos;shish (Kretkachi)</DialogTitle></DialogHeader>
          <form onSubmit={eskiQarzForm.handleSubmit((d) => eskiQarzMutation.mutate(d))} className="space-y-4">
            <div className="space-y-2">
              <Label>Eski qarz miqdori (so&apos;m)</Label>
              <Input {...eskiQarzForm.register('oldDebt')} type="number" placeholder="0" />
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
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="To'lovni o'chirishni tasdiqlang"
        description="Bu amal orqaga qaytarib bo'lmaydi."
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
