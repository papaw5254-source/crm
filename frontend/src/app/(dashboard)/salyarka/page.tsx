'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Fuel, TrendingUp, TrendingDown, Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { fuelService } from '@/services/fuel.service'
import { PageHeader } from '@/components/shared/page-header'
import { StatsCard } from '@/components/shared/stats-card'
import { EmptyState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { LoadingBlock } from '@/components/ui/spinner'
import { formatDate, formatCurrency, formatNumber, getErrorMessage } from '@/lib/utils'
import type { FuelExpense, FuelIncome } from '@/types'

const today = new Date().toISOString().split('T')[0]
const CUSTOM_DESTINATION = '__CUSTOM__'
const DESTINATIONS = ['Volga', 'G-28', 'Xon', 'Kran']

const incomeSchema = z.object({
  liters: z.coerce.number().min(0.01, "Litr 0 dan katta bo'lishi kerak"),
  pricePerLiter: z.coerce.number().min(0.01, "Narx 0 dan katta bo'lishi kerak"),
  paymentType: z.enum(['CASH', 'CARD', 'BANK_TRANSFER']),
  date: z.string().min(1, 'Sana kiritilishi shart'),
  description: z.string().optional(),
})
type IncomeForm = z.infer<typeof incomeSchema>

const expenseSchema = z.object({
  liters: z.coerce.number().min(0.01, "Litr 0 dan katta bo'lishi kerak"),
  destination: z.string().min(1, "Qayerga ketgani tanlanishi shart"),
  customDestination: z.string().optional(),
  date: z.string().min(1, 'Sana kiritilishi shart'),
  description: z.string().optional(),
}).refine(
  (d) => d.destination !== CUSTOM_DESTINATION || !!d.customDestination?.trim(),
  { message: "Qayerga ketganini yozing", path: ['customDestination'] },
)
type ExpenseForm = z.infer<typeof expenseSchema>

export default function SalyarkaPage() {
  const queryClient = useQueryClient()
  const [filterDate, setFilterDate] = useState('')
  const [incomeOpen, setIncomeOpen] = useState(false)
  const [expenseOpen, setExpenseOpen] = useState(false)
  const [deleteIncomeId, setDeleteIncomeId] = useState<string | null>(null)
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null)

  const { data: balance } = useQuery({
    queryKey: ['fuel-balance'],
    queryFn: () => fuelService.getBalance(),
  })

  const { data: incomes, isLoading: incomesLoading } = useQuery({
    queryKey: ['fuel-incomes', filterDate],
    queryFn: () => fuelService.getIncomes(filterDate ? { date: filterDate } : undefined),
  })

  const { data: expenses, isLoading: expensesLoading } = useQuery({
    queryKey: ['fuel-expenses', filterDate],
    queryFn: () => fuelService.getExpenses(filterDate ? { date: filterDate } : undefined),
  })

  const { data: ledger, isLoading: ledgerLoading } = useQuery({
    queryKey: ['fuel-ledger'],
    queryFn: () => fuelService.getLedger(),
  })

  const incomeList = incomes ?? []
  const expenseList = expenses ?? []
  const ledgerList = ledger ?? []

  const totalIncomeLiters = incomeList.reduce((s: number, i: FuelIncome) => s + Number(i.liters), 0)
  const totalExpenseLiters = expenseList.reduce((s: number, e: FuelExpense) => s + Number(e.liters), 0)

  const incomeForm = useForm<IncomeForm>({
    resolver: zodResolver(incomeSchema),
    defaultValues: { date: today, paymentType: 'CASH' },
  })
  const incomeLiters = incomeForm.watch('liters') || 0
  const incomePrice = incomeForm.watch('pricePerLiter') || 0
  const incomeTotal = incomeLiters * incomePrice

  const expenseForm = useForm<ExpenseForm>({
    resolver: zodResolver(expenseSchema),
    defaultValues: { date: today },
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['fuel-balance'] })
    queryClient.invalidateQueries({ queryKey: ['fuel-incomes'] })
    queryClient.invalidateQueries({ queryKey: ['fuel-expenses'] })
    queryClient.invalidateQueries({ queryKey: ['fuel-ledger'] })
  }

  const createIncomeMutation = useMutation({
    mutationFn: (d: IncomeForm) => fuelService.createIncome(d),
    onSuccess: () => {
      invalidate()
      toast.success("Salyarka kirimi qo'shildi")
      setIncomeOpen(false)
      incomeForm.reset({ date: today, paymentType: 'CASH' })
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const deleteIncomeMutation = useMutation({
    mutationFn: (id: string) => fuelService.deleteIncome(id),
    onSuccess: () => {
      invalidate()
      toast.success("Kirim o'chirildi")
      setDeleteIncomeId(null)
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const createExpenseMutation = useMutation({
    mutationFn: (d: ExpenseForm) => fuelService.createExpense({
      liters: d.liters,
      destination: d.destination === CUSTOM_DESTINATION ? d.customDestination!.trim() : d.destination,
      date: d.date,
      description: d.description,
    }),
    onSuccess: () => {
      invalidate()
      toast.success("Salyarka rasxodi qo'shildi")
      setExpenseOpen(false)
      expenseForm.reset({ date: today, destination: '', customDestination: '' })
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const deleteExpenseMutation = useMutation({
    mutationFn: (id: string) => fuelService.deleteExpense(id),
    onSuccess: () => {
      invalidate()
      toast.success("Rasxod o'chirildi")
      setDeleteExpenseId(null)
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Salyarka"
        description="Dizel yoqilg'i kirim-chiqim boshqaruvi — bu bo'lim Hisobotlar va Kassaga ta'sir qilmaydi"
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => { expenseForm.reset({ date: today, destination: '', customDestination: '' }); setExpenseOpen(true) }}>
              <Plus className="h-4 w-4 mr-1" /> Rasxod qo&apos;shish
            </Button>
            <Button onClick={() => { incomeForm.reset({ date: today, paymentType: 'CASH' }); setIncomeOpen(true) }}>
              <Plus className="h-4 w-4 mr-1" /> Kirim qo&apos;shish
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard title="Hozirgi qoldiq" value={Number(balance ?? 0)} icon={Fuel} color="blue" format="number" suffix="litr" />
        <StatsCard title="Kirim (litr)" value={totalIncomeLiters} icon={TrendingUp} color="emerald" format="number" suffix="litr" />
        <StatsCard title="Rasxod (litr)" value={totalExpenseLiters} icon={TrendingDown} color="red" format="number" suffix="litr" />
      </div>

      <div className="flex items-center gap-2">
        <Input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="w-40" />
        {filterDate && (
          <Button variant="outline" size="sm" onClick={() => setFilterDate('')}>✕ Tozalash</Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Kirimlar</h3></CardHeader>
          <CardContent>
            {incomesLoading ? (
              <LoadingBlock minHeight="min-h-24" size="sm" />
            ) : incomeList.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Kirim yo&apos;q</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {incomeList.map((i: FuelIncome) => (
                  <div key={i.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 text-sm">
                    <div>
                      <p className="font-medium">{formatNumber(Number(i.liters))} litr <span className="text-xs text-muted-foreground">({formatCurrency(Number(i.pricePerLiter))}/litr)</span></p>
                      <p className="text-xs text-muted-foreground">{formatDate(i.date)} — {paymentTypeUz(i.paymentType)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-emerald-600">{formatCurrency(Number(i.totalAmount))}</span>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 w-7 p-0" onClick={() => setDeleteIncomeId(i.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Rasxodlar</h3></CardHeader>
          <CardContent>
            {expensesLoading ? (
              <LoadingBlock minHeight="min-h-24" size="sm" />
            ) : expenseList.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Rasxod yo&apos;q</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {expenseList.map((e: FuelExpense) => (
                  <div key={e.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 text-sm">
                    <div>
                      <p className="font-medium">{formatNumber(Number(e.liters))} litr — {e.destination}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(e.date)}{e.description ? ` — ${e.description}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-red-600">-{formatNumber(Number(e.liters))} litr</span>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 w-7 p-0" onClick={() => setDeleteExpenseId(e.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Kunlik holat — kun oxiriga qolgan salyarka</h3>
        </CardHeader>
        <CardContent>
          {ledgerLoading ? (
            <LoadingBlock minHeight="min-h-24" size="sm" />
          ) : ledgerList.length === 0 ? (
            <EmptyState icon={Fuel} title="Ma'lumot yo'q" description="Hali kirim yoki rasxod kiritilmagan" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border">
                    <th className="pb-2 font-medium">Sana</th>
                    <th className="pb-2 font-medium">Kirim</th>
                    <th className="pb-2 font-medium">Rasxod</th>
                    <th className="pb-2 font-medium text-right">Kun oxiriga qolgan</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerList.map((row) => (
                    <tr key={row.date} className="border-b border-border last:border-0">
                      <td className="py-2 font-medium">{formatDate(row.date)}</td>
                      <td className="py-2 text-emerald-600">{row.incomeLiters > 0 ? `+${formatNumber(row.incomeLiters)}` : '—'}</td>
                      <td className="py-2 text-red-600">{row.expenseLiters > 0 ? `-${formatNumber(row.expenseLiters)}` : '—'}</td>
                      <td className="py-2 text-right font-semibold">{formatNumber(row.balance)} litr</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Kirim qo'shish */}
      <Dialog open={incomeOpen} onOpenChange={setIncomeOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Salyarka kirimi qo&apos;shish</DialogTitle></DialogHeader>
          <form onSubmit={incomeForm.handleSubmit((d) => createIncomeMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Litr *</Label>
                <Input {...incomeForm.register('liters')} type="number" placeholder="200" />
                {incomeForm.formState.errors.liters && (
                  <p className="text-destructive text-xs">{incomeForm.formState.errors.liters.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>1 litr narxi (so&apos;m) *</Label>
                <Input {...incomeForm.register('pricePerLiter')} type="number" placeholder="8500" />
                {incomeForm.formState.errors.pricePerLiter && (
                  <p className="text-destructive text-xs">{incomeForm.formState.errors.pricePerLiter.message}</p>
                )}
              </div>
            </div>
            {incomeTotal > 0 && (
              <div className="rounded-lg bg-primary/10 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Jami summa: </span>
                <span className="font-bold text-primary">{formatCurrency(incomeTotal)}</span>
              </div>
            )}
            <div className="space-y-2">
              <Label>To&apos;lov turi *</Label>
              <Select value={incomeForm.watch('paymentType')} onValueChange={(v: string) => incomeForm.setValue('paymentType', v as IncomeForm['paymentType'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Naqd</SelectItem>
                  <SelectItem value="CARD">Karta</SelectItem>
                  <SelectItem value="BANK_TRANSFER">Perechisleniya</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sana *</Label>
              <Input {...incomeForm.register('date')} type="date" />
            </div>
            <div className="space-y-2">
              <Label>Izoh</Label>
              <Input {...incomeForm.register('description')} placeholder="Ixtiyoriy izoh..." />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIncomeOpen(false)}>Bekor qilish</Button>
              <Button type="submit" loading={createIncomeMutation.isPending}>Qo&apos;shish</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Rasxod qo'shish */}
      <Dialog open={expenseOpen} onOpenChange={setExpenseOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Salyarka rasxodi qo&apos;shish</DialogTitle></DialogHeader>
          <form onSubmit={expenseForm.handleSubmit((d) => createExpenseMutation.mutate(d))} className="space-y-4">
            <div className="space-y-2">
              <Label>Litr *</Label>
              <Input {...expenseForm.register('liters')} type="number" placeholder="10" />
              {expenseForm.formState.errors.liters && (
                <p className="text-destructive text-xs">{expenseForm.formState.errors.liters.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Qayerga ketdi *</Label>
              <Select value={expenseForm.watch('destination')} onValueChange={(v: string) => expenseForm.setValue('destination', v)}>
                <SelectTrigger><SelectValue placeholder="Tanlang..." /></SelectTrigger>
                <SelectContent>
                  {DESTINATIONS.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                  <SelectItem value={CUSTOM_DESTINATION}>✏️ Boshqa (o&apos;zim yozaman)</SelectItem>
                </SelectContent>
              </Select>
              {expenseForm.formState.errors.destination && (
                <p className="text-destructive text-xs">{expenseForm.formState.errors.destination.message}</p>
              )}
              {expenseForm.watch('destination') === CUSTOM_DESTINATION && (
                <div className="pt-1">
                  <Input {...expenseForm.register('customDestination')} placeholder="Masalan: Traktor" />
                  {expenseForm.formState.errors.customDestination && (
                    <p className="text-destructive text-xs">{expenseForm.formState.errors.customDestination.message}</p>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Sana *</Label>
              <Input {...expenseForm.register('date')} type="date" />
            </div>
            <div className="space-y-2">
              <Label>Izoh</Label>
              <Input {...expenseForm.register('description')} placeholder="Ixtiyoriy izoh..." />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setExpenseOpen(false)}>Bekor qilish</Button>
              <Button type="submit" loading={createExpenseMutation.isPending}>Qo&apos;shish</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteIncomeId}
        onOpenChange={(o) => !o && setDeleteIncomeId(null)}
        title="Kirimni o'chirish"
        description="Bu yozuv o'chiriladi va salyarka qoldig'i qayta hisoblanadi."
        onConfirm={() => deleteIncomeId && deleteIncomeMutation.mutate(deleteIncomeId)}
        loading={deleteIncomeMutation.isPending}
      />

      <ConfirmDialog
        open={!!deleteExpenseId}
        onOpenChange={(o) => !o && setDeleteExpenseId(null)}
        title="Rasxodni o'chirish"
        description="Bu yozuv o'chiriladi va salyarka qoldig'i qayta hisoblanadi."
        onConfirm={() => deleteExpenseId && deleteExpenseMutation.mutate(deleteExpenseId)}
        loading={deleteExpenseMutation.isPending}
      />
    </div>
  )
}

function paymentTypeUz(t: string): string {
  if (t === 'CASH') return 'Naqd'
  if (t === 'CARD') return 'Karta'
  if (t === 'BANK_TRANSFER') return 'Perechisleniya'
  return t
}
