"use client";

import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import Image from "next/image";
import type { Database } from "../database.types";
import { createClient } from "@supabase/supabase-js";
import {
  Star,
  BookOpen,
  MessageSquare,
  User,
  Tags as TagsIcon,
  AlertTriangle,
  Edit3,
  Brush,
  Eye,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  CornerDownRight,
  X,
} from "lucide-react";
import Link from "next/link";
import AddChapterButton from "./AddChapterButton";
import { useTheme } from "@/lib/theme/context";
import { Header } from "@/components/Header";

/* ================= Types ================= */
type Manga = Database["public"]["Tables"]["manga"]["Row"];
type Chapter = Database["public"]["Tables"]["chapters"]["Row"];
type Genre = Database["public"]["Tables"]["manga_genres"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Rating = Database["public"]["Tables"]["manga_ratings"]["Row"];
type Team = Database["public"]["Tables"]["translator_teams"]["Row"];
type TeamMember = Database["public"]["Tables"]["translator_team_members"]["Row"];
type MangaCommentRow = Database["public"]["Tables"]["manga_comments"]["Row"];

/** строковые uuid, parent_id может ещё не быть в типах — делаем опциональным */
type MangaComment = MangaCommentRow & {
  id: string; // uuid
  parent_id?: string | null;
  profile?: Pick<Profile, "id" | "username" | "avatar_url">;
};

/* ============== sanitize с поддержкой <span style> ============== */
function sanitize(input: string) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(input, "text/html");

  function clean(node: Node): Node | null {
    if (node.nodeType === Node.TEXT_NODE) return node.cloneNode();

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();

      // разрешённые «простые» теги (вместе с <strike>/<del>)
      const simple = new Set(["b", "i", "u", "s", "strong", "em", "br", "strike", "del"]);

      // нормализуем <strike>/<del> в <s>
      if (tag === "strike" || tag === "del") {
        const clone = document.createElement("s");
        el.childNodes.forEach((ch) => {
          const c = clean(ch);
          if (c) clone.appendChild(c);
        });
        return clone;
      }

      if (simple.has(tag)) {
        const clone = document.createElement(tag);
        el.childNodes.forEach((ch) => {
          const c = clean(ch);
          if (c) clone.appendChild(c);
        });
        return clone;
      }

      // разрешённый <span> c безопасными стилями (в т.ч. line-through)
      if (tag === "span") {
        const style = el.style;
        const clone = document.createElement("span");

        if (style.fontWeight === "bold" || style.fontWeight === "700") clone.style.fontWeight = "bold";
        if (style.fontStyle === "italic") clone.style.fontStyle = "italic";

        const td = style.textDecoration || style.textDecorationLine || "";
        const wantUnderline = /underline/i.test(td);
        const wantStrike = /line-through|strike/i.test(td);
        if (wantUnderline && wantStrike) clone.style.textDecoration = "underline line-through";
        else if (wantUnderline) clone.style.textDecoration = "underline";
        else if (wantStrike) clone.style.textDecoration = "line-through";

        // если в итоге нет полезных стилей — разворачиваем span
        if (!clone.getAttribute("style")) {
          const frag = document.createDocumentFragment();
          el.childNodes.forEach((ch) => {
            const c = clean(ch);
            if (c) frag.appendChild(c);
          });
          return frag;
        }

        el.childNodes.forEach((ch) => {
          const c = clean(ch);
          if (c) clone.appendChild(c);
        });
        return clone;
      }

      // остальные теги — разворачиваем
      const frag = document.createDocumentFragment();
      el.childNodes.forEach((ch) => {
        const c = clean(ch);
        if (c) frag.appendChild(c);
      });
      return frag;
    }
    return null;
  }

  const frag = document.createDocumentFragment();
  doc.body.childNodes.forEach((ch) => {
    const c = clean(ch);
    if (c) frag.appendChild(c);
  });

  const div = document.createElement("div");
  div.appendChild(frag);
  return div.innerHTML
    .replace(/&nbsp;/gi, " ")
    .replace(/(?:<br\s*\/?>\s*){3,}/gi, "<br><br>")
    .trim();
}


