'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  X, User, Edit3, Save, Loader2, Mail, Shield, Calendar, 
  Upload, Camera, Settings, LogOut, CheckCircle, AlertCircle 
} from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { useTheme } from '@/lib/theme/context'
import CreateTeamButton from '@/components/teams/CreateTeamButton'
import Image from 'next/image'

interface ProfileModalProps {
  isOpen: boolean
  onClose: () => void
}

export function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { theme } = useTheme()
  const { user, profile, updateProfile, signOut } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [activeTab, setActiveTab] = useState<'profile' | 'settings'>('profile')
  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    bio: '',
  })

  useEffect(() => {
    if (profile) {
      setFormData({
        username: profile.username || '',
        full_name: profile.full_name || '',
        bio: profile.bio || '',
      })
    }
  }, [profile])

  const handleSave = async () => {
    setLoading(true)
    setError('')
    setSuccess('')
    
    try {
      const { error: updateError } = await updateProfile(formData)
      if (updateError) {
        setError('Ошибка при сохранении профиля')
      } else {
        setSuccess('Профиль успешно обновлен')
        setIsEditing(false)
        setTimeout(() => setSuccess(''), 3000)
      }
    } catch (err) {
      setError('Произошла ошибка при сохранении')
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    onClose()
  }

  const getRoleBadge = (role: string | null) => {
    const roles = {
      admin: { label: 'Администратор', color: 'from-red-500 to-pink-500' },
      moderator: { label: 'Модератор', color: 'from-yellow-500 to-orange-500' },
      user: { label: 'Пользователь', color: 'from-blue-500 to-purple-500' }
    }
    const roleData = roles[role as keyof typeof roles] || roles.user
    return (
      <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r ${roleData.color} text-white text-xs font-semibold`}>
        <Shield className="w-3 h-3" />
        {roleData.label}
      </div>
    )
  }

  if (!user || !profile) return null

  const bgClass = theme === 'light' 
    ? 'bg-white border-gray-200' 
    : 'bg-slate-800 border-slate-700'
  
  const inputClass = theme === 'light'
    ? 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500 focus:ring-blue-500'
    : 'bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:ring-blue-500'

  const textClass = theme === 'light' ? 'text-gray-900' : 'text-white'
  const mutedTextClass = theme === 'light' ? 'text-gray-600' : 'text-slate-400'
  const tabActiveClass = theme === 'light' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-blue-500/20 text-blue-400 border-blue-500/50'
  const tabInactiveClass = theme === 'light' ? 'text-gray-500 hover:text-gray-700' : 'text-slate-400 hover:text-slate-200'

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={`relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border shadow-2xl ${bgClass}`}
          >
            <div className="p-8">
              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className={`text-2xl font-bold ${textClass}`}>Мой профиль</h2>
                  <p className={`text-sm ${mutedTextClass}`}>Управляйте своим аккаунтом и настройками</p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onClose}
                  className={`p-2 rounded-full transition-colors ${
                    theme === 'light' 
                      ? 'text-gray-400 hover:text-gray-600 hover:bg-gray-100' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  <X className="h-5 w-5" />
                </motion.button>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 mb-8">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveTab('profile')}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    activeTab === 'profile' ? tabActiveClass : tabInactiveClass
                  }`}
                >
                  <User className="w-4 h-4 inline mr-2" />
                  Профиль
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveTab('settings')}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    activeTab === 'settings' ? tabActiveClass : tabInactiveClass
                  }`}
                >
                  <Settings className="w-4 h-4 inline mr-2" />
                  Настройки
                </motion.button>
              </div>

              <AnimatePresence mode="wait">
                {activeTab === 'profile' && (
                  <motion.div
                    key="profile"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="space-y-8"
                  >
                    {/* Avatar Section */}
                    <div className="flex flex-col sm:flex-row items-center gap-6">
                      <div className="relative group">
                        <div className="relative w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600 ring-4 ring-blue-500/20">
                          {profile.avatar_url ? (
                            <Image
                              src={profile.avatar_url}
                              alt="Avatar"
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex items-center justify-center w-full h-full">
                              <User className="w-10 h-10 text-white" />
                            </div>
                          )}
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          className="absolute -bottom-2 -right-2 p-2 bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600 transition-colors"
                        >
                          <Camera className="w-4 h-4" />
                        </motion.button>
                      </div>
                      
                      <div className="text-center sm:text-left flex-1">
                        <h3 className={`text-xl font-bold ${textClass}`}>
                          {profile.full_name || profile.username || 'Пользователь'}
                        </h3>
                        <div className="flex items-center gap-2 mt-1 justify-center sm:justify-start">
                          <Mail className={`w-4 h-4 ${mutedTextClass}`} />
                          <span className={`text-sm ${mutedTextClass}`}>{user.email}</span>
                        </div>
                        <div className="mt-3 flex justify-center sm:justify-start">
                          {getRoleBadge(profile.role)}
                        </div>
                        {profile.created_at && (
                          <div className="flex items-center gap-2 mt-2 justify-center sm:justify-start">
                            <Calendar className={`w-4 h-4 ${mutedTextClass}`} />
                            <span className={`text-sm ${mutedTextClass}`}>
                              Регистрация: {new Date(profile.created_at).toLocaleDateString('ru-RU')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Profile Form */}
                    <div className="space-y-6">
                      <div>
                        <label className={`block text-sm font-semibold mb-3 ${textClass}`}>
                          Имя пользователя
                        </label>
                        <input
                          type="text"
                          value={formData.username}
                          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                          disabled={!isEditing}
                          className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:border-transparent transition-all disabled:opacity-50 ${inputClass}`}
                          placeholder="Введите имя пользователя"
                        />
                      </div>

                      <div>
                        <label className={`block text-sm font-semibold mb-3 ${textClass}`}>
                          Полное имя
                        </label>
                        <input
                          type="text"
                          value={formData.full_name}
                          onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                          disabled={!isEditing}
                          className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:border-transparent transition-all disabled:opacity-50 ${inputClass}`}
                          placeholder="Введите полное имя"
                        />
                      </div>

                      <div>
                        <label className={`block text-sm font-semibold mb-3 ${textClass}`}>
                          О себе
                        </label>
                        <textarea
                          value={formData.bio}
                          onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                          disabled={!isEditing}
                          rows={4}
                          className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:border-transparent transition-all disabled:opacity-50 resize-none ${inputClass}`}
                          placeholder="Расскажите о себе..."
                        />
                      </div>
                    </div>

                    {/* Messages */}
                    <AnimatePresence>
                      {error && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500"
                        >
                          <AlertCircle className="w-5 h-5 flex-shrink-0" />
                          <p className="text-sm font-medium">{error}</p>
                        </motion.div>
                      )}
                      {success && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-green-500"
                        >
                          <CheckCircle className="w-5 h-5 flex-shrink-0" />
                          <p className="text-sm font-medium">{success}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-3">
                      {isEditing ? (
                        <>
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleSave}
                            disabled={loading}
                            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:from-green-500/50 disabled:to-emerald-500/50 text-white rounded-xl font-semibold transition-all"
                          >
                            {loading ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                              <Save className="w-5 h-5" />
                            )}
                            Сохранить изменения
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                              setIsEditing(false)
                              setError('')
                              setSuccess('')
                            }}
                            className={`px-6 py-3 border rounded-xl font-semibold transition-all ${
                              theme === 'light' 
                                ? 'border-gray-300 text-gray-700 hover:bg-gray-50' 
                                : 'border-slate-600 text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            Отмена
                          </motion.button>
                        </>
                      ) : (
                        <>
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setIsEditing(true)}
                            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-xl font-semibold transition-all"
                          >
                            <Edit3 className="w-5 h-5" />
                            Редактировать профиль
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleSignOut}
                            className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white rounded-xl font-semibold transition-all"
                          >
                            <LogOut className="w-5 h-5" />
                            Выйти
                          </motion.button>
                        </>
                      )}
                    </div>
                  </motion.div>
                )}

                {activeTab === 'settings' && (
                  <motion.div
                    key="settings"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    {/* Team Management */}
                    <div>
                      <h3 className={`text-lg font-semibold mb-4 ${textClass}`}>Управление командой</h3>
                      <CreateTeamButton className="w-full" />
                    </div>

                    {/* Account Settings */}
                    <div>
                      <h3 className={`text-lg font-semibold mb-4 ${textClass}`}>Настройки аккаунта</h3>
                      <div className={`p-4 border rounded-xl ${theme === 'light' ? 'border-gray-200 bg-gray-50' : 'border-slate-600 bg-slate-700/50'}`}>
                        <p className={`text-sm ${mutedTextClass}`}>
                          Дополнительные настройки аккаунта будут добавлены в ближайшее время.
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
