'use client'
import { useEffect, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import { useTheme } from '@/lib/theme/context'
import { Loader2, Lock, Shield } from 'lucide-react'

interface ProtectedRouteProps {
  children: ReactNode
  requireAuth?: boolean
  requireRole?: 'admin' | 'moderator'
  redirectTo?: string
  fallback?: ReactNode
}

export function ProtectedRoute({ 
  children, 
  requireAuth = false, 
  requireRole, 
  redirectTo = '/',
  fallback 
}: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth()
  const { theme } = useTheme()
  const router = useRouter()

  useEffect(() => {
    if (loading) return

    // Check authentication requirement
    if (requireAuth && !user) {
      router.push(redirectTo)
      return
    }

    // Check role requirement
    if (requireRole && (!user || !profile)) {
      router.push(redirectTo)
      return
    }

    if (requireRole === 'admin' && profile?.role !== 'admin') {
      router.push(redirectTo)
      return
    }

    if (requireRole === 'moderator' && !['admin', 'moderator'].includes(profile?.role || '')) {
      router.push(redirectTo)
      return
    }
  }, [user, profile, loading, requireAuth, requireRole, router, redirectTo])

  // Show loading state
  if (loading) {
    return fallback || (
      <div className={`min-h-screen flex items-center justify-center ${
        theme === 'light' ? 'bg-gray-50' : 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900'
      }`}>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className={theme === 'light' ? 'text-gray-600' : 'text-slate-400'}>
            Проверка доступа...
          </p>
        </div>
      </div>
    )
  }

  // Check access requirements
  const hasAccess = () => {
    if (requireAuth && !user) return false
    
    if (requireRole) {
      if (!user || !profile) return false
      
      if (requireRole === 'admin' && profile.role !== 'admin') return false
      if (requireRole === 'moderator' && !['admin', 'moderator'].includes(profile.role || '')) return false
    }
    
    return true
  }

  // Show access denied if requirements not met
  if (!hasAccess()) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        theme === 'light' ? 'bg-gray-50' : 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900'
      }`}>
        <div className="text-center">
          {requireRole ? (
            <Shield className={`w-16 h-16 mx-auto mb-4 ${
              theme === 'light' ? 'text-gray-400' : 'text-slate-500'
            }`} />
          ) : (
            <Lock className={`w-16 h-16 mx-auto mb-4 ${
              theme === 'light' ? 'text-gray-400' : 'text-slate-500'
            }`} />
          )}
          <h2 className={`text-xl font-bold mb-2 ${
            theme === 'light' ? 'text-gray-900' : 'text-white'
          }`}>
            Доступ ограничен
          </h2>
          <p className={`mb-4 ${
            theme === 'light' ? 'text-gray-600' : 'text-slate-400'
          }`}>
            {requireRole 
              ? `Требуется роль: ${requireRole === 'admin' ? 'Администратор' : 'Модератор'}`
              : 'Необходимо войти в систему'
            }
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
