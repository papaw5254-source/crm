'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Users, Wallet, Banknote, TrendingDown, Trash2, History } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { salaryWorkersService } from '@/services/salary-workers.service'
import { PageHeader } from '@/components/shared/page-header'
import { StatsCard } from '@/components/shared/stats-card'
import { EmptyState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { LoadingBlock } from '@/components/ui/spinner'
import { formatDate, formatCurrency, getErrorMessage } from '@/lib/utils'
import type { SalaryAdvance, SalaryWorker } from '@/types'

const now = new Date()
const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
const today = now.toISOString().split('T')[0]

const workerSchema = z.object({
  fullName: z.string().min(1, 'Ism kiritilishi shart'),
  month: z.string().min(1, 'Oy tanlanishi shart'),
  salaryAmount: z.coerce.number().min(0, "Oylik manfiy bo'lmasligi kerak"),
  notes: z.string().optional(),
})
type WorkerForm = z.infer<typeof workerSchema>

const advanceSchema = z.object({
  amount: z.coerce.number().min(0.01, "Summa 0 dan katta bo'lishi kerak"),
  date: z.string().min(1, 'Sana kiritilishi shart'),
  description: z.string().optional(),
})
type AdvanceForm = z.infer<typeof advanceSchema>

function ProgressBar({ paid, total }: { paid: number; total: number }) {
  const percent = total > 0 ? Math.min(100, (paid / total) * 100) : 0
  return (
    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
      <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${percent}%` }} />
    </div>
  )
}

export default function OylikIshchilarPage() {
  const queryClient = useQueryClient()
  const [selectedMonth, setSelectedMonth] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [workerDialogOpen, setWorkerDialogOpen] = useState(false)
  const [advanceOpen, setAdvanceOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [selectedWorker, setSelectedWorker] = useState<SalaryWorker | null>(null)
  const [deleteWorkerId, setDeleteWorkerId] = useState<string | null>(null)
  const [deleteAdvance, setDeleteAdvance] = useState<{ workerId: string; advanceId: string } | null>(null)

  const { data: workers, isLoading } = useQuery({
    queryKey: ['salary-workers', selectedMonth],
    queryFn: () => salaryWorkersService.getAll(selectedMonth ? { month: selectedMonth } : undefined),
  })

  const workerList = workers ?? []

  // Flattened "all advances this month" list, for the date-based view.
  const allAdvances = workerList
    .flatMap((w: SalaryWorker) => (w.advances ?? []).map((a: SalaryAdvance) => ({ ...a, workerName: w.fullName })))
    .filter((a) => !filterDate || a.date === filterDate)
    .sort((a, b) => (a.date < b.date ? 1 : -1))

  const totalSalary = workerList.reduce((s: number, w: SalaryWorker) => s + Number(w.salaryAmount), 0)
  const totalPaid = workerList.reduce((s: number, w: SalaryWorker) => s + Number(w.paidAmount), 0)
  const totalRemaining = workerList.reduce((s: number, w: SalaryWorker) => s + Number(w.remainingAmount), 0)

  const workerForm = useForm<WorkerForm>({
    resolver: zodResolver(workerSchema),
    defaultValues: { month: currentMonth, salaryAmount: 0 },
  })

  const advanceForm = useForm<AdvanceForm>({
    resolver: zodResolver(advanceSchema),
    defaultValues: { date: today },
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['salary-workers'] })

  const createWorkerMutation = useMutation({
    mutationFn: (d: WorkerForm) => salaryWorkersService.create({
      fullName: d.fullName.trim(),
      month: d.month,
      salaryAmount: d.salaryAmount,
      notes: d.notes?.trim() || undefined,
    }),
    onSuccess: () => {
      invalidate()
      toast.success("Ishchi qo'shildi")
      setWorkerDialogOpen(false)
      workerForm.reset({ month: selectedMonth || currentMonth, salaryAmount: 0 })
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const deleteWorkerMutation = useMutation({
    mutationFn: (id: string) => salaryWorkersService.delete(id),
    onSuccess: () => {
      invalidate()
      toast.success("Ishchi o'chirildi")
      setDeleteWorkerId(null)
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const addAdvanceMutation = useMutation({
    mutationFn: (d: AdvanceForm) => salaryWorkersService.addAdvance(selectedWorker!.id, {
      amount: d.amount,
      date: d.date,
      description: d.description?.trim() || undefined,
    }),
    onSuccess: () => {
      invalidate()
      toast.success('Avans berildi')
      setAdvanceOpen(false)
      advanceForm.reset({ date: today })
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const deleteAdvanceMutation = useMutation({
    mutationFn: (p: { workerId: string; advanceId: string }) => salaryWorkersService.deleteAdvance(p.workerId, p.advanceId),
    onSuccess: () => {
      invalidate()
      toast.success("Avans o'chirildi")
      setDeleteAdvance(null)
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Oylik ishchilar"
        description="Oylik maosh oladigan ishchilar va avanslar boshqaruvi — bu bo'lim Hisobotlar va Kassaga ta'sir qilmaydi"
        actions={
          <Button onClick={() => { workerForm.reset({ month: selectedMonth || currentMonth, salaryAmount: 0 }); setWorkerDialogOpen(true) }}>
            <Plus className="h-4 w-4 mr-1" /> Ishchi qo&apos;shish
          </Button>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatsCard title="Ishchilar soni" value={workerList.length} icon={Users} color="blue" format="number" suffix="ta" />
        <StatsCard title="Jami oylik" value={totalSalary} icon={Wallet} color="amber" />
        <StatsCard title="Berilgan avans" value={totalPaid} icon={Banknote} color="emerald" />
        <StatsCard title="Qolgan" value={totalRemaining} icon={TrendingDown} color="red" />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Oy (bo&apos;sh = barchasi)</Label>
          <div className="flex items-center gap-2">
            <Input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-40"
            />
            {selectedMonth && (
              <Button variant="outline" size="sm" onClick={() => setSelectedMonth('')}>✕ Barchasi</Button>
            )}
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Sana bo&apos;yicha (avanslar)</Label>
          <div className="flex items-center gap-2">
            <Input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="w-40" />
            {filterDate && (
              <Button variant="outline" size="sm" onClick={() => setFilterDate('')}>✕ Tozalash</Button>
            )}
          </div>
        </div>
      </div>

      {isLoading ? (
        <LoadingBlock />
      ) : workerList.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Ishchi yo'q"
          description={selectedMonth ? "Shu oy uchun hali ishchi qo'shilmagan" : "Hali ishchi qo'shilmagan"}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {workerList.map((w: SalaryWorker) => {
            const salary = Number(w.salaryAmount)
            const paid = Number(w.paidAmount)
            const remaining = Number(w.remainingAmount)
            return (
              <Card key={w.id}>
                <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate">{w.fullName}</h3>
                    <p className="text-xs text-muted-foreground">{w.month}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 w-7 p-0 shrink-0"
                    onClick={() => setDeleteWorkerId(w.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{formatCurrency(paid)} berildi</span>
                      <span>{formatCurrency(salary)} oylik</span>
                    </div>
                    <ProgressBar paid={paid} total={salary} />
                    <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                      Qolgan: {formatCurrency(remaining)}
                    </p>
                  </div>
                  {w.notes && <p className="text-xs text-muted-foreground">{w.notes}</p>}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-xs"
                      onClick={() => { setSelectedWorker(w); setHistoryOpen(true) }}
                    >
                      <History className="h-3.5 w-3.5 mr-1" /> Tarix
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => { setSelectedWorker(w); advanceForm.reset({ date: today }); setAdvanceOpen(true) }}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Avans
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Barcha avanslar — sana bo'yicha ko'rinadigan ro'yxat */}
      <Card>
        <CardHeader className="pb-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Barcha avanslar {filterDate ? `— ${formatDate(filterDate)}` : ''}
          </h3>
        </CardHeader>
        <CardContent>
          {allAdvances.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {filterDate ? "Shu sanada avans yo'q" : "Hali avans berilmagan"}
            </p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {allAdvances.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">{formatDate(a.date)}</span>
                    <span className="font-medium">{a.workerName}</span>
                    {a.description && <span className="text-xs text-muted-foreground">{a.description}</span>}
                  </div>
                  <span className="font-semibold text-emerald-600">{formatCurrency(Number(a.amount))}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ishchi qo'shish */}
      <Dialog open={workerDialogOpen} onOpenChange={setWorkerDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ishchi qo&apos;shish</DialogTitle></DialogHeader>
          <form onSubmit={workerForm.handleSubmit((d) => createWorkerMutation.mutate(d))} className="space-y-4">
            <div className="space-y-2">
              <Label>Ism familiya *</Label>
              <Input {...workerForm.register('fullName')} placeholder="Ahmadjon Toshmatov" />
              {workerForm.formState.errors.fullName && (
                <p className="text-destructive text-xs">{workerForm.formState.errors.fullName.message}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Oy *</Label>
                <Input {...workerForm.register('month')} type="month" />
              </div>
              <div className="space-y-2">
                <Label>Oylik summasi *</Label>
                <Input {...workerForm.register('salaryAmount')} type="number" placeholder="3000000" />
                {workerForm.formState.errors.salaryAmount && (
                  <p className="text-destructive text-xs">{workerForm.formState.errors.salaryAmount.message}</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Izoh</Label>
              <Input {...workerForm.register('notes')} placeholder="Ixtiyoriy izoh..." />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setWorkerDialogOpen(false)}>Bekor qilish</Button>
              <Button type="submit" loading={createWorkerMutation.isPending}>Qo&apos;shish</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Avans berish */}
      <Dialog open={advanceOpen} onOpenChange={setAdvanceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Avans berish — {selectedWorker?.fullName}</DialogTitle>
          </DialogHeader>
          {selectedWorker && (
            <div className="rounded-xl bg-muted/40 p-3 text-sm mb-2">
              <p>Oylik: <span className="font-bold">{formatCurrency(Number(selectedWorker.salaryAmount))}</span></p>
              <p>Berilgan: <span className="font-bold text-emerald-600">{formatCurrency(Number(selectedWorker.paidAmount))}</span></p>
              <p>Qolgan: <span className="font-bold text-red-600">{formatCurrency(Number(selectedWorker.remainingAmount))}</span></p>
            </div>
          )}
          <form onSubmit={advanceForm.handleSubmit((d) => addAdvanceMutation.mutate(d))} className="space-y-4">
            <div className="space-y-2">
              <Label>Avans summasi *</Label>
              <Input {...advanceForm.register('amount')} type="number" placeholder="500000" />
              {advanceForm.formState.errors.amount && (
                <p className="text-destructive text-xs">{advanceForm.formState.errors.amount.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Sana *</Label>
              <Input {...advanceForm.register('date')} type="date" />
            </div>
            <div className="space-y-2">
              <Label>Izoh</Label>
              <Input {...advanceForm.register('description')} placeholder="Ixtiyoriy izoh..." />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAdvanceOpen(false)}>Bekor qilish</Button>
              <Button type="submit" loading={addAdvanceMutation.isPending}>Berish</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Tarix */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Avanslar tarixi — {selectedWorker?.fullName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {(selectedWorker?.advances?.length ?? 0) === 0 ? (
              <p className="text-center text-muted-foreground py-8">Avans yo&apos;q</p>
            ) : (
              selectedWorker!.advances!.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                  <div>
                    <p className="font-medium text-sm text-emerald-600 dark:text-emerald-400">
                      +{formatCurrency(Number(a.amount))}
                    </p>
                    <p className="text-xs text-muted-foreground">{a.description || 'Avans'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{formatDate(a.date)}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 w-7 p-0"
                      onClick={() => setDeleteAdvance({ workerId: selectedWorker!.id, advanceId: a.id })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryOpen(false)}>Yopish</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteWorkerId}
        onOpenChange={(o) => !o && setDeleteWorkerId(null)}
        title="Ishchini o'chirish"
        description="Bu ishchi va uning barcha avans yozuvlari o'chiriladi."
        onConfirm={() => deleteWorkerId && deleteWorkerMutation.mutate(deleteWorkerId)}
        loading={deleteWorkerMutation.isPending}
      />

      <ConfirmDialog
        open={!!deleteAdvance}
        onOpenChange={(o) => !o && setDeleteAdvance(null)}
        title="Avansni o'chirish"
        description="Bu avans yozuvi o'chiriladi va ishchining qolgan summasi qayta hisoblanadi."
        onConfirm={() => deleteAdvance && deleteAdvanceMutation.mutate(deleteAdvance)}
        loading={deleteAdvanceMutation.isPending}
      />
    </div>
  )
}
