import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getAuthUser } from '@/lib/auth/route-guards'
import { resolveTeamBySlug } from './_utils'

type Params = { params: { slug: string } }

/** Профиль команды: базовые поля + подписчики + счётчик участников + флаг «я подписан» */
export async function GET(req: NextRequest, { params }: Params) {
  const me = await getAuthUser(req) // -> { id } | null
  const team = await resolveTeamBySlug(params.slug)
  if (!team) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  // Живой подсчёт подписчиков (чтобы не было рассинхрона)
  const followersRes = await query<{ cnt: number }>(
    'select count(*)::int as cnt from team_followers where team_id=$1',
    [team.id]
  )
  const followers_count = followersRes.rows[0]?.cnt ?? team.followers_count ?? 0

  // Счётчик участников для бейджа «Команда (N)»
  const membersRes = await query<{ cnt: number }>(
    'select count(*)::int as cnt from translator_team_members where team_id=$1',
    [team.id]
  )
  const members_count = membersRes.rows[0]?.cnt ?? 0

  // Подписан ли текущий пользователь
  let i_follow = false
  if (me?.id) {
    const res = await query(
      'select 1 from team_followers where team_id=$1 and user_id=$2 limit 1',
      [team.id, me.id]
    )
    i_follow = (res?.rowCount ?? 0) > 0
  }

  return NextResponse.json({
    ...team,
    followers_count,
    members_count,
    i_follow,
  })
}
