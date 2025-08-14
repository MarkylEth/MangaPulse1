'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Upload, Plus } from 'lucide-react'
import { useTheme } from '@/lib/theme/context'
import { useAuth } from '@/lib/auth/context'

interface MangaSubmissionModalProps {
  isOpen: boolean
  onClose: () => void
}

export function MangaSubmissionModal({ isOpen, onClose }: MangaSubmissionModalProps) {
  const { theme } = useTheme()
  const { user } = useAuth()
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    author: '',
    artist: '',
    status: 'ongoing' as 'ongoing' | 'completed' | 'hiatus',
    genres: [] as string[],
    coverUrl: ''
  })
  
  const [loading, setLoading] = useState(false)
  
  const availableGenres = [
    'Экшен', 'Приключения', 'Комедия', 'Драма', 'Фэнтези', 
    'Ужасы', 'Романтика', 'Научная фантастика', 'Школа', 
    'Сверхъестественное', 'Боевые искусства', 'Сёнен', 'Сёдзё',
    'Сейнен', 'Дзёсей', 'Исекай', 'Меха', 'Спорт', 'Музыка'
  ]
  
  const bgClass = theme === 'light' ? 'bg-white' : 'bg-slate-800'
  const textClass = theme === 'light' ? 'text-gray-900' : 'text-white'
  const mutedTextClass = theme === 'light' ? 'text-gray-600' : 'text-slate-400'
  const inputClass = theme === 'light' 
    ? 'bg-gray-50 border-gray-300 text-gray-900 focus:border-blue-500' 
    : 'bg-slate-700 border-slate-600 text-white focus:border-blue-500'
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    
    setLoading(true)
    try {
      // TODO: Implement manga submission logic
      console.log('Submitting manga:', formData)
      onClose()
    } catch (error) {
      console.error('Error submitting manga:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const toggleGenre = (genre: string) => {
    setFormData(prev => ({
      ...prev,
      genres: prev.genres.includes(genre)
        ? prev.genres.filter(g => g !== genre)
        : [...prev.genres, genre]
    }))
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={`relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl ${bgClass} shadow-2xl`}
          >
            <div className="sticky top-0 flex items-center justify-between p-6 border-b border-slate-700 bg-inherit">
              <h2 className={`text-2xl font-bold ${textClass}`}>
                Предложить мангу
              </h2>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-slate-700 transition-colors"
              >
                <X className={`w-5 h-5 ${textClass}`} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${textClass}`}>
                    Название *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${inputClass}`}
                    placeholder="Введите название манги"
                  />
                </div>
                
                <div>
                  <label className={`block text-sm font-medium mb-2 ${textClass}`}>
                    Статус
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      status: e.target.value as 'ongoing' | 'completed' | 'hiatus' 
                    }))}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${inputClass}`}
                  >
                    <option value="ongoing">Онгоинг</option>
                    <option value="completed">Завершено</option>
                    <option value="hiatus">На паузе</option>
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${textClass}`}>
                    Автор
                  </label>
                  <input
                    type="text"
                    value={formData.author}
                    onChange={(e) => setFormData(prev => ({ ...prev, author: e.target.value }))}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${inputClass}`}
                    placeholder="Имя автора"
                  />
                </div>
                
                <div>
                  <label className={`block text-sm font-medium mb-2 ${textClass}`}>
                    Художник
                  </label>
                  <input
                    type="text"
                    value={formData.artist}
                    onChange={(e) => setFormData(prev => ({ ...prev, artist: e.target.value }))}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${inputClass}`}
                    placeholder="Имя художника"
                  />
                </div>
              </div>
              
              <div>
                <label className={`block text-sm font-medium mb-2 ${textClass}`}>
                  Описание
                </label>
                <textarea
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${inputClass}`}
                  placeholder="Краткое описание сюжета"
                />
              </div>
              
              <div>
                <label className={`block text-sm font-medium mb-2 ${textClass}`}>
                  URL обложки
                </label>
                <input
                  type="url"
                  value={formData.coverUrl}
                  onChange={(e) => setFormData(prev => ({ ...prev, coverUrl: e.target.value }))}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${inputClass}`}
                  placeholder="https://example.com/cover.jpg"
                />
              </div>
              
              <div>
                <label className={`block text-sm font-medium mb-3 ${textClass}`}>
                  Жанры
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableGenres.map((genre) => (
                    <motion.button
                      key={genre}
                      type="button"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => toggleGenre(genre)}
                      className={`px-3 py-1 rounded-full text-sm transition-colors ${
                        formData.genres.includes(genre)
                          ? 'bg-blue-600 text-white'
                          : theme === 'light'
                          ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {genre}
                    </motion.button>
                  ))}
                </div>
                <p className={`text-xs mt-2 ${mutedTextClass}`}>
                  Выбрано: {formData.genres.length} жанров
                </p>
              </div>
              
              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className={`flex-1 py-3 px-4 border rounded-lg font-medium transition-colors ${
                    theme === 'light'
                      ? 'border-gray-300 text-gray-700 hover:bg-gray-50'
                      : 'border-slate-600 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={loading || !formData.title}
                  className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors"
                >
                  {loading ? 'Отправка...' : 'Предложить'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
