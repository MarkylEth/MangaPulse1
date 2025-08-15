'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/Header'
import { useTheme } from '@/lib/theme/context'
import { useAuth } from '@/lib/auth/context'
import type { Tables } from '@/database.types'
import TeamPosts from '@/components/team/TeamPosts'
import {
  Check,
  Heart,
  UsersRound,
  Edit,
  X,
  Plus,
  Trash2,
  Star,
  Calendar,
  ExternalLink,
  BookOpen,
  TrendingUp,
  Users,
  Award,
  MessageCircle,
  Share2,
  Clock,
  Activity
} from 'lucide-react'

/* ========= DB types ========= */
type Team = Tables<'translator_teams'>
type TeamMember = Tables<'translator_team_members'>
type Profile = Tables<'profiles'>

type ProfileLite = Pick<Profile, 'id' | 'username' | 'avatar_url'>
type MemberWithProfile = TeamMember & { profile: ProfileLite | null }

type TeamTitle = {
  id: number
  name: string
  slug?: string | null
  cover_url?: string | null
  status?: string | null
  chapters_count?: number
  rating?: number
  last_update?: string
}

type EditValues = {
  name: string
  avatar_url: string
  bio: string
  hiring_text: string | null
  discord_url: string | null
  boosty_url: string | null
  langs: string[]
  tags: string[]
  members: { username: string; role: string }[]
}

/* ========= helpers for schema-agnostic mapping ========= */
function pickStr(o: any, keys: string[], fallback = ''): string {
  for (const k of keys) {
    const v = o?.[k]
    if (v !== undefined && v !== null && String(v).trim().length) return String(v)
  }
  return fallback
}

function pickNullableStr(o: any, keys: string[]): string | null {
  for (const k of keys) {
    const v = o?.[k]
    if (v !== undefined && v !== null && String(v).trim().length) return String(v)
  }
  return null
}

function mapTitleRow(row: any): TeamTitle {
  return {
    id: Number(row.id),
    name: pickStr(row, ['title', 'name'], 'Без названия'),
    slug: pickNullableStr(row, ['slug']),
    cover_url: pickNullableStr(row, ['cover_url']),
    status: pickNullableStr(row, ['status']),
    chapters_count: row.chapters_count || 0,
    rating: row.rating || 0,
    last_update: row.updated_at || row.created_at
  }
}

export default function TeamPage(): JSX.Element {
  const { theme } = useTheme()
  const { user, profile } = useAuth()

  const params = useParams() as Record<string, string | string[]> | null
  const slug =
    (Array.isArray(params?.slug) ? params?.slug?.[0] : (params?.slug as string | undefined)) ?? ''

  const sb = useMemo(() => createClient(), [])

  // загрузки разделены
  const [initialLoading, setInitialLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingTitles, setLoadingTitles] = useState(false)

  const [team, setTeam] = useState<Team | null>(null)
  const [members, setMembers] = useState<MemberWithProfile[]>([])
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isFollowing, setIsFollowing] = useState(false)

  const [activeTab, setActiveTab] = useState<'overview' | 'titles' | 'posts'>('overview')

  const [titles, setTitles] = useState<TeamTitle[]>([])

  const [showAllMembers, setShowAllMembers] = useState(false)
  const [showAllTags, setShowAllTags] = useState(false)

  // для всплывашки "Ссылка скопирована"
const [copied, setCopied] = useState(false)


  // ref для актуального состояния в обработчиках
  const teamRef = useRef<Team | null>(null)
  useEffect(() => {
    teamRef.current = team
  }, [team])

  // лок против конкурирующих загрузок
  const loadLockRef = useRef(false)

  // --- Лёгкий рефетч на фокус вкладки (без перезагрузки тайтлов) ---
const lastFocusRefresh = useRef(0)

