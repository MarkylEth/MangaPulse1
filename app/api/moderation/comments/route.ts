// app/api/moderation/comments/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Source = "all" | "manga" | "page";

async function getSql() {
  const url = process.env.DATABASE_URL;
  const mod = await import("@neondatabase/serverless").catch(() => null as any);
  if (!url || !mod?.neon) return null;
  return mod.neon(url);
}
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const like = (s: string) => `%${s}%`;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const source = (searchParams.get("source") || "all").toLowerCase() as Source;
    const q = (searchParams.get("q") || "").trim();
    const limit = clamp(parseInt(searchParams.get("limit") || "50", 10), 1, 500);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);

    const sql = await getSql();
    if (!sql) {
      return NextResponse.json({ ok: true, items: [], total: 0, hint: "DB not configured" });
    }

    async function safe<T>(fn: () => Promise<T>) {
      try {
        const data = await fn();
        return { ok: true, data, error: null as string | null };
      } catch (e: any) {
        return { ok: false, data: null as any, error: String(e?.message || e) };
      }
    }

    // ---- manga_comments
    const mangaRes =
      source !== "page"
        ? await safe(async () => {
            const [rows, cnt] = await Promise.all([
              q
                ? sql/* sql */`
                    SELECT * FROM public.manga_comments
                    WHERE (comment ILIKE ${like(q)} OR content ILIKE ${like(q)})
                    ORDER BY created_at DESC
                    LIMIT ${limit} OFFSET ${offset};
                  `
                : sql/* sql */`
                    SELECT * FROM public.manga_comments
                    ORDER BY created_at DESC
                    LIMIT ${limit} OFFSET ${offset};
                  `,
              q
                ? sql/* sql */`
                    SELECT count(*)::int AS c FROM public.manga_comments
                    WHERE (comment ILIKE ${like(q)} OR content ILIKE ${like(q)});
                  `
                : sql/* sql */`SELECT count(*)::int AS c FROM public.manga_comments;`,
            ]);
            return {
              rows: rows.map((r: any) => mapRow(r, "manga")),
              total: Number(cnt?.[0]?.c || 0),
            };
          })
        : { ok: true, data: { rows: [], total: 0 }, error: null };

    // ---- page_comments
    const pageRes =
      source !== "manga"
        ? await safe(async () => {
            const [rows, cnt] = await Promise.all([
              q
                ? sql/* sql */`
                    SELECT * FROM public.page_comments
                    WHERE (content ILIKE ${like(q)} OR comment ILIKE ${like(q)})
                    ORDER BY created_at DESC
                    LIMIT ${limit} OFFSET ${offset};
                  `
                : sql/* sql */`
                    SELECT * FROM public.page_comments
                    ORDER BY created_at DESC
                    LIMIT ${limit} OFFSET ${offset};
                  `,
              q
                ? sql/* sql */`
                    SELECT count(*)::int AS c FROM public.page_comments
                    WHERE (content ILIKE ${like(q)} OR comment ILIKE ${like(q)});
                  `
                : sql/* sql */`SELECT count(*)::int AS c FROM public.page_comments;`,
            ]);
            return {
              rows: rows.map((r: any) => mapRow(r, "page")),
              total: Number(cnt?.[0]?.c || 0),
            };
          })
        : { ok: true, data: { rows: [], total: 0 }, error: null };

    if (!mangaRes.ok && !pageRes.ok) {
      const err = mangaRes.error || pageRes.error || "DB error";
      return NextResponse.json({ ok: false, error: `Error connecting to database: ${err}` }, { status: 502 });
    }

    const allItems = [...(mangaRes.data?.rows ?? []), ...(pageRes.data?.rows ?? [])]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);

    const total = Number((mangaRes.data?.total ?? 0) + (pageRes.data?.total ?? 0));
    const hint = [mangaRes.error, pageRes.error].filter(Boolean).join(" | ") || undefined;

    return NextResponse.json({ ok: true, items: allItems, total, hint });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Internal error" }, { status: 500 });
  }
}

function mapRow(row: any, source: "manga" | "page") {
  // ВАЖНО: у manga_comments текст в колонке "comment", у page_comments — обычно "content"
  const content = String(row.comment ?? row.content ?? row.text ?? "");

  const created_at =
    row.created_at ??
    row.created_at_timestamp ?? // на некоторых схемах так называется
    row.created ??
    row.inserted_at ??
    null;

  const author_id = row.profile_id ?? row.user_id ?? row.author_id ?? null;
  const target_id =
    source === "manga"
      ? row.manga_id ?? row.manga ?? null
      : row.page_id ?? row.page ?? null;

  return {
    id: String(row.id),
    source,
    target_id,
    content,
    created_at,
    author_id,
    flags: {
      is_spoiler: !!row.is_spoiler,
      is_pinned: !!row.is_pinned,
      is_hidden: !!row.is_hidden,
      is_deleted: !!row.is_deleted,
    },
    _raw: row,
  };
}
