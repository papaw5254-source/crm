'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { HardHat, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { workerPaymentsService } from '@/services/worker-payments.service'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatsCard } from '@/components/shared/stats-card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { formatCurrency, formatDate, getErrorMessage, workerPaymentCategoryLabel } from '@/lib/utils'
import { useAuth } from '@/providers/auth-provider'
import type { WorkerPayment } from '@/types'

interface WorkerPaymentsPanelProps {
  title: string
  categories: string[]
  limit?: number
}

function currentMonth() {
  const now = new Date()
  return { month: now.getMonth() + 1, year: now.getFullYear() }
}

function previousMonthEndDate() {
  const now = new Date()
  const date = new Date(now.getFullYear(), now.getMonth(), 0)
  return date.toISOString().split('T')[0]
}

export function WorkerPaymentsPanel({ title, categories, limit = 6 }: WorkerPaymentsPanelProps) {
  const { month, year } = currentMonth()
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const queryClient = useQueryClient()
  const [editItem, setEditItem] = useState<WorkerPayment | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [editPaid, setEditPaid] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [debtOpen, setDebtOpen] = useState(false)
  const [debtCategory, setDebtCategory] = useState(categories[0] ?? 'PRESS')
  const [debtWorkerName, setDebtWorkerName] = useState('Zavod ishchilari')
  const [debtAmount, setDebtAmount] = useState('')
  const [debtDate, setDebtDate] = useState(previousMonthEndDate())
  const [debtDescription, setDebtDescription] = useState("O'tgan oydan qolgan ishchi qarzi")

  useEffect(() => {
    setDebtCategory(categories[0] ?? 'PRESS')
  }, [categories.join('|')])

  const { data: report } = useQuery({
    queryKey: ['worker-payments-report', title, month, year],
    queryFn: () => workerPaymentsService.getReport({ month, year }),
  })

  const { data: payments, isLoading } = useQuery({
    queryKey: ['worker-payments-panel', title, categories, limit],
    queryFn: async () => {
      const results = await Promise.all(
        categories.map((category) =>
          workerPaymentsService.getAll({ category, limit, sortBy: 'date', sortOrder: 'DESC' }),
        ),
        )
        return results
          .flatMap((result) => result.data ?? [])
          .filter(Boolean)
          .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
          .slice(0, limit)
      },
  })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['worker-payments-report'] })
    queryClient.invalidateQueries({ queryKey: ['worker-payments-panel'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    queryClient.refetchQueries({ queryKey: ['worker-payments-report'] })
    queryClient.refetchQueries({ queryKey: ['worker-payments-panel'] })
    queryClient.refetchQueries({ queryKey: ['dashboard'] })
  }

  const createDebtMutation = useMutation({
    mutationFn: () =>
      workerPaymentsService.create({
        workerName: debtWorkerName.trim() || 'Zavod ishchilari',
        category: debtCategory,
        debtFromPreviousMonth: Number(debtAmount || 0),
        amount: 0,
        paidAmount: 0,
        date: debtDate,
        month: debtDate.slice(0, 7),
        description: debtDescription.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success("Eski ishchi qarzi qo'shildi")
      setDebtOpen(false)
      setDebtAmount('')
      setDebtDate(previousMonthEndDate())
      refresh()
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const updateMutation = useMutation({
    mutationFn: () =>
      workerPaymentsService.update(editItem!.id, {
        amount: Number(editAmount),
        paidAmount: Number(editPaid),
        date: editDate,
        description: editDescription.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success("Ishchi puli yangilandi")
      setEditItem(null)
      refresh()
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => workerPaymentsService.delete(id),
    onSuccess: () => {
      toast.success("Ishchi puli o'chirildi")
      setDeleteId(null)
      refresh()
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const openEdit = (payment: WorkerPayment) => {
    setEditItem(payment)
    setEditAmount(String(payment.amount ?? 0))
    setEditPaid(String(payment.paidAmount ?? 0))
    setEditDate(payment.date)
    setEditDescription(payment.description ?? '')
  }

  const totals = useMemo(() => {
    return categories.reduce(
      (acc, category) => {
        const item = report?.byCategory?.[category]
        acc.amount += Number(item?.amount ?? 0)
        acc.paid += Number(item?.paid ?? 0)
        acc.debt += Number(item?.debt ?? 0)
        acc.carriedDebt += Number(item?.carriedDebt ?? 0)
        return acc
      },
      { amount: 0, paid: 0, debt: 0, carriedDebt: 0 },
    )
  }, [categories, report])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <HardHat className="h-4 w-4" /> {title}
        </h3>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setDebtOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Eski qarz qo&apos;shish
          </Button>
          <span className="text-sm text-muted-foreground">
            {String(month).padStart(2, '0')}.{year}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <StatsCard title="Bu oy hisoblandi" value={totals.amount} icon={HardHat} color="amber" />
        <StatsCard title="Berildi" value={totals.paid} icon={HardHat} color="emerald" />
        <StatsCard title="Oldingi qarz" value={totals.carriedDebt} icon={HardHat} color="slate" />
        <StatsCard title="Jami qarz" value={totals.debt} icon={HardHat} color="red" />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Sanalar bo'yicha ishchi puli</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>
          ) : payments?.length ? (
            payments.filter(Boolean).map((payment: WorkerPayment) => (
              <div key={payment.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">{formatDate(payment.date || '')} - {payment.workerName}</p>
                  <p className="text-xs text-muted-foreground">{workerPaymentCategoryLabel(payment.category)}</p>
                </div>
                <div className="text-right ml-auto">
                  <p className="font-semibold">{formatCurrency(Number(payment.amount))}</p>
                  <p className="text-xs text-muted-foreground">
                    Berildi: {formatCurrency(Number(payment.paidAmount))}
                    {Number(payment.remainingDebt) > 0 ? ` | Qarz: ${formatCurrency(Number(payment.remainingDebt))}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon-sm" onClick={() => openEdit(payment)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(payment.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Hali ishchi puli yozilmagan.</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ishchi pulini tahrirlash</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Hisoblangan summa</Label>
              <Input value={editAmount} onChange={(e) => setEditAmount(e.target.value)} type="number" />
            </div>
            <div className="space-y-2">
              <Label>Berildi</Label>
              <Input value={editPaid} onChange={(e) => setEditPaid(e.target.value)} type="number" />
            </div>
            <div className="space-y-2">
              <Label>Sana</Label>
              <Input value={editDate} onChange={(e) => setEditDate(e.target.value)} type="date" />
            </div>
            <div className="space-y-2">
              <Label>Izoh</Label>
              <Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditItem(null)}>Bekor qilish</Button>
            <Button onClick={() => updateMutation.mutate()} loading={updateMutation.isPending}>Saqlash</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={debtOpen} onOpenChange={setDebtOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eski ishchi qarzini qo&apos;shish</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Bo&apos;lim</Label>
              <Select value={debtCategory} onValueChange={setDebtCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {workerPaymentCategoryLabel(category)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ishchi nomi</Label>
              <Input value={debtWorkerName} onChange={(e) => setDebtWorkerName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Qarz summasi</Label>
              <Input value={debtAmount} onChange={(e) => setDebtAmount(e.target.value)} type="number" placeholder="1000000" />
            </div>
            <div className="space-y-2">
              <Label>Qaysi sanadan qoldi</Label>
              <Input value={debtDate} onChange={(e) => setDebtDate(e.target.value)} type="date" />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Izoh</Label>
              <Input value={debtDescription} onChange={(e) => setDebtDescription(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDebtOpen(false)}>Bekor qilish</Button>
            <Button
              onClick={() => createDebtMutation.mutate()}
              loading={createDebtMutation.isPending}
              disabled={Number(debtAmount || 0) <= 0}
            >
              Qo&apos;shish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Ishchi pulini o'chirishni tasdiqlang"
        description="Bu yozuv hisobotlardan ham olib tashlanadi."
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
