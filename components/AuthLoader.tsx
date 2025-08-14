'use client'
import { useAuth } from '@/lib/auth/context'
import { useTheme } from '@/lib/theme/context'
import { Loader2 } from 'lucide-react'
import Image from 'next/image'

interface AuthLoaderProps {
  children: React.ReactNode
}

export function AuthLoader({ children }: AuthLoaderProps) {
  const { initialLoading } = useAuth()
  const { theme } = useTheme()

  if (initialLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        theme === 'light' ? 'bg-gray-50' : 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900'
      }`}>
        <div className="flex flex-col items-center gap-8">
          <div className="relative">
            <Image
              src="/logodark.png"
              alt="MangaPulse"
              width={64}
              height={64}
              className="rounded-xl shadow-lg"
              priority
            />
            <div className="absolute -bottom-2 -right-2">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          </div>
          <div className="text-center">
            <h2 className={`text-xl font-bold mb-2 ${
              theme === 'light' ? 'text-gray-900' : 'text-white'
            }`}>
              MangaPulse
            </h2>
            <p className={`text-sm ${
              theme === 'light' ? 'text-gray-600' : 'text-slate-400'
            }`}>
              Загрузка...
            </p>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
