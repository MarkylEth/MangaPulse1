'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BookOpen, Clock, Star } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/Header'
import { HeroCarousel } from '@/components/HeroCarousel'
import { useAuth } from '@/lib/auth/context'
import { useTheme } from '@/lib/theme/context'
import type { Database } from '@/database.types'
import { AuthModal } from '@/components/auth/AuthModal'

// ===== Типы =====
type MangaRow = Database['public']['Tables']['manga']['Row']
type Manga = Omit<MangaRow, 'genres'> & {
  genres?: string[]
  rating?: number | null
  chapters_count?: number
}

// ===== Разделы "Мои списки" =====
const MY_LISTS = [
  { key: 'reading',   label: 'Читаю' },
  { key: 'planned',   label: 'В планах' },
  { key: 'completed', label: 'Прочитано' },
  { key: 'dropped',   label: 'Брошено' },
  { key: 'favorite',  label: 'Любимое' },
] as const

type MyListKey = typeof MY_LISTS[number]['key']
type MyListsMap = Record<string, MyListKey[]> // mangaId -> список статусов пользователя

export default function Home() {
  const { theme } = useTheme()
  const { user } = useAuth()
  const supabase = useMemo(() => createClient(), [])

  // Router/query
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()

  // UI
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Auth modal
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login')

  // Данные
  const [mangaList, setMangaList] = useState<Manga[]>([])
  const [loadingManga, setLoadingManga] = useState(true)

  // HERO
  type CarouselItem = { id: number; title: string; coverUrl: string; href: string }
  const [heroItems, setHeroItems] = useState<CarouselItem[]>([])

  // Текущий выбранный раздел (или null = «Все манга»)
  const [selectedList, setSelectedList] = useState<MyListKey | null>(null)

  // Списки пользователя (временное локальное хранилище до БД)
  const [userListMap, setUserListMap] = useState<MyListsMap>({})

  /* ======================= Загрузка данных ======================= */
  // Манга
  useEffect(() => {
    ;(async () => {
      setLoadingManga(true)
      try {
        const { data, error } = await supabase
          .from('manga')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20)

        if (error) throw error
        const transformed: Manga[] = (data || []).map(item => ({
          ...item,
          genres: item.genres ? item.genres.split(',').map(g => g.trim()) : [],
        }))
        setMangaList(transformed)
      } catch (e) {
        console.error('Error loading manga:', e)
      } finally {
        setLoadingManga(false)
      }
    })()
  }, [supabase])

  // Баннеры
  useEffect(() => {
    let cancelled = false
    fetch('/api/banners')
      .then(r => r.json())
      .then((items: CarouselItem[]) => { if (!cancelled) setHeroItems(items) })
      .catch(console.error)
    return () => { cancelled = true }
  }, [])

  // Подхватываем список из URL (?list=reading/…)
  useEffect(() => {
    const list = sp?.get('list') as MyListKey | null
    const valid = list && (MY_LISTS as readonly any[]).some(l => l.key === list)
    setSelectedList(valid ? list : null)
  }, [sp])

  // Загружаем карту списков пользователя из localStorage
  useEffect(() => {
    if (!user?.id) { setUserListMap({}); return }
    const raw = localStorage.getItem(`mp:userListMap:${user.id}`)
    if (raw) {
      try { setUserListMap(JSON.parse(raw) as MyListsMap) } catch { setUserListMap({}) }
    } else {
      setUserListMap({})
    }
  }, [user?.id])

  /* ======================= Взаимодействия ======================= */
  const openList = (key: MyListKey) => {
    if (!user) { setAuthModalMode('login'); setAuthModalOpen(true); return }
    const params = new URLSearchParams(sp?.toString())
    params.set('list', key)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    setSidebarOpen(false)
  }

  /* ======================= Фильтрация ======================= */
  const filteredManga = mangaList.filter(item => {
    if (searchQuery && !item.title.toLowerCase().includes(searchQuery.toLowerCase())) return false
    if (user && selectedList) {
      const lists = userListMap[item.id as unknown as string] || []
      return lists.includes(selectedList)
    }
    return true
  })

  const heading = selectedList
    ? (MY_LISTS.find(l => l.key === selectedList)?.label ?? 'Мои списки')
    : 'Рекомендации'
  /* ======================= Тема ======================= */
  const bgClass = theme === 'light'
    ? 'bg-white border-gray-200'
    : 'bg-slate-800/60 backdrop-blur-sm border-slate-700'
  const textClass = theme === 'light' ? 'text-gray-900' : 'text-white'
  const mutedTextClass = theme === 'light' ? 'text-gray-600' : 'text-slate-400'

  return (
    <div className={`min-h-screen ${theme === 'light' ? 'bg-gray-50' : 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900'}`}>
      {/* Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-black/50 z-30"
            />
            <motion.aside
              initial={{ x: -320 }} animate={{ x: 0 }} exit={{ x: -320 }}
              className="fixed left-0 top-0 h-full w-80 bg-slate-800 border-r border-slate-700 z-40 overflow-y-auto"
            >
              <div className="p-6">
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-white">Мои списки</h2>
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors"
                    aria-label="Закрыть"
                  >×</button>
                </div>

                {!user && (
                  <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-3 text-sm text-slate-200 mb-6">
                    Войдите в аккаунт, чтобы смотреть свои списки.
                    <button
                      onClick={() => { setAuthModalMode('login'); setAuthModalOpen(true) }}
                      className="mt-3 w-full px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                    >
                      Войти / Зарегистрироваться
                    </button>
                  </div>
                )}

                {/* Разделы списков — это навигация, не выбор */}
                <div className="space-y-1">
                  {MY_LISTS.map(({ key, label }) => {
                    const active = selectedList === key
                    const base = 'w-full text-left px-3 py-2 rounded-lg transition-colors text-[15px] font-medium'
                    if (!user) {
                      return (
                        <div key={key} className={`${base} bg-slate-800/40 text-slate-300 select-none`}>
                          {label}
                        </div>
                      )
                    }
                    return (
                      <button
                        key={key}
                        onClick={() => openList(key)}
                        className={`${base} ${active ? 'bg-blue-600/30 text-white' : 'bg-slate-800/40 text-slate-200 hover:bg-slate-700/60'}`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main */}
      <main className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'ml-80' : 'ml-0'}`}>
        <Header
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          showSearch={true}
          sidebarOpen={sidebarOpen}
          onSidebarToggle={() => setSidebarOpen(!sidebarOpen)}
        />

        <div className="p-6">
          {/* Баннеры */}
          <section className="mb-8">
          <HeroCarousel items={heroItems} />
          </section>

          <div className="flex items-center justify-between mb-6">
            <h1 className={`text-2xl font-bold ${textClass}`}>{heading}</h1>
            <div className={mutedTextClass}>
              {loadingManga ? 'Загрузка…' : `Найдено: ${filteredManga.length}`}
            </div>
          </div>

          {/* Сетка манги или плейсхолдер для пустого списка */}
          {selectedList && user && !loadingManga && filteredManga.length === 0 ? (
            <div className={`text-center py-16 ${mutedTextClass}`}>
              <p className="text-lg">В этом списке пока пусто.</p>
            </div>
          ) : !loadingManga && filteredManga.length === 0 ? (
            <div className={`text-center py-20 ${mutedTextClass}`}>
              <p className="text-lg">Манга не найдена</p>
            </div>
          ) : (
            <motion.div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
              {filteredManga.map(manga => (
                <motion.div
                  key={manga.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -8, scale: 1.02 }}
                  className={`${bgClass} rounded-xl overflow-hidden hover:border-blue-500/50 transition-all duration-300 group`}
                >
                  <div className="aspect-[3/4] relative overflow-hidden">
                    <Image
                      src={manga.cover_url || '/placeholder.png'}
                      alt={manga.title}
                      fill
                      className="object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                    {manga.status && (
                      <div className="absolute top-2 left-2">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            manga.status === 'ongoing'
                              ? 'bg-green-500 text-white'
                              : manga.status === 'completed'
                              ? 'bg-blue-500 text-white'
                              : 'bg-orange-500 text-white'
                          }`}
                        >
                          {manga.status === 'ongoing' ? 'Онгоинг' : manga.status === 'completed' ? 'Завершено' : 'Заморожено'}
                        </span>
                      </div>
                    )}

                    <div className="absolute top-2 right-2">
                      <div className="flex items-center gap-1 bg-black/70 backdrop-blur-sm rounded-full px-2 py-1">
                        <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                        <span className="text-xs text-white font-medium">{(manga.rating || 0).toFixed(1)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4">
                    <h3 className={`font-semibold line-clamp-2 mb-2 ${textClass}`}>{manga.title}</h3>

                    <div className={`flex items-center gap-4 text-xs ${mutedTextClass} mb-3`}>
                      <div className="flex items-center gap-1">
                        <BookOpen className="w-3 h-3" />
                        <span>{manga.chapters_count || 0} глав</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(manga.created_at).toLocaleDateString('ru-RU')}</span>
                      </div>
                    </div>

                    {manga.genres && manga.genres.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {manga.genres.slice(0, 3).map((genre: string, index: number) => (
                          <span
                            key={index}
                            className={`px-2 py-1 rounded text-xs ${
                              theme === 'light' ? 'bg-gray-100 text-gray-700' : 'bg-slate-700 text-slate-300'
                            }`}
                          >
                            {genre}
                          </span>
                        ))}
                        {manga.genres.length > 3 && (
                          <span className={`px-2 py-1 rounded text-xs ${mutedTextClass}`}>
                            +{manga.genres.length - 3}
                          </span>
                        )}
                      </div>
                    )}

                    <Link href={`/manga/${manga.id}`}>
                      <motion.button
                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                      >
                        Читать
                      </motion.button>
                    </Link>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </main>

      {/* Модалка авторизации */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authModalMode}
      />
    </div>
  )
}