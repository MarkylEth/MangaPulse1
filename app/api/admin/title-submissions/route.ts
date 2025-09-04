import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* ---------- helpers ---------- */

function toStrList(v: any): string[] {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === 'string') return v.split(/[,;\n]/).map(s => s.trim()).filter(Boolean);
  if (typeof v === 'object') {
    const arr = Array.isArray((v as any).names) ? (v as any).names : Object.values(v);
    return Array.isArray(arr) ? arr.map(String).filter(Boolean) : [];
  }
  return [];
}
function uniq<T>(arr: T[]): T[] {
  const s = new Set<T>(); const out: T[] = [];
  for (const x of arr) if (!s.has(x)) { s.add(x); out.push(x); }
  return out;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeBody(raw: any) {
  const anyId = raw?.id ?? raw?.sid ?? raw?.uid ?? raw?.submission_id ?? raw?.manga_id;
  let action: string = (raw?.action ?? '').toString().toLowerCase().trim();

  // поддерживаем approved/rejected
  if (action === 'approved') action = 'approve';
  if (action === 'rejected') action = 'reject';

  // не приводим к числу! оставляем как строку, далее подберем каст
  const idStr = anyId == null ? null : String(anyId).trim();
  const cast = idStr && UUID_RE.test(idStr) ? 'uuid' : 'bigint';

  return {
    id: idStr as string | null,
    cast, // 'uuid' | 'bigint'
    action,
    note: raw?.note ?? null,
    tags: raw?.tags ?? null,
    tagsOverride: !!raw?.tagsOverride,
    payload: raw?.payload ?? {},
  };
}

// Функция для преобразования данных в формат, ожидаемый компонентом
function transformRowToItem(row: any) {
  const payload = row.payload || {};
  
  return {
    // Основные поля для компонента
    id: row.id,
    sid: row.id, // используем id как sid для совместимости
    uid: null,
    kind: 'suggestion' as const, // все записи из title_submissions это заявки
    
    // Извлекаем поля из payload с fallback на базовые поля
    title: payload.title_ru || payload.title || 'Без названия',
    cover_url: payload.cover_url || null,
    author: payload.author || null,
    artist: payload.artist || null,
    description: payload.description || null,
    status: payload.status || null,
    
    // Статус модерации
    submission_status: row.status === 'pending' ? 'pending' 
                     : row.status === 'approved' ? 'approved'
                     : row.status === 'rejected' ? 'rejected'
                     : 'pending',
    
    created_at: row.created_at,
    updated_at: row.reviewed_at,
    
    // Дополнительные поля
    original_title: payload.original_title || null,
    type: payload.type || null,
    translation_status: payload.translation_status || null,
    age_rating: payload.age_rating || null,
    release_year: payload.release_year || null,
    slug: null,
    title_romaji: payload.title_romaji || row.title_romaji || null,
    
    // Сохраняем payload для детального просмотра
    payload: payload,
    
    // Жанры и теги из отдельных колонок и payload
    genres: row.genres || payload.genres || null,
    tags: row.tags || payload.tags || null,
    manga_genres: null,
    tag_list: null,
    
    translator_team_id: payload.translator_team_id || null,
    author_comment: row.author_comment || null,
    sources: row.source_links || null,
    author_name: row.author_name || payload.author_name || null,
  };
}

/* ---------- GET: последние заявки с полной информацией ---------- */

export async function GET() {
  try {
    // Расширенный запрос с дополнительными полями
    const r = await query(
      `select 
         id, status, payload, tags, genres, source_links,
         manga_id, reviewed_at, review_note, created_at,
         title_romaji, author_comment, author_name, user_id, type
       from title_submissions
       order by created_at desc
       limit 50`
    );
    
    // Преобразуем данные в формат, ожидаемый компонентом
    const items = r.rows.map(transformRowToItem);
    
    // Считаем статистику
    const stats = {
      total: items.length,
      manga: 0, // в title_submissions только заявки
      suggestions: items.length,
      pending: items.filter(item => item.submission_status === 'pending').length,
      approved: items.filter(item => item.submission_status === 'approved').length,
      rejected: items.filter(item => item.submission_status === 'rejected').length,
    };
    
    return NextResponse.json({ ok: true, items, stats });
  } catch (e: any) {
    console.error('Error in GET /api/admin/manga-moderation:', e);
    return NextResponse.json({ 
      ok: false, 
      error: e?.message ?? 'Internal error',
      items: [],
      stats: { total: 0, manga: 0, suggestions: 0, pending: 0, approved: 0, rejected: 0 }
    }, { status: 500 });
  }
}

/* ---------- POST ---------- */
/*
  - { action: 'approve' | 'reject', id|sid|uid, note?, tags?, tagsOverride? }
  - иначе { payload, tags? } — создать заявку
*/
export async function POST(req: Request) {
  try {
    const raw = await req.json().catch(() => ({}));
    const { id, cast, action, note, tags, tagsOverride, payload } = normalizeBody(raw);
    const nowIso = new Date().toISOString();

    if (action === 'reject') {
      if (!id) return NextResponse.json({ ok: false, error: 'id and action are required' }, { status: 400 });
      await query(
        `update title_submissions
           set status='rejected', reviewed_at=$2, review_note=$3
         where id = $1::${cast}`,
        [id, nowIso, note ?? null]
      );
      return NextResponse.json({ ok: true });
    }

    if (action === 'approve') {
      if (!id) return NextResponse.json({ ok: false, error: 'id and action are required' }, { status: 400 });

      const sRes = await query<any>(`select * from title_submissions where id = $1::${cast}`, [id]);
      if (!sRes.rowCount) {
        return NextResponse.json({ ok: false, error: 'Suggestion not found' }, { status: 404 });
      }

      const row = sRes.rows[0];
      const p = (row?.payload ?? {}) as any;
      let mangaId: number | null = row?.manga_id ?? null;

      // жанры + теги
      const genreList = uniq(toStrList(p.genre_names).length ? toStrList(p.genre_names) : toStrList(p.genres));
      const tagsFromSug = uniq([
        ...toStrList(row?.tags),
        ...toStrList(p.tags),
        ...toStrList(p.tag_names),
        ...toStrList(p.keywords),
        ...toStrList(p.tags_csv),
      ]);
      const tagList = tagsOverride ? toStrList(tags) : uniq([...tagsFromSug, ...toStrList(tags)]);

      // создаём мангу, если нет
      if (mangaId == null) {
        const ins = await query<{ id: number }>(
          `insert into manga (
             cover_url, title, title_romaji, author, artist, description,
             status, translation_status, age_rating, release_year, type, created_at
           ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now())
           returning id`,
          [
            p.cover_url ?? null,
            p.title_ru ?? p.title ?? null,
            p.title_romaji ?? null,
            p.author ?? null,
            p.artist ?? null,
            p.description ?? null,
            p.status ?? null,
            p.translation_status ?? null,
            p.age_rating ?? null,
            p.release_year ?? null,
            p.type ?? null,
          ]
        );
        mangaId = ins.rows?.[0]?.id ?? null;
        if (!mangaId) return NextResponse.json({ ok: false, error: 'Insert into manga failed' }, { status: 500 });
      }

      // genres/tags в самой manga (text[])
      await query(`update manga set genres=$2, tags=$3 where id=$1`, [mangaId, genreList, tagList]);

      await query(
        `update title_submissions
           set status='approved', reviewed_at=$2, review_note=$3, manga_id=$4
         where id=$1::${cast}`,
        [id, nowIso, note ?? null, mangaId]
      );

      return NextResponse.json({ ok: true, manga_id: mangaId });
    }

    // ---- создание новой заявки ----
    const insSug = await query<{ id: string }>(
      `insert into title_submissions (status, payload, tags, created_at)
       values ('pending', $1::jsonb, $2, now())
       returning id`,
      [payload ?? {}, Array.isArray(tags) ? tags : null]
    );
    return NextResponse.json({ ok: true, id: insSug.rows?.[0]?.id ?? null });
  } catch (e: any) {
    console.error('Error in POST /api/admin/manga-moderation:', e);
    return NextResponse.json({ ok: false, error: e?.message ?? 'Internal error' }, { status: 500 });
  }
}