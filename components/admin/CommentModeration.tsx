"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useTheme } from "@/lib/theme/context";
import {
  Search,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Trash2,
  Filter,
  MessageSquare,
  ShieldAlert,
} from "lucide-react";
import { loadCompiledRules, findBadSpans, type CompiledRule } from "@/lib/mod-rules";

/** ===== Тип ответа /api/moderation/comments (NEON) ===== */
type ApiComment = {
  id: string | number;
  source: "manga" | "page" | "post";
  target_id: string | number | null;
  content: string;
  created_at: string; // ISO
  author_id?: string | number | null;
  manga_title?: string | null;
  flagged?: boolean;
  flagged_matches?: string[];
  [k: string]: any;
};

type ApiResponse = {
  ok: true;
  items: ApiComment[];
  total: number;
  hint?: string;
};

type UIComment = {
  id: string | number;
  body: string;
  created_at: string;
  source: "manga" | "page" | "post";
  target_id: string | number | null;
  raw: ApiComment;
};

function mapApiToUI(c: ApiComment): UIComment {
  return {
    id: c.id,
    body: String(c.content ?? ""),
    created_at: c.created_at,
    source: c.source,
    target_id: c.target_id ?? null,
    raw: c,
  };
}

async function fetchJson<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { Accept: "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text || "{}");
  } catch {
    throw new Error(`Bad JSON: ${text.slice(0, 200)}`);
  }
  if (!res.ok || data?.ok === false) throw new Error(data?.error || `HTTP ${res.status}`);
  return data as T;
}

function HighlightedText({ text, rules }: { text: string; rules: CompiledRule[] }) {
  const bads = useMemo(() => (rules.length ? findBadSpans(text, rules) : []), [text, rules]);
  if (!bads.length) return <span className="whitespace-pre-wrap break-words">{text}</span>;

  const out: React.ReactNode[] = [];
  let pos = 0;
  bads.forEach((b, i) => {
    if (pos < b.start) {
      out.push(
        <span key={`t-${i}`} className="whitespace-pre-wrap break-words">
          {text.slice(pos, b.start)}
        </span>
      );
    }
    out.push(
      <span
        key={`m-${i}`}
        title="Запрещённый фрагмент"
        className="inline whitespace-pre-wrap break-words rounded-sm px-0.5 bg-red-500/20 text-red-700 underline decoration-red-500 underline-offset-2 dark:text-red-300 dark:decoration-red-400"
      >
        {text.slice(b.start, b.end)}
      </span>
    );
    pos = b.end;
  });
  if (pos < text.length) {
    out.push(
      <span key="tail" className="whitespace-pre-wrap break-words">
        {text.slice(pos)}
      </span>
    );
  }
  return <>{out}</>;
}

