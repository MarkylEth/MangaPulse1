// app/api/teams/[slug]/_utils.ts - ИСПРАВЛЕННАЯ ВЕРСИЯ
import { query } from '@/lib/db'

export type TeamRow = {
  id: number                    // BIGINT в JS = number
  slug: string | null
  name: string
  created_by: string           // UUID
  created_at: string
  updated_at: string
  bio: string | null
  avatar_url: string | null
  banner_url: string | null
  telegram_url: string | null
  vk_url: string | null
  discord_url: string | null
  boosty_url: string | null
  tags: string[]
  langs: string[]
  likes_count: number
  followers_count: number
  started_at: string | null
  stats_projects: number
  stats_pages: number
  stats_inwork: number
  verified: boolean
  hiring_text: string | null
  hiring_enabled: boolean
}

/** Полная загрузка команды по slug */
export async function resolveTeamBySlug(slug: string): Promise<TeamRow | null> {
  const r = await query<TeamRow>(
    `
    select
      id, slug, name, created_by, created_at, updated_at,
      bio, avatar_url, banner_url,
      telegram_url, vk_url, discord_url, boosty_url,
      tags, langs,
      likes_count, followers_count,
      started_at,
      stats_projects, stats_pages, stats_inwork,
      verified, hiring_text, hiring_enabled
    from translator_teams
    where slug = $1
    limit 1
    `,
    [slug]
  )
  return r.rows[0] ?? null
}

/** Состоит ли пользователь в команде */
export async function isTeamMember(teamId: number, userId: string): Promise<boolean> {
  const r = await query<{ exists: boolean }>(
    `select exists(
       select 1 from translator_team_members
       where team_id = $1 and user_id = $2::uuid
     ) as exists`,
    [teamId, userId]
  )
  return !!r.rows[0]?.exists
}

/** Может ли пользователь редактировать команду */
export async function isTeamEditor(teamId: number, userId: string): Promise<boolean> {
  // Создатель всегда может
  const created = await query<{ exists: boolean }>(
    `select exists(select 1 from translator_teams where id = $1 and created_by = $2::uuid) as exists`,
    [teamId, userId]
  )
  if (created.rows[0]?.exists) return true

  // Участник с ролью lead или editor
  const r = await query<{ exists: boolean }>(
    `select exists(
       select 1 from translator_team_members
       where team_id = $1 and user_id = $2::uuid and role = any($3::text[])
     ) as exists`,
    [teamId, userId, ['lead', 'leader', 'editor']]
  )
  return !!r.rows[0]?.exists
}

/** Роль участника */
export async function getMemberRole(teamId: number, userId: string): Promise<string> {
  // Проверяем создателя
  const created = await query<{ exists: boolean }>(
    `select exists(select 1 from translator_teams where id = $1 and created_by = $2::uuid) as exists`,
    [teamId, userId]
  )
  if (created.rows[0]?.exists) return 'leader'

  // Получаем роль из таблицы участников
  const r = await query<{ role: string }>(
    `select role from translator_team_members where team_id = $1 and user_id = $2::uuid limit 1`,
    [teamId, userId]
  )
  return r.rows[0]?.role ?? 'none'
}

/** Может ли пользователь создавать посты */
export async function canCreatePosts(teamId: number, userId: string): Promise<boolean> {
  const role = await getMemberRole(teamId, userId)
  const allowedRoles = ['leader', 'lead', 'editor', 'translator', 'typesetter']
  return allowedRoles.includes(role)
}

/** Может ли пользователь закреплять посты */
export async function canPinPosts(teamId: number, userId: string): Promise<boolean> {
  const role = await getMemberRole(teamId, userId)
  return role === 'leader' || role === 'lead'
}

/** Получить команду с дополнительными данными пользователя */
export async function getTeamWithUserData(slug: string, userId: string | null) {
  const team = await resolveTeamBySlug(slug)
  if (!team) return null

  // Подсчет подписчиков из team_followers
  const followersRes = await query<{ cnt: number }>(
    'select count(*)::int as cnt from team_followers where team_id = $1',
    [team.id]
  )
  const followers_count = followersRes.rows[0]?.cnt ?? team.followers_count ?? 0

  // Подсчет участников из translator_team_members
  const membersRes = await query<{ cnt: number }>(
    'select count(*)::int as cnt from translator_team_members where team_id = $1',
    [team.id]
  )
  const members_count = membersRes.rows[0]?.cnt ?? 0

  let i_follow = false
  let user_role = 'none'
  let can_post = false
  let can_edit = false
  let can_pin = false

  if (userId) {
    // Проверяем подписку
    const followRes = await query(
      'select 1 from team_followers where team_id = $1 and user_id = $2::uuid limit 1',
      [team.id, userId]
    )
    i_follow = (followRes?.rowCount ?? 0) > 0

    // Получаем роль и права
    user_role = await getMemberRole(team.id, userId)
    can_post = await canCreatePosts(team.id, userId)
    can_edit = await isTeamEditor(team.id, userId)
    can_pin = await canPinPosts(team.id, userId)
  }

  return {
    ...team,
    followers_count,
    members_count,
    i_follow,
    user_role,
    can_post,
    can_edit,
    can_pin,
  }
}

// Совместимость
export { resolveTeamBySlug as resolveTeam }