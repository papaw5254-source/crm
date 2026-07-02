'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Warehouse, ArrowUp, ArrowDown } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { reserveService } from '@/services/reserve.service'
import { PageHeader } from '@/components/shared/page-header'
import { StatsCard } from '@/components/shared/stats-card'
import { DataTable } from '@/components/shared/data-table'
import { Pagination } from '@/components/shared/pagination'
import { EmptyState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn, formatDate, formatNumber, brickTypeLabel, brickTypeColor, reserveMovementTypeLabel, reserveMovementTypeColor, getErrorMessage } from '@/lib/utils'
import { usePagination } from '@/hooks/use-pagination'
import type { ReserveMovement, BrickType, ReserveMovementType } from '@/types'

const schema = z.object({
  brickType: z.enum(['RAW_BRICK', 'BAKED_BRICK']),
  movementType: z.enum(['ADD', 'REMOVE', 'SALE', 'TO_KILN', 'ADJUSTMENT']),
  quantity: z.coerce.number().min(1, "Miqdor 0 dan katta bo'lishi kerak"),
  reason: z.string().optional(),
  date: z.string().min(1, 'Sana kiritilishi shart'),
})
type FormData = z.infer<typeof schema>

const MOVEMENT_TYPES: ReserveMovementType[] = ['ADD', 'REMOVE', 'SALE', 'TO_KILN', 'ADJUSTMENT']

