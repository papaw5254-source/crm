'use client'

import { useTheme } from 'next-themes'
import { Sun, Moon, Monitor, Info } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const THEMES = [
  { value: 'light', label: 'Yorug\'', icon: Sun },
  { value: 'dark', label: 'Qorong\'i', icon: Moon },
  { value: 'system', label: 'Sistema', icon: Monitor },
] as const

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()

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
              { label: 'Tizim', "value": "G'isht Zavodi CRM" },
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
    </div>
  )
}
