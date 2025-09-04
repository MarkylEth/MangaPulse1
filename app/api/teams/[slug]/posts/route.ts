// app/api/teams/[slug]/posts/route.ts - адаптированный под вашу БД
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getViewerId } from '@/lib/auth/route-guards'
import { resolveTeamBySlug, isTeamMember } from '../_utils'

type Params = { params: { slug: string } }

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const team = await resolveTeamBySlug(params.slug)
    if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 })

    const uid = await getViewerId(req)
    const { searchParams } = new URL(req.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '30', 10), 100)
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0)

    // Адаптируем запрос под вашу структуру БД
    const r = await query<{
      id: string
      team_id: number
      author_id: string
      body: string
      title: string | null
      images: string[] | null
      featured_image: string | null
      post_type: string | null
      is_published: boolean
      is_pinned: boolean
      created_at: string
      updated_at: string
      likes_count: number
      dislikes_count: number
      comments_count: number
      viewer_liked: boolean
      author_username: string | null
      author_avatar_url: string | null
    }>(
      `
      with base as (
        select
          p.id::text,
          p.team_id,
          p.author_id,
          p.body,
          p.title,
          p.images,
          p.featured_image,
          p.post_type,
          p.is_published,
          coalesce(p.is_pinned, false) as is_pinned,
          p.created_at,
          p.updated_at,
          coalesce(p.likes_count, 0)::int as likes_count,
          coalesce(p.dislikes_count, 0)::int as dislikes_count,
          coalesce(p.comments_count, 0)::int as comments_count
        from team_posts p
        where p.team_id = $1
        order by coalesce(p.is_pinned, false) desc, p.created_at desc
        limit $2 offset $3
      )
      select
        b.*,
        case when $4::uuid is not null and exists(
          select 1 from team_post_likes l
          where l.post_id = b.id::uuid and l.user_id = $4::uuid and l.is_like = true
        ) then true else false end as viewer_liked,
        pr.username as author_username,
        pr.avatar_url as author_avatar_url
      from base b
      left join profiles pr on pr.id = b.author_id
      `,
      [team.id, limit, offset, uid]
    )

    const items = r.rows.map((row) => ({
      id: row.id,
      teamId: row.team_id,
      author: { 
        id: row.author_id, 
        username: row.author_username, 
        avatar: row.author_avatar_url 
      },
      body: row.body,
      title: row.title,
      images: row.images,
      featured_image: row.featured_image,
      post_type: row.post_type ?? 'text',
      is_published: row.is_published,
      is_pinned: !!row.is_pinned,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      likesCount: row.likes_count,
      dislikesCount: row.dislikes_count,
      commentsCount: row.comments_count,
      likedByViewer: row.viewer_liked,
    }))

    return NextResponse.json({ items, nextOffset: offset + items.length, limit })
  } catch (e) {
    console.error('posts GET error', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const team = await resolveTeamBySlug(params.slug)
    if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 })

    const uid = await getViewerId(req)
    if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Проверяем членство в команде используя вашу таблицу translator_team_members
    const member = await query(
      'select 1 from translator_team_members where team_id = $1 and user_id = $2',
      [team.id, uid]
    )
    if (!member.rowCount) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const payload = await req.json().catch(() => ({} as any))
    
    const body = String(payload?.body ?? payload?.content ?? '').trim()
    if (!body) return NextResponse.json({ error: 'Empty body' }, { status: 400 })

    const title = payload?.title ? String(payload.title).slice(0, 256) : null
    const images = Array.isArray(payload?.images) ? payload.images.slice(0, 12) : null
    const featured = payload?.featured_image ? String(payload.featured_image) : null
    const postType = ['text', 'image', 'announcement'].includes(payload?.post_type) 
      ? payload.post_type 
      : 'text'

    // Вставляем пост в вашу таблицу team_posts (используя BIGINT для team_id)
    const inserted = await query<{ id: string }>(
      `
      insert into team_posts (
        team_id, author_id, body, title, images, featured_image, post_type, is_published, is_pinned
      )
      values ($1, $2, $3, $4, $5, $6, $7, true, false)
      returning id::text
      `,
      [team.id, uid, body, title, images, featured, postType]
    )

    return NextResponse.json({ ok: true, id: inserted.rows[0].id })
  } catch (e) {
    console.error('posts POST error', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}