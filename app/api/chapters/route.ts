// app/api/chapters/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import type { CookieOptions } from "@supabase/ssr"; // только для типов
import type { Database } from "@/database.types";
import { cookies, headers } from "next/headers";
import sharp from "sharp";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/* ---------- утилита: слаг из названия (поддержка кириллицы) ---------- */
function slugify(input: string, max = 60) {
  const map: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "i",
    к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
    х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ъ: "",  ы: "y", ь: "",  э: "e", ю: "yu", я: "ya",
  };
  const norm = (input || "")
    .toLowerCase()
    .replace(/[а-яё]/g, ch => map[ch] ?? ch)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, max);
  return norm || "title";
}

/* --------- тип под обе схемы chapter_pages --------- */
type ChapterPageRow =
  | { chapter_id: number; image_url: string; page_index: number; page_number?: never }
  | { chapter_id: number; image_url: string; page_number: number; page_index?: never }
  | { chapter_id: number; image_url: string; page_index: number; page_number: number };

/* --------- Supabase helpers --------- */
function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE!;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE is missing");
  return createClient<Database>(url, key); // service-role обходит RLS
}

function supabaseAuthFromCookies() {
  // В route handlers используем auth-helpers:
  const cookieStore = cookies(); // не await!
  return createRouteHandlerClient<Database>({ cookies: () => cookieStore });
}

/** Получаем пользователя: 1) cookies, 2) Authorization: Bearer <token> */
async function getUserFromRequest(req: NextRequest) {
  // 1) cookies
  const cookieClient = supabaseAuthFromCookies();
  {
    const { data, error } = await cookieClient.auth.getUser();
    if (data?.user && !error) return { user: data.user, authClient: cookieClient };
  }

  // 2) Authorization (берём из req.headers, и fallback — await headers())
  const h = await headers(); // в некоторых версиях тип промисный
  const authz =
    req.headers.get("authorization") ??
    h.get("authorization") ??
    "";

  const m = authz.match(/^Bearer\s+(.+)$/i);
  if (m) {
    const token = m[1];
    const tokenClient = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
    const { data, error } = await tokenClient.auth.getUser();
    if (data?.user && !error) return { user: data.user, authClient: tokenClient };
  }

  return { user: null as any, authClient: cookieClient };
}

/* --------- BunnyCDN --------- */
function bunnyCfg() {
  const zone = process.env.BUNNY_STORAGE_ZONE?.trim();
  const key = process.env.BUNNY_STORAGE_KEY?.trim();
  const host = (process.env.BUNNY_STORAGE_HOST || "https://storage.bunnycdn.com").trim();
  const publicBase = process.env.BUNNY_PULLZONE_HOST?.replace(/\/+$/, "");
  if (!zone || !key || !publicBase) {
    throw new Error("BUNNY env missing: BUNNY_STORAGE_ZONE, BUNNY_STORAGE_KEY, BUNNY_PULLZONE_HOST");
  }
  return { zone, key, host, publicBase };
}

