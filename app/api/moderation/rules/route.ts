// app/api/moderation/rules/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// NEON
async function getSql() {
  const url = process.env.DATABASE_URL;
  const mod = await import("@neondatabase/serverless").catch(() => null as any);
  if (!url || !mod?.neon) return null;
  return mod.neon(url);
}

/** Возвращаем список правил из БД (только активные) */
export async function GET() {
  try {
    const sql = await getSql();
    if (!sql) return NextResponse.json({ ok: true, rules: [] });

    // ВАЖНО: маппим названия колонок твоей схемы:
    // pattern, kind_mod_kind, mod_category, lang, severity, is_active
    const rows = await sql/* sql */`
      SELECT
        id::text                             AS id,
        pattern                              AS pattern,
        COALESCE(kind_mod_kind, 'regex')     AS kind,
        COALESCE(mod_category, 'misc')       AS category,
        lang                                  ,
        severity
      FROM public.mod_banned_patterns
      WHERE COALESCE(is_active, true) = true
      ORDER BY created_at ASC;
    `;

    // Схема, которую ждёт фронт
    const rules = rows.map((r: any) => ({
      id: String(r.id),
      pattern: String(r.pattern ?? ""),
      // 'regex' | 'word' | 'phrase'
      kind: (r.kind ?? "regex") as "regex" | "word" | "phrase",
      category: String(r.category ?? "misc"),
      lang: r.lang ?? null,
      severity: r.severity ?? null,
    }));

    return NextResponse.json({ ok: true, rules });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Internal error" }, { status: 500 });
  }
}

/** Если нужно, можно оставить POST-валидатор, но он не обязателен
 * для подсветки. Фронт подсвечивает локально. */
