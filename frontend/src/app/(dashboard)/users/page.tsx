'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, UserCog, Pencil, Trash2, Shield, User as UserIcon } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { usersService } from '@/services/users.service'
import { PageHeader } from '@/components/shared/page-header'
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
import { Badge } from '@/components/ui/badge'
import { formatDate, getErrorMessage } from '@/lib/utils'
import { useDebounce } from '@/hooks/use-debounce'
import { usePagination } from '@/hooks/use-pagination'
import { useAuth } from '@/providers/auth-provider'
import type { User, UserRole } from '@/types'

const createSchema = z.object({
  username: z.string().min(3, "Kamida 3 ta belgi"),
  fullName: z.string().min(2, "To'liq ism kiritilishi shart"),
  password: z.string().min(6, "Kamida 6 ta belgi"),
  role: z.enum(['ADMIN', 'EMPLOYEE']),
})

const editSchema = z.object({
  fullName: z.string().min(2, "To'liq ism kiritilishi shart"),
  role: z.enum(['ADMIN', 'EMPLOYEE']),
  isActive: z.boolean(),
  password: z.string().optional(),
})

type CreateForm = z.infer<typeof createSchema>
type EditForm = z.infer<typeof editSchema>

export default function UsersPage() {
  const { user: currentUser } = useAuth()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editItem, setEditItem] = useState<User | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const { page, limit, setPage } = usePagination()
  const debouncedSearch = useDebounce(search)

  const { data, isLoading } = useQuery({
    queryKey: ['users', page, limit, debouncedSearch],
    queryFn: () => usersService.getAll({ page, limit, search: debouncedSearch }),
  })

  const createForm = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { role: 'EMPLOYEE' },
  })

  const editForm = useForm<EditForm>({
    resolver: zodResolver(editSchema),
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateForm) => usersService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success("Foydalanuvchi qo'shildi")
      setCreateOpen(false)
      createForm.reset()
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const updateMutation = useMutation({
    mutationFn: (data: EditForm) => usersService.update(editItem!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('Foydalanuvchi yangilandi')
      setEditItem(null)
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success("Foydalanuvchi o'chirildi")
      setDeleteId(null)
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const openEdit = (u: User) => {
    setEditItem(u)
    editForm.setValue('fullName', u.fullName)
    editForm.setValue('role', u.role)
    editForm.setValue('isActive', u.isActive)
    editForm.setValue('password', '')
  }

  const columns = [
    {
      key: 'user',
      header: 'Foydalanuvchi',
      cell: (u: User) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
            {u.fullName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-sm">{u.fullName}</p>
            <p className="text-xs text-muted-foreground">@{u.username}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Rol',
      cell: (u: User) => (
        <div className="flex items-center gap-2">
          {u.role === 'ADMIN' ? (
            <Shield className="h-4 w-4 text-primary" />
          ) : (
            <UserIcon className="h-4 w-4 text-muted-foreground" />
          )}
          <Badge variant={u.role === 'ADMIN' ? 'default' : 'secondary'}>
            {u.role === 'ADMIN' ? 'Admin' : 'Xodim'}
          </Badge>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Holat',
      cell: (u: User) => (
        <Badge variant={u.isActive ? 'success' : 'destructive'}>
          {u.isActive ? 'Faol' : 'Bloklangan'}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      header: "Qo'shilgan",
      cell: (u: User) => <span className="text-sm text-muted-foreground">{formatDate(u.createdAt)}</span>,
    },
    {
      key: 'actions',
      header: '',
      cell: (u: User) => (
        <div className="flex gap-1 justify-end">
          <Button variant="ghost" size="icon-sm" onClick={() => openEdit(u)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          {u.id !== currentUser?.id && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleteId(u.id)}
            >
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
        title="Foydalanuvchilar"
        description="Tizim foydalanuvchilari boshqaruvi"
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Foydalanuvchi qo&apos;shish
          </Button>
        }
      />

      <Card>
        <CardContent className="p-4 space-y-4">
          <SearchInput
            value={search}
            onChange={(v) => { setSearch(v); setPage(1) }}
            placeholder="Ism yoki username bo'yicha..."
            className="max-w-sm"
          />

          {data?.data.length === 0 && !isLoading ? (
            <EmptyState icon={UserCog} title="Foydalanuvchi yo'q" description="Birinchi foydalanuvchini qo'shing" />
          ) : (
            <>
              <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} />
              {data && <Pagination page={page} totalPages={data.meta.totalPages} total={data.meta.total} limit={limit} onPageChange={setPage} />}
            </>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Foydalanuvchi qo&apos;shish</DialogTitle>
          </DialogHeader>
          <form onSubmit={createForm.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
            <div className="space-y-2">
              <Label>To&apos;liq ism *</Label>
              <Input {...createForm.register('fullName')} placeholder="Ahmadjon Karimov" />
              {createForm.formState.errors.fullName && <p className="text-destructive text-xs">{createForm.formState.errors.fullName.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Username *</Label>
              <Input {...createForm.register('username')} placeholder="ahmadjon" />
              {createForm.formState.errors.username && <p className="text-destructive text-xs">{createForm.formState.errors.username.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Parol *</Label>
              <Input {...createForm.register('password')} type="password" placeholder="••••••••" />
              {createForm.formState.errors.password && <p className="text-destructive text-xs">{createForm.formState.errors.password.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Rol *</Label>
              <Select defaultValue="EMPLOYEE" onValueChange={(v: string) => createForm.setValue('role', v as UserRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EMPLOYEE">Xodim</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Bekor qilish</Button>
              <Button type="submit" loading={createMutation.isPending}>Qo&apos;shish</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editItem} onOpenChange={(o: boolean) => !o && setEditItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Foydalanuvchini tahrirlash — {editItem?.username}</DialogTitle>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit((d) => updateMutation.mutate(d))} className="space-y-4">
            <div className="space-y-2">
              <Label>To&apos;liq ism *</Label>
              <Input {...editForm.register('fullName')} />
              {editForm.formState.errors.fullName && <p className="text-destructive text-xs">{editForm.formState.errors.fullName.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Rol *</Label>
              <Select
                value={editForm.watch('role')}
                onValueChange={(v: string) => editForm.setValue('role', v as UserRole)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EMPLOYEE">Xodim</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Holat</Label>
              <Select
                value={editForm.watch('isActive') ? 'true' : 'false'}
                onValueChange={(v: string) => editForm.setValue('isActive', v === 'true')}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Faol</SelectItem>
                  <SelectItem value="false">Bloklangan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Yangi parol (ixtiyoriy)</Label>
              <Input {...editForm.register('password')} type="password" placeholder="O'zgartirish uchun kiriting" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditItem(null)}>Bekor qilish</Button>
              <Button type="submit" loading={updateMutation.isPending}>Saqlash</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Foydalanuvchini o'chirishni tasdiqlang"
        description="Bu foydalanuvchi tizimdan chiqariladi."
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