const refreshOnFocus = async () => {
  if (!team) return
  const now = Date.now()
  if (now - lastFocusRefresh.current < 60_000) return // не чаще раза в минуту
  lastFocusRefresh.current = now

  try {
    // подтянуть свежие счётчики команды (тайтлы не трогаем)
    const { data: t2 } = await sb
      .from('translator_teams')
      .select('likes_count, followers_count, stats_pages, stats_inwork, updated_at')
      .eq('id', team.id)
      .single()

    if (t2) setTeam(prev => (prev ? { ...prev, ...t2 } as any : prev))

    // актуализируем статус подписки
    if (user) {
      const { data } = await sb
        .from('team_followers')
        .select('id')
        .eq('team_id', team.id)
        .eq('user_id', user.id)
        .maybeSingle()
      setIsFollowing(!!data)
    }
  } catch (e) {
    console.warn('refreshOnFocus error', e)
  }
}

  // единый загрузчик данных команды (без привязки к user)
  const loadTeam = async (isFirst: boolean, withTitles: boolean = true) => {
    if (loadLockRef.current) return
    loadLockRef.current = true

    isFirst ? setInitialLoading(true) : setRefreshing(true)
    if (withTitles) setLoadingTitles(true)

    try {
      // 1) Команда
      const { data: t, error: teamErr } = await sb
        .from('translator_teams')
        .select('*')
        .eq('slug', slug)
        .maybeSingle<Team>()

      if (teamErr || !t) {
        setTeam(null)
        setMembers([])
        setTitles([])
        return
      }

      setTeam(t)

      // 2) Тайтлы
      try {
        if (withTitles) {
          if ((t as any).manga_id) {
            const { data: manga } = await sb
              .from('manga')
              .select('*')
              .eq('id', (t as any).manga_id)
              .single()
          setTitles(manga ? [mapTitleRow(manga)] : [])
        } else {
          setTitles([])
        }
      }
    } catch (e) {
      console.error('Error loading manga:', e)
      if (withTitles) setTitles([])
    }

      // 3) Участники
      const { data: teamMembers } = await sb
        .from('translator_team_members')
        .select('user_id, role, team_id, added_at')
        .eq('team_id', t.id)

      const userIds = Array.from(new Set((teamMembers ?? []).map((m) => m.user_id)))
      if (userIds.length) {
        const { data: profs } = await sb
          .from('profiles')
          .select('id, username, avatar_url')
          .in('id', userIds)
        const profLite = (profs ?? []) as ProfileLite[]

        setMembers(
          (teamMembers ?? []).map((m) => ({
            ...(m as TeamMember),
            profile: profLite.find((p) => p.id === m.user_id) ?? null
          }))
        )
      } else {
        setMembers([])
      }
    } catch (e) {
      console.error('Error loading team:', e)
      setTeam(null)
      setMembers([])
      setTitles([])
    } finally {
      if (withTitles) setLoadingTitles(false)  // ← всегда закрываем спиннер
      isFirst ? setInitialLoading(false) : setRefreshing(false)
      loadLockRef.current = false
    }
  }

  // первичная загрузка + обновление при возврате на вкладку
  useEffect(() => {
    if (!slug) {
      setInitialLoading(false)
      return
    }
    // первичная загрузка с тайтлами
    void loadTeam(true, true)
  
    // при возврате во вкладку — лёгкий рефетч без тайтлов
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        void refreshOnFocus()
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [slug, sb, team?.id, user?.id])
  
  // проверка подписки + актуализация счётчика после загрузки команды/появления user
  useEffect(() => {
    const checkFollow = async () => {
      if (!user || !team) {
        setIsFollowing(false)
        return
      }

      // проверяем факт подписки
      const { data, error } = await sb
        .from('team_followers')
        .select('id')
        .eq('team_id', team.id)
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) {
        console.warn('checkFollow error', error)
        setIsFollowing(false)
      } else {
        setIsFollowing(!!data)
      }

      // подтягиваем точный total подписчиков (если политика RLS разрешает head+count)
      const { count: total } = await sb
        .from('team_followers')
        .select('id', { count: 'exact', head: true })
        .eq('team_id', team.id)

      if (typeof total === 'number') {
        setTeam((prev) => (prev ? { ...prev, followers_count: total as any } : prev))
      }
    }

    void checkFollow()
  }, [user?.id, team?.id, sb])

  // Подписаться/отписаться
  const toggleFollow = async () => {
    if (!user || !team) return
    try {
      if (isFollowing) {
        await sb.from('team_followers').delete().eq('team_id', team.id).eq('user_id', user.id)
        setIsFollowing(false)
      } else {
        await sb.from('team_followers').insert({ team_id: team.id, user_id: user.id })
        setIsFollowing(true)
      }

      const { count: total } = await sb
        .from('team_followers')
        .select('id', { count: 'exact', head: true })
        .eq('team_id', team.id)

      if (typeof total === 'number') {
        setTeam((prev) => (prev ? { ...prev, followers_count: total as any } : prev))
      }
    } catch (error) {
      console.error('Error toggling follow:', error)
    }
  }
  
  // Копирование ссылки + мини-тост
