// app/api/manga/[id]/comments/route.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* ================== helpers ================== */

function parseMangaId(raw: string | string[] | undefined): number {
  const s = String(Array.isArray(raw) ? raw[0] : raw ?? '').trim();
  const m = s.match(/^\d+/)?.[0];
  const n = m ? parseInt(m, 10) : Number.NaN;
  return Number.isFinite(n) ? n : Number.NaN;
}

async function hasColumn(table: string, column: string) {
  const sql = `
    select 1
    from information_schema.columns
    where table_schema='public' and table_name=$1 and column_name=$2
    limit 1
  `;
  const r = await query(sql, [table, column]);
  return (r.rowCount ?? 0) > 0;
}

async function getCaps() {
  const T = 'manga_comments';
  const [hasComment, hasContent, hasCreatedAt] = await Promise.all([
    hasColumn(T, 'comment'),
    hasColumn(T, 'content'),
    hasColumn(T, 'created_at'),
  ]);
  return { hasComment, hasContent, hasCreatedAt, table: T };
}

const ok = (data: any) => NextResponse.json({ ok: true, ...data });
const bad = (error: string, status = 400) =>
  NextResponse.json({ ok: false, error }, { status });

/* ================== GET list ================== */

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  const mangaId = parseMangaId(ctx.params?.id);
  if (!Number.isFinite(mangaId)) return ok({ items: [] });

  const { hasComment, hasContent, table } = await getCaps();

  // coalesce(content, comment) -> "comment" для фронта
  const commentExpr = hasContent
    ? (hasComment ? 'coalesce(c.content, c.comment)' : 'c.content')
    : 'c.comment';

  const sql = `
    select
      c.id::text,
      c.manga_id::int,
      c.user_id::text,
      ${commentExpr} as comment,
      c.created_at,
      c.parent_id::text,
      c.is_team_comment,
      c.team_id::int,
      c.is_pinned,
      jsonb_build_object(
        'id', p.id::text,
        'username', p.username,
        'avatar_url', p.avatar_url
      ) as profile,
      case when c.team_id is not null then
        jsonb_build_object(
          'id', t.id::int,
          'name', t.name,
          'avatar_url', t.avatar_url
        )
      else null end as team
    from public.${table} c
    left join public.profiles p on p.id = c.user_id
    left join public.translator_teams t on t.id = c.team_id
    where c.manga_id = $1
    order by c.created_at asc, c.id asc
  `;

  const r = await query(sql, [mangaId]);
  return ok({ items: r.rows ?? [] });
}

/* ================== POST insert ================== */

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  const user = await getAuthUser();
  if (!user) return bad('unauthorized', 401);

  const mangaId = parseMangaId(ctx.params?.id);
  if (!Number.isFinite(mangaId)) return bad('bad_id', 400);

  const body = await req.json().catch(() => ({}));
  const html: string = String(body?.comment ?? '').trim();
  if (!html) return bad('empty_comment', 400);

  const parent_id: string | null = body?.parent_id || null;
  const as_team: boolean = !!body?.as_team;
  const pin: boolean = !!body?.pin;

  // Разрешаем комм. "от команды" только лидеру/модерации (если у тебя это уже проверяется на UI — серверная проверка всё равно не помешает)
  // Здесь используем признак leaderTeamId, если он приходит из getAuthUser().
  const leaderTeamId: number | null = (user as any)?.leaderTeamId ?? null;
  const usingTeam = as_team && leaderTeamId != null;
  const pinOnInsert = usingTeam && pin ? true : false;

  const { hasComment, hasContent, hasCreatedAt, table } = await getCaps();

  // Собираем колонки и значения синхронно, без сдвигов (чтобы не словить boolean vs timestamptz)
  const cols: string[] = [];
  const vals: any[] = [];
  const ph: string[] = [];

  const add = (col: string, val: any) => {
    cols.push(col);
    vals.push(val);
    ph.push(`$${vals.length}`);
  };
  const addRaw = (col: string, rawSql: string) => {
    cols.push(col);
    ph.push(rawSql); // без плейсхолдера
  };

  add('manga_id', mangaId);
  add('user_id', user.id);

  if (hasComment) add('comment', html);
  if (hasContent) add('content', html);

  // Если нет DEFAULT now() — раскомментируй след. строку:
  // if (hasCreatedAt) addRaw('created_at', 'now()');

  add('parent_id', parent_id);
  add('is_team_comment', usingTeam);
  add('team_id', usingTeam ? leaderTeamId : null);
  add('is_pinned', pinOnInsert);

  const sql = `
    insert into public.${table} (${cols.join(', ')})
    values (${ph.join(', ')})
    returning
      id::text, manga_id::int, user_id::text,
      coalesce(content, comment) as comment,
      created_at, parent_id::text, is_team_comment, team_id::int, is_pinned
  `;

  try {
    const ins = await query(sql, vals);
    const row = ins.rows?.[0];

    // Дотягиваем profile и team, чтобы фронту было удобно
    const ex = await query(
      `
      select
        jsonb_build_object(
          'id', p.id::text,
          'username', p.username,
          'avatar_url', p.avatar_url
        ) as profile,
        case when $1::int is not null then
          jsonb_build_object('id', t.id::int, 'name', t.name, 'avatar_url', t.avatar_url)
        else null end as team
      from public.profiles p
      left join public.translator_teams t on t.id = $1::int
      where p.id = $2
      limit 1
      `,
      [usingTeam ? leaderTeamId : null, user.id]
    );

    const extras = ex.rows?.[0] ?? {};
    const item = { ...row, profile: extras.profile ?? null, team: extras.team ?? null };

    return ok({ item });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.code || 'internal', message: e?.message },
      { status: 500 }
    );
  }
}
