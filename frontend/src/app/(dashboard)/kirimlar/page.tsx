'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Banknote, Pencil, Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { moneyIncomesService } from '@/services/money-incomes.service'
import { PageHeader } from '@/components/shared/page-header'
import { StatsCard } from '@/components/shared/stats-card'
import { DataTable } from '@/components/shared/data-table'
import { SearchInput } from '@/components/shared/search-input'
import { Pagination } from '@/components/shared/pagination'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { cn, formatDate, formatCurrency, moneyIncomeSourceLabel, moneyIncomeSourceColor, getErrorMessage } from '@/lib/utils'
import { useDebounce } from '@/hooks/use-debounce'
import { usePagination } from '@/hooks/use-pagination'
import { useAuth } from '@/providers/auth-provider'
import type { MoneyIncome, MoneyIncomeSource } from '@/types'

const SOURCES: MoneyIncomeSource[] = ['FOUNDER', 'BANK', 'DEBT_RETURN', 'OTHER']

const schema = z.object({
  amount: z.coerce.number().min(0.01, "Summa 0 dan katta bo'lishi kerak"),
  source: z.enum(['FOUNDER', 'BANK', 'DEBT_RETURN', 'OTHER']),
  fromWhom: z.string().optional(),
  description: z.string().optional(),
  date: z.string().min(1, 'Sana kiritilishi shart'),
})
type FormData = z.infer<typeof schema>

export default function KirimlarPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState<MoneyIncomeSource | 'ALL'>('ALL')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editItem, setEditItem] = useState<MoneyIncome | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const { page, limit, setPage } = usePagination()
  const debouncedSearch = useDebounce(search)

  const { data, isLoading } = useQuery({
    queryKey: ['money-incomes', page, limit, debouncedSearch, sourceFilter],
    queryFn: () =>
      moneyIncomesService.getAll({
        page,
        limit,
        search: debouncedSearch,
        source: sourceFilter !== 'ALL' ? sourceFilter : undefined,
      }),
  })

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { date: new Date().toISOString().split('T')[0], source: 'OTHER' },
  })

  const createMutation = useMutation({
    mutationFn: (d: FormData) => moneyIncomesService.create(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['money-incomes'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success("Kirim qo'shildi")
      setDialogOpen(false)
      reset({ date: new Date().toISOString().split('T')[0], source: 'OTHER' })
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const updateMutation = useMutation({
    mutationFn: (d: FormData) => moneyIncomesService.update(editItem!.id, d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['money-incomes'] })
      toast.success('Kirim yangilandi')
      setEditItem(null)
      setDialogOpen(false)
      reset()
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => moneyIncomesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['money-incomes'] })
      toast.success("Kirim o'chirildi")
      setDeleteId(null)
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const openEdit = (item: MoneyIncome) => {
    setEditItem(item)
    setValue('amount', Number(item.amount))
    setValue('source', item.source)
    setValue('fromWhom', item.fromWhom || '')
    setValue('description', item.description || '')
    setValue('date', item.date)
    setDialogOpen(true)
  }

  const totalAmount = (data?.data ?? []).reduce((s: number, x: MoneyIncome) => s + Number(x.amount), 0)

  const columns = [
    { key: 'date', header: 'Sana', cell: (r: MoneyIncome) => <span className="font-medium">{formatDate(r.date)}</span> },
    {
      key: 'source',
      header: 'Manba',
      cell: (r: MoneyIncome) => (
        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${moneyIncomeSourceColor(r.source)}`}>
          {moneyIncomeSourceLabel(r.source)}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Summa',
      cell: (r: MoneyIncome) => (
        <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(Number(r.amount))}</span>
      ),
    },
    { key: 'fromWhom', header: 'Kimdan', cell: (r: MoneyIncome) => <span className="text-sm">{r.fromWhom || '—'}</span> },
    { key: 'desc', header: 'Izoh', cell: (r: MoneyIncome) => <span className="text-sm text-muted-foreground">{r.description || '—'}</span> },
    {
      key: 'actions',
      header: '',
      cell: (r: MoneyIncome) => (
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pul kirimlari"
        description="Sotuvsiz pul kirimlari boshqaruvi"
        actions={
          <Button onClick={() => { setEditItem(null); reset({ date: new Date().toISOString().split('T')[0], source: 'OTHER' }); setDialogOpen(true) }}>
            <Plus className="h-4 w-4 mr-1" /> Kirim qo&apos;shish
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatsCard title="Jami kirimlar" value={data?.meta.total ?? 0} icon={Banknote} color="emerald" format="number" suffix="ta" />
        <StatsCard title="Jami summa" value={totalAmount} icon={Banknote} color="blue" />
      </div>

      {/* Source filter chips */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => { setSourceFilter('ALL'); setPage(1) }}
          className={cn(
            'px-3 py-1.5 rounded-xl border text-xs font-medium transition-all',
            sourceFilter === 'ALL' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/50'
          )}
        >
          Barchasi
        </button>
        {SOURCES.map((s) => (
          <button
            key={s}
            onClick={() => { setSourceFilter(s); setPage(1) }}
            className={cn(
              'px-3 py-1.5 rounded-xl border text-xs font-medium transition-all',
              sourceFilter === s ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/50'
            )}
          >
            {moneyIncomeSourceLabel(s)}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Kimdan yoki izoh bo'yicha..." className="max-w-sm" />
          {(data?.data ?? []).length === 0 && !isLoading ? (
            <EmptyState icon={Banknote} title="Kirim yo'q" description="Birinchi kirimni qo'shing" action={<Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-1" />Kirim qo&apos;shish</Button>} />
          ) : (
            <>
              <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} />
              {data && <Pagination page={page} totalPages={data.meta.totalPages} total={data.meta.total} limit={limit} onPageChange={setPage} />}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editItem ? 'Kirimni tahrirlash' : "Kirim qo'shish"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit((d) => editItem ? updateMutation.mutate(d) : createMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Summa *</Label>
                <Input {...register('amount')} type="number" step="0.01" placeholder="1000000" />
                {errors.amount && <p className="text-destructive text-xs">{errors.amount.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Manba *</Label>
                <Select defaultValue={editItem?.source ?? 'OTHER'} onValueChange={(v: string) => setValue('source', v as MoneyIncomeSource)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SOURCES.map((s) => <SelectItem key={s} value={s}>{moneyIncomeSourceLabel(s)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Kimdan</Label>
              <Input {...register('fromWhom')} placeholder="Shaxs yoki tashkilot nomi" />
            </div>
            <div className="space-y-2">
              <Label>Sana *</Label>
              <Input {...register('date')} type="date" />
              {errors.date && <p className="text-destructive text-xs">{errors.date.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Izoh</Label>
              <Input {...register('description')} placeholder="Qo'shimcha ma'lumot..." />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Bekor qilish</Button>
              <Button type="submit" disabled={isSubmitting || createMutation.isPending || updateMutation.isPending}>
                {isSubmitting || createMutation.isPending || updateMutation.isPending ? 'Saqlanmoqda...' : editItem ? 'Saqlash' : "Qo'shish"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Kirimni o'chirishni tasdiqlang"
        description="Bu amal orqaga qaytarib bo'lmaydi."
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
