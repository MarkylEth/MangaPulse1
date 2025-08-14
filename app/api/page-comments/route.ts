// app/api/page-comments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/* ========= helpers ========= */

function reqEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

// Supabase из cookies
async function supabaseFromCookies() {
  const store = await cookies();
  return createServerClient(
    reqEnv("NEXT_PUBLIC_SUPABASE_URL"),
    reqEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        get(name: string) {
          return store.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try { store.set({ name, value, ...options }); } catch {}
        },
        remove(name: string, options: CookieOptions) {
          try { store.set({ name, value: "", ...options }); } catch {}
        },
      },
    }
  );
}

// Supabase по токену (Authorization: Bearer ...)
function supabaseFromToken(token: string) {
  return createClient(
    reqEnv("NEXT_PUBLIC_SUPABASE_URL"),
    reqEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
}

// 1) cookies → 2) Authorization: Bearer
async function getClientAndUser(req: NextRequest) {
  const cookieClient = await supabaseFromCookies();
  const { data: cData } = await cookieClient.auth.getUser();
  if (cData?.user) return { db: cookieClient, userId: cData.user.id };

  const authz = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const m = authz.match(/^Bearer\s+(.+)$/i);
  if (m?.[1]) {
    const tokenClient = supabaseFromToken(m[1].trim());
    const { data: tData } = await tokenClient.auth.getUser();
    if (tData?.user) return { db: tokenClient, userId: tData.user.id };
    return { db: tokenClient, userId: null };
  }

  return { db: cookieClient, userId: null };
}

/* ========= flexible schema for page_comments ========= */

async function trySelectVariants(
  db: any,
  args: {
    pageId?: number | string | null;
    pageUrl?: string | null;
    pageNumber?: number | null;
    chapterId?: number | null;
    limit?: number;
  }
) {
  const { pageId, pageUrl, pageNumber, chapterId } = args;
  const limit = Math.min(Math.max(args.limit ?? 200, 1), 500);

  const runs: Array<() => Promise<{ data: any[] | null; error: any | null }>> = [];

  if (pageId != null) {
    runs.push(() =>
      db.from("page_comments")
        .select("*")
        .eq("page_id", pageId)
        .order("created_at", { ascending: true })
        .limit(limit)
    );
  }
  if (pageUrl) {
    runs.push(() =>
      db.from("page_comments")
        .select("*")
        .eq("image_url", pageUrl)
        .order("created_at", { ascending: true })
        .limit(limit)
    );
  }
  if (pageNumber != null && chapterId != null) {
    runs.push(() =>
      db.from("page_comments")
        .select("*")
        .eq("page_number", pageNumber)
        .eq("chapter_id", chapterId)
        .order("created_at", { ascending: true })
        .limit(limit)
    );
    runs.push(() =>
      db.from("page_comments")
        .select("*")
        .eq("page_index", pageNumber)
        .eq("chapter_id", chapterId)
        .order("created_at", { ascending: true })
        .limit(limit)
    );
  }

  for (const run of runs) {
    const { data, error } = await run();
    if (!error && Array.isArray(data)) return data;
  }
  return [];
}

async function tryInsertVariants(
  db: any,
  contentHtml: string,
  base: { user_id: string; parent_id?: string | null },
  page: {
    pageId?: number | string | null;
    pageUrl?: string | null;
    pageNumber?: number | null;
    chapterId?: number | null;
  }
) {
  const requireParent = !!base.parent_id;

  const candidates: any[] = [];
  if (page.pageId != null) candidates.push({ page_id: page.pageId, ...base });
  if (page.pageUrl) candidates.push({ image_url: page.pageUrl, ...base });
  if (page.pageNumber != null && page.chapterId != null) {
    candidates.push({ page_number: page.pageNumber, chapter_id: page.chapterId, ...base });
    candidates.push({ page_index: page.pageNumber, chapter_id: page.chapterId, ...base });
  }

  for (const obj of candidates) {
    // 1) с content
    let { data, error } = await db
      .from("page_comments")
      .insert({ ...obj, content: contentHtml } as any)
      .select("*")
      .single();
    if (data && !error) return data;

    const msg = (error?.message || "").toLowerCase();

    // 2) с comment (если нет content)
    if (msg.includes("content") && (msg.includes("does not exist") || msg.includes("schema cache"))) {
      const r2 = await db
        .from("page_comments")
        .insert({ ...obj, comment: contentHtml } as any)
        .select("*")
        .single();
      if (r2.data && !r2.error) return r2.data;
      error = r2.error;
    }

    // 3) если нет parent_id
    if (error) {
      const em = (error.message || "").toLowerCase();
      const parentMissing = em.includes("parent_id") && (em.includes("does not exist") || em.includes("schema cache"));
      if (parentMissing) {
        if (requireParent) throw new Error("replies-not-supported");
        const { parent_id, ...noParent } = obj;
        let r3 = await db
          .from("page_comments")
          .insert({ ...noParent, content: contentHtml } as any)
          .select("*")
          .single();
        if (r3.data && !r3.error) return r3.data;

        const em3 = (r3.error?.message || "").toLowerCase();
        if (em3.includes("content") && (em3.includes("does not exist") || em3.includes("schema cache"))) {
          const r4 = await db
            .from("page_comments")
            .insert({ ...noParent, comment: contentHtml } as any)
            .select("*")
            .single();
          if (r4.data && !r4.error) return r4.data;
        }
      }
    }
  }
  throw new Error("no-variant");
}

/* ========= GET ========= */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const pageIdRaw = searchParams.get("pageId");
    const pageUrl = searchParams.get("pageUrl");
    const pageNumber = searchParams.get("pageNumber");
    const chapterId = searchParams.get("chapterId");
    const limit = Number(searchParams.get("limit") || "200");

    if (!pageIdRaw && !pageUrl && !(pageNumber && chapterId)) {
      return NextResponse.json(
        { items: [], error: "Provide pageId or pageUrl or (pageNumber+chapterId)" },
        { status: 400 }
      );
    }

    const { db } = await getClientAndUser(req);

    const items = await trySelectVariants(db, {
      pageId: pageIdRaw ? (isNaN(Number(pageIdRaw)) ? pageIdRaw : Number(pageIdRaw)) : null,
      pageUrl: pageUrl || null,
      pageNumber: pageNumber ? Number(pageNumber) : null,
      chapterId: chapterId ? Number(chapterId) : null,
      limit,
    });

    const normalized = items.map((r: any) => ({
      id: r.id,
      user_id: r.user_id ?? null,
      created_at: r.created_at,
      content: (r.content ?? r.comment ?? "") as string,
      page_id: r.page_id ?? null,
      image_url: r.image_url ?? null,
      page_number: r.page_number ?? r.page_index ?? null,
      parent_id: r.parent_id ?? null,
    }));

    return NextResponse.json({ items: normalized }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ items: [], error: e?.message || "Server error" }, { status: 500 });
  }
}

