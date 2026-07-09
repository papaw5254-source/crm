'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { HardHat, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { kilnService } from '@/services/kiln.service'
import { PageHeader } from '@/components/shared/page-header'
import { StatsCard } from '@/components/shared/stats-card'
import { DataTable } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/empty-state'
import { WorkerPaymentsPanel } from '@/components/shared/worker-payments-panel'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency, formatDate, formatNumber, getErrorMessage, kilnNameLabel } from '@/lib/utils'
import type { KilnName, KilnOperation } from '@/types'

const KILNS: KilnName[] = ['HUMBUZ_1', 'HUMBUZ_2', 'HUMBUZ_3']

export default function QachigarPage() {
  const queryClient = useQueryClient()
  const [kilnFilter, setKilnFilter] = useState<KilnName | 'ALL'>('ALL')
  const [dateFilter, setDateFilter] = useState('')
  const [editItem, setEditItem] = useState<KilnOperation | null>(null)
  const [rate, setRate] = useState('')
  const [paid, setPaid] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['qachigar-operations', kilnFilter, dateFilter],
    queryFn: () =>
      kilnService.getAll({
        page: 1,
        limit: 100,
        kilnName: kilnFilter !== 'ALL' ? kilnFilter : undefined,
        dateFrom: dateFilter || undefined,
        dateTo: dateFilter || undefined,
      }),
  })

  const allRows = Array.isArray(data)
    ? data
    : Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.data?.data)
        ? data.data.data
        : []

  const rows = allRows.filter((item: KilnOperation) => Number(item?.bakedBricksOutput || 0) > 0)

  const totalBaked = rows.reduce((sum: number, item: KilnOperation) => sum + Number(item.bakedBricksOutput || 0), 0)
  const totalAmount = rows.reduce((sum: number, item: KilnOperation) => sum + Number(item.qachigarTotalCost || 0), 0)
  const totalPaid = rows.reduce((sum: number, item: KilnOperation) => sum + Number(item.qachigarPaidAmount || 0), 0)
  const totalDebt = rows.reduce((sum: number, item: KilnOperation) => sum + Number(item.qachigarDebt || 0), 0)

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editItem) throw new Error('Operatsiya tanlanmagan')
      return kilnService.update(editItem.id, {
        qachigarRatePerBrick: Number(rate || 0),
        qachigarPaidAmount: Number(paid || 0),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qachigar-operations'] })
      queryClient.invalidateQueries({ queryKey: ['kiln-operations'] })
      queryClient.invalidateQueries({ queryKey: ['worker-payments-report'] })
      queryClient.invalidateQueries({ queryKey: ['worker-payments-panel'] })
      toast.success('Qachigar puli saqlandi')
      setEditItem(null)
      setRate('')
      setPaid('')
    },
    onError: (error: unknown) => toast.error(getErrorMessage(error)),
  })

  const openEdit = (item: KilnOperation) => {
    setEditItem(item)
    setRate(String(Number(item.qachigarRatePerBrick || 0)))
    setPaid(String(Number(item.qachigarPaidAmount || 0)))
  }

  const previewAmount = Number(editItem?.bakedBricksOutput || 0) * Number(rate || 0)
  const previewDebt = Math.max(0, previewAmount - Number(paid || 0))

  const columns = [
    { key: 'date', header: 'Sana', cell: (row: KilnOperation) => <span className="font-medium">{formatDate(row.date)}</span> },
    { key: 'kiln', header: 'Humbuz', cell: (row: KilnOperation) => <span>{kilnNameLabel(row.kilnName)}</span> },
    {
      key: 'baked',
      header: "Pishgan chiqdi",
      cell: (row: KilnOperation) => <span className="font-semibold text-emerald-600">{formatNumber(row.bakedBricksOutput)} dona</span>,
    },
    {
      key: 'rate',
      header: '1 dona narxi',
      cell: (row: KilnOperation) => <span>{Number(row.qachigarRatePerBrick || 0) > 0 ? formatCurrency(Number(row.qachigarRatePerBrick)) : '-'}</span>,
    },
    {
      key: 'amount',
      header: 'Hisoblandi',
      cell: (row: KilnOperation) => <span className="font-semibold">{formatCurrency(Number(row.qachigarTotalCost || 0))}</span>,
    },
    {
      key: 'paid',
      header: 'Berildi / qarz',
      cell: (row: KilnOperation) => (
        <div className="text-sm">
          <div className="text-emerald-600">{formatCurrency(Number(row.qachigarPaidAmount || 0))}</div>
          {Number(row.qachigarDebt || 0) > 0 && <div className="text-red-500">{formatCurrency(Number(row.qachigarDebt))}</div>}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      cell: (row: KilnOperation) => (
        <Button variant="ghost" size="icon-sm" onClick={() => openEdit(row)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Qachigar" description="Humbuzdan chiqqan pishgan g'isht uchun ishchi puli" />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatsCard title="Pishgan chiqdi" value={totalBaked} icon={HardHat} color="emerald" format="number" suffix="dona" />
        <StatsCard title="Hisoblandi" value={totalAmount} icon={HardHat} color="blue" />
        <StatsCard title="Berildi" value={totalPaid} icon={HardHat} color="emerald" />
        <StatsCard title="Qarz" value={totalDebt} icon={HardHat} color="red" />
      </div>

      <WorkerPaymentsPanel title="Ishchi puli (Qachigar)" categories={['QACHIGAR']} />

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={kilnFilter} onValueChange={(value) => setKilnFilter(value as KilnName | 'ALL')}>
              <SelectTrigger className="sm:w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Barcha humbuzlar</SelectItem>
                {KILNS.map((kiln) => <SelectItem key={kiln} value={kiln}>{kilnNameLabel(kiln)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} className="sm:w-[180px]" />
          </div>

          {rows.length === 0 && !isLoading ? (
            <EmptyState icon={HardHat} title="Pishgan g'isht chiqmagan" description="Tanlangan sana yoki humbuz bo'yicha pishgan g'isht topilmadi" />
          ) : (
            <DataTable columns={columns} data={rows} loading={isLoading} />
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Qachigar pulini kiritish</DialogTitle>
          </DialogHeader>
          {editItem && (
            <div className="space-y-4">
              <div className="rounded-md bg-muted px-3 py-2 text-sm">
                <div className="font-medium">{kilnNameLabel(editItem.kilnName)} · {formatDate(editItem.date)}</div>
                <div className="text-muted-foreground">Pishgan chiqdi: {formatNumber(editItem.bakedBricksOutput)} dona</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>1 dona narxi</Label>
                  <Input type="number" value={rate} onChange={(event) => setRate(event.target.value)} placeholder="10" />
                </div>
                <div className="space-y-2">
                  <Label>Berildi</Label>
                  <Input type="number" value={paid} onChange={(event) => setPaid(event.target.value)} placeholder="0" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="rounded-md bg-muted px-3 py-2 text-center">
                  <div className="text-xs text-muted-foreground">Hisoblandi</div>
                  <div className="font-semibold">{formatCurrency(previewAmount)}</div>
                </div>
                <div className="rounded-md bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 text-center">
                  <div className="text-xs text-muted-foreground">Berildi</div>
                  <div className="font-semibold text-emerald-600">{formatCurrency(Number(paid || 0))}</div>
                </div>
                <div className="rounded-md bg-red-50 dark:bg-red-900/20 px-3 py-2 text-center">
                  <div className="text-xs text-muted-foreground">Qarz</div>
                  <div className="font-semibold text-red-500">{formatCurrency(previewDebt)}</div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditItem(null)}>Bekor qilish</Button>
            <Button type="button" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate()}>
              {updateMutation.isPending ? 'Saqlanmoqda...' : 'Saqlash'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
