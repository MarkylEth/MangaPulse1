'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Search, Menu, Grid3X3, User, Plus, Home, Shield } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useAuth } from '@/lib/auth/context'
import { useTheme } from '@/lib/theme/context'
import { useAuthNavigation } from '@/lib/auth/navigation'
import { ThemeToggle } from '@/components/ThemeToggle'
import { AuthModal } from '@/components/auth/AuthModal'
import { ProfileModal } from '@/components/profile/ProfileModal'
import { MangaSubmissionModal } from '@/components/manga/MangaSubmissionModal'

interface HeaderProps {
  searchQuery?: string
  onSearchChange?: (query: string) => void
  showSearch?: boolean
  sidebarOpen?: boolean
  onSidebarToggle?: () => void
}

/** Крупный логотип: меняется по теме и наклоняется при hover */
const ThemedLogo = ({ className = '' }: { className?: string }) => {
  const { theme } = useTheme()
  const src = theme === 'light' ? '/logo.png' : '/logodark.png'

  return (
    <motion.div
      className={`origin-left inline-block select-none ${className}`}
      initial={{ rotate: 0 }}
      whileHover={{ rotate: -6 }}
      whileTap={{ rotate: -8, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 500, damping: 28 }}
    >
      {/* ширину/высоту даём примерно по пропорции, фактический размер управляется h-* */}
      <Image
        src={src}
        alt="MangaPulse"
        width={500}
        height={500}
        priority
        className="w-auto h-5 sm:h-5 md:h-8" // ← крупнее и адаптивно
      />
    </motion.div>
  )
}