/* ========= POST ========= */
export async function POST(req: NextRequest) {
  try {
    const { db, userId } = await getClientAndUser(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const pageId = body.pageId as number | string | undefined;
    const pageUrl = body.pageUrl as string | undefined;
    const pageNumber =
      typeof body.pageNumber === "number" ? body.pageNumber : Number(body.pageNumber || NaN);
    const chapterId =
      typeof body.chapterId === "number" ? body.chapterId : Number(body.chapterId || NaN);
    const parentId = (body.parentId as string | undefined) ?? null;
    const content = (body.content as string | undefined) ?? "";

    if (!content.trim()) {
      return NextResponse.json({ error: "Empty content" }, { status: 400 });
    }
    if (!pageId && !pageUrl && !(Number.isFinite(pageNumber) && Number.isFinite(chapterId))) {
      return NextResponse.json(
        { error: "Provide pageId or pageUrl or (pageNumber+chapterId)" },
        { status: 400 }
      );
    }

    let inserted;
    try {
      inserted = await tryInsertVariants(
        db,
        content,
        { user_id: userId, parent_id: parentId },
        {
          pageId: pageId ?? null,
          pageUrl: pageUrl ?? null,
          pageNumber: Number.isFinite(pageNumber) ? (pageNumber as number) : null,
          chapterId: Number.isFinite(chapterId) ? (chapterId as number) : null,
        }
      );
    } catch (e: any) {
      if (e?.message === "replies-not-supported") {
        return NextResponse.json(
          { error: "В БД нет колонки parent_id — ответы отключены. Добавьте её, чтобы включить треды." },
          { status: 400 }
        );
      }
      if (e?.message === "no-variant") {
        return NextResponse.json(
          { error: "No page key fits your schema (page_id/image_url/page_number/page_index)" },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: e?.message || "Insert failed" }, { status: 400 });
    }

    return NextResponse.json(
      {
        id: inserted.id,
        item: {
          id: inserted.id,
          user_id: userId,
          created_at: inserted.created_at,
          content: inserted.content ?? inserted.comment ?? content,
          parent_id: inserted.parent_id ?? null,
        },
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
