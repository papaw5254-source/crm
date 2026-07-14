'use client'

import { type LucideIcon } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'

interface StatsCardProps {
  title: string
  value: number | string
  icon: LucideIcon
  trend?: number
  color?: 'emerald' | 'blue' | 'amber' | 'red' | 'purple' | 'slate'
  format?: 'currency' | 'number' | 'text'
  suffix?: string
  loading?: boolean
}

const colorMap = {
  emerald: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    icon: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400',
    trend: 'text-emerald-600',
  },
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    icon: 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400',
    trend: 'text-blue-600',
  },
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    icon: 'bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400',
    trend: 'text-amber-600',
  },
  red: {
    bg: 'bg-red-50 dark:bg-red-950/30',
    icon: 'bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400',
    trend: 'text-red-600',
  },
  purple: {
    bg: 'bg-purple-50 dark:bg-purple-950/30',
    icon: 'bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400',
    trend: 'text-purple-600',
  },
  slate: {
    bg: 'bg-slate-50 dark:bg-slate-900',
    icon: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    trend: 'text-slate-600',
  },
}

export function StatsCard({
  title,
  value,
  icon: Icon,
  color = 'emerald',
  format = 'currency',
  suffix,
  loading = false,
}: StatsCardProps) {
  const colors = colorMap[color]

  const formattedValue =
    format === 'currency' && typeof value === 'number'
      ? formatCurrency(value)
      : format === 'number' && typeof value === 'number'
        ? new Intl.NumberFormat('uz-UZ').format(value)
        : value

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center h-[92px]">
          <Spinner size="md" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden animate-fade-in">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold tracking-tight">
              {formattedValue}
              {suffix && <span className="text-base font-normal text-muted-foreground ml-1">{suffix}</span>}
            </p>
          </div>
          <div className={cn('flex h-12 w-12 items-center justify-center rounded-xl', colors.icon)}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
