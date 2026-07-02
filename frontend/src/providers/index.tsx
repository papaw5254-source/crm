'use client'

import { Toaster } from 'sonner'
import { ThemeProvider } from './theme-provider'
import { QueryProvider } from './query-provider'
import { AuthProvider } from './auth-provider'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <QueryProvider>
        <AuthProvider>
          {children}
          <Toaster
            position="top-right"
            richColors
            closeButton
            toastOptions={{
              style: { borderRadius: '12px' },
            }}
          />
        </AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  )
}
