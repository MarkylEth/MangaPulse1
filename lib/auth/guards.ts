'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from './context'

export function useAuthGuard(redirectTo: string = '/') {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push(redirectTo)
    }
  }, [user, loading, router, redirectTo])

  return { user, loading }
}

export function useAdminGuard(redirectTo: string = '/') {
  const { user, profile, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && (!user || profile?.role !== 'admin')) {
      router.push(redirectTo)
    }
  }, [user, profile, loading, router, redirectTo])

  return { user, profile, loading }
}

export function useModeratorGuard(redirectTo: string = '/') {
  const { user, profile, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && (!user || !['admin', 'moderator'].includes(profile?.role || ''))) {
      router.push(redirectTo)
    }
  }, [user, profile, loading, router, redirectTo])

  return { user, profile, loading }
}
