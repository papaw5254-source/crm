'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@/types'
import { authService } from '@/services/auth.service'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  const refreshUser = useCallback(async () => {
    try {
      const profile = await authService.getProfile()
      setUser(profile)
      localStorage.setItem('user', JSON.stringify(profile))
    } catch {
      setUser(null)
    }
  }, [])

  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true)
      const token = localStorage.getItem('accessToken')
      if (token) {
        try {
          await refreshUser()
        } catch {
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
          localStorage.removeItem('user')
          setUser(null)
        }
      } else {
        setUser(null)
      }
      setIsLoading(false)
    }
    initAuth()
  }, [refreshUser])

  const login = useCallback(
    async (username: string, password: string) => {
      const data = await authService.login(username, password)
      localStorage.setItem('accessToken', data.accessToken)
      localStorage.setItem('refreshToken', data.refreshToken)
      localStorage.setItem('user', JSON.stringify(data.user))
      setUser(data.user)
      router.push('/')
    },
    [router],
  )

  const logout = useCallback(async () => {
    await authService.logout()
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('user')
    setUser(null)
    router.push('/login')
  }, [router])

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
