'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  Search, BookOpen, CheckCircle, XCircle, Clock, 
  Eye, ThumbsUp, Filter, MoreHorizontal, Loader2,
  Star, Users, Calendar, AlertTriangle
} from 'lucide-react'
import { useTheme } from '@/lib/theme/context'
import { createClient } from '@/lib/supabase/client'
import type { Tables } from '@/database.types'
import Image from 'next/image'

type Manga = Tables<'manga'>

export function MangaManagement() {
  const { theme } = useTheme()
  const [manga, setManga] = useState<Manga[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedManga, setSelectedManga] = useState<Manga | null>(null)
  const [showModerationModal, setShowModerationModal] = useState(false)

  const textClass = theme === 'light' ? 'text-gray-900' : 'text-white'
  const mutedTextClass = theme === 'light' ? 'text-gray-600' : 'text-slate-400'
  const cardClass = theme === 'light' 
    ? 'bg-white border-gray-200 shadow-sm' 
    : 'bg-slate-800 border-slate-700 shadow-lg'

  useEffect(() => {
    fetchManga()
  }, [])

  const fetchManga = async () => {
    const supabase = createClient()
    setLoading(true)
    
    try {
      const { data, error } = await supabase
        .from('manga')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setManga(data || [])
    } catch (error) {
      console.error('Error fetching manga:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateMangaStatus = async (mangaId: number, status: string, submissionStatus: string) => {
    const supabase = createClient()
    
    try {
      const { error } = await supabase
        .from('manga')
        .update({ 
          status,
          submission_status: submissionStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', mangaId)
      
      if (error) throw error
      
      // Update local state
      setManga(manga.map(m => 
        m.id === mangaId ? { ...m, status, submission_status: submissionStatus } : m
      ))
      
      setShowModerationModal(false)
      setSelectedManga(null)
    } catch (error) {
      console.error('Error updating manga status:', error)
    }
  }

  const getStatusBadge = (status: string | null, submissionStatus: string | null) => {
    if (submissionStatus === 'pending') {
      return <span className="px-2 py-1 rounded-md text-xs font-semibold bg-yellow-500/20 text-yellow-400 border border-yellow-500/50">На модерации</span>
    }
    if (submissionStatus === 'approved') {
      return <span className="px-2 py-1 rounded-md text-xs font-semibold bg-green-500/20 text-green-400 border border-green-500/50">Одобрено</span>
    }
    if (submissionStatus === 'rejected') {
      return <span className="px-2 py-1 rounded-md text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/50">Отклонено</span>
    }
    return <span className="px-2 py-1 rounded-md text-xs font-semibold bg-gray-500/20 text-gray-400 border border-gray-500/50">Неизвестно</span>
  }

  const filteredManga = manga.filter(m => {
    const matchesSearch = m.title.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || m.submission_status === statusFilter
    return matchesSearch && matchesStatus
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          <span className={mutedTextClass}>Загрузка манги...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className={`text-3xl font-bold ${textClass} mb-2`}>Управление мангой</h1>
        <p className={mutedTextClass}>
          Модерируйте контент, одобряйте заявки и управляйте каталогом
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { 
            title: 'Всего манги', 
            value: manga.length, 
            icon: BookOpen, 
            color: 'from-purple-500 to-purple-600' 
          },
          { 
            title: 'На модерации', 
            value: manga.filter(m => m.submission_status === 'pending').length, 
            icon: Clock, 
            color: 'from-yellow-500 to-yellow-600' 
          },
          { 
            title: 'Одобрено', 
            value: manga.filter(m => m.submission_status === 'approved').length, 
            icon: CheckCircle, 
            color: 'from-green-500 to-green-600' 
          },
          { 
            title: 'Отклонено', 
            value: manga.filter(m => m.submission_status === 'rejected').length, 
            icon: XCircle, 
            color: 'from-red-500 to-red-600' 
          }
        ].map((stat, index) => {
          const Icon = stat.icon
          return (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`p-4 rounded-xl border ${cardClass}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-2xl font-bold ${textClass}`}>{stat.value}</p>
                  <p className={`text-sm ${mutedTextClass}`}>{stat.title}</p>
                </div>
                <div className={`p-2 rounded-lg bg-gradient-to-r ${stat.color}`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Search and Filters */}
      <div className={`p-4 rounded-xl border ${cardClass}`}>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${mutedTextClass}`} />
            <input
              type="text"
              placeholder="Поиск манги..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                theme === 'light'
                  ? 'bg-gray-50 border-gray-200 text-gray-900'
                  : 'bg-slate-700 border-slate-600 text-white'
              }`}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className={`w-5 h-5 ${mutedTextClass}`} />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                theme === 'light'
                  ? 'bg-gray-50 border-gray-200 text-gray-900'
                  : 'bg-slate-700 border-slate-600 text-white'
              }`}
            >
              <option value="all">Все статусы</option>
              <option value="pending">На модерации</option>
              <option value="approved">Одобрено</option>
              <option value="rejected">Отклонено</option>
            </select>
          </div>
        </div>
      </div>

      {/* Manga Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredManga.map((m) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 rounded-xl border ${cardClass} hover:shadow-lg transition-all cursor-pointer`}
            onClick={() => {
              setSelectedManga(m)
              setShowModerationModal(true)
            }}
          >
            <div className="aspect-[3/4] rounded-lg overflow-hidden mb-4 bg-gradient-to-br from-purple-500 to-blue-500">
              {m.cover_url ? (
                <Image
                  src={m.cover_url}
                  alt={m.title}
                  width={200}
                  height={280}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <BookOpen className="w-12 h-12 text-white opacity-50" />
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <h3 className={`font-bold line-clamp-2 ${textClass}`}>{m.title}</h3>
              <div className="flex items-center justify-between">
                {getStatusBadge(m.status, m.submission_status)}
                <span className={`text-xs ${mutedTextClass}`}>
                  {new Date(m.created_at).toLocaleDateString('ru-RU')}
                </span>
              </div>
              
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <div className="flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  {m.view_count || 0}
                </div>
                <div className="flex items-center gap-1">
                  <Star className="w-3 h-3" />
                  {m.rating?.toFixed(1) || '0.0'}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Moderation Modal */}
      {showModerationModal && selectedManga && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border ${cardClass} p-6`}
          >
            <div className="flex items-start gap-4 mb-6">
              <div className="w-24 h-32 rounded-lg overflow-hidden bg-gradient-to-br from-purple-500 to-blue-500 flex-shrink-0">
                {selectedManga.cover_url ? (
                  <Image
                    src={selectedManga.cover_url}
                    alt={selectedManga.title}
                    width={96}
                    height={128}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <BookOpen className="w-8 h-8 text-white opacity-50" />
                  </div>
                )}
              </div>
              
              <div className="flex-1">
                <h3 className={`text-xl font-bold ${textClass} mb-2`}>{selectedManga.title}</h3>
                <div className="space-y-2">
                  {getStatusBadge(selectedManga.status, selectedManga.submission_status)}
                  <div className={`text-sm ${mutedTextClass}`}>
                    <p>Автор: {selectedManga.author || 'Неизвестен'}</p>
                    <p>Художник: {selectedManga.artist || 'Неизвестен'}</p>
                    <p>Дата создания: {new Date(selectedManga.created_at).toLocaleDateString('ru-RU')}</p>
                  </div>
                </div>
              </div>
            </div>

            {selectedManga.description && (
              <div className="mb-6">
                <h4 className={`font-semibold ${textClass} mb-2`}>Описание</h4>
                <p className={`text-sm ${mutedTextClass} leading-relaxed`}>
                  {selectedManga.description}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              {selectedManga.submission_status === 'pending' && (
                <>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => updateMangaStatus(selectedManga.id, 'published', 'approved')}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg font-semibold"
                  >
                    <CheckCircle className="w-5 h-5" />
                    Одобрить
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => updateMangaStatus(selectedManga.id, 'rejected', 'rejected')}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg font-semibold"
                  >
                    <XCircle className="w-5 h-5" />
                    Отклонить
                  </motion.button>
                </>
              )}
              
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setShowModerationModal(false)
                  setSelectedManga(null)
                }}
                className={`px-4 py-3 border rounded-lg font-semibold transition-all ${
                  theme === 'light'
                    ? 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    : 'border-slate-600 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Закрыть
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