export function Header({
  searchQuery = '',
  onSearchChange,
  showSearch = true,
  sidebarOpen = false,
  onSidebarToggle
}: HeaderProps) {
  const { user, profile, loading } = useAuth()
  const { theme } = useTheme()
  const { canAccess } = useAuthNavigation()

  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login')
  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const [mangaModalOpen, setMangaModalOpen] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)

  useEffect(() => {
    const handleClickOutside = () => setShowUserMenu(false)
    if (showUserMenu) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showUserMenu])

  const openAuthModal = (mode: 'login' | 'register') => {
    setAuthModalMode(mode)
    setAuthModalOpen(true)
  }

  const textClass = theme === 'light' ? 'text-gray-900' : 'text-white'

  return (
    <>
      <header
        className={`backdrop-blur-sm border-b sticky top-0 z-50 ${
          theme === 'light'
            ? 'bg-white/90 border-gray-200'
            : 'bg-slate-800/50 border-slate-700'
        }`}
      >
        <div className="mx-auto px-3 sm:px-4">
          {/* компактная высота шапки */}
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-2.5">
            {/* Left */}
            <div className="flex items-center gap-3">
              {onSidebarToggle && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onSidebarToggle}
                  className={`p-1.5 rounded-lg transition-colors ${
                    theme === 'light'
                      ? 'bg-gray-100 hover:bg-gray-200'
                      : 'bg-slate-700 hover:bg-slate-600'
                  }`}
                  aria-label="Открыть меню"
                >
                  <Menu className={`w-4 h-4 ${textClass}`} />
                </motion.button>
              )}

              <Link href="/" className="flex items-center" aria-label="На главную">
                <ThemedLogo />
              </Link>
            </div>

             {/* Center section - Search */}
            {showSearch && (
              <div className="flex-1 max-w-2xl mx-auto">
                <div className="relative">
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 z-10">
                    <Link href="/catalog">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors"
                      >
                        <Grid3X3 className="w-4 h-4" />
                        Каталог
                      </motion.button>
                    </Link>
                  </div>
                  <input
                    type="text"
                    placeholder="   Поиск манги..."
                    value={searchQuery}
                    onChange={(e) => onSearchChange?.(e.target.value)}
                    className={`w-full rounded-lg pl-28 pr-12 py-3 border focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                      theme === 'light'
                        ? 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500'
                        : 'bg-slate-700 border-slate-600 text-white placeholder-slate-400'
                    }`}
                  />
                  <Search className={`absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
                    theme === 'light' ? 'text-gray-400' : 'text-slate-400'
                  }`} />
                </div>
              </div>
            )}


            {/* Center (no search) */}
            {!showSearch && (
              <div className="flex-1 flex items-center justify-center gap-4">
                <Link href="/">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 text-sm transition-colors ${
                      theme === 'light'
                        ? 'text-gray-600 hover:text-gray-900'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Home className="w-4 h-4" />
                    <span className="hidden sm:block">Главная</span>
                  </motion.button>
                </Link>
                <Link href="/catalog">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 text-sm transition-colors ${
                      theme === 'light'
                        ? 'text-gray-600 hover:text-gray-900'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Grid3X3 className="w-4 h-4" />
                    <span className="hidden sm:block">Каталог</span>
                  </motion.button>
                </Link>
                {canAccess.admin && (
                  <Link href="/admin">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-red-400 hover:text-red-300 transition-colors"
                    >
                      <Shield className="w-4 h-4" />
                      <span className="hidden sm:block">Админ</span>
                    </motion.button>
                  </Link>
                )}
              </div>
            )}

            {/* Right */}
            <div className="flex items-center gap-2">
              <ThemeToggle />

              {user && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setMangaModalOpen(true)}
                  className="p-1.5 rounded-lg bg-green-600 hover:bg-green-700 transition-colors"
                  title="Предложить мангу"
                >
                  <Plus className="w-4 h-4 text-white" />
                </motion.button>
              )}

              {user ? (
                <div className="relative">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowUserMenu(!showUserMenu)
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors ${
                      theme === 'light'
                        ? 'bg-gray-100 hover:bg-gray-200'
                        : 'bg-slate-700 hover:bg-slate-600'
                    }`}
                  >
                    {profile?.avatar_url ? (
                      <Image
                        src={profile.avatar_url}
                        alt="Avatar"
                        width={22}
                        height={22}
                        className="rounded-full object-cover"
                      />
                    ) : (
                      <User className={`w-4 h-4 ${textClass}`} />
                    )}
                    <span className={`text-sm hidden sm:block ${textClass}`}>
                      {profile?.username || 'Профиль'}
                    </span>
                  </motion.button>

                  {showUserMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      className={`absolute right-0 mt-2 w-48 rounded-lg border shadow-lg z-50 ${
                        theme === 'light'
                          ? 'bg-white border-gray-200'
                          : 'bg-slate-800 border-slate-700'
                      }`}
                    >
                      <div className="py-2">
                        <button
                          onClick={() => {
                            setProfileModalOpen(true)
                            setShowUserMenu(false)
                          }}
                          className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                            theme === 'light'
                              ? 'text-gray-700 hover:bg-gray-100'
                              : 'text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          Мой профиль
                        </button>
                        {canAccess.admin && (
                          <Link href="/admin">
                            <button
                              onClick={() => setShowUserMenu(false)}
                              className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                                theme === 'light'
                                  ? 'text-gray-700 hover:bg-gray-100'
                                  : 'text-slate-300 hover:bg-slate-700'
                              }`}
                            >
                              Админ панель
                            </button>
                          </Link>
                        )}
                      </div>
                    </motion.div>
                  )}
                </div>
              ) : (
                !loading && (
                  <div className="flex gap-2">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => openAuthModal('login')}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-white text-sm font-medium"
                    >
                      Войти
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => openAuthModal('register')}
                      className={`px-3 py-1.5 rounded-lg transition-colors text-sm font-medium ${
                        theme === 'light'
                          ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                          : 'bg-slate-700 hover:bg-slate-600 text-white'
                      }`}
                    >
                      Регистрация
                    </motion.button>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Modals */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authModalMode}
      />
      <ProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
      />
      {user && (
        <MangaSubmissionModal
          isOpen={mangaModalOpen}
          onClose={() => setMangaModalOpen(false)}
        />
      )}
    </>
  )
}
