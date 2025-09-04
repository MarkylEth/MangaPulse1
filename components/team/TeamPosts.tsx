'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Heart, MessageCircle, Plus, Loader2, Trash2, X, Send,
  Type, Megaphone, ChevronLeft, ChevronRight,
  Maximize2, Bold, Italic, Underline, Edit3, Pin
} from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { useTheme } from '@/lib/theme/context'

/* ===================== Типы ===================== */
type ProfileLite = { id: string; username: string | null; avatar_url: string | null }

type Post = {
  id: string
  team_id: number
  author_id: string
  title: string | null
  body: string | null
  images: string[] | null
  featured_image: string | null
  post_type: 'text' | 'announcement'
  is_published: boolean
  is_pinned: boolean | null
  likes_count: number | null
  comments_count: number | null
  created_at: string
  updated_at: string
}

type PostWithMeta = Post & {
  author?: ProfileLite | null
  author_role?: string | null
  is_liked_by_me: boolean
}

type PostDraft = {
  title: string
  body: string
  post_type: 'text' | 'announcement'
  images: string[]
  featured_image: string | null
}

type JoinedComment = {
  id: string
  post_id: string
  user_id: string
  content: string
  parent_id: string | null
  created_at: string
  username: string | null
  avatar_url: string | null
  team_role?: string | null
}

/* ===================== Хелперы ===================== */
const normalizeRole = (raw: string | null | undefined): string | null => {
  if (!raw) return null
  const v = raw.toString().trim().toLowerCase()
  if (['leader', 'lead', 'лидер', 'owner', 'глава'].includes(v)) return 'leader'
  if (['editor', 'редактор'].includes(v)) return 'editor'
  if (['translator', 'переводчик'].includes(v)) return 'translator'
  if (['typesetter', 'тайпсеттер', 'тайпсетер', 'тайп'].includes(v)) return 'typesetter'
  return v
}
const ROLE_LABEL: Record<string, string> = {
  leader: 'Лидер',
  editor: 'Редактор',
  translator: 'Переводчик',
  typesetter: 'Тайпсеттер',
}
const ROLE_BADGE: Record<string, string> = {
  leader: 'bg-amber-500 text-white',
  editor: 'bg-blue-500 text-white',
  translator: 'bg-green-500 text-white',
  typesetter: 'bg-purple-500 text-white',
}
const CAN_POST_ROLES = new Set(['leader', 'editor', 'translator', 'typesetter'])

/** Приводим серверный пост к нашей форме, независимо от кейсов и наличия алиасов */
function wirePost(row: any): PostWithMeta {
  const id = String(row.id)
  const team_id = Number(row.team_id ?? row.teamId)
  const author_id = String(row.author_id ?? row.author?.id ?? row.user_id ?? '')
  const title = row.title ?? null
  const body = row.body ?? row.content ?? null
  const images = Array.isArray(row.images) ? row.images : null
  const featured_image = row.featured_image ?? null
  const post_type: 'text' | 'announcement' = (row.post_type ?? 'text') as any
  const is_published = row.is_published ?? true
  const is_pinned = Boolean(row.is_pinned ?? row.isPinned ?? false)
  const likes_count = Number(row.likes_count ?? row.likesCount ?? 0)
  const comments_count = Number(row.comments_count ?? row.commentsCount ?? 0)
  const created_at = row.created_at ?? row.createdAt ?? new Date().toISOString()
  const updated_at = row.updated_at ?? row.updatedAt ?? created_at
  const author: ProfileLite | null =
    row.author
      ? { id: String(row.author.id), username: row.author.username ?? null, avatar_url: row.author.avatar ?? row.author.avatar_url ?? null }
      : {
          id: author_id,
          username: row.author_username ?? row.username ?? null,
          avatar_url: row.author_avatar_url ?? row.avatar_url ?? null,
        }
  const author_role = row.author_role ?? null
  const is_liked_by_me = Boolean(row.is_liked_by_me ?? row.likedByViewer ?? row.viewer_liked ?? false)

  return {
    id, team_id, author_id, title, body, images, featured_image, post_type,
    is_published, is_pinned, likes_count, comments_count, created_at, updated_at,
    author, author_role, is_liked_by_me
  }
}

/** Приводим комментарий к нашей форме */
function wireComment(row: any, postId: string): JoinedComment {
  return {
    id: String(row.id),
    post_id: postId,
    user_id: String(row.user_id ?? row.author?.id ?? row.author_id ?? ''),
    content: String(row.content ?? ''),
    parent_id: row.parent_id ?? null,
    created_at: row.created_at ?? row.createdAt ?? new Date().toISOString(),
    username: row.username ?? row.author?.username ?? null,
    avatar_url: row.avatar_url ?? row.author?.avatar ?? null,
    team_role: row.team_role ?? null,
  }
}

