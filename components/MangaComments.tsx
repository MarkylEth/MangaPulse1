"use client";

import { useEffect, useRef, useState } from "react";
import { createClient, RealtimeChannel } from "@supabase/supabase-js";
import { Bold, Italic, Underline, Strikethrough, Trash2 } from "lucide-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type CommentItem = {
  id: number;
  content: string;        // серверное поле "comment"
  created_at: string;
  user_id: string;
};

type Props = {
  mangaId: number;
  isAdmin?: boolean;
  adminUserIds?: string[];
};

/* ---------- helpers: те же, что в PageComments ---------- */

function sanitize(html: string) {
  let out = (html || "").replace(/&nbsp;/gi, " ");
  // оставляем только теги форматирования
  out = out.replace(/<(?!\/?(?:b|i|u|s|strong|em|br)\b)[^>]*>/gi, "");
  // удаляем пустые теги
  out = out.replace(/<(?:b|i|u|s|strong|em)>\s*<\/(?:b|i|u|s|strong|em)>/gi, "");
  // схлопываем множественные <br>
  out = out.replace(/(?:<br\s*\/?>\s*){3,}/gi, "<br><br>");
  return out.trim();
}

async function safePostJSON(url: string, body: any) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  if (!r.ok) throw new Error((data && data.error) || text || `HTTP ${r.status}`);
  return data;
}

/* ---------- component ---------- */

