'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Receipt, Pencil, Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { expensesService } from '@/services/expenses.service'
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
import { cn, formatDate, formatCurrency, expenseCategoryLabel, expenseCategoryColor, getErrorMessage } from '@/lib/utils'
import { useDebounce } from '@/hooks/use-debounce'
import { usePagination } from '@/hooks/use-pagination'
import { useAuth } from '@/providers/auth-provider'
import type { Expense, ExpenseCategory } from '@/types'

const ALL_CATEGORIES: ExpenseCategory[] = [
  'GAS', 'ELECTRICITY', 'SALARY', 'TRANSPORT', 'MAINTENANCE',
  'COAL', 'SOIL', 'SPARE_PARTS', 'CONSTRUCTION', 'MEDICINE',
  'GREENHOUSE', 'MATERIAL_HELP', 'BANK_PAYMENT', 'ANIMAL_FEED', 'OTHER',
]

const schema = z.object({
  amount: z.coerce.number().min(0.01, "Summa 0 dan katta bo'lishi kerak"),
  category: z.string().min(1, 'Kategoriya tanlanishi shart'),
  description: z.string().optional(),
  date: z.string().min(1, 'Sana kiritilishi shart'),
})
type FormData = z.infer<typeof schema>

export default function ExpensesPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | 'ALL'>('ALL')
  const [filterDate, setFilterDate] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editItem, setEditItem] = useState<Expense | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const { page, limit, setPage } = usePagination()
  const debouncedSearch = useDebounce(search)

  const { data, isLoading } = useQuery({
    queryKey: ['expenses', page, limit, debouncedSearch, categoryFilter, filterDate],
    queryFn: () =>
      expensesService.getAll({
        page: filterDate ? 1 : page,
        limit: filterDate ? 500 : limit,
        search: debouncedSearch,
        category: categoryFilter !== 'ALL' ? categoryFilter : undefined,
        ...(filterDate ? { dateFrom: filterDate, dateTo: filterDate } : {}),
      }),
  })

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { date: new Date().toISOString().split('T')[0], category: 'OTHER' },
  })

  const createMutation = useMutation({
    mutationFn: (d: FormData) => expensesService.create(d as Parameters<typeof expensesService.create>[0]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success("Xarajat qo'shildi")
      setDialogOpen(false)
      reset({ date: new Date().toISOString().split('T')[0], category: 'OTHER' })
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const updateMutation = useMutation({
    mutationFn: (d: FormData) => expensesService.update(editItem!.id, d as Parameters<typeof expensesService.update>[1]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      toast.success('Xarajat yangilandi')
      setEditItem(null)
      setDialogOpen(false)
      reset()
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => expensesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      toast.success("Xarajat o'chirildi")
      setDeleteId(null)
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const openEdit = (item: Expense) => {
    setEditItem(item)
    setValue('amount', Number(item.amount))
    setValue('category', item.category)
    setValue('description', item.description || '')
    setValue('date', item.date)
    setDialogOpen(true)
  }

  const totalAmount = (data?.data ?? []).reduce((s: number, x: Expense) => s + Number(x.amount), 0)

  const columns = [
    { key: 'date', header: 'Sana', cell: (r: Expense) => <span className="font-medium">{formatDate(r.date)}</span> },
    {
      key: 'category',
      header: 'Kategoriya',
      cell: (r: Expense) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${expenseCategoryColor(r.category)}`}>
          {expenseCategoryLabel(r.category)}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Summa',
      cell: (r: Expense) => (
        <span className="font-semibold text-red-600 dark:text-red-400">{formatCurrency(Number(r.amount))}</span>
      ),
    },
    { key: 'description', header: 'Izoh', cell: (r: Expense) => <span className="text-muted-foreground text-sm">{r.description || '—'}</span> },
    { key: 'createdBy', header: "Qo'shgan", cell: (r: Expense) => <span className="text-sm">{r.createdBy?.fullName || '—'}</span> },
    {
      key: 'actions',
      header: '',
      cell: (r: Expense) => (
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
        title="Xarajatlar"
        description="Zavod xarajatlari boshqaruvi"
        actions={
          <Button onClick={() => { setEditItem(null); reset({ date: new Date().toISOString().split('T')[0], category: 'OTHER' }); setDialogOpen(true) }}>
            <Plus className="h-4 w-4 mr-1" /> Xarajat qo&apos;shish
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatsCard title="Jami xarajatlar" value={data?.meta?.total ?? 0} icon={Receipt} color="red" format="number" suffix="ta" />
        <StatsCard title="Jami summa" value={totalAmount} icon={Receipt} color="amber" />
      </div>

      {/* Category filter chips */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => { setCategoryFilter('ALL'); setPage(1) }}
          className={cn(
            'px-3 py-1.5 rounded-xl border text-xs font-medium transition-all',
            categoryFilter === 'ALL' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/50'
          )}
        >
          Barchasi
        </button>
        {ALL_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => { setCategoryFilter(cat); setPage(1) }}
            className={cn(
              'px-3 py-1.5 rounded-xl border text-xs font-medium transition-all',
              categoryFilter === cat ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/50'
            )}
          >
            {expenseCategoryLabel(cat)}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Izoh bo'yicha qidirish..." className="max-w-sm" />
            <Input type="date" value={filterDate} onChange={(e) => { setFilterDate(e.target.value); setPage(1) }} className="w-40" />
            {filterDate && (
              <Button variant="outline" size="sm" onClick={() => { setFilterDate(''); setPage(1) }}>✕ Tozalash</Button>
            )}
          </div>
          {data?.data.length === 0 && !isLoading ? (
            <EmptyState icon={Receipt} title="Xarajat yo'q" description="Birinchi xarajatni qo'shing" action={<Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-1" />Xarajat qo&apos;shish</Button>} />
          ) : (
            <>
              <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} />
              {data?.meta && <Pagination page={page} totalPages={data.meta.totalPages} total={data.meta.total} limit={limit} onPageChange={setPage} />}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editItem ? 'Xarajatni tahrirlash' : "Xarajat qo'shish"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit((d) => editItem ? updateMutation.mutate(d) : createMutation.mutate(d))} className="space-y-4">
            <div className="space-y-2">
              <Label>Summa *</Label>
              <Input {...register('amount')} type="number" step="0.01" placeholder="150000" />
              {errors.amount && <p className="text-destructive text-xs">{errors.amount.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Kategoriya *</Label>
              <Select defaultValue={editItem?.category ?? 'OTHER'} onValueChange={(v: string) => setValue('category', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ALL_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>{expenseCategoryLabel(cat)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && <p className="text-destructive text-xs">{errors.category.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Sana *</Label>
              <Input {...register('date')} type="date" />
              {errors.date && <p className="text-destructive text-xs">{errors.date.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Izoh</Label>
              <Input {...register('description')} placeholder="Xarajat ta'rifi..." />
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
        title="Xarajatni o'chirishni tasdiqlang"
        description="Bu amal orqaga qaytarib bo'lmaydi."
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
