'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Building2 } from 'lucide-react'
import { salesService } from '@/services/sales.service'
import type { BankTransferFirm } from '@/services/sales.service'
import { PageHeader } from '@/components/shared/page-header'
import { StatsCard } from '@/components/shared/stats-card'
import { DataTable } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatDate, formatCurrency, brickTypeLabel, brickTypeColor } from '@/lib/utils'
import type { Sale } from '@/types'

export default function PerechisleniyaPage() {
  const [selectedFirm, setSelectedFirm] = useState<BankTransferFirm | null>(null)

  const { data: firms = [], isLoading } = useQuery({
    queryKey: ['bank-transfer-firms'],
    queryFn: () => salesService.getBankTransferFirms(),
  })

  const totalFirms = firms.length
  const totalQuantity = firms.reduce((s, f) => s + f.totalQuantity, 0)
  const totalAmount = firms.reduce((s, f) => s + f.totalAmount, 0)

  const firmColumns = [
    {
      key: 'firmName',
      header: 'Firma nomi',
      cell: (row: BankTransferFirm) => (
        <span className="font-semibold">{row.firmName}</span>
      ),
    },
    {
      key: 'totalSales',
      header: 'Sotuvlar',
      cell: (row: BankTransferFirm) => (
        <span className="text-muted-foreground">{row.totalSales} ta</span>
      ),
    },
    {
      key: 'totalQuantity',
      header: "Jami g'isht",
      cell: (row: BankTransferFirm) => (
        <span className="font-medium">{row.totalQuantity.toLocaleString()} dona</span>
      ),
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
      cell: (r: Sale) => <span className="font-medium">{formatDate(r.date)}</span>,
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
      cell: (r: Sale) => <span>{r.quantity.toLocaleString()} dona</span>,
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
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Perechisleniya"
        description="Bank o'tkazmasi orqali sotuvlar va qarzdor firmalar"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard
          title="Jami firmalar"
          value={totalFirms}
          icon={Building2}
          color="purple"
          format="number"
          suffix="ta"
        />
        <StatsCard
          title="Jami g'isht"
          value={totalQuantity}
          icon={Building2}
          color="blue"
          format="number"
          suffix="dona"
        />
        <StatsCard
          title="Jami summa"
          value={totalAmount}
          icon={Building2}
          color="emerald"
        />
      </div>

      <Card>
        <CardContent className="p-4">
          {firms.length === 0 && !isLoading ? (
            <EmptyState
              icon={Building2}
              title="Perechisleniya sotuvlar yo'q"
              description="Sotuvlar bo'limida 'Perechisleniya' to'lov turi bilan sotuv qo'shing"
            />
          ) : (
            <DataTable
              columns={firmColumns}
              data={firms}
              loading={isLoading}
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedFirm} onOpenChange={(o) => !o && setSelectedFirm(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedFirm?.firmName} — sotuvlar tarixi</DialogTitle>
          </DialogHeader>
          {selectedFirm && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-muted p-3 text-center">
                  <div className="text-xs text-muted-foreground">Sotuvlar</div>
                  <div className="font-bold text-lg">{selectedFirm.totalSales} ta</div>
                </div>
                <div className="rounded-lg bg-muted p-3 text-center">
                  <div className="text-xs text-muted-foreground">Jami g&apos;isht</div>
                  <div className="font-bold text-lg">{selectedFirm.totalQuantity.toLocaleString()} dona</div>
                </div>
                <div className="rounded-lg bg-primary/10 p-3 text-center">
                  <div className="text-xs text-muted-foreground">Jami summa</div>
                  <div className="font-bold text-lg text-primary">{formatCurrency(selectedFirm.totalAmount)}</div>
                </div>
              </div>
              <DataTable
                columns={saleColumns}
                data={selectedFirm.sales}
                loading={false}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