/* ================= Component ================= */
export default function MangaTitlePage({ mangaId }: { mangaId: number }) {
  const { theme } = useTheme();

  const supabase = useMemo(
    () =>
      createClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  /* ===== THEME PRESETS ===== */
  const pageBg =
    theme === "light"
      ? "bg-gray-50 text-gray-900"
      : "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-gray-100";

  const card = theme === "light" ? "bg-white border-gray-200" : "bg-gray-900/40 border-white/10";
  const subtleCard = theme === "light" ? "bg-gray-50 border-gray-200" : "bg-gray-950/40 border-white/10";
  const titleText = theme === "light" ? "text-gray-900" : "text-white";
  const bodyText = theme === "light" ? "text-gray-800" : "text-gray-200";
  const mutedText = theme === "light" ? "text-gray-600" : "text-gray-400";
  const chip =
    theme === "light" ? "bg-gray-100 border-gray-200 text-gray-700" : "bg-white/10 border-white/10 text-gray-100";
  const primaryBtn = theme === "light" ? "bg-slate-900 text-white hover:bg-slate-800" : "bg-white text-black hover:opacity-90";
  const secondaryBtn =
    theme === "light"
      ? "border-gray-300 bg-white hover:bg-gray-100 text-gray-900"
      : "border-white/10 bg-gray-800/60 hover:bg-gray-700 text-white";
  const warnBtn =
    theme === "light"
      ? "border-yellow-400/40 bg-yellow-100 text-yellow-900 hover:bg-yellow-200"
      : "border-yellow-500/30 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-100";
  const tabActive = theme === "light" ? "bg-slate-900 text-white" : "bg-white text-black";
  const tabIdle = theme === "light" ? "bg-white hover:bg-gray-100 text-gray-800" : "bg-gray-900/60 hover:bg-gray-800 text-gray-100";

  // Комментарии: центр + тема
  const cWrap =
    theme === "light"
      ? "mx-auto my-4 max-w-2xl rounded-xl p-4 bg-white text-gray-900 border border-gray-200"
      : "mx-auto my-4 max-w-2xl rounded-xl p-4 bg-slate-900 text-slate-100 border border-white/10";

  const cBtn =
    theme === "light"
      ? "px-3 py-1 rounded bg-black/5 hover:bg-black/10 text-gray-800 disabled:opacity-50"
      : "px-3 py-1 rounded bg-white/10 hover:bg-white/15 text-white disabled:opacity-50";

  const cPlaceholder = theme === "light" ? "text-gray-500" : "text-slate-400";

  const cEditor = (enabled: boolean) =>
    theme === "light"
      ? `min-h-[64px] rounded-lg p-3 outline-none ${enabled ? "bg-gray-50" : "bg-gray-100 cursor-not-allowed"}`
      : `min-h-[64px] rounded-lg p-3 outline-none ${enabled ? "bg-slate-800/70" : "bg-slate-800/30 cursor-not-allowed"}`;

  const cSendBtn =
    theme === "light"
      ? "px-4 py-2 rounded bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
      : "px-4 py-2 rounded bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50";

  const cItem =
    theme === "light"
      ? "mx-auto max-w-2xl rounded-xl border border-gray-200 bg-white p-4"
      : "mx-auto max-w-2xl rounded-xl border border-white/10 bg-slate-900 p-4";

  const cReply =
    theme === "light" ? "ml-6 mt-3 border-l border-gray-200 pl-4" : "ml-6 mt-3 border-l border-white/10 pl-4";

  /* ===== STATE ===== */
  const [manga, setManga] = useState<Manga | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [comments, setComments] = useState<MangaComment[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [role, setRole] = useState<"guest" | "user" | "team" | "moderator" | "admin">("guest");
  const [user, setUser] = useState<any>(null);
  const [tab, setTab] = useState<"chapters" | "comments">("chapters");
  const [loading, setLoading] = useState(true);

  // rich editor + reply
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; username?: string } | null>(null);

  const canEdit = role === "moderator" || role === "admin";
  const canAdd = role === "team" || canEdit;

  /* ===== Data load ===== */
  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      try {
        const [
          { data: mangaData },
          { data: genreData },
          { data: chaptersData },
          { data: commentsData },
          { data: ratingsData },
        ] = await Promise.all([
          supabase.from("manga").select("*").eq("id", mangaId).maybeSingle(),
          supabase.from("manga_genres").select("*").eq("manga_id", mangaId).order("genre"),
          supabase
            .from("chapters")
            .select("id, manga_id, chapter_number, title, created_at, uploaded_by")
            .eq("manga_id", mangaId)
            .order("chapter_number", { ascending: false }),
          supabase
            .from("manga_comments")
            .select("*, profiles:profiles!manga_comments_user_id_fkey(id, username, avatar_url)")
            .eq("manga_id", mangaId)
            .order("created_at", { ascending: true }),
          supabase.from("manga_ratings").select("*").eq("manga_id", mangaId),
        ]);

        if (!mounted) return;

        setManga(mangaData ?? null);
        setGenres((genreData ?? []) as Genre[]);
        setChapters((chaptersData ?? []) as Chapter[]);
        setComments(
          ((commentsData as any[]) ?? []).map((c) => ({
            ...(c as MangaComment),
            profile: (c as any).profiles,
          }))
        );
        setRatings((ratingsData ?? []) as Rating[]);

        // команды переводчиков
        const { data: directTeams } = await supabase
          .from("translator_teams")
          .select("id, name, slug, avatar_url, verified, manga_id")
          .eq("manga_id", mangaId);

        let teamsForManga: Team[] = (directTeams as Team[]) ?? [];

        if (!teamsForManga.length) {
          const uploaderIds = Array.from(
            new Set(
              ((chaptersData ?? []) as Chapter[])
                .map((c) => (c as any).uploaded_by as string | null)
                .filter(Boolean) as string[]
            )
          );

          if (uploaderIds.length) {
            const { data: memberRows } = await supabase
              .from("translator_team_members")
              .select("team_id, user_id")
              .in("user_id", uploaderIds);

            const teamIds = Array.from(new Set((memberRows as TeamMember[] | null)?.map((m) => m.team_id) ?? []));
            if (teamIds.length) {
              const { data: teamsByMembers } = await supabase
                .from("translator_teams")
                .select("id, name, slug, avatar_url, verified")
                .in("id", teamIds);
              teamsForManga = (teamsByMembers as Team[]) ?? [];
            }
          }
        }

        setTeams(teamsForManga);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [mangaId, supabase]);

  /* ===== Auth + роль ===== */
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.auth.getUser();
      const u = data?.user ?? null;
      setUser(u);
      if (error || !u) {
        setRole("guest");
        return;
      }
      const { data: prof } = await supabase.from("profiles").select("role").eq("id", u.id).maybeSingle();
      setRole(((prof?.role as any) ?? "user") as any);
    })();
  }, [supabase]);

  /* ===== Рейтинг ===== */
  const ratingAverage =
    ratings.length > 0
      ? Number((ratings.reduce((s, r) => s + r.rating, 0) / ratings.length).toFixed(2))
      : ((manga as any)?.rating ?? 0);
  const ratingCount = ratings.length || ((manga as any)?.rating_count ?? 0);
  const ratingPct = (Math.min(10, Math.max(0, ratingAverage)) / 10) * 100;

  /* ===== threads (reply) ===== */
  const threads = useMemo(() => {
    const roots: MangaComment[] = [];
    const children: Record<string, MangaComment[]> = {};
    for (const c of comments) {
      const pid = (c as any).parent_id ?? null;
      if (pid) (children[pid] ||= []).push(c);
      else roots.push(c);
    }
    return { roots, children };
  }, [comments]);

  /* ===== Отправка комментария ===== */
  const submitComment = useCallback(async () => {
    if (sending) return;

    const plain = editorRef.current?.textContent?.replace(/\u00a0/g, " ").trim() ?? "";
    if (!plain) return;

    const html = sanitize(editorRef.current?.innerHTML ?? "");
    if (!html) return;

    setSending(true);
    try {
      const { data: auth, error: authErr } = await supabase.auth.getUser();
      if (authErr || !auth?.user) {
        alert("Нужно войти, чтобы отправлять комментарии");
        return;
      }

      const payload: any = {
        manga_id: mangaId,
        user_id: auth.user.id,
        comment: html,
      };
      if (replyTo?.id) payload.parent_id = replyTo.id;

      const { data, error } = await supabase
        .from("manga_comments")
        .insert(payload)
        .select("*, profiles:profiles!manga_comments_user_id_fkey(id, username, avatar_url)")
        .single();
      if (error) throw error;

      setComments((prev) => [...prev, { ...(data as any), profile: (data as any).profiles }]);
      if (editorRef.current) editorRef.current.innerHTML = "";
      setIsEmpty(true);
      setReplyTo(null);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Не удалось отправить комментарий");
    } finally {
      setSending(false);
    }
  }, [sending, mangaId, supabase, replyTo]);

  async function handleRate(value: number) {
    const { data: u } = await supabase.auth.getUser();
    const userId = u.user?.id;
    if (!userId) return;

    const { data: upserted } = await supabase
      .from("manga_ratings")
      .upsert({ manga_id: mangaId, user_id: userId, rating: value }, { onConflict: "manga_id,user_id" })
      .select("*")
      .single();
    if (!upserted) return;

    const { data: fresh } = await supabase.from("manga_ratings").select("*").eq("manga_id", mangaId);
    setRatings((fresh ?? []) as Rating[]);
  }

  /* ===== Loading / 404 ===== */
  if (loading)
    return (
      <div className={`min-h-screen ${pageBg}`}>
        <Header showSearch={false} />
        <div className="flex items-center justify-center h-[60vh] text-sm opacity-70">Загрузка…</div>
      </div>
    );

  if (!manga)
    return (
      <div className={`min-h-screen ${pageBg}`}>
        <Header showSearch={false} />
        <div className="p-6 text-sm opacity-70">Тайтл не найден.</div>
      </div>
    );

  /* ================= Render ================= */
  return (
    <div className={`min-h-screen ${pageBg}`}>
      <Header showSearch={false} />

      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* HERO */}
        <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-8">
          {/* Cover */}
          <div className={`relative rounded-3xl overflow-hidden border ${card}`}>
            <div className="relative w-full h-[560px]">
              <Image
                src={manga.cover_url || "/cover-placeholder.png"}
                alt={manga.title}
                fill
                sizes="(max-width: 1024px) 100vw, 420px"
                className="object-cover"
                priority
              />
            </div>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute left-0 right-0 bottom-0 p-6">
              <h1 className="text-white text-4xl md:text-5xl font-extrabold tracking-tight drop-shadow-lg">
                {manga.title}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-white/90">
                  <User className="h-4 w-4 opacity-80" />
                  {manga.author || "Автор неизвестен"}
                </span>
                {(manga as any).artist && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-white/90">
                    <Brush className="h-4 w-4 opacity-80" />
                    {(manga as any).artist}
                  </span>
                )}

                {teams.map((t) => (
                  <Link
                    key={t.id}
                    href={`/team/${t.slug ?? String(t.id)}`}
                    className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-white/90 hover:bg-white/20"
                    title={`Переводчик: ${t.name}`}
                  >
                    <User className="h-4 w-4 opacity-80" />
                    {t.name}
                  </Link>
                ))}

                <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-white/90">
                  <MessageSquare className="h-4 w-4 opacity-80" />
                  {comments.length} комм.
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-white/90">
                  <BookOpen className="h-4 w-4 opacity-80" />
                  {chapters.length} глав
                </span>
                {typeof (manga as any).view_count === "number" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-white/90">
                    <Eye className="h-4 w-4 opacity-80" />
                    {((manga as any).view_count as number).toLocaleString("ru-RU")}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Правая колонка */}
          <div className="flex flex-col gap-6">
            <div className={`rounded-2xl border p-5 ${card}`}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className={`text-sm uppercase tracking-wider ${mutedText}`}>Жанры</div>
                  <div className="flex flex-wrap gap-2">
                    {genres.length ? (
                      genres.map((g) => (
                        <span key={g.id} className={`rounded-full border px-3 py-1 text-sm ${chip}`}>
                          {g.genre}
                        </span>
                      ))
                    ) : (
                      <span className={`text-sm ${mutedText}`}>Жанры не указаны</span>
                    )}
                  </div>

                  <div className={`flex items-center gap-2 pt-2 text-sm ${bodyText}`}>
                    <TagsIcon className="h-4 w-4 opacity-80" />
                    <span className={`${mutedText}`}>Теги:&nbsp;</span>
                    <span>
                      {Array.isArray((manga as any).tags) && (manga as any).tags.length
                        ? (manga as any).tags.join(", ")
                        : "—"}
                    </span>
                  </div>

                  <div className={`text-sm ${bodyText}`}>
                    <span className={`${mutedText}`}>Переводчик(и): </span>
                    {teams.length ? (
                      <span className="space-x-1">
                        {teams.map((t, i) => (
                          <Link key={t.id} href={`/team/${t.slug ?? String(t.id)}`} className="hover:underline" title={t.name}>
                            {t.name}
                            {i < teams.length - 1 ? ", " : ""}
                          </Link>
                        ))}
                      </span>
                    ) : (
                      "—"
                    )}
                  </div>

                  {manga.status && (
                    <div className={`text-sm ${bodyText}`}>
                      <span className={`${mutedText}`}>Статус: </span>
                      {manga.status}
                    </div>
                  )}
                </div>

                {/* Рейтинг */}
                <div className={`rounded-xl border p-4 ${subtleCard}`}>
                  <div className="flex items-center gap-3">
                    <Star className="h-7 w-7 text-yellow-400 fill-yellow-400" />
                    <div className={`text-4xl font-bold ${titleText}`}>
                      {ratingAverage
                        ? ratingAverage.toLocaleString("ru-RU", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })
                        : "—"}
                    </div>
                    <div className={`text-xs ${mutedText}`}>на основе {ratingCount} оценок</div>
                  </div>

                  <div
                    className="mt-4 h-3 w-full rounded-full overflow-hidden"
                    style={{ background: theme === "light" ? "#e5e7eb" : "rgba(255,255,255,0.1)" }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${ratingPct}%`, background: "linear-gradient(90deg,#facc15 0%, #22c55e 100%)" }}
                    />
                  </div>

                  <div
                    className="mt-3 h-2 w-full rounded-full overflow-hidden"
                    style={{ background: theme === "light" ? "#e5e7eb" : "rgba(255,255,255,0.1)" }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${ratingPct}%`, background: theme === "light" ? "#f59e0b" : "#facc15" }}
                    />
                  </div>

                  <div className="mt-4 grid grid-cols-10 gap-2">
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
                      <button
                        key={v}
                        onClick={() => handleRate(v)}
                        className={`h-9 rounded-md border text-sm transition-colors ${
                          theme === "light"
                            ? "border-gray-300 hover:bg-gray-100 text-gray-800"
                            : "border-white/10 hover:bg-white/10 text-white"
                        }`}
                        title={`Оценить на ${v}`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Описание */}
              <div className="mt-6">
                <div className={`text-sm uppercase tracking-wider mb-2 ${mutedText}`}>О тайтле</div>
                <p className={`leading-relaxed whitespace-pre-line ${bodyText}`}>
                  {manga.description || "Описание пока отсутствует."}
                </p>
              </div>
            </div>

            {/* Действия */}
            <div className="flex flex-wrap items-center gap-3">
              <a
                href={`/manga/${mangaId}/chapter/${chapters[0]?.id ?? ""}`}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm ${primaryBtn}`}
              >
                <BookOpen className="h-4 w-4" />
                Читать первую доступную главу
              </a>

              <a href={`/title/${mangaId}/error`} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm border ${warnBtn}`}>
                <AlertTriangle className="h-4 w-4" />
                Сообщить об ошибке
              </a>

              {canEdit && (
                <a href={`/title/${mangaId}/edit`} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm border ${secondaryBtn}`}>
                  <Edit3 className="h-4 w-4" />
                  Редактировать
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Вкладки */}
        <div className="mt-8">
          <div className={`inline-grid grid-cols-2 rounded-xl overflow-hidden border ${theme === "light" ? "border-gray-200" : "border-white/10"}`}>
            <button onClick={() => setTab("chapters")} className={`px-4 py-2 text-sm transition-colors ${tab === "chapters" ? tabActive : tabIdle}`}>
              Главы
            </button>
            <button onClick={() => setTab("comments")} className={`px-4 py-2 text-sm transition-colors ${tab === "comments" ? tabActive : tabIdle}`}>
              Комментарии
            </button>
          </div>

          {tab === "chapters" ? (
            <div className={`mt-4 rounded-2xl border ${card}`}>
              <div className={`flex items-center justify-between p-3 border-b ${theme === "light" ? "border-gray-200" : "border-white/10"}`}>
                <span className={`font-semibold ${titleText}`}>Список глав</span>
                {canAdd ? <AddChapterButton mangaId={mangaId} onDone={() => window.location.reload()} /> : null}
              </div>
              <div className={`divide-y ${theme === "light" ? "divide-gray-200" : "divide-white/10"}`}>
                {chapters.map((ch) => (
                  <div
                    key={ch.id}
                    className={`flex items-center justify-between p-3 transition-colors ${
                      theme === "light" ? "hover:bg-gray-50" : "hover:bg-gray-800/50"
                    }`}
                  >
                    <div>
                      <div className={`font-medium ${titleText}`}>Глава {ch.chapter_number}{ch.title ? ` — ${ch.title}` : ""}</div>
                      <div className={`text-xs ${mutedText}`}>{new Date(ch.created_at).toLocaleDateString("ru-RU")}</div>
                    </div>
                    <a href={`/manga/${mangaId}/chapter/${ch.id}`} className={`text-sm px-3 py-1 rounded-lg ${primaryBtn}`}>
                      Читать
                    </a>
                  </div>
                ))}
                {chapters.length === 0 && <div className={`p-4 text-sm ${mutedText}`}>Глав пока нет.</div>}
              </div>
            </div>
          ) : (
            /* ===== Комментарии: центр + ответы ===== */
            <div className="mt-4">
              {/* тулбар и редактор */}
              <div className={cWrap}>
                <div className="mb-2 flex gap-2 flex-wrap">
                  <button disabled={!user} onClick={() => document.execCommand("bold")} className={cBtn} title="Жирный">
                    <Bold className="w-4 h-4" /> <span>Жирный</span>
                  </button>
                  <button disabled={!user} onClick={() => document.execCommand("italic")} className={cBtn} title="Курсив">
                    <Italic className="w-4 h-4" /> <span>Курсив</span>
                  </button>
                  <button disabled={!user} onClick={() => document.execCommand("underline")} className={cBtn} title="Подчеркнуть">
                    <Underline className="w-4 h-4" /> <span>Подчеркнуть</span>
                  </button>
                  <button disabled={!user} onClick={() => document.execCommand("strikeThrough")} className={cBtn} title="Зачеркнуть">
                    <Strikethrough className="w-4 h-4" /> <span>Зачеркнуть</span>
                  </button>
                  
                </div>

                {!user && (
                  <div className={`text-xs ${theme === "light" ? "text-gray-500" : "text-slate-300/80"} mb-2`}>
                    Вы не вошли. <a href="/login" className="underline">Войти</a>
                  </div>
                )}

                {replyTo && (
                  <div className={`mb-2 flex items-center gap-2 text-sm ${theme === "light" ? "text-gray-700" : "text-slate-200"}`}>
                    <CornerDownRight className="w-4 h-4" />
                    Ответ для <span className="font-medium">@{replyTo.username ?? `коммент #${replyTo.id}`}</span>
                    <button onClick={() => setReplyTo(null)} className="ml-auto inline-flex items-center gap-1 text-xs opacity-80 hover:opacity-100">
                      <X className="w-3 h-3" /> отменить
                    </button>
                  </div>
                )}

                <div className="relative">
                  {isEmpty && (
                    <span className={`pointer-events-none absolute left-3 top-3 text-sm ${cPlaceholder}`}>
                      {user ? "Оставьте комментарий…" : "Войдите, чтобы оставить комментарий"}
                    </span>
                  )}
                  <div
                    ref={editorRef}
                    role="textbox"
                    aria-label="Поле ввода комментария"
                    contentEditable={!!user}
                    suppressContentEditableWarning
                    className={cEditor(!!user)}
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
                      if (!user) return;
                      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        void submitComment();
                      }
                    }}
                  />
                </div>

                <div className="mt-2 flex justify-end">
                  <button type="button" onClick={submitComment} disabled={!user || sending || isEmpty} className={cSendBtn}>
                    {sending ? "Отправка…" : replyTo ? "Ответить" : "Отправить"}
                  </button>
                </div>
              </div>

              {/* список */}
              <div className="space-y-4">
                {threads.roots.length === 0 && (
                  <div className={`text-sm text-center ${mutedText}`}>Пока нет комментариев</div>
                )}

                {threads.roots.map((c) => {
                  const replies = threads.children[c.id] || [];
                  return (
                    <article key={c.id} className={cItem}>
                      <header className="flex items-center gap-3">
                        <div
                          className={`h-9 w-9 rounded-full overflow-hidden flex items-center justify-center text-xs ${
                            theme === "light" ? "bg-gray-200 text-gray-700" : "bg-gray-700 text-white"
                          }`}
                        >
                          {c.profile?.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={c.profile.avatar_url} alt="avatar" className="h-full w-full object-cover" />
                          ) : (
                            <span>{c.profile?.username?.[0]?.toUpperCase() ?? "?"}</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className={`text-sm font-medium ${titleText}`}>{c.profile?.username ?? "Пользователь"}</div>
                          <div className={`text-xs ${mutedText}`}>{new Date(c.created_at).toLocaleString("ru-RU")}</div>
                        </div>
                        <button
                          className="ml-auto text-xs opacity-70 hover:opacity-100 inline-flex items-center gap-1"
                          onClick={() => setReplyTo({ id: c.id, username: c.profile?.username || undefined })}
                        >
                          <CornerDownRight className="w-3.5 h-3.5" />
                          Ответить
                        </button>
                      </header>

                      <div
                        className={`mt-3 text-sm leading-relaxed break-words ${bodyText}`}
                        dangerouslySetInnerHTML={{ __html: c.comment || "" }}
                      />

                      {replies.length > 0 && (
                        <div className={cReply}>
                          <div className="space-y-3">
                            {replies.map((r) => (
                              <div key={r.id} className="rounded-lg p-3 bg-black/5 dark:bg-white/5">
                                <div className="flex items-center gap-2">
                                  <div className="text-xs font-medium">{r.profile?.username ?? "Пользователь"}</div>
                                  <div className={`text-[11px] ${mutedText}`}>
                                    {new Date(r.created_at).toLocaleString("ru-RU")}
                                  </div>
                                  <button
                                    className="ml-auto text-[11px] opacity-70 hover:opacity-100 inline-flex items-center gap-1"
                                    onClick={() => setReplyTo({ id: c.id, username: c.profile?.username || undefined })}
                                  >
                                    <CornerDownRight className="w-3 h-3" />
                                    Ответить
                                  </button>
                                </div>
                                <div
                                  className={`mt-1 text-sm leading-relaxed break-words ${bodyText}`}
                                  dangerouslySetInnerHTML={{ __html: r.comment || "" }}
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