const copyLink = async () => {
  try {
    const url = window.location.href
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url)
    } else {
      // fallback
      const ta = document.createElement('textarea')
      ta.value = url
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  } catch (e) {
    console.error('copy link failed', e)
  }
}

  // Проверка прав доступа (учитываем profile.role + membership + created_by)
  const canEdit = useMemo(() => {
    if (!user) return false

    const metaRole = user.user_metadata?.role as string | undefined
    const dbRole = profile?.role as string | undefined
    const membership = members.find((m) => m.user_id === user.id)
    const teamRole = membership?.role
    const elevated = new Set(['admin', 'moderator', 'owner', 'lead', 'leader', 'editor'])

    return (
      (metaRole && elevated.has(metaRole)) ||
      (dbRole && elevated.has(dbRole)) ||
      team?.created_by === user.id ||
      (teamRole && elevated.has(String(teamRole)))
    )
  }, [user?.id, profile?.role, team?.created_by, members])

  const bgClass =
    theme === 'light' ? 'bg-gray-50' : 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900'
  const cardBgClass =
    theme === 'light' ? 'bg-white border-gray-200' : 'bg-slate-800/60 backdrop-blur-sm border-slate-700'
  const textClass = theme === 'light' ? 'text-gray-900' : 'text-white'
  const mutedTextClass = theme === 'light' ? 'text-gray-600' : 'text-slate-400'

  if (!slug) {
    return (
      <div className={`min-h-screen ${bgClass}`}>
        <Header showSearch={false} />
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className={`rounded-2xl border p-6 ${cardBgClass}`}>
            <div className="text-center">
              <div className="text-4xl mb-4">🔍</div>
              <h1 className={`text-2xl font-bold ${textClass} mb-2`}>Неверный URL</h1>
              <p className={mutedTextClass}>Отсутствует идентификатор команды в URL</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // скелетон только при самом первом рендере
  if (initialLoading) {
    return (
      <div className={`min-h-screen ${bgClass}`}>
        <Header showSearch={false} />
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className={`h-48 rounded-2xl border animate-pulse ${cardBgClass}`} />
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className={`h-32 rounded-2xl border animate-pulse ${cardBgClass}`} />
            <div className={`h-32 rounded-2xl border animate-pulse ${cardBgClass}`} />
            <div className={`h-32 rounded-2xl border animate-pulse ${cardBgClass}`} />
          </div>
        </div>
      </div>
    )
  }

  if (!team) {
    return (
      <div className={`min-h-screen ${bgClass}`}>
        <Header showSearch={false} />
        <div className="mx-auto max-w-6xl px-4 py-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl border p-8 ${cardBgClass} text-center`}
          >
            <div className="text-6xl mb-6">😔</div>
            <h1 className={`text-3xl font-bold ${textClass} mb-4`}>Команда не найдена</h1>
            <p className={`${mutedTextClass} mb-6 text-lg`}>
              К сожалению, команда с таким именем не существует или была удалена
            </p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => window.history.back()}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Вернуться назад
            </motion.button>
          </motion.div>
        </div>
      </div>
    )
  }

  const sinceText = team.started_at ? `с ${new Date(team.started_at).getFullYear()}` : ''
  const resources = (
    [
      team.discord_url && { key: 'Discord', href: team.discord_url, icon: '#', color: 'bg-[#7289da]' },
      team.boosty_url && { key: 'Boosty', href: team.boosty_url, icon: 'B', color: 'bg-[#ff6b35]' }
    ].filter(Boolean) as { key: string; href: string; icon: string; color: string }[]
  )

  const displayMembers = showAllMembers ? members : members.slice(0, 12)
  const displayTags = showAllTags ? (team.tags || []) : (team.tags || []).slice(0, 6)

  return (
    <div className={`min-h-screen ${bgClass}`}>
      <Header showSearch={false} />

      {/* тонкая полоска фонового рефетча */}
      {refreshing && <div className="fixed left-0 top-0 h-0.5 w-full bg-blue-500/70" />}

      {/* Breadcrumb */}
      <div className="mx-auto max-w-6xl px-5 pt-6">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2 text-sm">
          <span className={`uppercase tracking-wide ${mutedTextClass}`}>Команды переводчиков</span>
          <span className={mutedTextClass}>/</span>
          <span className={textClass}>{team.name}</span>
        </motion.div>
      </div>

      <div className="mx-auto max-w-6xl px-5 py-6">
{/* Шапка профиля */}
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  className={`mb-6 rounded-2xl border shadow-sm ${cardBgClass} overflow-hidden`}
>
  {/* Баннер — выше */}
  <div className="h-64 sm:h-72 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 relative">
    <div className="absolute inset-0 bg-black/20" />
  </div>

  {/* Тёмная полоса под баннером */}
  <div className="bg-slate-900 text-white">
    <div className="px-6 py-5">
      <div className="flex items-start justify-between gap-6">
        {/* Левая часть: аватар + текст */}
        <div className="flex items-center gap-6 min-w-0">
          {/* Аватар чуть заезжает на баннер */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="-mt-16 relative"
          >
            <div className="relative h-[120px] w-[120px] overflow-hidden rounded-2xl bg-white ring-4 ring-white shadow-xl">
              {team.avatar_url ? (
                <img src={team.avatar_url} alt="avatar" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center text-4xl bg-gradient-to-br from-blue-400 to-purple-600 text-white">
                  🦊
                </div>
              )}
            </div>
            {(team as any).verified && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.4, type: 'spring' }}
                className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-[#4285f4] text-white shadow-lg"
              >
                <Check className="h-4 w-4" />
              </motion.div>
            )}
          </motion.div>

          {/* Название / ник / счётчики — на тёмной полосе */}
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-3">
              <h1 className="text-3xl font-bold truncate text-white">{team.name}</h1>
            </div>
            <div className="mb-3 text-[16px] text-slate-300">@{team.slug ?? team.id}</div>

            <div className="flex flex-wrap items-center gap-6 text-[15px]">
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-slate-400" />
                <span className="font-semibold text-white">
                  {formatK((team as any).likes_count ?? 0)}
                </span>
                <span className="text-slate-400">лайков</span>
              </div>
              <div className="flex items-center gap-2">
                <UsersRound className="h-4 w-4 text-slate-400" />
                <span className="font-semibold text-white">
                  {formatK((team as any).followers_count ?? 0)}
                </span>
                <span className="text-slate-400">подписчиков</span>
              </div>
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-slate-400" />
                <span className="font-semibold text-white">{titles.length}</span>
                <span className="text-slate-400">тайтлов</span>
              </div>
              {team.started_at && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  <span className="text-slate-300">
                    с {new Date(team.started_at).getFullYear()}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Правая часть: кнопки + тост "Ссылка скопирована" */}
        <div className="flex shrink-0 items-center gap-3 relative">
          {user && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={toggleFollow}
              className={`px-6 py-3 rounded-xl font-medium transition-all shadow-lg ${
                isFollowing
                  ? 'bg-slate-800 text-white border-2 border-slate-700 hover:bg-slate-700'
                  : 'bg-[#2196F3] text-white hover:bg-[#1976D2] border-2 border-transparent'
              }`}
            >
              {isFollowing ? '✓ Подписан' : 'Подписаться'}
            </motion.button>
          )}

          {/* Поделиться: копируем ссылку */}
          <div className="relative">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={copyLink}
              className="p-3 rounded-xl border-2 border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 shadow-sm"
              title="Скопировать ссылку"
            >
              <Share2 className="h-4 w-4" />
            </motion.button>

            {/* Тост "Ссылка скопирована" */}
            <AnimatePresence>
              {copied && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="absolute right-0 -top-10 whitespace-nowrap rounded-lg bg-slate-900 text-white text-xs px-3 py-1 shadow-lg"
                >
                  Ссылка скопирована
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {user && canEdit && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsEditOpen(true)}
              className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 shadow-sm"
            >
              <Edit className="h-4 w-4" />
              Редактировать
            </motion.button>
          )}
        </div>
      </div>
    </div>
  </div>
