'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Users, Banknote, TrendingDown, Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { debtorsService } from '@/services/debtors.service'
import { PageHeader } from '@/components/shared/page-header'
import { StatsCard } from '@/components/shared/stats-card'
import { SearchInput } from '@/components/shared/search-input'
import { EmptyState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { formatDate, formatCurrency, getErrorMessage } from '@/lib/utils'
import type { Debtor, DebtPayment } from '@/types'

const paymentSchema = z.object({
  amount: z.coerce.number().min(0.01, "Summa 0 dan katta bo'lishi kerak"),
  description: z.string().optional(),
  date: z.string().min(1, 'Sana kiritilishi shart'),
})
type PaymentForm = z.infer<typeof paymentSchema>

function DebtProgressBar({ paid, total }: { paid: number; total: number }) {
  const percent = total > 0 ? Math.min(100, (paid / total) * 100) : 0
  return (
    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
      <div
        className="h-full bg-emerald-500 transition-all duration-500"
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}

export default function DebtorsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [selectedDebtor, setSelectedDebtor] = useState<Debtor | null>(null)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [showActive, setShowActive] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const { data: debtorsResp, isLoading } = useQuery({
    queryKey: ['debtors'],
    queryFn: () => debtorsService.getAll({ limit: 200 }),
  })

  const debtors = debtorsResp?.data ?? []

  const { data: paymentsResp, isLoading: paymentsLoading } = useQuery({
    queryKey: ['debtor-payments', selectedDebtor?.id],
    queryFn: () => debtorsService.getPayments(selectedDebtor!.id),
    enabled: !!selectedDebtor && historyOpen,
  })

  const payments = paymentsResp?.data ?? []

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<PaymentForm>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { date: new Date().toISOString().split('T')[0] },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => debtorsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debtors'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success("Qarzdor o'chirildi")
      setDeleteOpen(false)
      setDeleteId(null)
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const paymentMutation = useMutation({
    mutationFn: (data: PaymentForm) => debtorsService.addPayment(selectedDebtor!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debtors'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success("To'lov qo'shildi")
      setPaymentOpen(false)
      reset({ date: new Date().toISOString().split('T')[0] })
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const visibleDebtors = debtors
    .filter((d: Debtor) => showActive ? !d.isPaid : true)
    .filter((d: Debtor) =>
      d.fullName.toLowerCase().includes(search.toLowerCase()) ||
      (d.phone && d.phone.includes(search))
    )

  const totalDebt = debtors.reduce((s: number, d: Debtor) => s + Number(d.totalDebt), 0)
  const totalPaid = debtors.reduce((s: number, d: Debtor) => s + Number(d.paidAmount), 0)
  const totalRemaining = debtors.reduce((s: number, d: Debtor) => s + Number(d.remainingDebt), 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Qarzdorlar"
        description="Nasiya savdolar va to'lovlar boshqaruvi"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard title="Jami nasiya" value={totalDebt} icon={Users} color="amber" />
        <StatsCard title="To'langan" value={totalPaid} icon={Banknote} color="emerald" />
        <StatsCard title="Qolgan qarz" value={totalRemaining} icon={TrendingDown} color="red" />
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Ism yoki telefon..."
              className="sm:max-w-sm"
            />
            <div className="flex gap-2">
              <Button size="sm" variant={showActive ? 'default' : 'outline'} onClick={() => setShowActive(true)}>
                Faol
              </Button>
              <Button size="sm" variant={!showActive ? 'default' : 'outline'} onClick={() => setShowActive(false)}>
                Barchasi
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-40 rounded-xl bg-muted/40 animate-pulse" />
              ))}
            </div>
          ) : visibleDebtors.length === 0 ? (
            <EmptyState icon={Users} title="Qarzdor yo'q" description="Nasiya sotuvlar bu yerda ko'rinadi" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {visibleDebtors.map((debtor: Debtor) => {
                const remaining = Number(debtor.remainingDebt)
                const total = Number(debtor.totalDebt)
                const paid = Number(debtor.paidAmount)
                const isSettled = debtor.isPaid || remaining <= 0
                return (
                  <Card key={debtor.id} className={`border ${isSettled ? 'border-emerald-500/30 bg-emerald-50/5' : 'border-border'}`}>
                    <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-semibold truncate">{debtor.fullName}</h3>
                        {debtor.phone && (
                          <p className="text-xs text-muted-foreground">{debtor.phone}</p>
                        )}
                      </div>
                      <Badge variant={isSettled ? 'success' : 'warning'} className="shrink-0">
                        {isSettled ? "To'langan" : 'Faol'}
                      </Badge>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{formatCurrency(paid)} to&apos;langan</span>
                          <span>{formatCurrency(total)} jami</span>
                        </div>
                        <DebtProgressBar paid={paid} total={total} />
                        <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                          Qolgan: {formatCurrency(remaining)}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">{formatDate(debtor.lastDebtDate || debtor.createdAt)}</p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-xs"
                          onClick={() => { setSelectedDebtor(debtor); setHistoryOpen(true) }}
                        >
                          Tarix
                        </Button>
                        {!isSettled && (
                          <Button
                            size="sm"
                            className="flex-1 text-xs"
                            onClick={() => { setSelectedDebtor(debtor); setPaymentOpen(true) }}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            To&apos;lov
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10 px-2"
                          onClick={() => { setDeleteId(debtor.id); setDeleteOpen(true) }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Dialog */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>To&apos;lov qo&apos;shish — {selectedDebtor?.fullName}</DialogTitle>
          </DialogHeader>
          {selectedDebtor && (
            <div className="rounded-xl bg-muted/40 p-3 text-sm mb-2">
              <p>Jami qarz: <span className="font-bold">{formatCurrency(Number(selectedDebtor.totalDebt))}</span></p>
              <p>To&apos;langan: <span className="font-bold text-emerald-600">{formatCurrency(Number(selectedDebtor.paidAmount))}</span></p>
              <p>Qolgan: <span className="font-bold text-red-600">{formatCurrency(Number(selectedDebtor.remainingDebt))}</span></p>
            </div>
          )}
          <form onSubmit={handleSubmit((d) => paymentMutation.mutate(d))} className="space-y-4">
            <div className="space-y-2">
              <Label>To&apos;lov summasi *</Label>
              <Input {...register('amount')} type="number" step="0.01" placeholder="500000" />
              {errors.amount && <p className="text-destructive text-xs">{errors.amount.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Sana *</Label>
              <Input {...register('date')} type="date" />
            </div>
            <div className="space-y-2">
              <Label>Izoh</Label>
              <Input {...register('description')} placeholder="Naqd to'lov..." />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPaymentOpen(false)}>Bekor qilish</Button>
              <Button type="submit" loading={isSubmitting || paymentMutation.isPending}>
                To&apos;lov qo&apos;shish
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={(open) => { setDeleteOpen(open); if (!open) setDeleteId(null) }}
        title="Qarzdorni o'chirish"
        description="Bu amal barcha bog'liq nasiya sotuvlarni ham o'chiradi. Davom etasizmi?"
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        loading={deleteMutation.isPending}
      />

      {/* Payment History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>To&apos;lov tarixi — {selectedDebtor?.fullName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {paymentsLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 rounded-xl bg-muted/40 animate-pulse" />
              ))
            ) : payments.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">To&apos;lov yo&apos;q</p>
            ) : (
              payments.map((p: DebtPayment) => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                  <div>
                    <p className="font-medium text-sm text-emerald-600 dark:text-emerald-400">
                      +{formatCurrency(Number(p.amount))}
                    </p>
                    <p className="text-xs text-muted-foreground">{p.description || "To'lov"}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatDate(p.date)}</span>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryOpen(false)}>Yopish</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
