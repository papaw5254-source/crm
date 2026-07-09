'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, Plus, Pencil, Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { salesService } from '@/services/sales.service'
import type { BankTransferFirm } from '@/services/sales.service'
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
import { formatDate, formatCurrency, formatNumber, brickTypeLabel, brickTypeColor, getErrorMessage } from '@/lib/utils'
import { useAuth } from '@/providers/auth-provider'
import type { Sale, BrickType } from '@/types'

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
  const [selectedFirm, setSelectedFirm] = useState<BankTransferFirm | null>(null)
  const [addSaleOpen, setAddSaleOpen] = useState(false)
  const [editSale, setEditSale] = useState<Sale | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data: firms = [], isLoading } = useQuery({
    queryKey: ['bank-transfer-firms'],
    queryFn: () => salesService.getBankTransferFirms(),
  })

  const { data: firmNames = [] } = useQuery({
    queryKey: ['firm-names'],
    queryFn: () => salesService.getFirmNames(),
  })

  const { data: firmSales = [], isLoading: firmSalesLoading } = useQuery({
    queryKey: ['firm-sales', selectedFirm?.firmName, 'BANK_TRANSFER'],
    queryFn: () => salesService.getFirmSales(selectedFirm!.firmName, 'BANK_TRANSFER'),
    enabled: !!selectedFirm,
  })

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

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['bank-transfer-firms'] })
    queryClient.invalidateQueries({ queryKey: ['firm-names'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    queryClient.invalidateQueries({ queryKey: ['stock'] })
  }

  const createMutation = useMutation({
    mutationFn: (d: SaleForm) => salesService.create(d as Parameters<typeof salesService.create>[0]),
    onSuccess: () => {
      invalidate()
      toast.success("Sotuv qo'shildi")
      setAddSaleOpen(false)
      form.reset(defaultFormValues)
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const updateMutation = useMutation({
    mutationFn: (d: SaleForm) => salesService.update(editSale!.id, d as Parameters<typeof salesService.create>[0]),
    onSuccess: () => {
      invalidate()
      queryClient.invalidateQueries({ queryKey: ['firm-sales', selectedFirm?.firmName, 'BANK_TRANSFER'] })
      toast.success('Sotuv yangilandi')
      setAddSaleOpen(false)
      setEditSale(null)
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => salesService.delete(id),
    onSuccess: () => {
      invalidate()
      queryClient.invalidateQueries({ queryKey: ['firm-sales', selectedFirm?.firmName, 'BANK_TRANSFER'] })
      toast.success("Sotuv o'chirildi")
      setDeleteId(null)
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const openAdd = () => {
    setEditSale(null)
    form.reset(defaultFormValues)
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

  const totalFirms = firms.length
  const totalAmount = firms.reduce((s: number, f: BankTransferFirm) => s + f.totalAmount, 0)
  const totalQty = firms.reduce((s: number, f: BankTransferFirm) => s + f.totalQuantity, 0)

  const firmColumns = [
    {
      key: 'firmName',
      header: 'Firma nomi',
      cell: (row: BankTransferFirm) => <span className="font-semibold">{row.firmName}</span>,
    },
    {
      key: 'totalSales',
      header: 'Sotuvlar',
      cell: (row: BankTransferFirm) => <span className="text-muted-foreground">{row.totalSales} marta</span>,
    },
    {
      key: 'totalQuantity',
      header: "Jami g'isht",
      cell: (row: BankTransferFirm) => <span className="font-medium">{formatNumber(row.totalQuantity)} dona</span>,
    },
    {
      key: 'totalAmount',
      header: 'Jami summa',
      cell: (row: BankTransferFirm) => (
        <span className="font-semibold text-primary">{formatCurrency(row.totalAmount)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      cell: (row: BankTransferFirm) => (
        <Button variant="outline" size="sm" onClick={() => setSelectedFirm(row)}>
          Ko&apos;rish
        </Button>
      ),
    },
  ]

  const saleColumns = [
    {
      key: 'date',
      header: 'Sana',
      cell: (r: Sale) => <span className="font-semibold">{formatDate(r.date)}</span>,
    },
    {
      key: 'brickType',
      header: "G'isht turi",
      cell: (r: Sale) => (
        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${brickTypeColor(r.brickType ?? 'BAKED_BRICK')}`}>
          {brickTypeLabel(r.brickType ?? 'BAKED_BRICK')}
        </span>
      ),
    },
    {
      key: 'quantity',
      header: 'Miqdor',
      cell: (r: Sale) => <span className="font-bold text-base">{formatNumber(r.quantity)} dona</span>,
    },
    {
      key: 'pricePerBrick',
      header: 'Narx',
      cell: (r: Sale) => <span>{formatCurrency(Number(r.pricePerBrick))}</span>,
    },
    {
      key: 'totalAmount',
      header: 'Jami',
      cell: (r: Sale) => <span className="font-semibold text-primary">{formatCurrency(Number(r.totalAmount))}</span>,
    },
    {
      key: 'desc',
      header: 'Izoh',
      cell: (r: Sale) => <span className="text-xs text-muted-foreground">{r.description || '—'}</span>,
    },
    {
      key: 'actions',
      header: '',
      cell: (r: Sale) => (
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
        title="Perechisleniya"
        description="Bank o'tkazmasi orqali sotuvlar"
        actions={
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4 mr-1" /> Sotuv qo&apos;shish
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard title="Firmalar soni" value={totalFirms} icon={Building2} color="purple" format="number" suffix="ta" />
        <StatsCard title="Jami g'isht" value={totalQty} icon={Building2} color="blue" format="number" suffix="dona" />
        <StatsCard title="Jami summa" value={totalAmount} icon={Building2} color="emerald" />
      </div>

      <Card>
        <CardContent className="p-4">
          {firms.length === 0 && !isLoading ? (
            <EmptyState
              icon={Building2}
              title="Perechisleniya sotuvlar yo'q"
              description="Bank o'tkazmasi to'lov turi bilan sotuv qo'shing"
              action={<Button onClick={openAdd}><Plus className="h-4 w-4 mr-1" />Sotuv qo&apos;shish</Button>}
            />
          ) : (
            <DataTable columns={firmColumns} data={firms} loading={isLoading} />
          )}
        </CardContent>
      </Card>

      {/* Firma detail dialog */}
      <Dialog open={!!selectedFirm} onOpenChange={(o: boolean) => !o && setSelectedFirm(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">{selectedFirm?.firmName}</DialogTitle>
          </DialogHeader>
          {selectedFirm && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-muted p-3 text-center">
                  <div className="text-xs text-muted-foreground mb-1">Sotuvlar soni</div>
                  <div className="font-bold text-xl">{selectedFirm.totalSales} ta</div>
                </div>
                <div className="rounded-lg bg-muted p-3 text-center">
                  <div className="text-xs text-muted-foreground mb-1">Jami g&apos;isht</div>
                  <div className="font-bold text-xl">{formatNumber(selectedFirm.totalQuantity)} dona</div>
                </div>
                <div className="rounded-lg bg-primary/10 p-3 text-center">
                  <div className="text-xs text-muted-foreground mb-1">Jami summa</div>
                  <div className="font-bold text-xl text-primary">{formatCurrency(selectedFirm.totalAmount)}</div>
                </div>
              </div>
              <div className="max-h-[420px] overflow-y-auto rounded-lg border">
                <DataTable columns={saleColumns} data={firmSales} loading={firmSalesLoading} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add / Edit sale dialog */}
      <Dialog open={addSaleOpen} onOpenChange={(o: boolean) => { if (!o) { setAddSaleOpen(false); setEditSale(null) } }}>
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
                  {firmNames.map((name: string) => (
                    <option key={name} value={name} />
                  ))}
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
                <Select value={watchedPayType || 'BANK_TRANSFER'} onValueChange={(v: string) => form.setValue('paymentType', v as SaleForm['paymentType'])}>
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
                <Select value={watchedBrickType || 'BAKED_BRICK'} onValueChange={(v: string) => form.setValue('brickType', v as BrickType)}>
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
                <Select value={watchedIsReserve ? 'true' : 'false'} onValueChange={(v: string) => form.setValue('isReserveSale', v === 'true')}>
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
                {form.formState.errors.quantity && (
                  <p className="text-destructive text-xs">{form.formState.errors.quantity.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Narx (1 dona, so&apos;m) *</Label>
                <Input {...form.register('pricePerBrick')} type="number" step="0.01" placeholder="450" />
                {form.formState.errors.pricePerBrick && (
                  <p className="text-destructive text-xs">{form.formState.errors.pricePerBrick.message}</p>
                )}
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
        onOpenChange={(o: boolean) => !o && setDeleteId(null)}
        title="Sotuvni o'chirishni tasdiqlang"
        description="Ombor miqdori tiklanadi. Bu amalni qaytarib bo'lmaydi."
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
