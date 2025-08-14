'use client'
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { User, AuthError } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Tables } from '@/database.types'

type Profile = Tables<'profiles'>

interface AuthContextType {
  user: User | null
  profile: Profile | null
  loading: boolean
  initialLoading: boolean
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: AuthError | null }>
  signOut: () => Promise<void>
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: any }>
  refreshProfile: () => Promise<void>
  clearError: () => void
  authError: string | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)
  
  const supabase = createClient()

  const clearError = useCallback(() => {
    setAuthError(null)
  }, [])

  const loadProfile = useCallback(async (userId: string) => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        // If profile doesn't exist, create one
        if (error.code === 'PGRST116') {
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert([{ id: userId }])
            .select()
            .single()

          if (createError) {
            console.error('Error creating profile:', createError)
            setAuthError('Ошибка создания профиля')
          } else {
            setProfile(newProfile)
          }
        } else {
          console.error('Error loading profile:', error)
          setAuthError('Ошибка загрузки профиля')
        }
      } else {
        setProfile(data)
      }
    } catch (error) {
      console.error('Unexpected error loading profile:', error)
      setAuthError('Неожиданная ошибка при загрузке профиля')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await loadProfile(user.id)
    }
  }, [user?.id, loadProfile])

  useEffect(() => {
    let mounted = true

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (mounted) {
          setUser(session?.user ?? null)
          if (session?.user) {
            await loadProfile(session.user.id)
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error)
        if (mounted) {
          setAuthError('Ошибка инициализации авторизации')
        }
      } finally {
        if (mounted) {
          setInitialLoading(false)
        }
      }
    }

    initAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      console.log('Auth state change:', event, !!session)
      
      setUser(session?.user ?? null)
      
      if (session?.user) {
        await loadProfile(session.user.id)
      } else {
        setProfile(null)
        setLoading(false)
      }

      if (event === 'SIGNED_OUT') {
        setProfile(null)
        setAuthError(null)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase, loadProfile])

  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true)
    setAuthError(null)
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setAuthError(getErrorMessage(error))
    }
    
    setLoading(false)
    return { error }
  }, [supabase])

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    setLoading(true)
    setAuthError(null)

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    })

    if (error) {
      setAuthError(getErrorMessage(error))
    }

    setLoading(false)
    return { error }
  }, [supabase])

  const signOut = useCallback(async () => {
    setLoading(true)
    await supabase.auth.signOut()
    setProfile(null)
    setAuthError(null)
    setLoading(false)
  }, [supabase])

  const updateProfile = useCallback(async (updates: Partial<Profile>) => {
    if (!user) return { error: 'Пользователь не авторизован' }

    setLoading(true)
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)

    if (!error && profile) {
      setProfile({ ...profile, ...updates })
    }

    setLoading(false)
    return { error }
  }, [user, profile, supabase])

  const value = {
    user,
    profile,
    loading,
    initialLoading,
    signIn,
    signUp,
    signOut,
    updateProfile,
    refreshProfile,
    clearError,
    authError,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Helper function to get user-friendly error messages
function getErrorMessage(error: AuthError): string {
  switch (error.message) {
    case 'Invalid login credentials':
      return 'Неверный email или пароль'
    case 'Email not confirmed':
      return 'Email не подтвержден. Проверьте почту'
    case 'User already registered':
      return 'Пользователь уже зарегистрирован'
    case 'Password should be at least 6 characters':
      return 'Пароль должен содержать минимум 6 символов'
    case 'Unable to validate email address: invalid format':
      return 'Неверный формат email адреса'
    case 'Signup is disabled':
      return 'Регистрация временно отключена'
    case 'Email rate limit exceeded':
      return 'Слишком много попыток. Попробуйте позже'
    default:
      return error.message || 'Произошла ошибка'
  }
}