</motion.div>

        {/* Табы */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className={`mb-6 rounded-2xl border ${cardBgClass} overflow-hidden`}>
          <div className="flex">
            <Tab active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<Activity className="w-4 h-4" />}>
              Обзор
            </Tab>
            <Tab active={activeTab === 'titles'} onClick={() => setActiveTab('titles')} icon={<BookOpen className="w-4 h-4" />}>
              Переводят ({titles.length})
            </Tab>
            <Tab active={activeTab === 'posts'} onClick={() => setActiveTab('posts')} icon={<MessageCircle className="w-4 h-4" />}>
              Посты
            </Tab>
          </div>
        </motion.div>

        {/* Контент табов */}
        <AnimatePresence initial={false} mode="sync">
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-1 gap-6 lg:grid-cols-3"
            >
              {/* Левая колонка */}
              <div className="space-y-6">
                <Section>
                  <SectionTitle icon={<Users className="w-5 h-5" />}>О команде</SectionTitle>
                  <p className="mb-6 whitespace-pre-wrap text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
                    {team.bio || 'Команда переводчиков манги на платформе MangaPulse. Мы работаем над качественными переводами для русскоязычных читателей.'}
                  </p>

                  <SectionTitle>Что переводят</SectionTitle>
                  <div className="mb-4 flex flex-wrap gap-2">
                    {displayTags.map((t, i) => (
                      <motion.span
                        key={`tag-${i}`}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.05 }}
                        className={`rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${
                          theme === 'light'
                            ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        {t}
                      </motion.span>
                    ))}
                    {(team.tags || []).length > 6 && !showAllTags && (
                      <button
                        onClick={() => setShowAllTags(true)}
                        className={`rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${
                          theme === 'light'
                            ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                            : 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30'
                        }`}
                      >
                        +{(team.tags || []).length - 6} еще
                      </button>
                    )}
                  </div>

                  <div className="mb-4 flex flex-wrap gap-2">
                    {(team.langs?.length ? team.langs : ['RU→EN']).map((t, i) => (
                      <motion.span
                        key={`lang-${i}`}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.05 + 0.2 }}
                        className={`rounded-full px-3 py-1.5 text-[13px] font-medium ${
                          theme === 'light'
                            ? 'bg-[#e3f2fd] text-[#1976D2]'
                            : 'bg-blue-600/20 text-blue-400 border border-blue-600/30'
                        }`}
                      >
                        {t}
                      </motion.span>
                    ))}
                  </div>
                </Section>

                {/* Статистика */}
                <Section>
                  <SectionTitle icon={<TrendingUp className="w-5 h-5" />}>Статистика</SectionTitle>
                  <div className="grid grid-cols-2 gap-4">
                    <div className={`${theme === 'light' ? 'bg-blue-50' : 'bg-blue-600/10'} p-4 rounded-lg`}>
                      <div className={`text-2xl font-bold ${theme === 'light' ? 'text-blue-900' : 'text-blue-400'}`}>
                        {formatK((team as any).stats_pages ?? 0)}
                      </div>
                      <div className={`text-sm ${theme === 'light' ? 'text-blue-600' : 'text-blue-300'}`}>Глав переведено</div>
                    </div>
                    <div className={`${theme === 'light' ? 'bg-green-50' : 'bg-green-600/10'} p-4 rounded-lg`}>
                      <div className={`text-2xl font-bold ${theme === 'light' ? 'text-green-900' : 'text-green-400'}`}>
                        {formatK((team as any).stats_inwork ?? 0)}
                      </div>
                      <div className={`text-sm ${theme === 'light' ? 'text-green-600' : 'text-green-300'}`}>В работе</div>
                    </div>
                  </div>
                </Section>
              </div>

              {/* Средняя колонка */}
              <div className="space-y-6">
                <Section>
                  <SectionTitle icon={<ExternalLink className="w-5 h-5" />}>Ресурсы</SectionTitle>
                  <div className="mb-6 flex flex-wrap gap-3">
                    {resources.length === 0 ? (
                      <div className={`text-[14px] ${mutedTextClass}`}>Ничего не указано</div>
                    ) : (
                      resources.map((r) => (
                        <motion.a
                          key={r.key}
                          href={r.href}
                          target="_blank"
                          rel="noreferrer"
                          whileHover={{ scale: 1.05, y: -2 }}
                          whileTap={{ scale: 0.95 }}
                          className={`inline-flex items-center gap-3 rounded-xl border px-4 py-3 font-medium transition-all hover:shadow-lg ${
                            theme === 'light'
                              ? 'border-slate-200 bg-white hover:bg-slate-50'
                              : 'border-slate-600 bg-slate-700/50 hover:bg-slate-600/50'
                          }`}
                        >
                          <span className={`flex h-6 w-6 items-center justify-center rounded ${r.color}`}>
                            <span className="text-[12px] font-bold text-white">{r.icon}</span>
                          </span>
                          <span className={textClass}>{r.key}</span>
                        </motion.a>
                      ))
                    )}
                  </div>

                  {/* Участники команды */}
                  <div>
                    <div className="mb-4 flex items-center justify-between">
                      <SectionTitle className="!mb-0" icon={<Users className="w-5 h-5" />}>
                        Команда ({members.length})
                      </SectionTitle>
                    </div>

                    <div className="grid grid-cols-4 gap-3">
                      {displayMembers.map((m, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: idx * 0.05 }}
                          whileHover={{ scale: 1.05, y: -5 }}
                          className="text-center group cursor-pointer"
                        >
                          <div
                            className={`mx-auto h-16 w-16 overflow-hidden rounded-xl mb-2 ring-2 transition-all group-hover:ring-4 ${
                              theme === 'light'
                                ? 'bg-slate-200 ring-slate-300 group-hover:ring-blue-300'
                                : 'bg-slate-700 ring-slate-600 group-hover:ring-blue-500'
                            }`}
                          >
                            {m.profile?.avatar_url ? (
                              <img src={m.profile.avatar_url} alt="avatar" className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center text-xl">👤</div>
                            )}
                          </div>
                          <div className={`truncate text-[12px] font-medium ${textClass}`}>{m.profile?.username || '—'}</div>
                          <div className={`text-[10px] ${mutedTextClass}`}>{roleLabel(m.role)}</div>
                        </motion.div>
                      ))}

                      {members.length > 12 && !showAllMembers && (
                        <motion.button
                          onClick={() => setShowAllMembers(true)}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className={`h-16 w-16 mx-auto rounded-xl border-2 border-dashed flex items-center justify-center text-xl ${
                            theme === 'light'
                              ? 'border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-500'
                              : 'border-slate-600 text-slate-500 hover:border-blue-500 hover:text-blue-400'
                          }`}
                        >
                          +{members.length - 12}
                        </motion.button>
                      )}
                    </div>
                  </div>
                </Section>
              </div>

              {/* Правая колонка */}
              <div className="space-y-6">
                <Section>
                  <SectionTitle icon={<Award className="w-5 h-5" />}>Топ участников</SectionTitle>
                  <div className="space-y-3">
                    {members.slice(0, 5).map((m, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                          theme === 'light' ? 'hover:bg-gray-50' : 'hover:bg-slate-700/50'
                        }`}
                      >
                        <div className="relative">
                          <div className={`h-10 w-10 overflow-hidden rounded-full ${theme === 'light' ? 'bg-slate-200' : 'bg-slate-600'}`}>
                            {m.profile?.avatar_url ? (
                              <img src={m.profile.avatar_url} alt="avatar" className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center text-sm">👤</div>
                            )}
                          </div>
                          {i < 3 && (
                            <div
                              className={`absolute -top-1 -right-1 w-4 h-4 rounded-full text-xs flex items-center justify-center ${
                                i === 0 ? 'bg-yellow-500' : i === 1 ? 'bg-gray-400' : 'bg-orange-500'
                              } text-white`}
                            >
                              {i + 1}
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className={`text-[14px] font-medium ${textClass}`}>{m.profile?.username || '—'}</div>
                          <div className={`text-[12px] ${mutedTextClass}`}>{roleLabel(m.role)}</div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                          <span className={`text-xs font-medium ${textClass}`}>{Math.floor(Math.random() * 100) + 50}</span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </Section>

                {/* Блок найма */}
                {((team as any).hiring_text || 'Нужен тайлсеттер') && (
                  <Section>
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={`rounded-lg border p-4 ${
                        theme === 'light' ? 'border-amber-200 bg-amber-50' : 'border-amber-600/30 bg-amber-600/10'
                      }`}
                    >
                      <h4 className={`mb-2 font-semibold flex items-center gap-2 ${theme === 'light' ? 'text-amber-800' : 'text-amber-400'}`}>
                        <Users className="w-4 h-4" />
                        Мы ищем таланты!
                      </h4>
                      <p className={`text-[14px] ${theme === 'light' ? 'text-amber-700' : 'text-amber-300'}`}>
                        {(team as any).hiring_text ?? 'Нужен тайлсеттер'}
                      </p>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={`mt-3 w-full rounded-lg py-2 text-sm font-medium transition-colors ${
                          theme === 'light'
                            ? 'bg-amber-200 text-amber-800 hover:bg-amber-300'
                            : 'bg-amber-600/20 text-amber-300 border border-amber-600/30 hover:bg-amber-600/30'
                        }`}
                      >
                        Связаться с командой
                      </motion.button>
                    </motion.div>
                  </Section>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'titles' && (
            <motion.div
              key="titles"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <Section>
                <SectionTitle icon={<BookOpen className="w-5 h-5" />}>Переводимые тайтлы ({titles.length})</SectionTitle>

                {loadingTitles ? (
                  <div className="text-center py-8">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mb-3"
                    />
                    <p className={`text-sm ${mutedTextClass}`}>Загружаем тайтлы...</p>
                  </div>
                ) : titles.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-4xl mb-4">📚</div>
                    <p className={`text-lg ${mutedTextClass} mb-2`}>Пока нет переводимых тайтлов</p>
                    <p className={`text-sm ${mutedTextClass}`}>Команда еще не начала работу над проектами</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                    {titles.map((t, index) => (
                      <motion.a
                        key={t.id}
                        href={`/manga/${t.id}`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        whileHover={{ y: -8, scale: 1.02 }}
                        className={`group block overflow-hidden rounded-xl border shadow-sm transition-all hover:shadow-lg ${
                          theme === 'light' ? 'border-slate-200 bg-white hover:border-blue-300' : 'border-slate-700 bg-slate-800/60 hover:border-blue-500'
                        }`}
                      >
                        <div className="aspect-[3/4] w-full overflow-hidden bg-slate-100 relative">
                          {t.cover_url ? (
                            <img src={t.cover_url} alt={t.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-110" />
                          ) : (
                            <div className={`grid h-full place-items-center ${mutedTextClass}`}>
                              <BookOpen className="w-8 h-8" />
                            </div>
                          )}

                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="absolute bottom-2 left-2 right-2">
                              {t.rating && (
                                <div className="flex items-center gap-1 mb-1">
                                  <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                                  <span className="text-xs text-white font-medium">{t.rating.toFixed(1)}</span>
                                </div>
                              )}
                              {t.chapters_count && <div className="text-xs text-white">{t.chapters_count} глав</div>}
                            </div>
                          </div>

                          {t.status && (
                            <div className="absolute top-2 left-2">
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  t.status === 'ongoing'
                                    ? 'bg-green-500 text-white'
                                    : t.status === 'completed'
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-orange-500 text-white'
                                }`}
                              >
                                {t.status === 'ongoing' ? 'Онгоинг' : t.status === 'completed' ? 'Завершен' : t.status}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="p-3">
                          <div className={`truncate text-[13px] font-medium mb-1 ${textClass}`}>{t.name}</div>
                          {t.last_update && (
                            <div className={`text-[11px] ${mutedTextClass} flex items-center gap-1`}>
                              <Clock className="w-3 h-3" />
                              {new Date(t.last_update).toLocaleDateString('ru-RU')}
                            </div>
                          )}
                        </div>
                      </motion.a>
                    ))}
                  </div>
                )}
              </Section>
            </motion.div>
          )}

          {activeTab === 'posts' && (
            <motion.div
              key="posts"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <TeamPosts
                teamId={team.id as number} // писать посты: только лидер/owner/админ
                canPost={( () => {
                  const membership = members.find(m => m.user_id === user?.id)
                  const isLead = ['lead','leader','owner'].includes(String(membership?.role))
                  const isAdmin = ['admin','moderator'].includes(String(profile?.role))
                  return !!user && (isLead || isAdmin)
                })()}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* === Edit Modal === */}
      {isEditOpen && canEdit && (
        <EditModal
          initial={{
            name: team.name ?? '',
            avatar_url: team.avatar_url ?? '',
            bio: team.bio ?? '',
            hiring_text: (team as unknown as { hiring_text?: string }).hiring_text ?? '',
            discord_url: team.discord_url ?? null,
            boosty_url: team.boosty_url ?? null,
            langs: team.langs ?? ['RU→EN'],
            tags: team.tags ?? ['Манга', 'Игры', 'Дорамы'],
            members: members.map((m) => ({
              username: m.profile?.username ?? '',
              role: m.role ?? 'member'
            }))
          }}
          onClose={() => setIsEditOpen(false)}
          onSave={async (v) => {
            try {
              const { error: upErr } = await sb
                .from('translator_teams')
                .update({
                  name: v.name.trim(),
                  avatar_url: v.avatar_url.trim(),
                  bio: v.bio,
                  discord_url: v.discord_url || null,
                  boosty_url: v.boosty_url || null,
                  langs: v.langs,
                  tags: v.tags,
                  hiring_text: v.hiring_text?.trim() || null
                })
                .eq('id', (team as any).id)
              if (upErr) throw new Error(upErr.message)

              const usernames = Array.from(new Set(v.members.map((m) => m.username.trim()).filter((u) => u.length > 0)))
              const { data: profs, error: profErr } = await sb.from('profiles').select('id, username').in('username', usernames)
              if (profErr) throw new Error(profErr.message)

              const idByUsername = new Map((profs ?? []).map((p) => [p.username, p.id]))
              const desiredIds = new Set(
                v.members.map((m) => idByUsername.get(m.username.trim())).filter((id): id is string => !!id)
              )

              const currentIds = new Set(members.map((m) => m.user_id))
              const toDeleteIds = [...currentIds].filter((id) => !desiredIds.has(id))
              const teamKey: any = (team as any).id

              const toUpsert = v.members
                .map((m) => {
                  const uid = idByUsername.get(m.username.trim())
                  return uid
                    ? {
                        team_id: teamKey,
                        user_id: uid,
                        role: m.role ?? 'member'
                      }
                    : null
                })
                .filter(Boolean) as any[]

              if (toDeleteIds.length) {
                const { error: delErr } = await sb.from('translator_team_members').delete().in('user_id', toDeleteIds).eq('team_id', teamKey)
                if (delErr) throw new Error(delErr.message)
              }

              if (toUpsert.length) {
                const { error: upsertErr } = await sb.from('translator_team_members').upsert(toUpsert, { onConflict: 'team_id,user_id' })
                if (upsertErr) throw new Error(upsertErr.message)
              }

              setTeam((t) =>
                t
                  ? {
                      ...t,
                      name: v.name.trim(),
                      avatar_url: v.avatar_url.trim(),
                      bio: v.bio,
                      discord_url: v.discord_url || null,
                      boosty_url: v.boosty_url || null,
                      langs: v.langs,
                      tags: v.tags,
                      ...(v.hiring_text !== undefined ? { hiring_text: v.hiring_text } : {})
                    }
                  : t
              )

              const { data: teamMembersNew, error: memErr } = await sb
                .from('translator_team_members')
                .select('user_id, role, team_id, added_at')
                .eq('team_id', teamKey)
              if (memErr) throw new Error(memErr.message)

              if (teamMembersNew) {
                const userIds = Array.from(new Set(teamMembersNew.map((m) => m.user_id)))
                const { data: profs2, error: profErr2 } = await sb.from('profiles').select('id, username, avatar_url').in('id', userIds)
                if (profErr2) throw new Error(profErr2.message)

                setMembers(
                  teamMembersNew.map((m) => ({
                    ...(m as TeamMember),
                    profile: (profs2 ?? []).find((p) => p.id === m.user_id) ?? null
                  }))
                )
              }

              setIsEditOpen(false)
            } catch (e) {
              const msg = e instanceof Error ? e.message : typeof e === 'string' ? e : 'Unknown error'
              console.error('[Edit save]', e)
              alert(`Не удалось сохранить: ${msg}`)
            }
          }}
        />
      )}
    </div>
  )
}

/* ========= Modal ========= */
type EditModalProps = {
  initial: EditValues
  onClose: () => void
  onSave: (v: EditValues) => Promise<void>
}

const EditModal: React.FC<EditModalProps> = ({ initial, onClose, onSave }) => {
  const { theme } = useTheme()
  const [v, setV] = useState<EditValues>(initial)
  const [saving, setSaving] = useState(false)

  const toggleSet = (key: 'langs' | 'tags', value: string) => {
    setV((prev) => {
      const set = new Set(prev[key])
      set.has(value) ? set.delete(value) : set.add(value)
      return { ...prev, [key]: Array.from(set) } as EditValues
    })
  }

  const addMember = () => {
    setV((prev) => ({ ...prev, members: [...prev.members, { username: '', role: 'member' }] }))
  }

  const removeMember = (idx: number) => {
    setV((prev) => ({ ...prev, members: prev.members.filter((_, i) => i !== idx) }))
  }

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave(v)
    } finally {
      setSaving(false)
    }
  }

  const modalBg = theme === 'light' ? 'bg-white' : 'bg-slate-800'
  const inputClass =
    theme === 'light'
      ? 'bg-white border-slate-200 text-gray-900 focus:ring-blue-500'
      : 'bg-slate-700 border-slate-600 text-white focus:ring-blue-500'

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className={`relative w-[min(860px,92vw)] max-h-[90vh] overflow-hidden rounded-3xl shadow-2xl ring-1 ring-black/5 ${modalBg}`}
        >
          <div
            className={`flex items-center justify-between border-b px-6 py-4 ${
              theme === 'light' ? 'border-slate-200 bg-gradient-to-r from-sky-50 to-indigo-50' : 'border-slate-700 bg-gradient-to-r from-slate-800 to-slate-700'
            }`}
          >
            <h3 className={`text-lg font-semibold ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>Редактировать команду</h3>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              type="button"
              className={`rounded-full p-2 transition ${theme === 'light' ? 'text-slate-500 hover:bg-white hover:text-slate-700' : 'text-slate-400 hover:bg-slate-600 hover:text-white'}`}
              onClick={() => !saving && onClose()}
            >
              <X className="h-5 w-5" />
            </motion.button>
          </div>

          <form className="max-h-[calc(90vh-80px)] space-y-6 overflow-y-auto px-6 py-6" onSubmit={submit}>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={`mb-1 block text-xs font-medium uppercase tracking-wide ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Название команды</label>
                <input
                  className={`w-full rounded-2xl border px-3 py-2.5 text-[14px] shadow-sm outline-none transition focus:ring-4 focus:ring-sky-200/60 ${inputClass}`}
                  value={v.name}
                  onChange={(e) => setV({ ...v, name: e.target.value })}
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className={`mb-1 block text-xs font-medium uppercase tracking-wide ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Аватар (URL)</label>
                <input
                  className={`w-full rounded-2xl border px-3 py-2.5 text-[14px] shadow-sm outline-none transition focus:ring-4 focus:ring-sky-200/60 ${inputClass}`}
                  value={v.avatar_url}
                  onChange={(e) => setV({ ...v, avatar_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>

              <div className="sm:col-span-2">
                <label className={`mb-1 block text-xs font-medium uppercase tracking-wide ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Описание</label>
                <textarea
                  className={`h-28 w-full resize-y rounded-2xl border px-3 py-2.5 text-[14px] shadow-sm outline-none transition focus:ring-4 focus:ring-sky-200/60 ${inputClass}`}
                  value={v.bio}
                  onChange={(e) => setV({ ...v, bio: e.target.value })}
                />
              </div>

              <div className="sm:col-span-2">
                <label className={`mb-1 block text-xs font-medium uppercase tracking-wide ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Мы ищем (плашка)</label>
                <input
                  className={`w-full rounded-2xl border px-3 py-2.5 text-[14px] shadow-sm outline-none transition focus:ring-4 focus:ring-amber-200/70 ${inputClass}`}
                  value={v.hiring_text ?? ''}
                  onChange={(e) => setV({ ...v, hiring_text: e.target.value })}
                  placeholder="Нужен тайлсеттер"
                />
              </div>

              <div>
                <label className={`mb-1 block text-xs font-medium uppercase tracking-wide ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Discord URL</label>
                <input
                  className={`w-full rounded-2xl border px-3 py-2.5 text-[14px] shadow-sm outline-none transition focus:ring-4 focus:ring-sky-200/60 ${inputClass}`}
                  value={v.discord_url ?? ''}
                  onChange={(e) => setV({ ...v, discord_url: e.target.value })}
                  placeholder="https://discord.gg/..."
                />
              </div>
              <div>
                <label className={`mb-1 block text-xs font-medium uppercase tracking-wide ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Boosty URL</label>
                <input
                  className={`w-full rounded-2xl border px-3 py-2.5 text-[14px] shadow-sm outline-none transition focus:ring-4 focus:ring-sky-200/60 ${inputClass}`}
                  value={v.boosty_url ?? ''}
                  onChange={(e) => setV({ ...v, boosty_url: e.target.value })}
                  placeholder="https://boosty.to/..."
                />
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <div className={`mb-2 text-xs font-medium uppercase tracking-wide ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Что переводят (теги)</div>
                <div className="flex flex-wrap gap-2">
                  {['Игры', 'Манга', 'Дорамы', 'Новеллы', 'Комиксы'].map((t) => (
                    <motion.button
                      key={t}
                      type="button"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => toggleSet('tags', t)}
                      className={`rounded-full border px-3 py-1.5 text-[13px] transition ${
                        v.tags.includes(t)
                          ? theme === 'light'
                            ? 'border-slate-900 bg-slate-900 text-white shadow'
                            : 'border-white bg-white text-slate-900 shadow'
                          : theme === 'light'
                          ? 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'
                          : 'border-slate-600 bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {t}
                    </motion.button>
                  ))}
                </div>
              </div>
              <div>
                <div className={`mb-2 text-xs font-medium uppercase tracking-wide ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Направления перевода</div>
                <div className="flex flex-wrap gap-2">
                  {['RU→EN', 'EN→RU', 'JP→RU', 'KR→RU'].map((lng) => (
                    <motion.button
                      key={lng}
                      type="button"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => toggleSet('langs', lng)}
                      className={`rounded-full border px-3 py-1.5 text-[13px] transition ${
                        v.langs.includes(lng)
                          ? 'border-sky-600 bg-sky-600 text-white shadow'
                          : theme === 'light'
                          ? 'border-sky-100 bg-sky-50 text-sky-700 hover:bg-sky-100'
                          : 'border-sky-600/50 bg-sky-600/10 text-sky-300 hover:bg-sky-600/20'
                      }`}
                    >
                      {lng}
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <div className={`mb-2 text-xs font-medium uppercase tracking-wide ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Состав команды</div>
              <div className={`space-y-3 rounded-2xl border p-3 ${theme === 'light' ? 'border-slate-200 bg-slate-50/50' : 'border-slate-600 bg-slate-700/30'}`}>
                {v.members.map((m, idx) => (
                  <motion.div key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid gap-2 sm:grid-cols-12">
                    <input
                      className={`sm:col-span-7 rounded-xl border px-3 py-2 text-[14px] shadow-sm outline-none transition focus:ring-4 focus:ring-sky-200/60 ${inputClass}`}
                      placeholder="username"
                      value={m.username}
                      onChange={(e) => {
                        const val = e.target.value
                        setV((prev) => ({
                          ...prev,
                          members: prev.members.map((mm, i) => (i === idx ? { ...mm, username: val } : mm))
                        }))
                      }}
                    />
                    <select
                      className={`sm:col-span-4 rounded-xl border px-3 py-2 text-[14px] shadow-sm outline-none transition focus:ring-4 focus:ring-sky-200/60 ${inputClass}`}
                      value={m.role}
                      onChange={(e) => {
                        const val = e.target.value
                        setV((prev) => ({
                          ...prev,
                          members: prev.members.map((mm, i) => (i === idx ? { ...mm, role: val } : mm))
                        }))
                      }}
                    >
                      <option value="lead">Лидер</option>
                      <option value="editor">Редактор</option>
                      <option value="translator">Переводчик</option>
                      <option value="typesetter">Тайпсеттер</option>
                      <option value="member">Участник</option>
                    </select>
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className={`sm:col-span-1 inline-flex items-center justify-center rounded-xl border transition ${
                        theme === 'light'
                          ? 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                          : 'border-slate-600 bg-slate-700 text-slate-400 hover:bg-slate-600'
                      }`}
                      onClick={() => removeMember(idx)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </motion.button>
                  </motion.div>
                ))}
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={addMember}
                  className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[14px] shadow-sm transition ${
                    theme === 'light'
                      ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      : 'border-slate-600 bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  <Plus className="h-4 w-4" /> Добавить участника
                </motion.button>
              </div>
            </div>

            <div
              className={`sticky bottom-0 -mx-6 -mb-6 flex items-center justify-end gap-2 border-t px-6 py-4 backdrop-blur ${
                theme === 'light' ? 'border-slate-200 bg-white/90' : 'border-slate-700 bg-slate-800/90'
              }`}
            >
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onClose}
                disabled={saving}
                className={`rounded-2xl border px-4 py-2 text-[14px] transition disabled:opacity-60 ${
                  theme === 'light' ? 'border-slate-300 text-slate-700 hover:bg-slate-50' : 'border-slate-600 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Отмена
              </motion.button>
              <motion.button
                type="submit"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={saving}
                className="rounded-2xl bg-slate-900 px-5 py-2.5 text-[14px] font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60 flex items-center gap-2"
              >
                {saving && (
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                )}
                {saving ? 'Сохранение…' : 'Сохранить'}
              </motion.button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

/* ========= UI helpers ========= */
function Tab({
  children,
  active = false,
  onClick,
  icon
}: {
  children: React.ReactNode
  active?: boolean
  onClick?: () => void
  icon?: React.ReactNode
}) {
  const { theme } = useTheme()

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: active ? 0 : -2 }}
      whileTap={{ scale: 0.98 }}
      className={[
        'relative flex items-center gap-2 px-6 py-4 font-medium transition-all',
        active
          ? 'text-[#2196F3] bg-gradient-to-b from-blue-50 to-white border-b-2 border-[#2196F3]'
          : theme === 'light'
          ? 'text-slate-600 hover:text-slate-900 hover:bg-gray-50'
          : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
      ].join(' ')}
    >
      {icon}
      {children}
    </motion.button>
  )
}

function Section({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme()
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border p-6 shadow-sm ${
        theme === 'light' ? 'bg-white border-gray-200' : 'bg-slate-800/60 border-slate-700'
      }`}
    >
      {children}
    </motion.div>
  )
}

function SectionTitle({
  children,
  className = '',
  icon
}: {
  children: React.ReactNode
  className?: string
  icon?: React.ReactNode
}) {
  const { theme } = useTheme()
  return (
    <h2 className={['mb-4 text-[18px] font-semibold flex items-center gap-2', theme === 'light' ? 'text-slate-900' : 'text-white', className].join(' ')}>
      {icon}
      {children}
    </h2>
  )
}

/* ========= utils ========= */
function roleLabel(role?: string | null) {
  switch (role) {
    case 'lead':
      return 'Лидер'
    case 'editor':
      return 'Редактор'
    case 'translator':
      return 'Переводчик'
    case 'typesetter':
      return 'Тайпсеттер'
    case 'member':
      return 'Участник'
    default:
      return role || 'Участник'
  }
}

function formatK(n: number) {
  if (n >= 1000) {
    const k = (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1).replace('.0', '')
    return `${k}K`
  }
  return String(n)
}