export default function ZaxiraPage() {
  const queryClient = useQueryClient()
  const [brickTypeFilter, setBrickTypeFilter] = useState<BrickType | 'ALL'>('ALL')
  const [dialogOpen, setDialogOpen] = useState(false)
  const { page, limit, setPage } = usePagination()

  const { data: balance, isLoading: balanceLoading } = useQuery({
    queryKey: ['reserve-balance'],
    queryFn: reserveService.getBalance,
    refetchInterval: 30000,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['reserve-movements', page, limit, brickTypeFilter],
    queryFn: () =>
      reserveService.getAll({
        page,
        limit,
        brickType: brickTypeFilter !== 'ALL' ? brickTypeFilter : undefined,
      }),
  })

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { date: new Date().toISOString().split('T')[0], brickType: 'RAW_BRICK', movementType: 'ADD' },
  })

  const createMutation = useMutation({
    mutationFn: (d: FormData) => reserveService.create(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reserve-movements'] })
      queryClient.invalidateQueries({ queryKey: ['reserve-balance'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success("Zaxira harakati qo'shildi")
      setDialogOpen(false)
      reset({ date: new Date().toISOString().split('T')[0], brickType: 'RAW_BRICK', movementType: 'ADD' })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const columns = [
    { key: 'date', header: 'Sana', cell: (r: ReserveMovement) => <span className="font-medium">{formatDate(r.date)}</span> },
    {
      key: 'brickType',
      header: "G'isht turi",
      cell: (r: ReserveMovement) => (
        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${brickTypeColor(r.brickType)}`}>
          {brickTypeLabel(r.brickType)}
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Harakat',
      cell: (r: ReserveMovement) => (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${reserveMovementTypeColor(r.movementType)}`}>
          {r.movementType === 'ADD' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
          {reserveMovementTypeLabel(r.movementType)}
        </span>
      ),
    },
    {
      key: 'qty',
      header: 'Miqdor',
      cell: (r: ReserveMovement) => (
        <span className={cn('font-semibold', r.movementType === 'ADD' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
          {r.movementType === 'ADD' ? '+' : '-'}{formatNumber(r.quantity)} dona
        </span>
      ),
    },
    {
      key: 'prev',
      header: 'Avvalgi',
      cell: (r: ReserveMovement) => <span className="text-sm text-muted-foreground">{formatNumber(r.previousQuantity)}</span>,
    },
    {
      key: 'new',
      header: 'Yangi',
      cell: (r: ReserveMovement) => <span className="font-medium">{formatNumber(r.newQuantity)}</span>,
    },
    { key: 'reason', header: 'Sabab', cell: (r: ReserveMovement) => <span className="text-sm text-muted-foreground">{r.reason || '—'}</span> },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Zaxira boshqaruvi"
        description="Xom va pishgan g'isht zaxirasi"
        actions={
          <Button onClick={() => { reset({ date: new Date().toISOString().split('T')[0], brickType: 'RAW_BRICK', movementType: 'ADD' }); setDialogOpen(true) }}>
            <Plus className="h-4 w-4 mr-1" /> Harakat qo&apos;shish
          </Button>
        }
      />

      {/* Balance Cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="relative overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Xom g&apos;isht zaxirasi</CardTitle>
          </CardHeader>
          <CardContent>
            {balanceLoading ? (
              <div className="h-8 w-32 bg-muted animate-pulse rounded" />
            ) : (
              <>
                <p className="text-3xl font-bold">{formatNumber(balance?.rawBrick ?? 0)}</p>
                <p className="text-sm text-muted-foreground mt-0.5">dona</p>
              </>
            )}
            <div className="absolute right-4 top-4 h-12 w-12 flex items-center justify-center rounded-xl bg-orange-100 dark:bg-orange-900/30">
              <Warehouse className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Pishgan g&apos;isht zaxirasi</CardTitle>
          </CardHeader>
          <CardContent>
            {balanceLoading ? (
              <div className="h-8 w-32 bg-muted animate-pulse rounded" />
            ) : (
              <>
                <p className="text-3xl font-bold">{formatNumber(balance?.bakedBrick ?? 0)}</p>
                <p className="text-sm text-muted-foreground mt-0.5">dona</p>
              </>
            )}
            <div className="absolute right-4 top-4 h-12 w-12 flex items-center justify-center rounded-xl bg-red-100 dark:bg-red-900/30">
              <Warehouse className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatsCard title="Jami harakatlar" value={data?.meta.total ?? 0} icon={Warehouse} color="blue" format="number" suffix="ta" />
        <StatsCard title="Jami zaxira" value={(balance?.rawBrick ?? 0) + (balance?.bakedBrick ?? 0)} icon={Warehouse} color="emerald" format="number" suffix="dona" />
      </div>

      {/* Filter tabs */}
      <Tabs value={brickTypeFilter} onValueChange={(v) => { setBrickTypeFilter(v as BrickType | 'ALL'); setPage(1) }}>
        <TabsList>
          <TabsTrigger value="ALL">Barchasi</TabsTrigger>
          <TabsTrigger value="RAW_BRICK">Xom g&apos;isht</TabsTrigger>
          <TabsTrigger value="BAKED_BRICK">Pishgan g&apos;isht</TabsTrigger>
        </TabsList>

        <TabsContent value={brickTypeFilter} className="mt-4">
          <Card>
            <CardContent className="p-4">
              {(data?.data ?? []).length === 0 && !isLoading ? (
                <EmptyState
                  icon={Warehouse}
                  title="Harakat yo'q"
                  description="Birinchi zaxira harakatini qo'shing"
                  action={<Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-1" />Harakat qo&apos;shish</Button>}
                />
              ) : (
                <>
                  <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} />
                  {data && <Pagination page={page} totalPages={data.meta.totalPages} total={data.meta.total} limit={limit} onPageChange={setPage} />}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Zaxira harakati qo&apos;shish</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>G&apos;isht turi *</Label>
                <Select defaultValue="RAW_BRICK" onValueChange={(v) => setValue('brickType', v as BrickType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RAW_BRICK">Xom g&apos;isht</SelectItem>
                    <SelectItem value="BAKED_BRICK">Pishgan g&apos;isht</SelectItem>
                  </SelectContent>
                </Select>
                {errors.brickType && <p className="text-destructive text-xs">{errors.brickType.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Harakat turi *</Label>
                <Select defaultValue="ADD" onValueChange={(v) => setValue('movementType', v as ReserveMovementType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MOVEMENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{reserveMovementTypeLabel(t)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.movementType && <p className="text-destructive text-xs">{errors.movementType.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Miqdor (dona) *</Label>
                <Input {...register('quantity')} type="number" placeholder="1000" />
                {errors.quantity && <p className="text-destructive text-xs">{errors.quantity.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Sana *</Label>
                <Input {...register('date')} type="date" />
                {errors.date && <p className="text-destructive text-xs">{errors.date.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Sabab / Izoh</Label>
              <Input {...register('reason')} placeholder="Harakat sababi..." />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Bekor qilish</Button>
              <Button type="submit" disabled={isSubmitting || createMutation.isPending}>
                {isSubmitting || createMutation.isPending ? 'Saqlanmoqda...' : "Qo'shish"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
