'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, Plus, Pencil, Trash2, Wallet, TrendingDown, TrendingUp } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { salesService } from '@/services/sales.service'
import type { BankTransferFirm } from '@/services/sales.service'
import { moneyIncomesService } from '@/services/money-incomes.service'
import { PageHeader } from '@/components/shared/page-header'
import { StatsCard } from '@/components/shared/stats-card'
import { DataTable } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/empty-state'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatDate, formatCurrency, formatNumber, brickTypeLabel, brickTypeColor, getErrorMessage } from '@/lib/utils'
import { useAuth } from '@/providers/auth-provider'
import type { Sale, BrickType, MoneyIncome } from '@/types'

const saleSchema = z.object({
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  brickType: z.enum(['RAW_BRICK', 'BAKED_BRICK']),
  quantity: z.coerce.number().min(1, "Miqdor 0 dan katta bo'lishi kerak"),
  pricePerBrick: z.coerce.number().min(0.01, "Narx 0 dan katta bo'lishi kerak"),
  paymentType: z.enum(['BANK_TRANSFER', 'DEBT', 'CASH', 'CARD']),
  date: z.string().min(1, 'Sana kiritilishi shart'),
  description: z.string().optional(),
  isReserveSale: z.boolean().optional(),
})
type SaleForm = z.infer<typeof saleSchema>

const defaultFormValues: Partial<SaleForm> = {
  brickType: 'BAKED_BRICK',
  paymentType: 'BANK_TRANSFER',
  date: new Date().toISOString().split('T')[0],
}