/* ===================== API fetch ===================== */
async function api<T>(
  url: string,
  options: RequestInit & { userId?: string | null } = {}
): Promise<T> {
  const { userId, headers, ...rest } = options
  const res = await fetch(url, {
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(userId ? { 'x-user-id': userId } : {}), // dev-хедер — если включён на бекенде
      ...(headers || {})
    },
    ...rest
  })
  if (!res.ok) {
    const msg = await res.text().catch(() => '')
    throw new Error(msg || `${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

/* ===================== Компонент ===================== */
export default function TeamPosts({
  teamId,
  teamSlug,
  canPost = false
}: {
  teamId: number
  teamSlug: string
  canPost?: boolean
}) {
  const { user, initialLoading } = useAuth()
  const { theme } = useTheme()

  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [posts, setPosts] = useState<PostWithMeta[]>([])
  const [editingPost, setEditingPost] = useState<string | null>(null)

  const [isComposerOpen, setIsComposerOpen] = useState(false)
  const [draft, setDraft] = useState<PostDraft>({
    title: '',
    body: '',
    post_type: 'text',
    images: [],
    featured_image: null
  })

  // комментарии
  const [commentsOpenFor, setCommentsOpenFor] = useState<Record<string, boolean>>({})
  const [comments, setComments] = useState<Record<string, JoinedComment[]>>({})
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({})
  const [commentSending, setCommentSending] = useState<Record<string, boolean>>({})

  // реплаи
  const [replyTo, setReplyTo] = useState<Record<string, string | null>>({})
  const [replyDraftMap, setReplyDraftMap] = useState<Record<string, string>>({})

  // просмотр изображений
  const [imageViewerOpen, setImageViewerOpen] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [currentImages, setCurrentImages] = useState<string[]>([])

  // пагинация
  const PAGE_SIZE = 7
  const [page, setPage] = useState(1)

  // моя роль (для прав)
  const [myRole, setMyRole] = useState<string | null>(null)

  // защита от setState после размонтирования
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  /* ===== роль пользователя в команде (для прав) ===== */
  useEffect(() => {
    if (!user?.id || !teamId) { setMyRole(null); return }
    api<{ role: string | null }>(`/api/teams/${encodeURIComponent(teamSlug)}/member-role`, { userId: user.id })
      .then((r) => setMyRole(normalizeRole((r as any)?.role ?? null)))
      .catch(() => setMyRole(null))
  }, [teamId, teamSlug, user?.id])

  /* ===== загрузка постов ===== */
  async function load({ soft = false }: { soft?: boolean } = {}) {
    if (!soft) setLoading(true)
    try {
      const data = await api<{ items: any[] }>(
        `/api/teams/${encodeURIComponent(teamSlug)}/posts`,
        { userId: user?.id || null }
      )
      const items = Array.isArray(data.items) ? data.items.map(wirePost) : []
      if (mounted.current) setPosts(items)
    } catch (e) {
      console.error('[TeamPosts] load error', e)
      if (!soft) setPosts([])
    } finally {
      if (!soft) setLoading(false)
    }
  }

  useEffect(() => {
    if (initialLoading || !teamSlug) return
    void load({ soft: false })

    const onVisible = () => {
      if (document.visibilityState === 'visible') void load({ soft: true })
    }
    const onFocus = () => void load({ soft: true })

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [teamSlug, user?.id, initialLoading])

  /* ===== права на создание ===== */
  const canCreatePosts = () => {
    const role = normalizeRole(myRole)
    return !!user && !!role && CAN_POST_ROLES.has(role)
  }

  /* ===== изображения в редакторе ===== */
  const titleRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  const addImageToPost = () => {
    const url = prompt('Введите URL изображения:')
    if (url?.trim()) {
      setDraft(prev => ({
        ...prev,
        images: [...prev.images, url.trim()],
        featured_image: prev.featured_image || url.trim()
      }))
    }
  }
  const removeImage = (index: number) => {
    setDraft(prev => {
      const newImages = prev.images.filter((_, i) => i !== index)
      return {
        ...prev,
        images: newImages,
        featured_image:
          prev.featured_image === prev.images[index]
            ? (newImages[0] || null)
            : prev.featured_image
      }
    })
  }

  /* ===== создать пост ===== */
  async function createPost() {
    if (!user) return alert('Войдите, чтобы публиковать посты')
    if (!canCreatePosts()) return alert('У вас нет прав для создания постов')
    if (draft.post_type === 'announcement' && normalizeRole(myRole) !== 'leader') {
      return alert('Объявления может публиковать только лидер')
    }
    if (!draft.body.trim() && !draft.title.trim() && !draft.images.length) return
    if (draft.body.length > 1000) return alert('Максимум 1000 символов в посте')

    setPosting(true)
    try {
      // Совместимо и с нашим «минимальным» API (content), и с расширенным (title/body/images)
      await api<{ id: string }>(
        `/api/teams/${encodeURIComponent(teamSlug)}/posts`,
        {
          method: 'POST',
          userId: user.id,
          body: JSON.stringify({
            // базовый бэкенд использует content; расширенный — остальные
            content: draft.body.trim() || draft.title.trim() || '(без текста)',
            title: draft.title.trim() || null,
            body: draft.body.trim() || null,
            post_type: draft.post_type,
            images: draft.images.length ? draft.images : null,
            featured_image: draft.featured_image
          })
        }
      )
      await load({ soft: true })
      setDraft({ title: '', body: '', post_type: 'text', images: [], featured_image: null })
      setIsComposerOpen(false)
    } catch (e) {
      console.error('[createPost] error', e)
      alert('Не удалось опубликовать пост')
    } finally {
      setPosting(false)
    }
  }

  /* ===== обновить пост (оставил как есть; если PATCH не реализован на API — покажет алерт) ===== */
  async function updatePost(postId: string, updatedData: Partial<Post>) {
    try {
      if (updatedData.body && (updatedData.body as string).length > 1000) {
        return alert('Максимум 1000 символов в посте')
      }

      const target = posts.find(p => p.id === postId)
      const isLeader = normalizeRole(myRole) === 'leader'
      if (!target) return
      const idx = posts.findIndex(p => p.id === postId)
      const isInTop4 = idx > -1 && idx < 4
      if (!isLeader) {
        const isOwn = target.author_id === user?.id
        if (!isOwn || !isInTop4) {
          return alert('Редактировать можно только свои посты из первых 4')
        }
      }

      // если на бэке нет PATCH — вернётся 404
      await api<{ ok: true }>(
        `/api/teams/${encodeURIComponent(teamSlug)}/posts/${encodeURIComponent(postId)}`,
        { method: 'PATCH', userId: user?.id || null, body: JSON.stringify(updatedData) }
      )

      setPosts(prev => prev.map(p => (p.id === postId ? { ...p, ...updatedData } : p)))
      setEditingPost(null)
    } catch (e: any) {
      console.error('[updatePost] error', e)
      alert('Не удалось обновить пост')
    }
  }

  /* ===== удалить пост ===== */
  async function deletePost(postId: string) {
    if (!confirm('Удалить пост?')) return
    try {
      const target = posts.find(p => p.id === postId)
      if (!target) return
      const isLeaderHere = normalizeRole(myRole) === 'leader'
      const isOwn = target.author_id === user?.id
      if (!isLeaderHere && !isOwn) {
        alert('Удалять можно только свои посты')
        return
      }

      await api<{ ok: true }>(
        `/api/teams/${encodeURIComponent(teamSlug)}/posts/${encodeURIComponent(postId)}`,
        { method: 'DELETE', userId: user?.id || null }
      )

      setPosts(prev => prev.filter(p => p.id !== postId))
    } catch (e) {
      console.error('[deletePost] error', e)
      alert('Не удалось удалить пост')
    }
  }

  /* ===== лайки (оптимистично) ===== */
  async function toggleLike(postId: string) {
    if (!user) return alert('Войдите, чтобы ставить лайки')
    const target = posts.find(p => p.id === postId)
    if (!target) return
    const want = !target.is_liked_by_me

    // оптимистично
    setPosts(prev => prev.map(p =>
      p.id === postId ? {
        ...p,
        is_liked_by_me: want,
        likes_count: Math.max(0, (p.likes_count ?? 0) + (want ? 1 : -1))
      } : p
    ))

    try {
      const updated: any = await api(
        `/api/teams/${encodeURIComponent(teamSlug)}/posts/${encodeURIComponent(postId)}/like`,
        { method: 'POST', userId: user.id, body: JSON.stringify({ like: want }) }
      )

      // поддерживаем оба варианта ответа
      const liked = typeof updated.likedByViewer === 'boolean'
        ? updated.likedByViewer
        : !!updated.i_like
      const cnt = (updated.likesCount ?? updated.likes_count) as number

      setPosts(prev => prev.map(p =>
        p.id === postId ? { ...p, is_liked_by_me: liked, likes_count: cnt } : p
      ))
    } catch (e) {
      // откат
      setPosts(prev => prev.map(p =>
        p.id === postId ? {
          ...p,
          is_liked_by_me: !want,
          likes_count: Math.max(0, (p.likes_count ?? 0) + (!want ? 1 : -1))
        } : p
      ))
      console.error('[toggleLike] error', e)
    }
  }

  /* ===== закреп (наш эндпоинт /pin) ===== */
  const isLeader = normalizeRole(myRole) === 'leader'
  async function pinPost(postId: string) {
    if (!isLeader) return
    try {
      await api<{ ok: true }>(
        `/api/teams/${encodeURIComponent(teamSlug)}/posts/${encodeURIComponent(postId)}/pin`,
        { method: 'PATCH', userId: user?.id || null, body: JSON.stringify({ pinned: true }) }
      )
      await load({ soft: true })
    } catch (e) {
      console.error('[pinPost] error', e)
      alert('Не удалось закрепить пост')
    }
  }
  async function unpinPost(postId: string) {
    if (!isLeader) return
    try {
      await api<{ ok: true }>(
        `/api/teams/${encodeURIComponent(teamSlug)}/posts/${encodeURIComponent(postId)}/pin`,
        { method: 'PATCH', userId: user?.id || null, body: JSON.stringify({ pinned: false }) }
      )
      await load({ soft: true })
    } catch (e) {
      console.error('[unpinPost] error', e)
      alert('Не удалось открепить пост')
    }
  }

  /* ===== комментарии ===== */
  async function openComments(postId: string) {
    setCommentsOpenFor(prev => ({ ...prev, [postId]: !prev[postId] }))
    if (comments[postId]) return
    try {
      const data = await api<{ items: any[] }>(
        `/api/teams/${encodeURIComponent(teamSlug)}/posts/${encodeURIComponent(postId)}/comments`,
        { userId: user?.id || null }
      )
      const items = (data.items ?? []).map(c => wireComment(c, postId))
      setComments(prev => ({ ...prev, [postId]: items }))
    } catch (e) {
      console.error('[openComments] error', e)
      setComments(prev => ({ ...prev, [postId]: [] }))
    }
  }

  async function sendComment(postId: string) {
    if (!user) return
    const text = (commentDraft[postId] ?? '').trim()
    if (!text) return
    if (text.length > 600) return alert('Максимум 600 символов в комментарии')

    setCommentSending(prev => ({ ...prev, [postId]: true }))
    try {
      await api<{ ok: true }>(
        `/api/teams/${encodeURIComponent(teamSlug)}/posts/${encodeURIComponent(postId)}/comments`,
        { method: 'POST', userId: user.id, body: JSON.stringify({ content: text }) }
      )
      const data = await api<{ items: any[] }>(
        `/api/teams/${encodeURIComponent(teamSlug)}/posts/${encodeURIComponent(postId)}/comments`,
        { userId: user.id }
      )
      const items = (data.items ?? []).map(c => wireComment(c, postId))
      setComments(prev => ({ ...prev, [postId]: items }))
      setCommentDraft(prev => ({ ...prev, [postId]: '' }))
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments_count: (p.comments_count ?? 0) + 1 } : p))
    } catch (e) {
      console.error('[sendComment] error', e)
      alert('Не удалось отправить комментарий')
    } finally {
      setCommentSending(prev => ({ ...prev, [postId]: false }))
    }
  }

  async function sendReply(postId: string, parentId: string) {
    if (!user) return
    const text = (replyDraftMap[parentId] ?? '').trim()
    if (!text) return
    if (text.length > 600) return alert('Максимум 600 символов')

    try {
      await api<{ ok: true }>(
        `/api/teams/${encodeURIComponent(teamSlug)}/posts/${encodeURIComponent(postId)}/comments`,
        { method: 'POST', userId: user.id, body: JSON.stringify({ content: text, parent_id: parentId }) }
      )
      const data = await api<{ items: any[] }>(
        `/api/teams/${encodeURIComponent(teamSlug)}/posts/${encodeURIComponent(postId)}/comments`,
        { userId: user.id }
      )
      const items = (data.items ?? []).map(c => wireComment(c, postId))
      setComments(prev => ({ ...prev, [postId]: items }))
      setReplyDraftMap(prev => ({ ...prev, [parentId]: '' }))
      setReplyTo(prev => ({ ...prev, [postId]: null }))
    } catch (e) {
      console.error('[sendReply] error', e)
      alert('Не удалось отправить ответ')
    }
  }

  // PATCH комментария — если на API ещё не добавили, покажет алерт
  async function updateComment(postId: string, commentId: string, newContent: string) {
    if (!newContent.trim()) return
    if (newContent.length > 600) return alert('Максимум 600 символов в комментарии')
    try {
      await api<{ ok: true }>(
        `/api/teams/${encodeURIComponent(teamSlug)}/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`,
        { method: 'PATCH', userId: user?.id || null, body: JSON.stringify({ content: newContent }) }
      )
      setComments(prev => ({
        ...prev,
        [postId]: (prev[postId] ?? []).map(c => c.id === commentId ? { ...c, content: newContent } : c)
      }))
    } catch (e) {
      console.error('[updateComment] error', e)
      alert('Не удалось обновить комментарий')
    }
  }

  async function deleteComment(postId: string, commentId: string) {
    if (!confirm('Удалить комментарий?')) return
    try {
      await api<{ ok: true }>(
        `/api/teams/${encodeURIComponent(teamSlug)}/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`,
        { method: 'DELETE', userId: user?.id || null }
      )

      const list = comments[postId] ?? []
      const idsToRemove = new Set<string>()
      const build = (id: string) => {
        idsToRemove.add(id)
        for (const c of list) if (c.parent_id === id) build(c.id)
      }
      build(commentId)

      setComments(prev => ({
        ...prev,
        [postId]: (prev[postId] ?? []).filter(c => !idsToRemove.has(c.id))
      }))
      setPosts(prev => prev.map(p => p.id === postId
        ? { ...p, comments_count: Math.max(0, (p.comments_count ?? 1) - 1) }
        : p
      ))
    } catch (e) {
      console.error('[deleteComment] error', e)
      alert('Не удалось удалить комментарий')
    }
  }

  /* ===== просмотр изображений ===== */
  const openImageViewer = (images: string[], startIndex = 0) => {
    setCurrentImages(images)
    setCurrentImageIndex(startIndex)
    setImageViewerOpen(true)
  }

  /* ===== форматирование ===== */
  const insertFormatting = (
    field: 'title' | 'body',
    formatType: 'bold' | 'italic' | 'underline',
    textareaRef?: React.RefObject<HTMLTextAreaElement>
  ) => {
    const textarea = textareaRef?.current
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = textarea.value
    const selectedText = text.substring(start, end)
    let wrapper = ''
    switch (formatType) {
      case 'bold': wrapper = '**'; break
      case 'italic': wrapper = '*'; break
      case 'underline': wrapper = '__'; break
    }
    const newText =
      text.substring(0, start) + wrapper + (selectedText || 'текст') + wrapper + text.substring(end)
    setDraft(prev => ({ ...prev, [field]: newText }))
    setTimeout(() => {
      textarea.focus()
      const newPos = start + wrapper.length + (selectedText || 'текст').length
      textarea.setSelectionRange(newPos, newPos)
    }, 0)
  }

  /* ===== стили ===== */
  const cardBg = theme === 'light'
    ? 'bg-white border-gray-200'
    : 'bg-gradient-to-br from-slate-800/90 to-slate-700/80 backdrop-blur-sm border-slate-600/50'
  const textMain = theme === 'light' ? 'text-slate-900' : 'text-slate-100'
  const textMuted = theme === 'light' ? 'text-slate-600' : 'text-slate-300'

  const PostTypeSelector = () => {
    const isLeaderHere = normalizeRole(myRole) === 'leader'
    const Item = ({
      value, icon: Icon, label, disabled
    }: { value: 'text' | 'announcement'; icon: any; label: string; disabled?: boolean }) => (
      <button
        type="button"
        disabled={!!disabled}
        onClick={() => {
          if (value === 'announcement' && !isLeaderHere) return
          setDraft(prev => ({ ...prev, post_type: value }))
        }}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition
          ${draft.post_type === value ? 'bg-blue-600 text-white' :
            theme === 'light' ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' :
            'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        title={value === 'announcement' && !isLeaderHere ? 'Только лидер' : ''}
      >
        <Icon className="w-4 h-4" />
        {label}
      </button>
    )
    return (
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-sm font-medium ${textMuted}`}>Тип поста:</span>
        <Item value="text" icon={Type} label="Текст" />
        <Item value="announcement" icon={Megaphone} label="Объявление" disabled={!isLeaderHere} />
      </div>
    )
  }

  const getRoleLabel = (role: string | null) => {
    const r = normalizeRole(role)
    if (!r) return 'Участник'
    return ROLE_LABEL[r] ?? r
  }
  const getRoleColor = (role: string | null) => {
    const r = normalizeRole(role)
    return (r && ROLE_BADGE[r]) ? ROLE_BADGE[r] : 'bg-gray-500 text-white'
  }
  const formatText = (text: string) =>
    text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
      .replace(/__(.*?)__/g, '<u>$1</u>')

  /* ===== разбиение / пагинация ===== */
  const pinned = posts.find(p => p.is_pinned)
  const rest = posts.filter(p => !p.is_pinned)
  const totalPages = Math.max(1, Math.ceil(rest.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * PAGE_SIZE
  const pageItems = rest.slice(start, start + PAGE_SIZE)

  return (
    <div className="space-y-4">
      {(canPost || canCreatePosts()) && (
        <>
          <button
            onClick={() => setIsComposerOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 transition shadow"
          >
            <Plus className="w-4 h-4" />
            Новый пост
          </button>

          <AnimatePresence>
            {isComposerOpen && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm grid place-items-center p-4"
              >
                <motion.div
                  initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
                  className={`w-[min(720px,92vw)] max-h-[90vh] overflow-y-auto rounded-2xl border ${cardBg} p-5`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className={`text-lg font-semibold ${textMain}`}>Новый пост</div>
                    <button
                      className={`rounded-lg p-2 transition ${theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-slate-700/40'}`}
                      onClick={() => setIsComposerOpen(false)}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <PostTypeSelector />

                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-sm font-medium ${textMuted}`}>Заголовок</span>
                        <div className="flex gap-1">
                          <button type="button" onClick={() => insertFormatting('title', 'bold', titleRef as any)}
                            className={`p-1 rounded text-xs transition ${theme === 'light' ? 'hover:bg-slate-200' : 'hover:bg-slate-600'}`} title="Жирный">
                            <Bold className="w-3 h-3" />
                          </button>
                          <button type="button" onClick={() => insertFormatting('title', 'italic', titleRef as any)}
                            className={`p-1 rounded text-xs transition ${theme === 'light' ? 'hover:bg-slate-200' : 'hover:bg-slate-600'}`} title="Курсив">
                            <Italic className="w-3 h-3" />
                          </button>
                          <button type="button" onClick={() => insertFormatting('title', 'underline', titleRef as any)}
                            className={`p-1 rounded text-xs transition ${theme === 'light' ? 'hover:bg-slate-200' : 'hover:bg-slate-600'}`} title="Подчёркнутый">
                            <Underline className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <input
                        ref={titleRef}
                        className={`w-full rounded-xl border px-3 py-2 text-sm outline-none ${theme === 'light' ? 'bg-white border-slate-300' : 'bg-slate-700/50 border-slate-600'} ${textMain}`}
                        placeholder="Заголовок (необязательно)"
                        value={draft.title}
                        onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
                      />
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-sm font-medium ${textMuted}`}>Текст поста</span>
                        <div className="flex gap-1">
                          <button type="button" onClick={() => insertFormatting('body', 'bold', bodyRef)}
                            className={`p-1 rounded text-xs transition ${theme === 'light' ? 'hover:bg-slate-200' : 'hover:bg-slate-600'}`} title="Жирный (**текст**)">
                            <Bold className="w-3 h-3" />
                          </button>
                          <button type="button" onClick={() => insertFormatting('body', 'italic', bodyRef)}
                            className={`p-1 rounded text-xs transition ${theme === 'light' ? 'hover:bg-slate-200' : 'hover:bg-slate-600'}`} title="Курсив (*текст*)">
                            <Italic className="w-3 h-3" />
                          </button>
                          <button type="button" onClick={() => insertFormatting('body', 'underline', bodyRef)}
                            className={`p-1 rounded text-xs transition ${theme === 'light' ? 'hover:bg-slate-200' : 'hover:bg-slate-600'}`} title="Подчёркнутый (__текст__)">
                            <Underline className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <div className="relative">
                        <textarea
                          ref={bodyRef}
                          className={`w-full h-32 rounded-xl border px-3 py-2 text-sm outline-none resize-y ${theme === 'light' ? 'bg-white border-slate-300' : 'bg-slate-700/50 border-slate-600'} ${textMain}`}
                          placeholder={draft.post_type === 'announcement' ? 'Текст объявления...' : 'Текст поста...'}
                          value={draft.body}
                          onChange={e => setDraft(d => ({ ...d, body: e.target.value }))}
                          maxLength={1000}
                        />
                        <div className={`absolute bottom-2 right-2 text-xs ${textMuted}`}>{draft.body.length}/1000</div>
                      </div>
                    </div>

                    <div className={`text-xs ${textMuted} bg-slate-100 dark:bg-slate-700/30 rounded-lg p-2`}>
                      <div className="font-medium mb-1">Форматирование текста:</div>
                      <div>**жирный** • *курсив* • __подчеркнутый__</div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-sm font-medium ${textMuted}`}>Изображения</span>
                        <button type="button" onClick={addImageToPost}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-600 text-white text-xs hover:bg-blue-700">
                          <Plus className="w-3 h-3" /> Добавить
                        </button>
                      </div>

                      {draft.images.length > 0 && (
                        <div className="grid grid-cols-2 gap-2 mb-2">
                          {draft.images.map((url, index) => (
                            <div key={index} className="relative group">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={url} alt={`Изображение ${index + 1}`} className="w-full h-24 object-cover rounded-lg border"
                                   onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/placeholder-image.png' }} />
                              <button type="button" onClick={() => removeImage(index)}
                                className="absolute top-1 right-1 w-6 h-6 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition">
                                <X className="w-3 h-3 mx-auto" />
                              </button>
                              {draft.featured_image === url && (
                                <div className="absolute bottom-1 left-1 px-1 py-0.5 bg-blue-600 text-white text-xs rounded">Главное</div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-end gap-2">
                    <button
                      className={`rounded-xl border px-4 py-2 text-sm transition ${theme === 'light' ? 'border-slate-300 hover:bg-slate-50' : 'border-slate-600 hover:bg-slate-700/50'}`}
                      onClick={() => setIsComposerOpen(false)} disabled={posting}
                    >
                      Отмена
                    </button>
                    <button
                      onClick={createPost} disabled={posting}
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 transition"
                    >
                      {posting && <Loader2 className="w-4 h-4 animate-spin" />}
                      Опубликовать
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* список постов */}
      {loading ? (
        <div className="grid gap-4">{[0,1,2].map(i => <div key={i} className={`h-36 rounded-2xl border ${cardBg} animate-pulse`} />)}</div>
      ) : posts.length === 0 ? (
        <div className={`rounded-2xl border ${cardBg} p-8 text-center`}>
          <div className="text-4xl mb-2">🗒️</div>
          <div className={`text-lg ${textMain} mb-1`}>Постов пока нет</div>
          <div className={textMuted}>Когда команда что-то опубликует, это появится здесь</div>
        </div>
      ) : (
        <div className="grid gap-4">
          {/* закреп сверху только на первой странице */}
          {safePage === 1 && pinned && (
            <PostCard
              key={pinned.id}
              post={pinned}
              index={0}
              theme={theme}
              textMain={textMain}
              textMuted={textMuted}
              cardBg={cardBg}
              user={user}
              isLeader={isLeader}
              setEditingPost={setEditingPost}
              editingPost={editingPost}
              onToggleLike={() => toggleLike(pinned.id)}
              onOpenComments={() => openComments(pinned.id)}
              onDelete={() => deletePost(pinned.id)}
              onUpdate={(data) => updatePost(pinned.id, data)}
              onOpenImageViewer={openImageViewer}
              commentsOpen={!!commentsOpenFor[pinned.id]}
              comments={comments[pinned.id] ?? []}
              commentDraft={commentDraft[pinned.id] ?? ''}
              commentSending={commentSending[pinned.id] ?? false}
              onCommentDraftChange={(value) => setCommentDraft(prev => ({ ...prev, [pinned.id]: value }))}
              onSendComment={() => sendComment(pinned.id)}
              getRoleLabel={(r) => getRoleLabel(r)}
              getRoleColor={(r) => getRoleColor(r)}
              formatText={(t) => formatText(t)}
              onPin={() => pinPost(pinned.id)}
              onUnpin={() => unpinPost(pinned.id)}
              // replies
              replyToId={replyTo[pinned.id] ?? null}
              setReplyToId={(cid: string | null) => setReplyTo(prev => ({ ...prev, [pinned.id]: cid }))}
              replyDraftMap={replyDraftMap}
              setReplyDraftMap={setReplyDraftMap}
              onSendReply={(cid: string) => sendReply(pinned.id, cid)}
              currentUserId={user?.id ?? null}
              onUpdateComment={(cid, text) => updateComment(pinned.id, cid, text)}
              onDeleteComment={(cid) => deleteComment(pinned.id, cid)}
            />
          )}

          {pageItems.map((post, idx) => (
            <PostCard
              key={post.id}
              post={post}
              index={idx}
              theme={theme}
              textMain={textMain}
              textMuted={textMuted}
              cardBg={cardBg}
              user={user}
              isLeader={isLeader}
              setEditingPost={setEditingPost}
              editingPost={editingPost}
              onToggleLike={() => toggleLike(post.id)}
              onOpenComments={() => openComments(post.id)}
              onDelete={() => deletePost(post.id)}
              onUpdate={(data) => updatePost(post.id, data)}
              onOpenImageViewer={openImageViewer}
              commentsOpen={!!commentsOpenFor[post.id]}
              comments={comments[post.id] ?? []}
              commentDraft={commentDraft[post.id] ?? ''}
              commentSending={commentSending[post.id] ?? false}
              onCommentDraftChange={(value) => setCommentDraft(prev => ({ ...prev, [post.id]: value }))}
              onSendComment={() => sendComment(post.id)}
              getRoleLabel={(r) => getRoleLabel(r)}
              getRoleColor={(r) => getRoleColor(r)}
              formatText={(t) => formatText(t)}
              onPin={() => pinPost(post.id)}
              onUnpin={() => unpinPost(post.id)}
              replyToId={replyTo[post.id] ?? null}
              setReplyToId={(cid: string | null) => setReplyTo(prev => ({ ...prev, [post.id]: cid }))}
              replyDraftMap={replyDraftMap}
              setReplyDraftMap={setReplyDraftMap}
              onSendReply={(cid: string) => sendReply(post.id, cid)}
              currentUserId={user?.id ?? null}
              onUpdateComment={(cid, text) => updateComment(post.id, cid, text)}
              onDeleteComment={(cid) => deleteComment(post.id, cid)}
            />
          ))}

          {totalPages > 1 && (
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                <button key={n} onClick={() => setPage(n)}
                  className={[
                    'min-w-9 h-9 px-3 rounded-lg text-sm border transition',
                    n === safePage
                      ? 'bg-blue-600 text-white border-blue-600'
                      : (theme === 'light'
                          ? 'border-slate-300 hover:bg-slate-50'
                          : 'border-slate-600 hover:bg-slate-700/50 text-slate-300')
                  ].join(' ')}
                >
                  {n}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* просмотр изображений */}
      <AnimatePresence>
        {imageViewerOpen && (
          <ImageViewer
            images={currentImages}
            currentIndex={currentImageIndex}
            onClose={() => setImageViewerOpen(false)}
            onIndexChange={setCurrentImageIndex}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

/* ===================== Карточка поста ===================== */
const PostCard: React.FC<{
  post: PostWithMeta
  index: number
  theme: 'light' | 'dark'
  textMain: string
  textMuted: string
  cardBg: string
  user: any
  isLeader: boolean
  editingPost: string | null
  setEditingPost: (id: string | null) => void
  onToggleLike: () => void
  onOpenComments: () => void
  onDelete: () => void
  onUpdate: (data: Partial<Post>) => void
  onOpenImageViewer: (images: string[], index: number) => void
  commentsOpen: boolean
  comments: JoinedComment[]
  commentDraft: string
  commentSending: boolean
  onCommentDraftChange: (value: string) => void
  onSendComment: () => void
  getRoleLabel: (role: string | null) => string
  getRoleColor: (role: string | null) => string
  formatText: (text: string) => string
  onPin: () => void
  onUnpin: () => void
  // replies
  replyToId: string | null
  setReplyToId: (id: string | null) => void
  replyDraftMap: Record<string, string>
  setReplyDraftMap: React.Dispatch<React.SetStateAction<Record<string, string>>>
  onSendReply: (commentId: string) => void
  currentUserId: string | null
  onUpdateComment: (commentId: string, text: string) => void
  onDeleteComment: (commentId: string) => void
}> = (props) => {
  const {
    post, index, theme, textMain, textMuted, cardBg, user, isLeader,
    editingPost, setEditingPost, onToggleLike, onOpenComments, onDelete,
    onUpdate, onOpenImageViewer, commentsOpen, comments, commentDraft,
    commentSending, onCommentDraftChange, onSendComment, getRoleLabel,
    getRoleColor, formatText, onPin, onUnpin,
    replyToId, setReplyToId, replyDraftMap, setReplyDraftMap, onSendReply,
    currentUserId, onUpdateComment, onDeleteComment
  } = props

  const [editData, setEditData] = useState({ title: post.title || '', body: post.body || '' })
  const editBodyRef = useRef<HTMLTextAreaElement>(null)

  const getPostTypeIcon = () => post.post_type === 'announcement'
    ? <Megaphone className="w-4 h-4 text-amber-500" />
    : <Type className="w-4 h-4 text-slate-500" />

  const getPostTypeBorder = () => post.post_type === 'announcement' ? 'border-l-4 border-l-amber-500' : ''

  const isEditing = editingPost === post.id
  const canEdit = isLeader || (user?.id === post.author_id && index < 4)

  const handleSaveEdit = () => {
    if (editData.body.length > 1000) return alert('Максимум 1000 символов в посте')
    onUpdate({ title: editData.title.trim() || null, body: editData.body.trim() })
  }

  const insertEditFormatting = (formatType: 'bold' | 'italic' | 'underline') => {
    const textarea = editBodyRef.current
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = textarea.value
    const selectedText = text.substring(start, end)
    let wrapper = ''
    switch (formatType) {
      case 'bold': wrapper = '**'; break
      case 'italic': wrapper = '*'; break
      case 'underline': wrapper = '__'; break
    }
    const newText = text.substring(0, start) + wrapper + (selectedText || 'текст') + wrapper + text.substring(end)
    setEditData(prev => ({ ...prev, body: newText }))
    setTimeout(() => {
      textarea.focus()
      const newPos = start + wrapper.length + (selectedText || 'текст').length
      textarea.setSelectionRange(newPos, newPos)
    }, 0)
  }

  // дерево реплаев
  const rootComments = comments.filter(c => !c.parent_id)
  const childrenMap = useMemo(() => {
    const m = new Map<string, JoinedComment[]>()
    for (const c of comments) {
      if (c.parent_id) {
        const list = m.get(c.parent_id) ?? []
        list.push(c)
        m.set(c.parent_id, list)
      }
    }
    return m
  }, [comments])

  const renderReplies = (parentId: string) => {
    const items = childrenMap.get(parentId) ?? []
    if (!items.length) return null
    return (
      <div className="mt-2 space-y-2">
        {items.map((rc) => (
          <div key={rc.id} className="pl-4 border-l border-slate-300/30">
            <CommentBubble
              c={rc}
              theme={theme}
              textMain={textMain}
              textMuted={textMuted}
              formatText={formatText}
              getRoleColor={getRoleColor}
              getRoleLabel={getRoleLabel}
              onReply={() => setReplyToId(rc.id)}
              canModerate={isLeader || (currentUserId === rc.user_id)}
              onEdit={(newText) => onUpdateComment(rc.id, newText)}
              onDelete={() => onDeleteComment(rc.id)}
            />
            {renderReplies(rc.id)}
          </div>
        ))}
      </div>
    )
  }

  return (
    <motion.article initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border ${cardBg} ${getPostTypeBorder()} overflow-hidden shadow-sm`}
    >
      <div className="p-5">
        {/* заголовок */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-full overflow-hidden bg-slate-200">
              {post.author?.avatar_url
                ? <img src={post.author.avatar_url || ''} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full grid place-items-center text-sm">👤</div>}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <div className={`font-medium ${textMain} truncate`}>{post.author?.username || 'Аноним'}</div>
                {post.author_role && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getRoleColor(post.author_role)}`}>
                    {getRoleLabel(post.author_role)}
                  </span>
                )}
                {post.is_pinned && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500 text-white">Закреплён</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <time className={`text-xs ${textMuted}`}>
                  {new Date(post.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </time>
                {post.post_type === 'announcement' ? <Megaphone className="w-4 h-4 text-amber-500" /> : <Type className="w-4 h-4 text-slate-500" />}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {isLeader && (
              post.is_pinned ? (
                <button onClick={onUnpin} className={`p-2 rounded-lg transition ${theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-slate-700/50'}`} title="Открепить пост">
                  <Pin className="w-4 h-4 rotate-45" />
                </button>
              ) : (
                <button onClick={onPin} className={`p-2 rounded-lg transition ${theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-slate-700/50'}`} title="Закрепить пост (снимет прошлый)">
                  <Pin className="w-4 h-4" />
                </button>
              )
            )}
            {(isLeader || (user?.id === post.author_id && index < 4)) && (
              <button onClick={() => setEditingPost(isEditing ? null : post.id)}
                className={`p-2 rounded-lg transition ${theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-slate-700/50'}`} title="Редактировать">
                <Edit3 className="w-4 h-4" />
              </button>
            )}
            {(isLeader || user?.id === post.author_id) && (
              <button onClick={onDelete}
                className={`p-2 rounded-lg transition text-red-500 ${theme === 'light' ? 'hover:bg-red-50' : 'hover:bg-red-900/20'}`} title="Удалить">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* контент */}
        {editingPost === post.id ? (
          <div className="space-y-3 mb-4">
            <input
              className={`w-full rounded-lg border px-3 py-2 text-sm ${theme === 'light' ? 'bg-white border-slate-300' : 'bg-slate-700/50 border-slate-600'} ${textMain}`}
              placeholder="Заголовок"
              value={editData.title}
              onChange={e => setEditData(prev => ({ ...prev, title: e.target.value }))}
            />
            <div className="flex gap-1 mb-2">
              <button type="button" onClick={() => insertEditFormatting('bold')}
                className={`p-1 rounded text-xs transition ${theme === 'light' ? 'hover:bg-slate-200' : 'hover:bg-slate-600'}`} title="Жирный (**текст**)">
                <Bold className="w-3 h-3" />
              </button>
              <button type="button" onClick={() => insertEditFormatting('italic')}
                className={`p-1 rounded text-xs transition ${theme === 'light' ? 'hover:bg-slate-200' : 'hover:bg-slate-600'}`} title="Курсив (*текст*)">
                <Italic className="w-3 h-3" />
              </button>
              <button type="button" onClick={() => insertEditFormatting('underline')}
                className={`p-1 rounded text-xs transition ${theme === 'light' ? 'hover:bg-slate-200' : 'hover:bg-slate-600'}`} title="Подчёркнутый (__текст__)">
                <Underline className="w-3 h-3" />
              </button>
            </div>
            <div className="relative">
              <textarea
                ref={editBodyRef}
                className={`w-full h-24 rounded-lg border px-3 py-2 text-sm resize-y ${theme === 'light' ? 'bg-white border-slate-300' : 'bg-slate-700/50 border-slate-600'} ${textMain}`}
                value={editData.body}
                onChange={e => setEditData(prev => ({ ...prev, body: e.target.value }))}
                maxLength={1000}
              />
              <div className={`absolute bottom-2 right-2 text-xs ${textMuted}`}>{editData.body.length}/1000</div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleSaveEdit} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Сохранить</button>
              <button onClick={() => setEditingPost(null)}
                className={`px-3 py-1.5 rounded-lg text-sm border ${theme === 'light' ? 'border-slate-300 hover:bg-slate-50' : 'border-slate-600 hover:bg-slate-700/50'}`}>Отмена</button>
            </div>
          </div>
        ) : (
          <div className="mb-4">
            {post.title && <h3 className={`text-lg font-semibold ${textMain} mb-2`} dangerouslySetInnerHTML={{ __html: formatText(post.title) }} />}
            {post.body && <div className={`${textMain} leading-relaxed whitespace-pre-wrap`} dangerouslySetInnerHTML={{ __html: formatText(post.body) }} />}
          </div>
        )}

        {/* изображения */}
        {post.images && post.images.length > 0 && (
          <div className="mb-4">
            {post.images.length === 1 ? (
              <div className="relative cursor-pointer group" onClick={() => onOpenImageViewer(post.images!, 0)}>
                <img src={post.images[0]} alt="Изображение поста" className="w-full max-h-96 object-contain rounded-xl border"
                     onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/placeholder-image.png' }} />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-xl flex items-center justify-center">
                  <Maximize2 className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {post.images.slice(0, 4).map((url, idx) => (
                  <div key={idx} className="relative cursor-pointer group" onClick={() => onOpenImageViewer(post.images!, idx)}>
                    <img src={url} alt={`Изображение ${idx + 1}`} className="w-full h-32 object-cover rounded-lg border"
                         onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/placeholder-image.png' }} />
                    {idx === 3 && post.images!.length > 4 && (
                      <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                        <span className="text-white font-medium">+{post.images!.length - 4}</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-lg flex items-center justify-center">
                      <Maximize2 className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* действия */}
        <div className="flex items-center gap-4 pt-3 border-t border-slate-200/50">
          <button
            onClick={onToggleLike}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition ${
              post.is_liked_by_me
                ? `${theme === 'light' ? 'bg-slate-100 text-slate-900' : 'bg-white/10 text-white'}`
                : `${textMuted} ${theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-slate-700/50'}`
            }`}
          >
            <Heart className={`w-4 h-4 ${post.is_liked_by_me ? 'fill-current' : ''}`} />
            <span className="text-sm font-medium">{post.likes_count || 0}</span>
          </button>

          <button
            onClick={onOpenComments}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition ${textMuted} ${
              theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-slate-700/50'
            }`}
          >
            <MessageCircle className="w-4 h-4" />
            <span className="text-sm font-medium">{post.comments_count || 0}</span>
          </button>
        </div>

        {/* комментарии */}
        <AnimatePresence>
          {commentsOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="mt-4 pt-4 border-t border-slate-200/50 space-y-3">
                {comments.filter(c => !c.parent_id).map((c) => (
                  <div key={c.id}>
                    <CommentBubble
                      c={c}
                      theme={theme}
                      textMain={textMain}
                      textMuted={textMuted}
                      formatText={formatText}
                      getRoleColor={getRoleColor}
                      getRoleLabel={getRoleLabel}
                      onReply={() => setReplyToId(c.id)}
                      canModerate={isLeader || (currentUserId === c.user_id)}
                      onEdit={(newText) => onUpdateComment(c.id, newText)}
                      onDelete={() => onDeleteComment(c.id)}
                    />
                    {(() => {
                      const child = comments.filter(x => x.parent_id === c.id)
                      return child.length ? (
                        <div className="mt-2 space-y-2">
                          {child.map(rc => (
                            <div key={rc.id} className="pl-4 border-l border-slate-300/30">
                              <CommentBubble
                                c={rc}
                                theme={theme}
                                textMain={textMain}
                                textMuted={textMuted}
                                formatText={formatText}
                                getRoleColor={getRoleColor}
                                getRoleLabel={getRoleLabel}
                                onReply={() => setReplyToId(rc.id)}
                                canModerate={isLeader || (currentUserId === rc.user_id)}
                                onEdit={(newText) => onUpdateComment(rc.id, newText)}
                                onDelete={() => onDeleteComment(rc.id)}
                              />
                            </div>
                          ))}
                        </div>
                      ) : null
                    })()}
                    {replyToId === c.id && (
                      <div className="mt-2 pl-4">
                        <textarea
                          className={`w-full rounded-xl border px-3 py-2 text-sm resize-none ${theme === 'light' ? 'bg-white border-slate-300' : 'bg-slate-700/50 border-slate-600'} ${textMain}`}
                          placeholder="Ваш ответ..."
                          value={replyDraftMap[c.id] ?? ''}
                          onChange={e => setReplyDraftMap(prev => ({ ...prev, [c.id]: e.target.value }))}
                          rows={2}
                          maxLength={600}
                          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); onSendReply(c.id) } }}
                        />
                        <div className="flex items-center justify-between mt-2">
                          <div className={`text-xs ${textMuted}`}>{(replyDraftMap[c.id] ?? '').length}/600 • Ctrl+Enter</div>
                          <button
                            onClick={() => onSendReply(c.id)}
                            disabled={!((replyDraftMap[c.id] ?? '').trim())}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Send className="w-3 h-3" />
                            Ответить
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                <div className="flex gap-3 pt-2 border-t border-slate-200/50">
                  <div className="h-8 w-8 rounded-full overflow-hidden bg-slate-200 flex-shrink-0">
                    <div className="w-full h-full grid place-items-center text-xs">👤</div>
                  </div>
                  <div className="flex-1">
                    <textarea
                      className={`w-full rounded-xl border px-3 py-2 text-sm resize-none ${theme === 'light' ? 'bg-white border-slate-300' : 'bg-slate-700/50 border-slate-600'} ${textMain}`}
                      placeholder="Написать комментарий..."
                      value={commentDraft}
                      onChange={e => onCommentDraftChange(e.target.value)}
                      rows={2}
                      maxLength={600}
                      onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); onSendComment() } }}
                    />
                    <div className="flex items-center justify-between mt-2">
                      <div className={`text-xs ${textMuted}`}>{commentDraft.length}/600 символов</div>
                      <button
                        onClick={onSendComment}
                        disabled={!commentDraft.trim() || commentSending}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {commentSending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                        Отправить
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.article>
  )
}

/* ===================== Комментарий ===================== */
const CommentBubble: React.FC<{
  c: JoinedComment
  theme: 'light' | 'dark'
  textMain: string
  textMuted: string
  formatText: (t: string) => string
  getRoleColor: (r: string | null) => string
  getRoleLabel: (r: string | null) => string
  onReply: () => void
  canModerate?: boolean
  onEdit?: (text: string) => void
  onDelete?: () => void
}> = ({ c, theme, textMain, textMuted, formatText, getRoleColor, getRoleLabel, onReply, canModerate, onEdit, onDelete }) => {
  const [isEditing, setIsEditing] = React.useState(false)
  const [draft, setDraft] = React.useState(c.content)

  const save = () => {
    const v = draft.trim()
    if (!v) return
    onEdit?.(v)
    setIsEditing(false)
  }

  return (
    <div className="flex gap-3">
      <div className="h-8 w-8 rounded-full overflow-hidden bg-slate-200 flex-shrink-0">
        {c.avatar_url ? <img src={c.avatar_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center text-xs">👤</div>}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`bg-slate-100 rounded-xl px-3 py-2 ${theme === 'dark' ? 'bg-slate-700/50' : ''}`}>
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-sm font-medium ${textMain}`}>{c.username || 'Аноним'}</span>
            {c.team_role && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getRoleColor(normalizeRole(c.team_role))}`}>
                {getRoleLabel(normalizeRole(c.team_role))}
              </span>
            )}
            <time className={`text-xs ${textMuted}`}>{new Date(c.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</time>

            {canModerate && (
              <span className="ml-auto flex items-center gap-2">
                {!isEditing ? (
                  <>
                    <button className="text-xs text-blue-500 hover:underline" onClick={() => setIsEditing(true)}>Редактировать</button>
                    <button className="text-xs text-red-500 hover:underline" onClick={onDelete}>Удалить</button>
                  </>
                ) : (
                  <>
                    <button className="text-xs text-blue-500 hover:underline" onClick={save}>Сохранить</button>
                    <button className="text-xs text-slate-500 hover:underline" onClick={() => { setIsEditing(false); setDraft(c.content) }}>Отмена</button>
                  </>
                )}
              </span>
            )}
          </div>

          {!isEditing ? (
            <div className={`text-sm ${textMain}`} dangerouslySetInnerHTML={{ __html: formatText(c.content) }} />
          ) : (
            <textarea
              className={`w-full rounded-md border px-2 py-1 text-sm ${theme === 'light' ? 'bg-white border-slate-300' : 'bg-slate-700/50 border-slate-600'} ${textMain}`}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              maxLength={600}
              onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save() } }}
            />
          )}

          <div className="mt-1">
            <button className="text-xs text-blue-500 hover:underline" onClick={onReply}>Ответить</button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ===================== Просмотр изображений ===================== */
const ImageViewer: React.FC<{
  images: string[]
  currentIndex: number
  onClose: () => void
  onIndexChange: (index: number) => void
}> = ({ images, currentIndex, onClose, onIndexChange }) => {
  const nextImage = () => onIndexChange((currentIndex + 1) % images.length)
  const prevImage = () => onIndexChange((currentIndex - 1 + images.length) % images.length)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') nextImage()
      if (e.key === 'ArrowLeft') prevImage()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentIndex])

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={onClose}
    >
      <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
        className="relative max-w-4xl max-h-full" onClick={e => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images[currentIndex]} alt={`Изображение ${currentIndex + 1}`} className="max-w-full max-h-full object-contain rounded-lg" />
        {images.length > 1 && (
          <>
            <button onClick={prevImage} className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70 transition">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button onClick={nextImage} className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70 transition">
              <ChevronRight className="w-6 h-6" />
            </button>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
              {currentIndex + 1} / {images.length}
            </div>
          </>
        )}
        <button onClick={onClose} className="absolute top-4 right-4 w-10 h-10 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70 transition">
          <X className="w-6 h-6" />
        </button>
      </motion.div>
    </motion.div>
  )
}
