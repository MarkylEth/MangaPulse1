"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "@/lib/theme/context";
import {
  Bold, Italic, Underline, Strikethrough,
  CornerDownRight, X, ChevronLeft, ChevronRight
} from "lucide-react";
import { useRouter } from "next/navigation";

type Chapter = { id: number; manga_id: number; chapter_number: number; title?: string | null };
type PageRow = {
  id: number;
  chapter_id: number;
  image_url: string;
  page_index?: number | null;
  page_number?: number | null;
};
type ApiPageComment = {
  id: string;
  user_id: string | null;
  created_at: string;
  content: string;
  parent_id?: string | null;
};

const supabase = createClient();

/* --- Санитайзер форматирования --- */
function sanitize(input: string) {
  let html = (input || "").replace(/&nbsp;/gi, " ");
  html = html.replace(/<(?!\/?(?:b|i|u|s|strong|em|br)\b)[^>]*>/gi, "");
  html = html.replace(/<(?:b|i|u|s|strong|em)>\s*<\/(?:b|i|u|s|strong|em)>/gi, "");
  html = html.replace(/(?:<br\s*\/?>\s*){3,}/gi, "<br><br>");
  return html.trim();
}

export default function ChapterReader({ chapterId }: { chapterId: number }) {
  const { theme } = useTheme();
  const router = useRouter();

  /* ---------- Глава и страницы ---------- */
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [pages, setPages] = useState<PageRow[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  /* ---------- Следующая глава ---------- */
  const [nextChapterId, setNextChapterId] = useState<number | null>(null);

  /* ---------- Комментарии текущей страницы ---------- */
  const [items, setItems] = useState<ApiPageComment[]>([]);
  const [sending, setSending] = useState(false);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const [replyTo, setReplyTo] = useState<{ id: string } | null>(null);

  /* ---------- Флаг для безопасной навигации (исправляет Router setState during render) ---------- */
  const [shouldNavigateAfterLast, setShouldNavigateAfterLast] = useState(false);

  /* ---------- Тема (классы) ---------- */
  const surface =
    theme === "light"
      ? "bg-white text-gray-900 border border-gray-200"
      : "bg-slate-900 text-slate-100 border border-white/10";

  const toolbarBtn =
    theme === "light"
      ? "px-3 py-1 rounded bg-black/5 hover:bg-black/10 text-gray-800 disabled:opacity-50"
      : "px-3 py-1 rounded bg-white/10 hover:bg-white/15 text-white disabled:opacity-50";

  const editorBox = (enabled: boolean) =>
    theme === "light"
      ? `min-h-[64px] rounded-lg p-3 outline-none ${enabled ? "bg-gray-50" : "bg-gray-100"}`
      : `min-h-[64px] rounded-lg p-3 outline-none ${enabled ? "bg-slate-800/70" : "bg-slate-800/30"}`;

  const sendBtn =
    theme === "light"
      ? "px-4 py-2 rounded bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
      : "px-4 py-2 rounded bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50";

  const listItem =
    theme === "light"
      ? "mx-auto max-w-2xl rounded-xl border border-gray-200 bg-white p-4"
      : "mx-auto max-w-2xl rounded-xl border border-white/10 bg-slate-900 p-4";

  const replyBox =
    theme === "light" ? "ml-6 mt-3 border-l border-gray-200 pl-4" : "ml-6 mt-3 border-l border-white/10 pl-4";

  /* ---------- Загрузка главы/страниц ---------- */
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const { data: ch, error: chErr } = await supabase
          .from("chapters")
          .select("id, manga_id, chapter_number, title")
          .eq("id", chapterId)
          .maybeSingle();
        if (chErr) throw chErr;
        setChapter(ch as Chapter);

        const { data: rows, error } = await supabase
          .from("chapter_pages")
          .select("id, chapter_id, image_url, page_index, page_number")
          .eq("chapter_id", chapterId)
          .order("page_index", { ascending: true })
          .order("page_number", { ascending: true });
        if (error) throw error;

        const sorted = (rows ?? []).slice().sort((a: any, b: any) => {
          const na = (a.page_index ?? a.page_number ?? 0) as number;
          const nb = (b.page_index ?? b.page_number ?? 0) as number;
          return na - nb;
        });

        setPages(sorted as PageRow[]);
        setIndex(0);
      } catch (e: any) {
        setErr(e?.message || "Не удалось загрузить главу");
      } finally {
        setLoading(false);
      }
    })();
  }, [chapterId]);

  /* ---------- Ищем следующую главу этого тайтла ---------- */
  useEffect(() => {
    (async () => {
      if (!chapter) return;
      const { data, error } = await supabase
        .from("chapters")
        .select("id, chapter_number")
        .eq("manga_id", chapter.manga_id)
        .gt("chapter_number", chapter.chapter_number)
        .order("chapter_number", { ascending: true })
        .limit(1);
      if (!error && data && data.length) setNextChapterId((data[0] as any).id as number);
      else setNextChapterId(null);
    })();
  }, [chapter]);

  /* ---------- Загрузка комментариев текущей страницы ---------- */
  const loadComments = useCallback(async (page: PageRow) => {
    const n = (page.page_index ?? page.page_number ?? 0) as number;
    const { data: sess } = await supabase.auth.getSession();
    const token = sess?.session?.access_token;

    const url =
      `/api/page-comments?pageId=${encodeURIComponent(String(page.id))}` +
      `&pageUrl=${encodeURIComponent(page.image_url || "")}` +
      `&pageNumber=${n}&chapterId=${page.chapter_id}&limit=200`;

    const r = await fetch(url, {
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    const text = await r.text();
    let j: any = {};
    try { j = text ? JSON.parse(text) : {}; } catch { j = {}; }
    setItems((j.items ?? []) as ApiPageComment[]);
  }, []);

  useEffect(() => {
    const p = pages[index];
    if (p) void loadComments(p);
    else setItems([]);
  }, [index, pages, loadComments]);

  /* ---------- Перелистывание (клик/стрелки) ---------- */
  const prevPage = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  const nextPage = useCallback(() => {
    setIndex((i) => {
      const last = pages.length - 1;
      if (i < last) return i + 1;
      // последняя страница — ставим флаг, переход выполним в эффекте
      setShouldNavigateAfterLast(true);
      return i;
    });
  }, [pages.length]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") prevPage();
      else if (e.key === "ArrowRight") nextPage();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prevPage, nextPage]);

  /* ---------- Безопасная навигация после последней страницы ---------- */
  useEffect(() => {
    if (!shouldNavigateAfterLast) return;
    if (!chapter) return;

    if (nextChapterId) {
      router.push(`/manga/${chapter.manga_id}/chapter/${nextChapterId}`);
    } else {
      router.push(`/manga/${chapter.manga_id}`);
    }
    setShouldNavigateAfterLast(false);
  }, [shouldNavigateAfterLast, chapter, nextChapterId, router]);

  /* ---------- Отправка комментария ---------- */
  async function send() {
    if (sending) return;
    const page = pages[index];
    if (!page) return;

    const plain = editorRef.current?.textContent?.replace(/\u00a0/g, " ").trim() ?? "";
    if (!plain) {
      alert("Введите текст комментария");
      return;
    }
    const html = sanitize(editorRef.current?.innerHTML ?? "");
    if (!html) {
      alert("Введите текст комментария");
      return;
    }

    setSending(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      const n = (page.page_index ?? page.page_number ?? 0) as number;

      const r = await fetch("/api/page-comments", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          pageId: page.id,
          pageUrl: page.image_url,
          pageNumber: n,
          chapterId: page.chapter_id,
          content: html,
          parentId: replyTo?.id ?? null,
        }),
      });

      const txt = await r.text();
      let j: any = {};
      try { j = txt ? JSON.parse(txt) : {}; } catch { j = {}; }

      if (!r.ok) throw new Error(j?.error || txt || `HTTP ${r.status}`);

      await loadComments(page);
      if (editorRef.current) editorRef.current.innerHTML = "";
      setIsEmpty(true);
      setReplyTo(null);
    } catch (e: any) {
      alert(e?.message || "Не удалось отправить");
    } finally {
      setSending(false);
    }
  }

  /* ---------- Рендер ---------- */
  if (loading) return <div className="text-center opacity-70 py-10">Загрузка…</div>;
  if (err) return <div className="text-center text-red-600 py-10">{err}</div>;
  if (!chapter || !pages.length) return <div className="text-center opacity-70 py-10">Нет страниц главы</div>;

  const current = pages[index];

  const roots = items.filter((c) => !c.parent_id);
  const childrenMap = items.reduce<Record<string, ApiPageComment[]>>((acc, c) => {
    if (c.parent_id) (acc[c.parent_id] ||= []).push(c);
    return acc;
  }, {});

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      {/* Заголовок */}
      <div className="text-center">
        <div className="text-2xl font-semibold">
          Глава {chapter.chapter_number}{chapter.title ? ` — ${chapter.title}` : ""}
        </div>
        <div className="mt-1 text-sm opacity-70">
          Страница {index + 1} / {pages.length}
        </div>
      </div>

      {/* Просмотр страницы */}
      <div className={`relative overflow-hidden rounded-xl ${surface}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current.image_url}
          alt={`page-${index + 1}`}
          className="w-full h-auto select-none"
          draggable={false}
        />
        <button
          aria-label="Предыдущая страница"
          onClick={prevPage}
          className="group absolute inset-y-0 left-0 w-1/2 focus:outline-none"
        >
          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/30 p-1 opacity-0 transition group-hover:opacity-100">
            <ChevronLeft className="h-6 w-6 text-white" />
          </span>
        </button>
        <button
          aria-label="Следующая страница"
          onClick={nextPage}
          className="group absolute inset-y-0 right-0 w-1/2 focus:outline-none"
        >
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/30 p-1 opacity-0 transition group-hover:opacity-100">
            <ChevronRight className="h-6 w-6 text-white" />
          </span>
        </button>
      </div>

      {/* Комментарии к странице */}
      <section className="space-y-4">
        <h3 className="text-center text-lg font-semibold">Комментарии к странице</h3>

        {/* Тулбар + поле */}
        <div className={`mx-auto max-w-2xl rounded-xl p-4 ${surface}`}>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <button onClick={() => document.execCommand("bold")} className={toolbarBtn} title="Жирный">
              <Bold className="w-4 h-4" />
            </button>
            <button onClick={() => document.execCommand("italic")} className={toolbarBtn} title="Курсив">
              <Italic className="w-4 h-4" />
            </button>
            <button onClick={() => document.execCommand("underline")} className={toolbarBtn} title="Подчеркнуть">
              <Underline className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                const ok = document.execCommand("strikeThrough");
                if (!ok) {
                  try { document.execCommand("strikethrough"); } catch {}
                }
              }}
              className={toolbarBtn}
              title="Зачеркнуть"
            >
              <Strikethrough className="w-4 h-4" />
            </button>

            {replyTo && (
              <div className="ml-auto inline-flex items-center gap-2 text-sm opacity-90">
                <CornerDownRight className="w-4 h-4" />
                Ответ на #{replyTo.id.slice(0, 6)}…
                <button onClick={() => setReplyTo(null)} className="inline-flex items-center gap-1 text-xs opacity-70 hover:opacity-100">
                  <X className="w-3 h-3" /> отменить
                </button>
              </div>
            )}
          </div>

          <div className="relative">
            {isEmpty && (
              <span className="pointer-events-none absolute left-3 top-3 text-sm opacity-50">
                Напишите комментарий…
              </span>
            )}
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              role="textbox"
              aria-label="Поле ввода комментария"
              className={editorBox(true)}
              onInput={() => {
                const plain = editorRef.current?.textContent?.replace(/\u00a0/g, " ").trim() ?? "";
                setIsEmpty(!plain);
              }}
              onPaste={(e) => {
                e.preventDefault();
                const text = (e.clipboardData || (window as any).clipboardData).getData("text/plain");
                document.execCommand("insertText", false, text);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
          </div>

          <div className="mt-2 flex justify-end">
            <button onClick={send} disabled={sending || isEmpty} className={sendBtn}>
              {sending ? "Отправка…" : replyTo ? "Ответить" : "Отправить"}
            </button>
          </div>
        </div>

        {/* Список комментариев */}
        <div className="space-y-4">
          {roots.length === 0 && (
            <div className="text-center text-sm opacity-70">
              Пока нет комментариев — будьте первым!
            </div>
          )}

          {roots.map((c) => {
            const replies = childrenMap[c.id] || [];
            return (
              <article key={c.id} className={listItem}>
                <header className="flex items-center gap-2">
                  <div className="text-xs opacity-70">
                    {new Date(c.created_at).toLocaleString("ru-RU", { hour12: false })}
                  </div>
                  <button
                    onClick={() => setReplyTo({ id: c.id })}
                    className="ml-auto inline-flex items-center gap-1 text-xs opacity-70 hover:opacity-100"
                    title="Ответить"
                  >
                    <CornerDownRight className="w-3.5 h-3.5" />
                    Ответить
                  </button>
                </header>

                <div
                  className="mt-2 text-[15px] leading-relaxed break-words prose prose-sm max-w-none dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: c.content }}
                />

                {replies.length > 0 && (
                  <div className={replyBox}>
                    <div className="space-y-3">
                      {replies.map((r) => (
                        <div key={r.id} className="rounded-lg p-3 bg-black/5 dark:bg-white/5">
                          <div className="flex items-center gap-2">
                            <div className="text-[11px] opacity-70">
                              {new Date(r.created_at).toLocaleString("ru-RU", { hour12: false })}
                            </div>
                            <button
                              onClick={() => setReplyTo({ id: c.id })}
                              className="ml-auto inline-flex items-center gap-1 text-[11px] opacity-70 hover:opacity-100"
                              title="Ответить на родительский"
                            >
                              <CornerDownRight className="w-3 h-3" />
                              Ответить
                            </button>
                          </div>
                          <div
                            className="mt-1 text-[13px] leading-relaxed break-words prose prose-sm max-w-none dark:prose-invert"
                            dangerouslySetInnerHTML={{ __html: r.content }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