export default function PerechisleniyaPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const queryClient = useQueryClient()
  const [selectedFirm, setSelectedFirm] = useState<string | null>(null)
  const [addSaleOpen, setAddSaleOpen] = useState(false)
  const [editSale, setEditSale] = useState<Sale | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [depositOpen, setDepositOpen] = useState(false)
  const [depositFirm, setDepositFirm] = useState('')
  const [depositAmount, setDepositAmount] = useState('')
  const [depositDate, setDepositDate] = useState(new Date().toISOString().split('T')[0])
  const [depositDesc, setDepositDesc] = useState('')
  const [deleteDepositId, setDeleteDepositId] = useState<string | null>(null)
  const [oldDebtOpen, setOldDebtOpen] = useState(false)
  const [oldDebtFirm, setOldDebtFirm] = useState('')
  const [oldDebtAmount, setOldDebtAmount] = useState('')
  const [oldDebtDate, setOldDebtDate] = useState(new Date().toISOString().split('T')[0])
  const [oldDebtDesc, setOldDebtDesc] = useState('')
  const [deleteOldDebtId, setDeleteOldDebtId] = useState<string | null>(null)
  const [filterDate, setFilterDate] = useState('')

  const { data: firms = [], isLoading } = useQuery({
    queryKey: ['bank-transfer-firms'],
    queryFn: () => salesService.getBankTransferFirms(),
  })

  const { data: firmNames = [] } = useQuery({
    queryKey: ['firm-names'],
    queryFn: () => salesService.getFirmNames(),
  })

  const { data: depositsData } = useQuery({
    queryKey: ['firm-deposits'],
    queryFn: () => moneyIncomesService.getAll({ source: 'FIRM_DEPOSIT', limit: 1000 }),
  })
  const allDeposits: MoneyIncome[] = depositsData?.data ?? []

  const { data: oldDebtsData } = useQuery({
    queryKey: ['firm-old-debts'],
    queryFn: () => moneyIncomesService.getAll({ source: 'FIRM_OLD_DEBT', limit: 1000 }),
  })
  const allOldDebts: MoneyIncome[] = oldDebtsData?.data ?? []

  const { data: firmSales = [], isLoading: firmSalesLoading } = useQuery({
    queryKey: ['firm-sales', selectedFirm, 'BANK_TRANSFER'],
    queryFn: () => salesService.getFirmSales(selectedFirm!, 'BANK_TRANSFER'),
    enabled: !!selectedFirm,
  })

  // Sana bo'yicha kunlik xulosa uchun
  const { data: dailySalesData } = useQuery({
    queryKey: ['perechisleniya-daily-sales', filterDate],
    queryFn: () => salesService.getAll({ dateFrom: filterDate, dateTo: filterDate, limit: 500, isReserveSale: false }),
    enabled: !!filterDate,
  })
  const dailySales: Sale[] = (dailySalesData?.data ?? []).filter((s: Sale) => s.paymentType === 'BANK_TRANSFER')
  const dailyDeposits = allDeposits.filter((d) => d.date === filterDate)

  const firmDeposits = allDeposits.filter(d => d.fromWhom === selectedFirm)
  const firmOldDebts = allOldDebts.filter(d => d.fromWhom === selectedFirm)

  const getOldDebt = (firmName: string) =>
    allOldDebts.filter(d => d.fromWhom === firmName).reduce((s, d) => s + Number(d.amount), 0)

  const getBalance = (firmName: string) => {
    const deposited = allDeposits
      .filter(d => d.fromWhom === firmName)
      .reduce((s, d) => s + Number(d.amount), 0)
    const firm = (firms as BankTransferFirm[]).find(f => f.firmName === firmName)
    const sold = firm ? firm.totalAmount : 0
    return deposited - sold - getOldDebt(firmName)
  }

  const allFirmNames: string[] = [...new Set([
    ...(firms as BankTransferFirm[]).map(f => f.firmName),
    ...allDeposits.map(d => d.fromWhom).filter(Boolean) as string[],
    ...allOldDebts.map(d => d.fromWhom).filter(Boolean) as string[],
  ])]

  const form = useForm<SaleForm>({
    resolver: zodResolver(saleSchema),
    defaultValues: defaultFormValues,
  })

  const watchedQty = form.watch('quantity') || 0
  const watchedPrice = form.watch('pricePerBrick') || 0
  const watchedPayType = form.watch('paymentType')
  const watchedBrickType = form.watch('brickType')
  const watchedIsReserve = form.watch('isReserveSale')
  const totalSaleAmount = watchedQty * watchedPrice

  const invalidateSales = () => {
    queryClient.invalidateQueries({ queryKey: ['bank-transfer-firms'] })
    queryClient.invalidateQueries({ queryKey: ['firm-names'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    queryClient.invalidateQueries({ queryKey: ['stock'] })
  }

  const createMutation = useMutation({
    mutationFn: (d: SaleForm) => salesService.create(d as Parameters<typeof salesService.create>[0]),
    onSuccess: () => {
      invalidateSales()
      queryClient.invalidateQueries({ queryKey: ['firm-sales', selectedFirm, 'BANK_TRANSFER'] })
      toast.success("Sotuv qo'shildi")
      setAddSaleOpen(false)
      form.reset(defaultFormValues)
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const updateMutation = useMutation({
    mutationFn: (d: SaleForm) => salesService.update(editSale!.id, d as Parameters<typeof salesService.create>[0]),
    onSuccess: () => {
      invalidateSales()
      queryClient.invalidateQueries({ queryKey: ['firm-sales', selectedFirm, 'BANK_TRANSFER'] })
      toast.success('Sotuv yangilandi')
      setAddSaleOpen(false)
      setEditSale(null)
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => salesService.delete(id),
    onSuccess: () => {
      invalidateSales()
      queryClient.invalidateQueries({ queryKey: ['firm-sales', selectedFirm, 'BANK_TRANSFER'] })
      toast.success("Sotuv o'chirildi")
      setDeleteId(null)
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const depositMutation = useMutation({
    mutationFn: () => moneyIncomesService.create({
      amount: Number(depositAmount),
      source: 'FIRM_DEPOSIT',
      fromWhom: depositFirm,
      description: depositDesc || `${depositFirm} oldindan to'lov`,
      date: depositDate,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['firm-deposits'] })
      toast.success("Depozit qo'shildi")
      setDepositOpen(false)
      setDepositAmount('')
      setDepositDesc('')
      setDepositDate(new Date().toISOString().split('T')[0])
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const deleteDepositMutation = useMutation({
    mutationFn: (id: string) => moneyIncomesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['firm-deposits'] })
      toast.success("Depozit o'chirildi")
      setDeleteDepositId(null)
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const oldDebtMutation = useMutation({
    mutationFn: () => moneyIncomesService.create({
      amount: Number(oldDebtAmount),
      source: 'FIRM_OLD_DEBT',
      fromWhom: oldDebtFirm,
      description: oldDebtDesc || `${oldDebtFirm} oldingi qarzi`,
      date: oldDebtDate,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['firm-old-debts'] })
      toast.success("Oldingi qarz qo'shildi")
      setOldDebtOpen(false)
      setOldDebtAmount('')
      setOldDebtDesc('')
      setOldDebtDate(new Date().toISOString().split('T')[0])
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const deleteOldDebtMutation = useMutation({
    mutationFn: (id: string) => moneyIncomesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['firm-old-debts'] })
      toast.success("Oldingi qarz o'chirildi")
      setDeleteOldDebtId(null)
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const openAdd = (firmName?: string) => {
    setEditSale(null)
    form.reset({ ...defaultFormValues, customerName: firmName || '' })
    setAddSaleOpen(true)
  }

  const openEdit = (sale: Sale) => {
    setEditSale(sale)
    form.reset({
      customerName: sale.customerName || '',
      customerPhone: sale.customerPhone || '',
      brickType: (sale.brickType ?? 'BAKED_BRICK') as BrickType,
      quantity: sale.quantity,
      pricePerBrick: Number(sale.pricePerBrick),
      paymentType: sale.paymentType as SaleForm['paymentType'],
      date: sale.date,
      description: sale.description || '',
      isReserveSale: false,
    })
    setAddSaleOpen(true)
  }

  const onSubmit = (d: SaleForm) => {
    if (editSale) updateMutation.mutate(d)
    else createMutation.mutate(d)
  }

  const openDepositDialog = (firmName: string) => {
    setDepositFirm(firmName)
    setDepositOpen(true)
  }

  const openOldDebtDialog = (firmName: string) => {
    setOldDebtFirm(firmName)
    setOldDebtOpen(true)
  }

  const totalDeposited = allDeposits.reduce((s, d) => s + Number(d.amount), 0)
  const totalSold = (firms as BankTransferFirm[]).reduce((s, f) => s + f.totalAmount, 0)
  const totalOldDebt = allOldDebts.reduce((s, d) => s + Number(d.amount), 0)
  const totalBalance = totalDeposited - totalSold - totalOldDebt

  const firmColumns = [
    {
      key: 'firmName',
      header: 'Firma nomi',
      cell: (row: { firmName: string }) => <span className="font-semibold">{row.firmName}</span>,
    },
    {
      key: 'deposited',
      header: "To'langan (depozit)",
      cell: (row: { firmName: string }) => {
        const dep = allDeposits.filter(d => d.fromWhom === row.firmName).reduce((s, d) => s + Number(d.amount), 0)
        return <span className="text-blue-600 dark:text-blue-400 font-medium">{formatCurrency(dep)}</span>
      },
    },
    {
      key: 'totalAmount',
      header: 'Berilgan (sotuv)',
      cell: (row: { firmName: string }) => {
        const firm = (firms as BankTransferFirm[]).find(f => f.firmName === row.firmName)
        return <span className="font-medium">{formatCurrency(firm ? firm.totalAmount : 0)}</span>
      },
    },
    {
      key: 'oldDebt',
      header: 'Oldingi qarz',
      cell: (row: { firmName: string }) => {
        const old = getOldDebt(row.firmName)
        return old > 0
          ? <span className="font-medium text-red-600 dark:text-red-400">-{formatCurrency(old)}</span>
          : <span className="text-muted-foreground">—</span>
      },
    },
    {
      key: 'balance',
      header: 'Balans',
      cell: (row: { firmName: string }) => {
        const bal = getBalance(row.firmName)
        return (
          <span className={`font-bold text-base ${bal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {bal >= 0 ? '+' : ''}{formatCurrency(bal)}
          </span>
        )
      },
    },
    {
      key: 'actions',
      header: '',
      cell: (row: { firmName: string }) => (
        <div className="flex gap-1 justify-end">
          <Button variant="outline" size="sm" onClick={() => openOldDebtDialog(row.firmName)}>
            <TrendingDown className="h-3.5 w-3.5 mr-1" /> Qarz
          </Button>
          <Button variant="outline" size="sm" onClick={() => openDepositDialog(row.firmName)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Depozit
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSelectedFirm(row.firmName)}>
            Ko&apos;rish
          </Button>
        </div>
      ),
    },
  ]

  const saleColumns = [
    { key: 'date', header: 'Sana', cell: (r: Sale) => <span className="font-medium">{formatDate(r.date)}</span> },
    {
      key: 'brickType', header: "G'isht",
      cell: (r: Sale) => (
        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${brickTypeColor(r.brickType ?? 'BAKED_BRICK')}`}>
          {brickTypeLabel(r.brickType ?? 'BAKED_BRICK')}
        </span>
      ),
    },
    { key: 'quantity', header: 'Miqdor', cell: (r: Sale) => <span className="font-bold">{formatNumber(r.quantity)} dona</span> },
    { key: 'pricePerBrick', header: 'Narx', cell: (r: Sale) => <span>{formatCurrency(Number(r.pricePerBrick))}</span> },
    {
      key: 'totalAmount', header: 'Jami',
      cell: (r: Sale) => <span className="font-semibold text-red-600 dark:text-red-400">-{formatCurrency(Number(r.totalAmount))}</span>,
    },
    { key: 'desc', header: 'Izoh', cell: (r: Sale) => <span className="text-xs text-muted-foreground">{r.description || '—'}</span> },
    {
      key: 'actions', header: '',
      cell: (r: Sale) => (
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

  const depositColumns = [
    { key: 'date', header: 'Sana', cell: (r: MoneyIncome) => <span className="font-medium">{formatDate(r.date)}</span> },
    {
      key: 'amount', header: 'Summa',
      cell: (r: MoneyIncome) => <span className="font-bold text-blue-600 dark:text-blue-400">+{formatCurrency(Number(r.amount))}</span>,
    },
    { key: 'desc', header: 'Izoh', cell: (r: MoneyIncome) => <span className="text-xs text-muted-foreground">{r.description || '—'}</span> },
    {
      key: 'actions', header: '',
      cell: (r: MoneyIncome) => isAdmin ? (
        <Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteDepositId(r.id)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      ) : null,
    },
  ]

  const oldDebtColumns = [
    { key: 'date', header: 'Sana', cell: (r: MoneyIncome) => <span className="font-medium">{formatDate(r.date)}</span> },
    {
      key: 'amount', header: 'Summa',
      cell: (r: MoneyIncome) => <span className="font-bold text-red-600 dark:text-red-400">-{formatCurrency(Number(r.amount))}</span>,
    },
    { key: 'desc', header: 'Izoh', cell: (r: MoneyIncome) => <span className="text-xs text-muted-foreground">{r.description || '—'}</span> },
    {
      key: 'actions', header: '',
      cell: (r: MoneyIncome) => isAdmin ? (
        <Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteOldDebtId(r.id)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      ) : null,
    },
  ]

  const selectedBalance = selectedFirm ? getBalance(selectedFirm) : 0
  const selectedDeposited = firmDeposits.reduce((s, d) => s + Number(d.amount), 0)
  const selectedSold = (firms as BankTransferFirm[]).find(f => f.firmName === selectedFirm)?.totalAmount ?? 0
  const selectedOldDebt = firmOldDebts.reduce((s, d) => s + Number(d.amount), 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Perechisleniya"
        description="Firma depozitlari va bank o'tkazmalari"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setOldDebtFirm(''); setOldDebtOpen(true) }}>
              <TrendingDown className="h-4 w-4 mr-1" /> Oldingi qarz qo&apos;shish
            </Button>
            <Button variant="outline" onClick={() => { setDepositFirm(''); setDepositOpen(true) }}>
              <Wallet className="h-4 w-4 mr-1" /> Depozit qo&apos;shish
            </Button>
            <Button onClick={() => openAdd()}>
              <Plus className="h-4 w-4 mr-1" /> Sotuv qo&apos;shish
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatsCard title="Jami depozit" value={totalDeposited} icon={TrendingUp} color="blue" />
        <StatsCard title="Jami berilgan" value={totalSold} icon={TrendingDown} color="red" />
        <StatsCard title="Oldingi qarzlar" value={totalOldDebt} icon={TrendingDown} color="red" />
        <StatsCard title="Umumiy balans" value={totalBalance} icon={Wallet} color={totalBalance >= 0 ? 'emerald' : 'red'} />
      </div>

      {/* Sana bo'yicha filtr */}
      <div className="flex items-center gap-2">
        <Input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="w-40" />
        {filterDate && (
          <Button variant="outline" size="sm" onClick={() => setFilterDate('')}>✕ Tozalash</Button>
        )}
      </div>

      {filterDate && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatsCard
            title={`${formatDate(filterDate)} — depozit qilindi`}
            value={dailyDeposits.reduce((s, d) => s + Number(d.amount), 0)}
            icon={TrendingUp} color="blue"
          />
          <StatsCard
            title={`${formatDate(filterDate)} — perechisleniya sotuvi`}
            value={dailySales.reduce((s, x) => s + Number(x.totalAmount), 0)}
            icon={TrendingDown} color="red"
          />
        </div>
      )}

      <Card>
        <CardContent className="p-4">
          {allFirmNames.length === 0 && !isLoading ? (
            <EmptyState
              icon={Building2}
              title="Firmalar yo'q"
              description="Depozit qo'shing yoki perechisleniya sotuv kiriting"
              action={<Button onClick={() => setDepositOpen(true)}><Wallet className="h-4 w-4 mr-1" />Depozit qo&apos;shish</Button>}
            />
          ) : (
            <DataTable
              columns={firmColumns}
              data={allFirmNames.map(name => ({ firmName: name }))}
              loading={isLoading}
            />
          )}
        </CardContent>
      </Card>

      {/* Firma detail dialog */}
      <Dialog open={!!selectedFirm} onOpenChange={(o) => !o && setSelectedFirm(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">{selectedFirm}</DialogTitle>
          </DialogHeader>
          {selectedFirm && (
            <div className="space-y-4 flex-1 min-h-0 overflow-y-auto">
              {/* Balance summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-3 text-center">
                  <div className="text-xs text-muted-foreground mb-1">Jami depozit</div>
                  <div className="font-bold text-lg text-blue-600 dark:text-blue-400">+{formatCurrency(selectedDeposited)}</div>
                </div>
                <div className="rounded-lg bg-red-50 dark:bg-red-950/30 p-3 text-center">
                  <div className="text-xs text-muted-foreground mb-1">Berilgan g&apos;isht</div>
                  <div className="font-bold text-lg text-red-600 dark:text-red-400">-{formatCurrency(selectedSold)}</div>
                </div>
                <div className="rounded-lg bg-red-50 dark:bg-red-950/30 p-3 text-center">
                  <div className="text-xs text-muted-foreground mb-1">Oldingi qarz</div>
                  <div className="font-bold text-lg text-red-600 dark:text-red-400">-{formatCurrency(selectedOldDebt)}</div>
                </div>
                <div className={`rounded-lg p-3 text-center ${selectedBalance >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-red-50 dark:bg-red-950/30'}`}>
                  <div className="text-xs text-muted-foreground mb-1">Balans</div>
                  <div className={`font-bold text-xl ${selectedBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {selectedBalance >= 0 ? '+' : ''}{formatCurrency(selectedBalance)}
                  </div>
                  <div className="text-xs mt-0.5 text-muted-foreground">
                    {selectedBalance >= 0 ? 'Qolgan kredit' : 'Qarz (ortiqcha olgan)'}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => openOldDebtDialog(selectedFirm)}>
                  <TrendingDown className="h-3.5 w-3.5 mr-1" /> Oldingi qarz qo&apos;shish
                </Button>
                <Button size="sm" variant="outline" onClick={() => openDepositDialog(selectedFirm)}>
                  <Wallet className="h-3.5 w-3.5 mr-1" /> Depozit qo&apos;shish
                </Button>
                <Button size="sm" onClick={() => openAdd(selectedFirm)}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Sotuv qo&apos;shish
                </Button>
              </div>

              <Tabs defaultValue="deposits">
                <TabsList>
                  <TabsTrigger value="deposits">Depozitlar ({firmDeposits.length})</TabsTrigger>
                  <TabsTrigger value="oldDebts">Oldingi qarzlar ({firmOldDebts.length})</TabsTrigger>
                  <TabsTrigger value="sales">Sotuvlar ({firmSales.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="deposits" className="mt-2">
                  {firmDeposits.length === 0 ? (
                    <p className="text-center text-muted-foreground py-6 text-sm">Depozit yo&apos;q</p>
                  ) : (
                    <DataTable columns={depositColumns} data={firmDeposits} />
                  )}
                </TabsContent>
                <TabsContent value="oldDebts" className="mt-2">
                  {firmOldDebts.length === 0 ? (
                    <p className="text-center text-muted-foreground py-6 text-sm">Oldingi qarz yo&apos;q</p>
                  ) : (
                    <DataTable columns={oldDebtColumns} data={firmOldDebts} />
                  )}
                </TabsContent>
                <TabsContent value="sales" className="mt-2">
                  <DataTable columns={saleColumns} data={firmSales} loading={firmSalesLoading} />
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Deposit dialog */}
      <Dialog open={depositOpen} onOpenChange={(o) => { if (!o) { setDepositOpen(false); setDepositAmount(''); setDepositDesc('') } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Firma depoziti qo&apos;shish</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Firma nomi *</Label>
              <Input
                list="deposit-firm-names"
                value={depositFirm}
                onChange={(e) => setDepositFirm(e.target.value)}
                placeholder="Firma nomi..."
                autoComplete="off"
              />
              <datalist id="deposit-firm-names">
                {allFirmNames.map(name => <option key={name} value={name} />)}
                {(firmNames as string[]).map((name: string) => <option key={name} value={name} />)}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label>Summa (so&apos;m) *</Label>
              <Input type="number" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="15000000" />
            </div>
            <div className="space-y-1.5">
              <Label>Sana *</Label>
              <Input type="date" value={depositDate} onChange={(e) => setDepositDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Izoh</Label>
              <Input value={depositDesc} onChange={(e) => setDepositDesc(e.target.value)} placeholder="Oldindan to'lov..." />
            </div>
            {depositAmount && Number(depositAmount) > 0 && (
              <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Depozit: </span>
                <span className="font-bold text-blue-600">{formatCurrency(Number(depositAmount))}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDepositOpen(false)}>Bekor qilish</Button>
            <Button
              disabled={!depositFirm || !depositAmount || Number(depositAmount) <= 0 || depositMutation.isPending}
              onClick={() => depositMutation.mutate()}
            >
              {depositMutation.isPending ? 'Saqlanmoqda...' : "Qo'shish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Old debt dialog */}
      <Dialog open={oldDebtOpen} onOpenChange={(o) => { if (!o) { setOldDebtOpen(false); setOldDebtAmount(''); setOldDebtDesc('') } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Firma oldingi qarzini qo&apos;shish</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Firma nomi *</Label>
              <Input
                list="old-debt-firm-names"
                value={oldDebtFirm}
                onChange={(e) => setOldDebtFirm(e.target.value)}
                placeholder="Firma nomi..."
                autoComplete="off"
              />
              <datalist id="old-debt-firm-names">
                {allFirmNames.map(name => <option key={name} value={name} />)}
                {(firmNames as string[]).map((name: string) => <option key={name} value={name} />)}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label>Summa (so&apos;m) *</Label>
              <Input type="number" value={oldDebtAmount} onChange={(e) => setOldDebtAmount(e.target.value)} placeholder="5000000" />
            </div>
            <div className="space-y-1.5">
              <Label>Sana *</Label>
              <Input type="date" value={oldDebtDate} onChange={(e) => setOldDebtDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Izoh</Label>
              <Input value={oldDebtDesc} onChange={(e) => setOldDebtDesc(e.target.value)} placeholder="Oldingi qarz..." />
            </div>
            {oldDebtAmount && Number(oldDebtAmount) > 0 && (
              <div className="rounded-lg bg-red-50 dark:bg-red-950/20 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Oldingi qarz: </span>
                <span className="font-bold text-red-600">-{formatCurrency(Number(oldDebtAmount))}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOldDebtOpen(false)}>Bekor qilish</Button>
            <Button
              disabled={!oldDebtFirm || !oldDebtAmount || Number(oldDebtAmount) <= 0 || oldDebtMutation.isPending}
              onClick={() => oldDebtMutation.mutate()}
            >
              {oldDebtMutation.isPending ? 'Saqlanmoqda...' : "Qo'shish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add / Edit sale dialog */}
      <Dialog open={addSaleOpen} onOpenChange={(o) => { if (!o) { setAddSaleOpen(false); setEditSale(null) } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editSale ? 'Sotuvni tahrirlash' : "Perechisleniya sotuv qo'shish"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Firma nomi</Label>
                <Input
                  {...form.register('customerName')}
                  list="firm-names-list"
                  placeholder="Zamin zavod..."
                  autoComplete="off"
                />
                <datalist id="firm-names-list">
                  {allFirmNames.map(name => <option key={name} value={name} />)}
                  {(firmNames as string[]).map((name: string) => <option key={name} value={name} />)}
                </datalist>
              </div>
              <div className="space-y-2">
                <Label>Telefon</Label>
                <Input {...form.register('customerPhone')} placeholder="+998..." />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>To&apos;lov turi *</Label>
                <Select value={watchedPayType || 'BANK_TRANSFER'} onValueChange={(v) => form.setValue('paymentType', v as SaleForm['paymentType'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BANK_TRANSFER">Perechisleniya</SelectItem>
                    <SelectItem value="CASH">Naqd</SelectItem>
                    <SelectItem value="CARD">Karta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>G&apos;isht turi *</Label>
                <Select value={watchedBrickType || 'BAKED_BRICK'} onValueChange={(v) => form.setValue('brickType', v as BrickType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BAKED_BRICK">Pishgan g&apos;isht</SelectItem>
                    <SelectItem value="RAW_BRICK">Xom g&apos;isht</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!editSale && (
              <div className="space-y-2">
                <Label>Manba</Label>
                <Select value={watchedIsReserve ? 'true' : 'false'} onValueChange={(v) => form.setValue('isReserveSale', v === 'true')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="false">Asosiy ombordan</SelectItem>
                    <SelectItem value="true">Zaxiradan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Miqdor (dona) *</Label>
                <Input {...form.register('quantity')} type="number" placeholder="10000" />
                {form.formState.errors.quantity && <p className="text-destructive text-xs">{form.formState.errors.quantity.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Narx (1 dona, so&apos;m) *</Label>
                <Input {...form.register('pricePerBrick')} type="number" step="0.01" placeholder="450" />
                {form.formState.errors.pricePerBrick && <p className="text-destructive text-xs">{form.formState.errors.pricePerBrick.message}</p>}
              </div>
            </div>

            {totalSaleAmount > 0 && (
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2 text-sm">
                <span className="text-muted-foreground">Jami summa: </span>
                <span className="font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(totalSaleAmount)}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sana *</Label>
                <Input {...form.register('date')} type="date" />
              </div>
              <div className="space-y-2">
                <Label>Izoh</Label>
                <Input {...form.register('description')} placeholder="Qo'shimcha ma'lumot..." />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setAddSaleOpen(false); setEditSale(null) }}>Bekor qilish</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? 'Saqlanmoqda...' : editSale ? 'Saqlash' : "Qo'shish"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Sotuvni o'chirishni tasdiqlang"
        description="Ombor miqdori tiklanadi. Bu amalni qaytarib bo'lmaydi."
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        loading={deleteMutation.isPending}
      />

      <ConfirmDialog
        open={!!deleteDepositId}
        onOpenChange={(o) => !o && setDeleteDepositId(null)}
        title="Depozitni o'chirishni tasdiqlang"
        description="Bu amal orqaga qaytarib bo'lmaydi."
        onConfirm={() => deleteDepositId && deleteDepositMutation.mutate(deleteDepositId)}
        loading={deleteDepositMutation.isPending}
      />

      <ConfirmDialog
        open={!!deleteOldDebtId}
        onOpenChange={(o) => !o && setDeleteOldDebtId(null)}
        title="Oldingi qarzni o'chirishni tasdiqlang"
        description="Bu amal orqaga qaytarib bo'lmaydi."
        onConfirm={() => deleteOldDebtId && deleteOldDebtMutation.mutate(deleteOldDebtId)}
        loading={deleteOldDebtMutation.isPending}
      />
    </div>
  )
}
