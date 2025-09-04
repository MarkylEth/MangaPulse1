// lib/data/chapters.ts
import { query } from '@/lib/db';

async function hasColumn(table: string, col: string) {
  const { rowCount } = await query(
    `select 1
       from information_schema.columns
      where table_schema='public' and table_name=$1 and column_name=$2
      limit 1`,
    [table, col]
  );
  return !!rowCount;
}

/** Публичные (только published) главы для страницы тайтла */
export async function getPublicChaptersByManga(
  mangaId: number,
  { limit = 0, order = 'desc', by = 'created_at' as 'created_at' | 'number' } = {}
) {
  const hasStatus = await hasColumn('chapters', 'status');

  const orderBy =
    by === 'number'
      ? `coalesce(chapter_number,0) ${order}, created_at desc`
      : `created_at ${order}, coalesce(chapter_number,0) desc`;

  const params: any[] = [mangaId];
  let sql =
    `select id, manga_id, coalesce(chapter_number,0) as chapter_number,
            coalesce(volume,0) as volume, coalesce(title,'') as title,
            status, pages_count, created_at, updated_at
       from chapters
      where manga_id = $1`;

  if (hasStatus) sql += ` and lower(status) = 'published'`;

  sql += ` order by ${orderBy}`;
  if (limit) { params.push(limit); sql += ` limit $${params.length}`; }

  const { rows } = await query(sql, params);
  return rows;
}
