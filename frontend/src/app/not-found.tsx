'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Home } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-6 animate-fade-in">
        <div className="space-y-2">
          <h1 className="text-8xl font-bold text-muted-foreground/20">404</h1>
          <h2 className="text-2xl font-semibold">Sahifa topilmadi</h2>
          <p className="text-muted-foreground">
            Siz qidirgan sahifa mavjud emas yoki ko&apos;chirilgan.
          </p>
        </div>
        <Button asChild>
          <Link href="/">
            <Home className="mr-2 h-4 w-4" />
            Bosh sahifaga qaytish
          </Link>
        </Button>
      </div>
    </div>
  )
}
