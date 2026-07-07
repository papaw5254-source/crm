import type { Metadata } from 'next'
import './globals.css'
import { Providers } from '@/providers'

export const metadata: Metadata = {
  title: "G'isht Zavodi CRM",
  description: 'Brick Factory Customer Relationship Management System',
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="uz" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