export default function MangaComments({ mangaId, isAdmin, adminUserIds }: Props) {
  const [items, setItems] = useState<CommentItem[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // новый UI: contentEditable
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  // твои прежние возможности: роль/админка/реалтайм
  const [isAdminUi, setIsAdminUi] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id ?? null;
      setMe(uid);
      const meta: any = data.user?.user_metadata || {};
      const appMeta: any = data.user?.app_metadata || {};
      const adminByMeta = meta?.role === "admin" || appMeta?.role === "admin";
      const adminByList = !!uid && Array.isArray(adminUserIds) && adminUserIds.includes(uid);
      setIsAdminUi(Boolean(isAdmin || adminByMeta || adminByList));
    });
  }, [isAdmin, adminUserIds]);

  async function load() {
    // оставляем твой api-роут или прямой supabase — тут пример с api
    const r = await fetch(`/api/manga-comments?mangaId=${mangaId}`, { cache: "no-store" });
    const j = await r.json();
    setItems((j.items ?? []) as CommentItem[]);
  }

  useEffect(() => {
    // realtime как раньше
    if (channelRef.current) {
      void supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    load();

    const ch = supabase
      .channel(`manga-comments-${mangaId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "manga_comments", filter: `manga_id=eq.${mangaId}` },
        (payload) => {
          const row = payload.new as any as CommentItem;
          setItems((prev) => [row, ...prev]);
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "manga_comments", filter: `manga_id=eq.${mangaId}` },
        (payload) => {
          const id = (payload.old as any)?.id as number;
          setItems((prev) => prev.filter((i) => i.id !== id));
        }
      )
      .subscribe();

    channelRef.current = ch;
    return () => { if (channelRef.current) void supabase.removeChannel(channelRef.current); };
  }, [mangaId]);

  const updateEmpty = () => {
    const plain = editorRef.current?.textContent?.replace(/\u00a0/g, " ").trim() ?? "";
    setIsEmpty(!plain);
  };

  async function send() {
    if (sending) return;
    const plain = editorRef.current?.textContent?.replace(/\u00a0/g, " ").trim() ?? "";
    if (!plain) { alert("Введите текст комментария"); return; }

    const html = sanitize(editorRef.current?.innerHTML ?? "");
    if (!html) { alert("Введите текст комментария"); return; }

    setSending(true);
    try {
      const j = await safePostJSON("/api/manga-comments", { mangaId, content: html });
      // локально добавим (потом всё равно прилетит realtime/refresh)
      setItems(prev => [
        { id: j.id, user_id: me ?? "", content: html, created_at: new Date().toISOString() },
        ...prev,
      ]);
      if (editorRef.current) editorRef.current.innerHTML = "";
      setIsEmpty(true);
    } catch (e: any) {
      alert(e?.message || "Не удалось отправить");
    } finally {
      setSending(false);
      load();
    }
  }

  async function removeItem(id: number) {
    if (!confirm("Удалить комментарий?")) return;
    const r = await fetch(`/api/manga-comments`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id }),
    });
    const t = await r.text();
    if (!r.ok) return alert(t || `HTTP ${r.status}`);
    setItems(prev => prev.filter(x => x.id !== id));
  }

  const exec = (cmd: "bold" | "italic" | "underline" | "strikeThrough") => {
    document.execCommand(cmd);
    editorRef.current?.focus();
  };

  return (
    <section className="rounded-2xl border border-black/10 dark:border-white/10 bg-transparent">
      <h3 className="px-4 pt-4 text-lg font-semibold">Комментарии</h3>

      {/* Тёмный блок с тулбаром и contentEditable — дизайн как в PageComments */}
      <div className="mx-4 my-3 rounded-xl bg-slate-900 text-slate-100 p-3">
        <div className="mb-2 flex gap-2 flex-wrap">
          <button onClick={() => exec("bold")} className="px-3 py-1 rounded bg-white/10 hover:bg-white/15 inline-flex items-center gap-2">
            <Bold className="w-4 h-4" /><span>Жирный</span>
          </button>
          <button onClick={() => exec("italic")} className="px-3 py-1 rounded bg-white/10 hover:bg-white/15 inline-flex items-center gap-2">
            <Italic className="w-4 h-4" /><span>Курсив</span>
          </button>
          <button onClick={() => exec("underline")} className="px-3 py-1 rounded bg-white/10 hover:bg-white/15 inline-flex items-center gap-2">
            <Underline className="w-4 h-4" /><span>Подчёркнуть</span>
          </button>
          <button onClick={() => exec("strikeThrough")} className="px-3 py-1 rounded bg-white/10 hover:bg-white/15 inline-flex items-center gap-2">
            <Strikethrough className="w-4 h-4" /><span>Зачеркнуть</span>
          </button>
          <div className="ml-auto text-xs opacity-70 self-center">
            B / I / U / S • Ctrl/⌘+Enter — отправить
          </div>
        </div>

        <div className="relative">
          {isEmpty && (
            <span className="pointer-events-none absolute left-3 top-3 text-sm text-slate-400">
              Напишите комментарий…
            </span>
          )}
          <div
            ref={editorRef}
            role="textbox"
            aria-label="Поле ввода комментария"
            contentEditable
            suppressContentEditableWarning
            className="min-h-[64px] rounded-lg bg-slate-800/70 p-3 outline-none"
            onInput={updateEmpty}
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
          <button
            onClick={send}
            disabled={sending}
            className="px-4 py-2 rounded bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50"
          >
            {sending ? "Отправка…" : "Отправить"}
          </button>
        </div>
      </div>

      {/* Список — как во втором файле */}
      <div className="px-4 pb-4 space-y-5">
        {items.length === 0 && (
          <div className="text-sm opacity-70">Пока нет комментариев — будьте первым!</div>
        )}
        {items.map((m) => (
          <div key={m.id} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs opacity-60">
                {new Date(m.created_at).toLocaleString("ru-RU", { hour12: false })}
              </div>
              <div
                className="mt-1 text-[15px] leading-relaxed break-words prose-invert"
                dangerouslySetInnerHTML={{ __html: m.content }}
              />
            </div>
            {me && me === m.user_id && (
              <button
                onClick={() => removeItem(m.id)}
                className="flex items-center gap-1 text-xs text-rose-300 hover:text-rose-200 shrink-0"
                title="Удалить"
              >
                <Trash2 className="w-4 h-4" />
                Удалить
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
