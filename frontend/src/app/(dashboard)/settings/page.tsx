'use client'

import { useState } from 'react'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
import { Sun, Moon, Monitor, Info, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/services/api'
import { PageHeader } from '@/components/shared/page-header'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn, getErrorMessage } from '@/lib/utils'
import { useAuth } from '@/providers/auth-provider'

const THEMES = [
  { value: 'light', label: "Yorug'", icon: Sun },
  { value: 'dark', label: "Qorong'i", icon: Moon },
  { value: 'system', label: 'Sistema', icon: Monitor },
] as const

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const queryClient = useQueryClient()
  const [resetOpen, setResetOpen] = useState(false)

  const resetMutation = useMutation({
    mutationFn: () => api.post('/reports/admin/reset-data'),
    onSuccess: () => {
      queryClient.clear()
      toast.success("Barcha ma'lumotlar tozalandi")
      setResetOpen(false)
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Sozlamalar"
        description="Tizim sozlamalarini boshqaring"
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ko&apos;rinish</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {THEMES.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={cn(
                  'flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all',
                  theme === value
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                )}
              >
                <Icon className={cn('h-6 w-6', theme === value ? 'text-primary' : 'text-muted-foreground')} />
                <span className={cn('text-sm font-medium', theme === value ? 'text-primary' : 'text-muted-foreground')}>
                  {label}
                </span>
                {theme === value && (
                  <Badge variant="default" className="text-xs">Faol</Badge>
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4" /> Tizim ma&apos;lumotlari
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            {[
              { label: 'Versiya', value: '1.0.0' },
              { label: 'Tizim', value: "G'isht Zavodi CRM" },
              { label: 'Backend', value: 'NestJS + PostgreSQL' },
              { label: 'Frontend', value: 'Next.js 15 + Tailwind CSS' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium">{value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {isAdmin && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-base text-destructive flex items-center gap-2">
              <Trash2 className="h-4 w-4" /> Xavfli zona
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Barcha sotuvlar, xarajatlar, kirimlar, ishchi to&apos;lovlari, qarzdorlar va ombor harakatlari o&apos;chiriladi.
              Foydalanuvchilar saqlanib qoladi. Ombor qoldig&apos;i 0 ga tushiriladi.
            </p>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setResetOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Barcha ma&apos;lumotlarni tozalash
            </Button>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Barcha ma'lumotlarni tozalash"
        description="Bu amalni ortga qaytarib bo'lmaydi! Barcha operatsiya ma'lumotlari o'chirilib, ombor 0 ga tushiriladi. Foydalanuvchilar saqlanadi. Davom etasizmi?"
        confirmLabel="Ha, tozalash"
        onConfirm={() => resetMutation.mutate()}
        loading={resetMutation.isPending}
      />
    </div>
  )
}
