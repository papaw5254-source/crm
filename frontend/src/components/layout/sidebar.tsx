'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  PackagePlus,
  ShoppingCart,
  CreditCard,
  BarChart3,
  UserCircle,
  LogOut,
  Building2,
  UserCog,
  Flame,
  Warehouse,
  Wallet,
  DollarSign,
  HardHat,
  Receipt,
  ChevronDown,
  ChevronRight,
  Landmark,
  Settings,
} from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import { useAuth } from '@/providers/auth-provider'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useState } from 'react'

interface NavItem {
  href: string
  icon: React.ElementType
  label: string
  adminOnly?: boolean
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    label: 'Asosiy',
    items: [
      { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
    ],
  },
  {
    label: "G'isht",
    items: [
      { href: '/inventory', icon: PackagePlus, label: "Xom g'isht kirim" },
      { href: '/press', icon: HardHat, label: 'Press' },
      { href: '/kretkachi', icon: HardHat, label: 'Kretkachi' },
      { href: '/eshikchi', icon: HardHat, label: 'Eshikchi' },
      { href: '/sales', icon: ShoppingCart, label: 'Sotuvlar' },
      { href: '/humbuz', icon: Flame, label: 'Humbuz' },
      { href: '/qachigar', icon: HardHat, label: 'Qachigar' },
      { href: '/zaxira', icon: Warehouse, label: 'Zaxira' },
    ],
  },
  {
    label: 'Moliya',
    items: [
      { href: '/debtors', icon: CreditCard, label: 'Qarzdorlar' },
      { href: '/perechisleniya', icon: Landmark, label: 'Perechisleniya' },
      { href: '/zalog', icon: Wallet, label: 'Zalog / Oldindan' },
      { href: '/kirimlar', icon: DollarSign, label: 'Pul kirimlari' },
      { href: '/expenses', icon: Receipt, label: 'Xarajatlar' },
    ],
  },
  {
    label: 'Hisobot',
    items: [
      { href: '/ishchilar', icon: HardHat, label: 'Ishchilar' },
      { href: '/reports', icon: BarChart3, label: 'Hisobotlar' },
    ],
  },
  {
    label: 'Tizim',
    items: [
      { href: '/users', icon: UserCog, label: 'Foydalanuvchilar', adminOnly: true },
      { href: '/settings', icon: Settings, label: 'Sozlamalar' },
    ],
  },
]

interface SidebarProps {
  onNavigate?: () => void
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  const toggleGroup = (label: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  return (
    <div className="flex h-full flex-col bg-background border-r border-border">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-6 border-b border-border shrink-0">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-sm">
          <Building2 className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="font-bold text-sm leading-none">G&apos;isht Zavodi</p>
          <p className="text-xs text-muted-foreground mt-0.5">CRM System</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 scrollbar-hide">
        {navGroups.map((group) => {
          const visibleItems = group.items.filter((item) => !item.adminOnly || isAdmin)
          if (visibleItems.length === 0) return null
          const isCollapsed = collapsedGroups.has(group.label)
          return (
            <div key={group.label} className="mb-1">
              <button
                onClick={() => toggleGroup(group.label)}
                className="flex w-full items-center justify-between px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
              >
                {group.label}
                {isCollapsed ? (
                  <ChevronRight className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </button>
              {!isCollapsed && (
                <div className="space-y-0.5 mb-1">
                  {visibleItems.map((item) => {
                    const isActive = pathname === item.href
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onNavigate}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                          isActive
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                        )}
                      >
                        <item.icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-primary' : '')} />
                        {item.label}
                        {isActive && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        <div className="pt-2 border-t border-border space-y-0.5">
          <Link
            href="/profile"
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
              pathname === '/profile'
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            <UserCircle className="h-4 w-4 shrink-0" />
            Profil
          </Link>
        </div>
      </nav>

      {/* User footer */}
      <div className="border-t border-border p-3 shrink-0">
        <div className="flex items-center gap-3 rounded-lg p-2.5 hover:bg-accent transition-colors">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs bg-primary/10 text-primary">
              {getInitials(user?.fullName || 'U')}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.fullName}</p>
            <p className="text-xs text-muted-foreground">{user?.role === 'ADMIN' ? 'Admin' : 'Xodim'}</p>
          </div>
          <button
            onClick={() => logout()}
            className="text-muted-foreground hover:text-destructive transition-colors"
            title="Chiqish"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
