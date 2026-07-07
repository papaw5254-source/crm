'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Flame, Package, PackagePlus, ShoppingCart, Warehouse } from 'lucide-react'
import { stockService } from '@/services/stock.service'
import { StatsCard } from '@/components/shared/stats-card'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/providers/auth-provider'

export default function DashboardPage() {
  const { user } = useAuth()

  const { data: stocks = [] } = useQuery({
    queryKey: ['stock'],
    queryFn: () => stockService.getStock(),
  })

  const stockList = Array.isArray(stocks) ? stocks : stocks ? [stocks] : []
  const rawStock = stockList.find((stock) => stock.brickType === 'RAW_BRICK')?.quantity ?? 0
  const bakedStock = stockList.find((stock) => stock.brickType === 'BAKED_BRICK')?.quantity ?? 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Xush kelibsiz, {user?.fullName || user?.username || 'foydalanuvchi'}!
        </h1>
        <p className="text-sm text-muted-foreground">G&apos;isht zavodi CRM tizimi</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Ombor holati
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatsCard title="Xom g'isht" value={rawStock} icon={Package} color="amber" format="number" suffix="dona" />
          <StatsCard title="Pishgan g'isht" value={bakedStock} icon={Flame} color="red" format="number" suffix="dona" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Tezkor bo&apos;limlar
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4 space-y-3">
              <PackagePlus className="h-5 w-5 text-emerald-600" />
              <div>
                <p className="font-semibold">Xom g&apos;isht kirim</p>
                <p className="text-sm text-muted-foreground">Pressdan chiqqan g&apos;ishtlar</p>
              </div>
              <Button asChild size="sm" className="w-full">
                <Link href="/inventory">Ochish</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <Flame className="h-5 w-5 text-orange-600" />
              <div>
                <p className="font-semibold">Humbuz</p>
                <p className="text-sm text-muted-foreground">Kirdi, chiqdi va pishgan g&apos;isht</p>
              </div>
              <Button asChild size="sm" className="w-full">
                <Link href="/humbuz">Ochish</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <ShoppingCart className="h-5 w-5 text-blue-600" />
              <div>
                <p className="font-semibold">Sotuv</p>
                <p className="text-sm text-muted-foreground">Naqd, karta va nasiya sotuvlar</p>
              </div>
              <Button asChild size="sm" className="w-full">
                <Link href="/sales">Ochish</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <Warehouse className="h-5 w-5 text-slate-600" />
              <div>
                <p className="font-semibold">Zaxira</p>
                <p className="text-sm text-muted-foreground">Xom va pishgan g&apos;isht zaxirasi</p>
              </div>
              <Button asChild size="sm" className="w-full">
                <Link href="/zaxira">Ochish</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
