// app/api/teams/[teamId]/members/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getViewerId } from '@/lib/auth/route-guards'

type Params = { params: { teamId: string } }

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const teamId = parseInt(params.teamId, 10)
    if (!teamId) return NextResponse.json({ error: 'Invalid team ID' }, { status: 400 })

    const r = await query<{
      user_id: string
      role: string
      username: string | null
      avatar_url: string | null
    }>(
      `
      select m.user_id, m.role,
             p.username, p.avatar_url
      from translator_team_members m
      left join profiles p on p.id = m.user_id
      where m.team_id = $1
      order by
        case m.role
          when 'leader' then 0
          when 'owner'  then 1
          when 'lead'   then 2
          when 'editor' then 3
          when 'translator' then 4
          when 'typesetter' then 5
          else 6
        end,
        coalesce(p.username, '') asc
      `,
      [teamId]
    )

    const items = r.rows.map((x) => ({
      user_id: x.user_id,
      role: x.role,
      profile: {
        id: x.user_id,
        username: x.username,
        avatar_url: x.avatar_url,
      }
    }))

    return NextResponse.json({ items, count: items.length })
  } catch (e) {
    console.error('members GET error', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const teamId = parseInt(params.teamId, 10)
    if (!teamId) return NextResponse.json({ error: 'Invalid team ID' }, { status: 400 })

    const uid = await getViewerId(req)
    if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Проверяем права на редактирование команды
    const canEdit = await query<{ exists: boolean }>(
      `select exists(
        select 1 from translator_teams 
        where id = $1 and created_by = $2
        union
        select 1 from translator_team_members
        where team_id = $1 and user_id = $2 and role in ('lead', 'editor')
      ) as exists`,
      [teamId, uid]
    )

    if (!canEdit.rows[0]?.exists) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { members } = await req.json().catch(() => ({ members: [] }))
    
    if (!Array.isArray(members)) {
      return NextResponse.json({ error: 'Invalid members data' }, { status: 400 })
    }

    await query('begin')
    
    try {
      // Удаляем всех текущих участников (кроме создателя)
      await query(
        `delete from translator_team_members 
         where team_id = $1 and user_id != (
           select created_by from translator_teams where id = $1
         )`,
        [teamId]
      )

      // Добавляем новых участников
      for (const member of members) {
        if (!member.username?.trim() || !member.role?.trim()) continue
        
        // Ищем пользователя по username
        const userResult = await query<{ id: string }>(
          'select id from profiles where username = $1 limit 1',
          [member.username.trim()]
        )
        
        if (userResult.rows[0]) {
          await query(
            `insert into translator_team_members (team_id, user_id, role)
             values ($1, $2, $3)
             on conflict (team_id, user_id) do update set role = excluded.role`,
            [teamId, userResult.rows[0].id, member.role.trim()]
          )
        }
      }

      await query('commit')

      // Возвращаем обновленный список
      const r = await query<{
        user_id: string
        role: string
        username: string | null
        avatar_url: string | null
      }>(
        `select m.user_id, m.role, p.username, p.avatar_url
         from translator_team_members m
         left join profiles p on p.id = m.user_id
         where m.team_id = $1
         order by
           case m.role
             when 'leader' then 0
             when 'owner' then 1
             when 'lead' then 2
             when 'editor' then 3
             when 'translator' then 4
             when 'typesetter' then 5
             else 6
           end,
           coalesce(p.username, '') asc`,
        [teamId]
      )

      const items = r.rows.map((x) => ({
        user_id: x.user_id,
        role: x.role,
        profile: {
          id: x.user_id,
          username: x.username,
          avatar_url: x.avatar_url,
        }
      }))

      return NextResponse.json({ ok: true, items })
    } catch (e) {
      await query('rollback')
      throw e
    }
  } catch (e) {
    console.error('members POST error', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}