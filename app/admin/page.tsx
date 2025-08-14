'use client'
import { Header } from '@/components/Header'
import { AdminDashboard } from '@/components/admin/AdminDashboard'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { useTheme } from '@/lib/theme/context'

export default function AdminPage() {
  const { theme } = useTheme()

  return (
    <ProtectedRoute requireAuth requireRole="admin">
      <div className={`min-h-screen ${theme === 'light' ? 'bg-gray-50' : 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900'}`}>
        <Header showSearch={false} />
        <AdminDashboard />
      </div>
    </ProtectedRoute>
  )
}
