'use client'
import { useRouter } from 'next/navigation'
import { useAuth } from './context'

export function useAuthNavigation() {
  const router = useRouter()
  const { user, profile } = useAuth()

  const navigateWithAuth = (path: string, requireAuth: boolean = false) => {
    if (requireAuth && !user) {
      // Could trigger auth modal or redirect to login
      return false
    }
    router.push(path)
    return true
  }

  const navigateToProfile = () => {
    if (user) {
      // Could open profile modal or navigate to profile page
      return true
    }
    return false
  }

  const navigateToAdmin = () => {
    if (user && profile?.role === 'admin') {
      router.push('/admin')
      return true
    }
    return false
  }

  const getRedirectPath = (intendedPath?: string) => {
    // Determine where to redirect after login based on user role and intended path
    if (intendedPath) {
      return intendedPath
    }
    
    if (profile?.role === 'admin') {
      return '/admin'
    }
    
    return '/'
  }

  return {
    navigateWithAuth,
    navigateToProfile,
    navigateToAdmin,
    getRedirectPath,
    canAccess: {
      admin: user && profile?.role === 'admin',
      moderator: user && ['admin', 'moderator'].includes(profile?.role || ''),
      authenticated: !!user
    }
  }
}
