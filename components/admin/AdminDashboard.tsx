'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  Users, BookOpen, MessageSquare, Shield, BarChart3, 
  Settings, ChevronRight, Activity, TrendingUp
} from 'lucide-react'
import { useTheme } from '@/lib/theme/context'
import { UserManagement } from './UserManagement'
import { MangaManagement } from './MangaManagement'
import { CommentModeration } from './CommentModeration'
import { SystemSettings } from './SystemSettings'
import { AdminStats } from './AdminStats'

type AdminSection = 'dashboard' | 'users' | 'manga' | 'comments' | 'settings'

export function AdminDashboard() {
  const { theme } = useTheme()
  const [activeSection, setActiveSection] = useState<AdminSection>('dashboard')

  const textClass = theme === 'light' ? 'text-gray-900' : 'text-white'
  const mutedTextClass = theme === 'light' ? 'text-gray-600' : 'text-slate-400'
  const cardClass = theme === 'light' 
    ? 'bg-white border-gray-200 shadow-sm' 
    : 'bg-slate-800 border-slate-700 shadow-lg'

  const menuItems = [
    {
      id: 'dashboard' as AdminSection,
      title: 'Обзор',
      icon: BarChart3,
      description: 'Статистика и аналитика'
    },
    {
      id: 'users' as AdminSection,
      title: 'Пользователи',
      icon: Users,
      description: 'Управление пользователями'
    },
    {
      id: 'manga' as AdminSection,
      title: 'Манга',
      icon: BookOpen,
      description: 'Модерация контента'
    },
    {
      id: 'comments' as AdminSection,
      title: 'Комментарии',
      icon: MessageSquare,
      description: 'Модерация комментариев'
    },
    {
      id: 'settings' as AdminSection,
      title: 'Настройки',
      icon: Settings,
      description: 'Системные настройки'
    }
  ]

  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard':
        return <AdminStats />
      case 'users':
        return <UserManagement />
      case 'manga':
        return <MangaManagement />
      case 'comments':
        return <CommentModeration />
      case 'settings':
        return <SystemSettings />
      default:
        return <AdminStats />
    }
  }

  return (
    <div className="flex h-[calc(100vh-80px)]">
      {/* Sidebar */}
      <div className={`w-80 border-r ${theme === 'light' ? 'border-gray-200 bg-white' : 'border-slate-700 bg-slate-800'}`}>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-gradient-to-r from-red-500 to-pink-500 rounded-lg">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className={`text-xl font-bold ${textClass}`}>Админ панель</h1>
              <p className={`text-sm ${mutedTextClass}`}>Управление системой</p>
            </div>
          </div>

          <nav className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon
              const isActive = activeSection === item.id
              
              return (
                <motion.button
                  key={item.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveSection(item.id)}
                  className={`w-full p-4 rounded-xl text-left transition-all flex items-center justify-between ${
                    isActive
                      ? theme === 'light'
                        ? 'bg-blue-50 border-blue-200 text-blue-700'
                        : 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                      : theme === 'light'
                        ? 'hover:bg-gray-50 text-gray-700 border-transparent'
                        : 'hover:bg-slate-700 text-slate-300 border-transparent'
                  } border`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5" />
                    <div>
                      <div className="font-semibold">{item.title}</div>
                      <div className={`text-xs ${mutedTextClass}`}>{item.description}</div>
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 transition-transform ${isActive ? 'rotate-90' : ''}`} />
                </motion.button>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <motion.div
          key={activeSection}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="p-8"
        >
          {renderContent()}
        </motion.div>
      </div>
    </div>
  )
}