async function bunnyUploadBuffer(
  pathKey: string,
  data: Uint8Array | ArrayBuffer,
  contentType: string
) {
  const { zone, key, host } = bunnyCfg();
  const url = `${host}/${zone}/${encodeURI(pathKey)}`;
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      AccessKey: key,
      "Content-Type": contentType || "application/octet-stream",
    },
    body: bytes as unknown as BodyInit,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Bunny PUT ${res.status}: ${txt}`);
  }
}

/* --------- вставка страниц под обе схемы --------- */
async function insertChapterPagesSmart(
  db: SupabaseClient<Database>,
  pagesBoth: { chapter_id: number; image_url: string; n: number }[]
) {
  const withBoth: ChapterPageRow[] = pagesBoth.map(p => ({
    chapter_id: p.chapter_id,
    image_url: p.image_url,
    page_index: p.n,
    page_number: p.n,
  })) as any;

  let { error } = await db.from("chapter_pages").insert(withBoth as any);
  if (!error) return;

  const msg = (error.message || "").toLowerCase();

  if (msg.includes('column "page_number" does not exist')) {
    const onlyIndex = pagesBoth.map(p => ({
      chapter_id: p.chapter_id,
      image_url: p.image_url,
      page_index: p.n,
    }));
    const { error: e2 } = await db.from("chapter_pages").insert(onlyIndex as any);
    if (e2) throw e2;
    return;
  }

  if (msg.includes('column "page_index" does not exist')) {
    const onlyNumber = pagesBoth.map(p => ({
      chapter_id: p.chapter_id,
      image_url: p.image_url,
      page_number: p.n,
    }));
    const { error: e3 } = await db.from("chapter_pages").insert(onlyNumber as any);
    if (e3) throw e3;
    return;
  }

  throw error;
}

function isUniqueChapterError(errMsg?: string) {
  const msg = String(errMsg || "").toLowerCase();
  return (
    msg.includes("duplicate key value violates unique constraint") &&
    msg.includes("chapters_manga_id_chapter_number_key")
  );
}

/* --------- GET (debug/удобства) --------- */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mangaId = Number(searchParams.get("mangaId"));
    const chapterId = Number(searchParams.get("chapterId"));

    const db = supabaseAdmin();

    if (chapterId) {
      const { data: chapter, error: chapterErr } = await db
        .from("chapters")
        .select(`
          *,
          pages:chapter_pages(image_url, page_index, page_number)
        `)
        .eq("id", chapterId)
        .single();

      if (chapterErr || !chapter) {
        return NextResponse.json({ error: "Глава не найдена" }, { status: 404 });
      }

      if ((chapter as any).pages) {
        const pages = ((chapter as any).pages as any[]).map(p => ({
          image_url: p.image_url,
          n: p.page_index ?? p.page_number ?? 0,
        }));
        pages.sort((a, b) => a.n - b.n);
        (chapter as any).pages = pages;
      }

      return NextResponse.json(chapter);
    }

    if (mangaId) {
      const { data: chapters, error: chaptersErr } = await db
        .from("chapters")
        .select("id, chapter_number, title, status, created_at, pages_count")
        .eq("manga_id", mangaId)
        .order("chapter_number", { ascending: true });

      if (chaptersErr) {
        return NextResponse.json({ error: chaptersErr.message }, { status: 500 });
      }

      return NextResponse.json(chapters || []);
    }

    return NextResponse.json({ error: "Требуется mangaId или chapterId" }, { status: 400 });
  } catch (err: any) {
    console.error("Ошибка получения глав:", err);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

/* --------- POST /api/chapters --------- */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const mangaId = Number(form.get("mangaId"));
    const chapterNumber = Number(form.get("chapterNumber"));
    const title = (form.get("title") as string) || null;
    const files = form.getAll("pages").filter(Boolean) as File[];

    if (!mangaId || Number.isNaN(mangaId)) {
      return NextResponse.json({ error: "Некорректный mangaId" }, { status: 400 });
    }
    if (!chapterNumber || Number.isNaN(chapterNumber)) {
      return NextResponse.json({ error: "Некорректный chapterNumber" }, { status: 400 });
    }
    if (files.length === 0) {
      return NextResponse.json({ error: "Нужны файлы pages[]" }, { status: 400 });
    }

    // ===== аутентификация: cookies → bearer
    const { user } = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    const userId = user.id as string;

    const db = supabaseAdmin();

    // Проверка дубликата до вставки
    {
      const { data: dup, error: dupErr } = await db
        .from("chapters")
        .select("id")
        .eq("manga_id", mangaId)
        .eq("chapter_number", chapterNumber)
        .maybeSingle();

      if (dupErr) return NextResponse.json({ error: dupErr.message }, { status: 500 });
      if (dup) {
        return NextResponse.json(
          { error: "Глава с таким номером уже существует для этой манги.", chapterId: dup.id },
          { status: 409 }
        );
      }
    }

    // 1) создаём главу (fallback, если нет uploaded_by)
    const insertData: any = {
      manga_id: mangaId,
      chapter_number: chapterNumber,
      title,
      user_id: userId,     // если есть такая колонка
      uploaded_by: userId, // для RLS-схем
    };

    let ch: any = null;
    let chErr: string | null = null;

    {
      const { data, error } = await db.from("chapters").insert(insertData).select("*").single();
      if (data && !error) ch = data;
      else chErr = error?.message || null;
    }
    if (!ch && chErr && /column "uploaded_by" does not exist/i.test(chErr)) {
      const { uploaded_by, ...onlyUser } = insertData;
      const { data, error } = await db.from("chapters").insert(onlyUser).select("*").single();
      if (data && !error) ch = data; else chErr = error?.message || chErr;
    }
    if (!ch) {
      if (isUniqueChapterError(chErr || "")) {
        const { data: dup } = await db
          .from("chapters")
          .select("id")
          .eq("manga_id", mangaId)
          .eq("chapter_number", chapterNumber)
          .maybeSingle();
        return NextResponse.json(
          { error: "Глава с таким номером уже существует для этой манги.", chapterId: dup?.id ?? null },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: chErr || "Не удалось создать главу" }, { status: 400 });
    }

    // 2) берём название манги и формируем папку из слага
    const { data: mData, error: mErr } = await db
      .from("manga")
      .select("title")
      .eq("id", mangaId)
      .single();
    if (mErr || !mData?.title) {
      return NextResponse.json({ error: "Не найдено название манги" }, { status: 400 });
    }
    const titleSlug = slugify(mData.title);

    // 3) порядок как на клиенте — не сортируем
    const ordered = files as File[];
    const pad = String(ordered.length).length;

    // 4) конвертация -> WebP и загрузка в Bunny
    const { publicBase } = bunnyCfg();
    const base = `${titleSlug}-${mangaId}/${ch.id}`;
    sharp.cache(false);

    for (let i = 0; i < ordered.length; i++) {
      const f = ordered[i];
      const src = await f.arrayBuffer();
      const webpBuf = await sharp(Buffer.from(src))
        .rotate()
        .webp({ quality: 80 })
        .toBuffer();
      const key = `${base}/${String(i + 1).padStart(pad, "0")}.webp`;
      await bunnyUploadBuffer(key, webpBuf, "image/webp");
    }

    // 5) chapter_pages (под обе схемы)
    const pagesBoth = ordered.map((_, i) => {
      const key = `${base}/${String(i + 1).padStart(pad, "0")}.webp`;
      return { chapter_id: ch.id, image_url: `${publicBase}/${key}`, n: i + 1 };
    });
    await insertChapterPagesSmart(db, pagesBoth);

    // 6) обновляем счётчик/статус (если колонки есть)
    const updateData: any = { pages_count: ordered.length };
    const { data: statusCheck } = await db
      .from("chapters")
      .select("status")
      .eq("id", ch.id)
      .single();
    if (statusCheck && "status" in statusCheck) {
      updateData.status = "approved";
    }
    const { error: updateErr } = await db.from("chapters").update(updateData).eq("id", ch.id);
    if (updateErr) console.warn("Не удалось обновить главу:", updateErr.message);

    return NextResponse.json({
      ok: true,
      chapterId: ch.id,
      pages: ordered.length,
      message: "Глава успешно загружена",
    });
  } catch (err: any) {
    console.error("Ошибка загрузки главы:", err);
    return NextResponse.json({ error: err.message || "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
