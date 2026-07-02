'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { User, Lock, Shield } from 'lucide-react'
import { usersService } from '@/services/users.service'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getErrorMessage } from '@/lib/utils'
import { useAuth } from '@/providers/auth-provider'

const profileSchema = z.object({
  fullName: z.string().min(2, "To'liq ism kiritilishi shart"),
})

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Joriy parol kiritilishi shart'),
  newPassword: z.string().min(6, 'Yangi parol kamida 6 ta belgi'),
  confirmPassword: z.string().min(1, 'Parolni tasdiqlang'),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: 'Parollar mos kelmadi',
  path: ['confirmPassword'],
})

type ProfileForm = z.infer<typeof profileSchema>
type PasswordForm = z.infer<typeof passwordSchema>

export default function ProfilePage() {
  const { user, refreshUser } = useAuth()

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName: user?.fullName ?? '' },
  })

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  })

  const updateProfileMutation = useMutation({
    mutationFn: (data: ProfileForm) => usersService.updateProfile(data),
    onSuccess: async () => {
      await refreshUser()
      toast.success('Profil yangilandi')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const changePasswordMutation = useMutation({
    mutationFn: (data: PasswordForm) => usersService.changePassword(data),
    onSuccess: () => {
      toast.success('Parol muvaffaqiyatli o\'zgartirildi')
      passwordForm.reset()
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Profil"
        description="Shaxsiy ma'lumotlaringizni boshqaring"
      />

      {/* Avatar card */}
      <Card>
        <CardContent className="p-6 flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary text-3xl font-bold">
            {user?.fullName?.charAt(0).toUpperCase() ?? '?'}
          </div>
          <div>
            <h2 className="text-xl font-bold">{user?.fullName}</h2>
            <p className="text-muted-foreground text-sm">@{user?.username}</p>
            <div className="mt-2 flex gap-2">
              <Badge variant={user?.role === 'ADMIN' ? 'default' : 'secondary'}>
                <Shield className="h-3 w-3 mr-1" />
                {user?.role === 'ADMIN' ? 'Admin' : 'Xodim'}
              </Badge>
              <Badge variant="success">Faol</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profile update */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" /> Shaxsiy ma&apos;lumotlar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={profileForm.handleSubmit((d) => updateProfileMutation.mutate(d))} className="space-y-4">
            <div className="space-y-2">
              <Label>Username</Label>
              <Input value={user?.username ?? ''} disabled className="bg-muted/50" />
              <p className="text-xs text-muted-foreground">Username o&apos;zgartirib bo&apos;lmaydi</p>
            </div>
            <div className="space-y-2">
              <Label>To&apos;liq ism *</Label>
              <Input {...profileForm.register('fullName')} placeholder="To'liq ismingiz" />
              {profileForm.formState.errors.fullName && (
                <p className="text-destructive text-xs">{profileForm.formState.errors.fullName.message}</p>
              )}
            </div>
            <Button type="submit" loading={updateProfileMutation.isPending}>
              Saqlash
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Change password */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-4 w-4" /> Parolni o&apos;zgartirish
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={passwordForm.handleSubmit((d) => changePasswordMutation.mutate(d))} className="space-y-4">
            <div className="space-y-2">
              <Label>Joriy parol *</Label>
              <Input {...passwordForm.register('currentPassword')} type="password" placeholder="••••••••" />
              {passwordForm.formState.errors.currentPassword && (
                <p className="text-destructive text-xs">{passwordForm.formState.errors.currentPassword.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Yangi parol *</Label>
              <Input {...passwordForm.register('newPassword')} type="password" placeholder="••••••••" />
              {passwordForm.formState.errors.newPassword && (
                <p className="text-destructive text-xs">{passwordForm.formState.errors.newPassword.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Yangi parolni tasdiqlang *</Label>
              <Input {...passwordForm.register('confirmPassword')} type="password" placeholder="••••••••" />
              {passwordForm.formState.errors.confirmPassword && (
                <p className="text-destructive text-xs">{passwordForm.formState.errors.confirmPassword.message}</p>
              )}
            </div>
            <Button type="submit" loading={changePasswordMutation.isPending}>
              Parolni o&apos;zgartirish
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
