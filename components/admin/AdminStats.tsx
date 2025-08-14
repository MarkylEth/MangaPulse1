'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  Users, BookOpen, MessageSquare, Eye, TrendingUp, 
  Calendar, Activity, Award, Clock, BarChart3 
} from 'lucide-react'
import { useTheme } from '@/lib/theme/context'
import { createClient } from '@/lib/supabase/client'

interface StatsData {
  totalUsers: number
  totalManga: number
  totalChapters: number
  totalComments: number
  recentUsers: number
  pendingManga: number
  todayViews: number
  totalViews: number
}

export function AdminStats() {
  const { theme } = useTheme()
  const [stats, setStats] = useState<StatsData>({
    totalUsers: 0,
    totalManga: 0,
    totalChapters: 0,
    totalComments: 0,
    recentUsers: 0,
    pendingManga: 0,
    todayViews: 0,
    totalViews: 0
  })
  const [loading, setLoading] = useState(true)

  const textClass = theme === 'light' ? 'text-gray-900' : 'text-white'
  const mutedTextClass = theme === 'light' ? 'text-gray-600' : 'text-slate-400'
  const cardClass = theme === 'light' 
    ? 'bg-white border-gray-200 shadow-sm' 
    : 'bg-slate-800 border-slate-700 shadow-lg'

  useEffect(() => {
    const fetchStats = async () => {
      const supabase = createClient()
      
      try {
        // Fetch all stats in parallel
        const [
          usersResult,
          mangaResult,
          chaptersResult,
          commentsResult,
          recentUsersResult,
          pendingMangaResult
        ] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('manga').select('id', { count: 'exact', head: true }),
          supabase.from('chapters').select('id', { count: 'exact', head: true }),
          supabase.from('manga_comments').select('id', { count: 'exact', head: true }),
          supabase.from('profiles').select('id', { count: 'exact', head: true })
            .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
          supabase.from('manga').select('id', { count: 'exact', head: true })
            .eq('submission_status', 'pending')
        ])

        // Calculate total views from manga
        const { data: mangaViews } = await supabase
          .from('manga')
          .select('view_count')
        
        const totalViews = mangaViews?.reduce((sum, manga) => sum + (manga.view_count || 0), 0) || 0

        setStats({
          totalUsers: usersResult.count || 0,
          totalManga: mangaResult.count || 0,
          totalChapters: chaptersResult.count || 0,
          totalComments: commentsResult.count || 0,
          recentUsers: recentUsersResult.count || 0,
          pendingManga: pendingMangaResult.count || 0,
          todayViews: Math.floor(totalViews * 0.1), // Mock today's views
          totalViews
        })
      } catch (error) {
        console.error('Error fetching stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  const statCards = [
    {
      title: 'Всего пользователей',
      value: stats.totalUsers,
      icon: Users,
      color: 'from-blue-500 to-blue-600',
      change: `+${stats.recentUsers} за неделю`,
      changeColor: 'text-green-500'
    },
    {
      title: 'Манга в каталоге',
      value: stats.totalManga,
      icon: BookOpen,
      color: 'from-purple-500 to-purple-600',
      change: `${stats.pendingManga} на модерации`,
      changeColor: 'text-orange-500'
    },
    {
      title: 'Всего глав',
      value: stats.totalChapters,
      icon: Award,
      color: 'from-green-500 to-green-600',
      change: 'Активный контент',
      changeColor: 'text-green-500'
    },
    {
      title: 'Комментариев',
      value: stats.totalComments,
      icon: MessageSquare,
      color: 'from-orange-500 to-orange-600',
      change: 'Вовлеченность',
      changeColor: 'text-blue-500'
    },
    {
      title: 'Просмотров сегодня',
      value: stats.todayViews,
      icon: Eye,
      color: 'from-indigo-500 to-indigo-600',
      change: `${stats.totalViews} всего`,
      changeColor: 'text-indigo-500'
    },
    {
      title: 'Активность',
      value: '94%',
      icon: Activity,
      color: 'from-pink-500 to-pink-600',
      change: 'Система работает',
      changeColor: 'text-green-500'
    }
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className={mutedTextClass}>Загрузка статистики...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className={`text-3xl font-bold ${textClass} mb-2`}>Обзор системы</h1>
        <p className={mutedTextClass}>
          Статистика и аналитика платформы MangaPulse
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon
          return (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`p-6 rounded-2xl border ${cardClass}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-xl bg-gradient-to-r ${stat.color}`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div className={`text-2xl font-bold ${textClass}`}>
                  {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                </div>
              </div>
              <div>
                <h3 className={`font-semibold ${textClass} mb-1`}>{stat.title}</h3>
                <p className={`text-sm ${stat.changeColor}`}>{stat.change}</p>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Recent Activity */}
      <div className={`p-6 rounded-2xl border ${cardClass}`}>
        <div className="flex items-center gap-3 mb-6">
          <Activity className={`w-6 h-6 ${textClass}`} />
          <h2 className={`text-xl font-bold ${textClass}`}>Последняя активность</h2>
        </div>
        
        <div className="space-y-4">
          {[
            {
              action: 'Новый пользователь зарегистрировался',
              time: '5 минут назад',
              type: 'user'
            },
            {
              action: 'Загружена новая глава манги',
              time: '15 минут назад',
              type: 'content'
            },
            {
              action: 'Модерирован комментарий',
              time: '30 минут назад',
              type: 'moderation'
            },
            {
              action: 'Одобрена заявка на мангу',
              time: '1 час назад',
              type: 'approval'
            }
          ].map((activity, index) => (
            <div key={index} className="flex items-center gap-4 p-3 rounded-lg bg-gradient-to-r from-blue-500/5 to-purple-500/5">
              <div className={`w-2 h-2 rounded-full ${
                activity.type === 'user' ? 'bg-blue-500' :
                activity.type === 'content' ? 'bg-green-500' :
                activity.type === 'moderation' ? 'bg-orange-500' :
                'bg-purple-500'
              }`} />
              <div className="flex-1">
                <p className={`font-medium ${textClass}`}>{activity.action}</p>
                <p className={`text-sm ${mutedTextClass}`}>{activity.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className={`p-6 rounded-2xl border ${cardClass}`}>
        <h2 className={`text-xl font-bold ${textClass} mb-6`}>Быстрые действия</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { title: 'Управление пользователями', icon: Users, color: 'from-blue-500 to-blue-600' },
            { title: 'Модерация манги', icon: BookOpen, color: 'from-purple-500 to-purple-600' },
            { title: 'Проверка комментариев', icon: MessageSquare, color: 'from-orange-500 to-orange-600' },
            { title: 'Системные настройки', icon: BarChart3, color: 'from-green-500 to-green-600' }
          ].map((action, index) => {
            const Icon = action.icon
            return (
              <motion.button
                key={action.title}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`p-4 rounded-xl bg-gradient-to-r ${action.color} text-white text-center`}
              >
                <Icon className="w-6 h-6 mx-auto mb-2" />
                <div className="font-semibold text-sm">{action.title}</div>
              </motion.button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
