// app/api/teams/[slug]/follow/route.ts - ИСПРАВЛЕННАЯ ВЕРСИЯ
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getViewerId } from '@/lib/auth/route-guards';
import { resolveTeam } from '../_utils';

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const uid = await getViewerId(req as any);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const team = await resolveTeam(params.slug);
  if (!team) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { follow } = await req.json().catch(() => ({ follow: true }));

  try {
    if (follow) {
      // Используем структуру вашей таблицы team_followers
      await query(
        `insert into team_followers (team_id, user_id)
         values ($1, $2::uuid)
         on conflict (team_id, user_id) do update set updated_at = now()`,
        [team.id, uid],
      );
    } else {
      await query(
        `delete from team_followers where team_id = $1 and user_id = $2::uuid`,
        [team.id, uid],
      );
    }

    // Получаем актуальный счетчик
    const { rows } = await query<{ cnt: number }>(
      `select count(*)::int as cnt from team_followers where team_id = $1`,
      [team.id],
    );

    const followers_count = rows[0]?.cnt || 0;

    // Обновляем счетчик в основной таблице команды
    await query(
      `update translator_teams set followers_count = $1 where id = $2`,
      [followers_count, team.id]
    );

    return NextResponse.json({ 
      ok: true, 
      i_follow: !!follow, 
      followers_count 
    });
  } catch (e) {
    console.error('follow error', e);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}