export default function CommentModeration() {
  const { theme } = useTheme();

  const [items, setItems] = useState<UIComment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [source, setSource] = useState<"all" | "manga" | "page" | "post">("all");

  // пагинация offset/limit для NEON-роута
  const LIMIT = 50;
  const [offset, setOffset] = useState(0);
  const hasMore = offset + items.length < total;

  // правила модерации
  const [rules, setRules] = useState<CompiledRule[]>([]);
  const [rulesLoaded, setRulesLoaded] = useState(false);

  useEffect(() => {
    let stop = false;
    (async () => {
      try {
        const compiled = await loadCompiledRules();
        if (!stop) setRules(compiled);
      } catch (e) {
        console.error("Failed to load moderation rules", e);
      } finally {
        if (!stop) setRulesLoaded(true);
      }
    })();
    return () => {
      stop = true;
    };
  }, []);

  // стили
  const textClass = theme === "light" ? "text-gray-900" : "text-white";
  const mutedText = theme === "light" ? "text-gray-600" : "text-gray-400";
  const cardBg = theme === "light" ? "bg-white border-gray-200 shadow-sm" : "bg-gray-900/40 border-white/10";
  const inputClass =
    theme === "light"
      ? "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      : "w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-400";
  const btnSecondary =
    theme === "light"
      ? "border-gray-300 bg-white hover:bg-gray-100 text-gray-900"
      : "border-white/10 bg-gray-800/60 hover:bg-gray-700 text-white";

  async function loadPage(reset = false) {
    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams();
      sp.set("limit", String(LIMIT));
      sp.set("offset", String(reset ? 0 : offset + items.length));
      // API сейчас понимает all/manga/page — "post" приравняем к "page"
      const srcToSend = source === "post" ? "page" : source;
      sp.set("source", srcToSend);
      if (searchQuery) sp.set("q", searchQuery);

      const data = await fetchJson<ApiResponse>(`/api/moderation/comments?${sp.toString()}`);

      const next = (data.items || []).map(mapApiToUI);
      if (reset) {
        setItems(next);
        setOffset(0);
      } else {
        setItems((prev) => [...prev, ...next]);
      }
      setTotal(Number(data.total || 0));
    } catch (e: any) {
      setError(e.message || "Не удалось загрузить данные");
    } finally {
      setLoading(false);
    }
  }

  // первая загрузка + перезагрузка по фильтрам
  useEffect(() => {
    const t = setTimeout(() => loadPage(true), 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, source]);

  // локальный подсчёт нарушений
  const flaggedCount = useMemo(() => {
    if (!rulesLoaded) return 0;
    let c = 0;
    for (const it of items) if (findBadSpans(it.body, rules).length > 0) c++;
    return c;
  }, [items, rules, rulesLoaded]);

  // фильтрация отображения
  const filtered = useMemo(() => {
    const base = !searchQuery
      ? items
      : items.filter((c) => `${c.body}`.toLowerCase().includes(searchQuery.toLowerCase()));
    if (!onlyFlagged) return base;
    return base.filter((c) => rulesLoaded && findBadSpans(c.body, rules).length > 0);
  }, [items, searchQuery, onlyFlagged, rules, rulesLoaded]);

  async function actDelete(id: string | number) {
    setBusyId(id);
    try {
      // серверное удаление (если не реализовано — ответ игнорируем)
      await fetchJson<{ ok: true }>(`/api/moderation/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      }).catch(() => ({ ok: true } as any));

      setItems((prev) => prev.filter((c) => c.id !== id));
    } catch (e: any) {
      alert(`Ошибка: ${e.message}`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className={`text-3xl font-bold ${textClass} mb-2`}>Модерация комментариев</h1>
        <p className={`${mutedText}`}>Запрещённые фрагменты подсвечены. Доступно удаление.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
        {[
          { label: "Всего", value: total },
          { label: "С нарушениями", value: flaggedCount },
        ].map((s) => (
          <div key={s.label} className={`p-4 rounded-xl border ${cardBg}`}>
            <div className="text-2xl font-bold">{s.value}</div>
            <div className={`text-sm ${mutedText}`}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className={`p-4 rounded-xl border ${cardBg}`}>
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center">
          <div className="flex-1 relative">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${mutedText}`} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по тексту, пользователю, тайтлу..."
              className={`${inputClass} pl-10`}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className={`text-sm ${mutedText}`}>Источник:</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as any)}
              className={
                theme === "light"
                  ? "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                  : "rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white"
              }
            >
              <option value="all">Все</option>
              <option value="manga">Тайтлы</option>
              <option value="page">Страницы</option>
              <option value="post">Посты</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <Filter className={`w-5 h-5 ${mutedText}`} />
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={onlyFlagged}
                onChange={(e) => setOnlyFlagged(e.target.checked)}
              />
              Только с нарушениями
            </label>
            <button
              onClick={() => loadPage(true)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${btnSecondary}`}
            >
              <RefreshCw className="h-4 w-4" />
              Обновить
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div
          className={`rounded-xl border p-3 ${
            theme === "light" ? "bg-red-50 border-red-200 text-red-800" : "bg-red-500/10 border-red-500/30 text-red-100"
          }`}
        >
          <AlertTriangle className="inline h-4 w-4 mr-2" />
          {error}
        </div>
      )}

      <div className="grid gap-4">
        {filtered.length === 0 && !loading && (
          <div className={`rounded-xl border p-8 text-center ${cardBg}`}>
            <MessageSquare className="mx-auto h-12 w-12 mb-2 opacity-50" />
            <p className={`${mutedText}`}>Нет комментариев по текущим фильтрам</p>
          </div>
        )}

        {filtered.map((c) => {
          const hits = rulesLoaded ? findBadSpans(c.body, rules) : [];
          const extra = c.raw;
          const violations = hits.length + (extra.flagged ? 1 : 0) + (extra.flagged_matches?.length ?? 0);

          return (
            <div key={`${c.created_at}-${c.id}`} className={`rounded-xl border p-4 ${cardBg}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    {violations > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs rounded-full border border-red-400 px-2 py-0.5 text-red-600 dark:text-red-300">
                        <ShieldAlert className="h-3 w-3" />
                        Нарушения: {violations}
                      </span>
                    )}
                    <span className={`text-xs ${mutedText}`}>
                      {new Date(c.created_at).toLocaleString("ru-RU")}
                    </span>
                    {c.source === "manga" && c.target_id && (
                      <span className={`text-xs ${mutedText}`}>Тайтл #{c.target_id}</span>
                    )}
                    {c.source === "page" && c.target_id && (
                      <span className={`text-xs ${mutedText}`}>Страница #{c.target_id}</span>
                    )}
                  </div>

                  <div className={`text-sm ${textClass} whitespace-pre-wrap break-words`}>
                    <HighlightedText text={c.body} rules={rules} />
                  </div>

                  <div className={`mt-2 text-xs ${mutedText}`}>
                    Пользователь: <strong>{extra.user_name || `#${extra.author_id ?? "—"}`}</strong>
                  </div>
                </div>

                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    onClick={() => actDelete(c.id)}
                    disabled={busyId === c.id}
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-white/10 disabled:opacity-50"
                    title="Удалить"
                  >
                    {busyId === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Удалить
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {hasMore && (
          <div className="flex justify-center">
            <button onClick={() => loadPage(false)} className={`rounded-lg border px-4 py-2 ${btnSecondary}`}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Загрузить ещё"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
