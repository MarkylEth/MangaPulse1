"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/Header";
import { useTheme } from "@/lib/theme/context";
import type { Tables } from "@/database.types";
import { Check, Heart, UsersRound, Edit, X, Plus, Trash2 } from "lucide-react";

/* ========= DB types ========= */
type Team = Tables<"translator_teams">;
type TeamMember = Tables<"translator_team_members">;
type Profile = Tables<"profiles">;

type ProfileLite = Pick<Profile, "id" | "username" | "avatar_url">;
type MemberWithProfile = TeamMember & { profile: ProfileLite | null };

type TeamTitle = {
  id: string;
  name: string;
  slug?: string | null;
  cover_url?: string | null;
  status?: string | null;
};

type EditValues = {
  name: string;
  avatar_url: string;
  bio: string;
  hiring_text: string | null;
  discord_url: string | null;
  boosty_url: string | null;
  langs: string[];
  tags: string[];
  members: { username: string; role: string }[];
};

/* ========= helpers for schema-agnostic mapping ========= */
function pickStr(o: any, keys: string[], fallback = ""): string {
  for (const k of keys) {
    const v = o?.[k];
    if (v !== undefined && v !== null && String(v).trim().length) return String(v);
  }
  return fallback;
}
function pickNullableStr(o: any, keys: string[]): string | null {
  for (const k of keys) {
    const v = o?.[k];
    if (v !== undefined && v !== null && String(v).trim().length) return String(v);
  }
  return null;
}
function mapTitleRow(row: any): TeamTitle {
  return {
    id: String(row.id),
    name: pickStr(row, ["name", "title", "rus_name", "eng_name"], "Без названия"),
    slug: pickNullableStr(row, ["slug", "seo_slug"]),
    cover_url: pickNullableStr(row, ["cover_url", "cover", "image", "poster"]),
    status: pickNullableStr(row, ["status", "state"]),
  };
}

export default function TeamPage(): JSX.Element {
  const { theme } = useTheme();

  const params = useParams() as Record<string, string | string[]> | null;
  const slug =
    (Array.isArray(params?.slug)
      ? params?.slug?.[0]
      : (params?.slug as string | undefined)) ?? "";

  const sb = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const [activeTab, setActiveTab] =
    useState<"overview" | "titles" | "posts">("overview");

  const [titles, setTitles] = useState<TeamTitle[]>([]);
  const [loadingTitles, setLoadingTitles] = useState(false);

  useEffect(() => {
    if (!slug) return;

    let cancelled = false;

    const load = async (): Promise<void> => {
      setLoading(true);

      // 1) Команда
      const { data: t, error: teamErr } = await sb
        .from("translator_teams")
        .select("*")
        .eq("slug", slug)
        .maybeSingle<Team>();

      if (cancelled) return;

      if (teamErr || !t) {
        setTeam(null);
        setMembers([]);
        setTitles([]);
        setLoading(false);
        return;
      }

      setTeam(t);

      // 2) Тайтлы — агностично к схеме
      setLoadingTitles(true);
      try {
        const collected: Record<string, TeamTitle> = {};
        const addRows = (rows: any[] | null | undefined) => {
          (rows ?? []).forEach((r: any) => {
            const key = String(r.id);
            if (!collected[key]) collected[key] = mapTitleRow(r);
          });
        };

        // team key как строка и число
        const teamKeyStr: string = String((t as any).id);
        const teamKeyNum: number | null =
          typeof (t as any).id === "number"
            ? (t as any).id
            : Number.isFinite(Number((t as any).id))
            ? Number((t as any).id)
            : null;

        // Пул таблиц, в которых могут лежать тайтлы
        const titleTables = ["manga", "titles", "manga_titles"];

        // A) прямой ключ translator_team_id
        for (const tbl of titleTables) {
          try {
            const { data } = await (sb as any).from(tbl).select("*").eq("translator_team_id", teamKeyStr);
            addRows(data);
          } catch {}
          if (teamKeyNum !== null) {
            try {
              const { data } = await (sb as any).from(tbl).select("*").eq("translator_team_id", teamKeyNum);
              addRows(data);
            } catch {}
          }
        }

        // B) массив translator_team_ids
        for (const tbl of titleTables) {
          try {
            const { data } = await (sb as any)
              .from(tbl)
              .select("*")
              .contains("translator_team_ids", [teamKeyStr]);
            addRows(data);
          } catch {}
          if (teamKeyNum !== null) {
            try {
              const { data } = await (sb as any)
                .from(tbl)
                .select("*")
                .contains("translator_team_ids", [teamKeyNum]);
              addRows(data);
            } catch {}
          }
        }

        // C) через chapters(team_id -> manga_id) -> manga/titles
        try {
          const { data: ch } = await (sb as any)
            .from("chapters")
            .select("*")
            .eq("team_id", teamKeyStr);
          const ids = Array.from(
            new Set((ch ?? []).map((r: any) => String(r.manga_id)).filter(Boolean))
          );
          if (ids.length) {
            for (const tbl of titleTables) {
              try {
                const { data } = await (sb as any).from(tbl).select("*").in("id", ids);
                addRows(data);
              } catch {}
            }
          }
        } catch {}
        if (teamKeyNum !== null) {
          try {
            const { data: ch2 } = await (sb as any)
              .from("chapters")
              .select("*")
              .eq("team_id", teamKeyNum);
            const ids2 = Array.from(
              new Set((ch2 ?? []).map((r: any) => String(r.manga_id)).filter(Boolean))
            );
            if (ids2.length) {
              for (const tbl of titleTables) {
                try {
                  const { data } = await (sb as any).from(tbl).select("*").in("id", ids2);
                  addRows(data);
                } catch {}
              }
            }
          } catch {}
        }

        // D) через связующую manga_teams(team_id, manga_id)
        try {
          const { data: mt } = await (sb as any)
            .from("manga_teams")
            .select("*")
            .eq("team_id", teamKeyStr);
          const ids = Array.from(
            new Set((mt ?? []).map((r: any) => String(r.manga_id)).filter(Boolean))
          );
          if (ids.length) {
            for (const tbl of titleTables) {
              try {
                const { data } = await (sb as any).from(tbl).select("*").in("id", ids);
                addRows(data);
              } catch {}
            }
          }
        } catch {}
        if (teamKeyNum !== null) {
          try {
            const { data: mt2 } = await (sb as any)
              .from("manga_teams")
              .select("*")
              .eq("team_id", teamKeyNum);
            const ids2 = Array.from(
              new Set((mt2 ?? []).map((r: any) => String(r.manga_id)).filter(Boolean))
            );
            if (ids2.length) {
              for (const tbl of titleTables) {
                try {
                  const { data } = await (sb as any).from(tbl).select("*").in("id", ids2);
                  addRows(data);
                } catch {}
              }
            }
          } catch {}
        }

        if (!cancelled) setTitles(Object.values(collected));
      } catch {
        if (!cancelled) setTitles([]);
      } finally {
        if (!cancelled) setLoadingTitles(false);
      }

      // 3) Участники
      const { data: teamMembers } = await sb
        .from("translator_team_members")
        .select("user_id, role, team_id, added_at")
        .eq("team_id", (t as any).id);

      if (cancelled) return;

      const userIds = Array.from(new Set((teamMembers ?? []).map((m) => m.user_id)));
      let enriched: MemberWithProfile[] = [];

      if (userIds.length) {
        const { data: profs } = await sb
          .from("profiles")
          .select("id, username, avatar_url")
          .in("id", userIds);
        const profLite = (profs ?? []) as ProfileLite[];

        enriched = (teamMembers ?? []).map((m) => ({
          ...(m as TeamMember),
          profile: profLite.find((p) => p.id === m.user_id) ?? null,
        }));
      }
      setMembers(enriched);
      setLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [slug, sb]);

  const bgClass =
    theme === "light"
      ? "bg-gray-50"
      : "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900";

  if (!slug) {
    return (
      <div className={`min-h-screen ${bgClass}`}>
        <Header showSearch={false} />
        <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-slate-500">
          Нет slug в URL.
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`min-h-screen ${bgClass}`}>
        <Header showSearch={false} />
        <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-slate-500">
          Загружаю…
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className={`min-h-screen ${bgClass}`}>
        <Header showSearch={false} />
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="rounded-2xl border p-6 text-slate-600 bg-white">
            Команда не найдена.
          </div>
        </div>
      </div>
    );
  }

  const sinceText = team.started_at
    ? `с ${new Date(team.started_at).getFullYear()}`
    : "";
  const resources = (
    [
      team.discord_url && { key: "Discord", href: team.discord_url },
      team.boosty_url && { key: "Boosty", href: team.boosty_url },
    ].filter(Boolean) as { key: "Discord" | "Boosty"; href: string }[]
  );

  return (
    <div className={`min-h-screen ${bgClass}`}>
      <Header showSearch={false} />

      {/* заголовок "файл" */}
      <div className="mx-auto max-w-6xl px-5 pt-6">
        <div className="text-xs uppercase tracking-wide text-slate-500">файл</div>
      </div>

      <div className="mx-auto max-w-6xl px-5 py-6">
        {/* Шапка профиля */}
        <div className="mb-6 flex items-start justify-between gap-6 rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex items-start gap-6">
            <div className="relative h-[96px] w-[96px] overflow-hidden rounded-2xl bg-white ring-2 ring-sky-400">
              {team.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={team.avatar_url}
                  alt="avatar"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="grid h-full w-full place-items-center text-4xl">🦊</div>
              )}
            </div>
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2">
                <h1 className="truncate text-[28px] font-semibold leading-tight text-slate-900">
                  {team.name}
                </h1>
                {team.verified && (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#4285f4] text-[14px] text-white">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                )}
              </div>
              <div className="mb-2 text-[14px] text-slate-600">
                @{team.slug ?? team.id}
              </div>
              <div className="flex flex-wrap items-center gap-6 text-[14px] text-slate-600">
                <div className="flex items-center gap-1">
                  <Heart className="h-4 w-4" />
                  <span className="font-semibold text-slate-900">
                    {formatK(team.likes_count ?? 0)}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <UsersRound className="h-4 w-4" />
                  <span className="font-semibold text-slate-900">
                    {formatK(team.followers_count ?? 0)}
                  </span>
                </div>
                {sinceText && <div>{sinceText}</div>}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button className="rounded-3xl bg-[#2196F3] px-5 py-2.5 text-[14px] font-medium text-white hover:bg-[#1976D2]">
              Подписаться
            </button>
            <button
              onClick={() => setIsEditOpen(true)}
              className="rounded-3xl border border-slate-300 px-4 py-2 text-[14px] hover:bg-slate-50"
            >
              <span className="inline-flex items-center gap-1">
                <Edit className="h-4 w-4" /> Редактировать
              </span>
            </button>
          </div>
        </div>

        {/* Табы */}
        <div className="mb-6 rounded-2xl border-b border-slate-200 bg-white px-6">
          <div className="flex gap-8 text-[14px] font-medium">
            <Tab active={activeTab === "overview"} onClick={() => setActiveTab("overview")}>
              Обзор
            </Tab>
            <Tab active={activeTab === "titles"} onClick={() => setActiveTab("titles")}>
              Переводят
            </Tab>
            <Tab active={activeTab === "posts"} onClick={() => setActiveTab("posts")}>
              Посты
            </Tab>
          </div>
        </div>

        {/* Контент: Обзор */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Левая колонка */}
            <div className="space-y-6">
              <Section>
                <SectionTitle>Описание</SectionTitle>
                <p className="mb-5 whitespace-pre-wrap text-[14px] leading-relaxed text-slate-600">
                  {team.bio || "Мы официальная команда MangaPulse"}
                </p>

                <SectionTitle>Что переводят</SectionTitle>
                <div className="mb-4 flex flex-wrap gap-2">
                  {(team.tags?.length ? team.tags : ["Манга", "Игры", "Дорамы"]).map(
                    (t, i) => (
                      <span
                        key={`tag-${i}`}
                        className="rounded-full bg-slate-100 px-3 py-1 text-[13px] text-slate-600"
                      >
                        {t}
                      </span>
                    )
                  )}
                </div>
                <div className="mb-2 flex flex-wrap gap-2">
                  {(team.langs?.length ? team.langs : ["RU→EN"]).map((t, i) => (
                    <span
                      key={`lang-${i}`}
                      className="rounded-full bg-[#e3f2fd] px-3 py-1 text-[13px] font-medium text-[#1976D2]"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </Section>
            </div>

            {/* Средняя колонка */}
            <div className="space-y-6">
              <Section>
                <SectionTitle>Ресурсы</SectionTitle>
                <div className="mb-6 flex flex-wrap gap-3">
                  {resources.length === 0 && (
                    <div className="text-[14px] text-slate-500">Ничего не указано</div>
                  )}
                  {resources.map((r) => (
                    <a
                      key={r.key}
                      href={r.href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-[14px] text-slate-900 hover:bg-slate-50"
                    >
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded ${
                          r.key === "Discord" ? "bg-[#7289da]" : "bg-[#ff6b35]"
                        }`}
                      >
                        <span className="text-[12px] font-bold text-white">
                          {r.key === "Discord" ? "#" : "B"}
                        </span>
                      </span>
                      {r.key}
                    </a>
                  ))}
                </div>

                {/* Команда — ряд аватаров */}
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <SectionTitle className="!mb-0">Команда</SectionTitle>
                    <a href="#" className="text-[14px] text-[#2196F3] hover:underline">
                      подписаться
                    </a>
                  </div>

                  <div className="-mx-2 overflow-x-auto pb-2">
                    <div className="flex w-max items-start gap-4 px-2">
                      {members.slice(0, 30).map((m, idx) => (
                        <div key={idx} className="w-20 shrink-0 text-center">
                          <div className="mx-auto h-16 w-16 overflow-hidden rounded-full bg-slate-200 ring-1 ring-slate-300">
                            {m.profile?.avatar_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={m.profile.avatar_url}
                                alt="avatar"
                                className="h-full w-full object-cover"
                              />
                            ) : null}
                          </div>
                          <div className="mt-1 truncate text-[13px] font-medium">
                            {m.profile?.username || "—"}
                          </div>
                          <div className="text-[12px] text-slate-500">
                            {roleLabel(m.role)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Section>
            </div>

            {/* Правая колонка */}
            <div className="space-y-6">
              <Section>
                <SectionTitle>Статистика</SectionTitle>
                <div className="divide-y divide-slate-100">
                  <div className="flex items-center justify-between py-3 text-[14px]">
                    <span className="text-slate-600">Глав переведено</span>
                    <span className="font-semibold text-slate-900">
                      {String(team.stats_pages ?? 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-3 text-[14px]">
                    <span className="text-slate-600">В работе</span>
                    <span className="font-semibold text-slate-900">
                      {String(team.stats_inwork ?? 0)}
                    </span>
                  </div>
                </div>

                <div className="mt-6">
                  <h3 className="mb-3 text-[16px] font-semibold">Топ лайков</h3>
                  <div className="space-y-3">
                    {members.slice(0, 3).map((m, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="h-8 w-8 overflow-hidden rounded-full bg-slate-200">
                          {m.profile?.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={m.profile.avatar_url}
                              alt="avatar"
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                        </div>
                        <div className="text-[14px] font-medium">
                          {m.profile?.username || "—"}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <h4 className="mb-1 font-semibold text-amber-800">Мы ищем</h4>
                    <p className="text-[14px] text-amber-800">
                      {(team as unknown as { hiring_text?: string }).hiring_text ??
                        "Нужен тайлсеттер"}
                    </p>
                  </div>
                </div>
              </Section>
            </div>
          </div>
        )}

        {/* Контент: Переводят */}
        {activeTab === "titles" && (
          <div className="space-y-6">
            <Section>
              <SectionTitle>Тайтлы команды</SectionTitle>
              {loadingTitles ? (
                <div className="text-sm text-slate-500">Загружаем тайтлы…</div>
              ) : titles.length === 0 ? (
                <div className="text-sm text-slate-500">Пока нет тайтлов.</div>
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {titles.map((t) => (
                    <a
                      key={t.id}
                      href={t.slug ? `/title/${t.slug}` : "#"}
                      className="group block overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
                    >
                      <div className="aspect-[3/4] w-full overflow-hidden bg-slate-100">
                        {t.cover_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={t.cover_url}
                            alt={t.name}
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                          />
                        ) : (
                          <div className="grid h-full place-items-center text-slate-400">
                            no cover
                          </div>
                        )}
                      </div>
                      <div className="p-2">
                        <div className="truncate text-[13px] font-medium text-slate-900">
                          {t.name}
                        </div>
                        {t.status && (
                          <div className="mt-0.5 text-[12px] text-slate-500">
                            {t.status}
                          </div>
                        )}
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </Section>
          </div>
        )}

        {/* Контент: Посты */}
        {activeTab === "posts" && (
          <div className="space-y-6">
            <Section>
              <SectionTitle>Посты</SectionTitle>
              <div className="text-sm text-slate-500">Постов пока нет.</div>
            </Section>
          </div>
        )}
      </div>

      {/* === Edit Modal === */}
      {isEditOpen && (
        <EditModal
          initial={{
            name: team.name ?? "",
            avatar_url: team.avatar_url ?? "",
            bio: team.bio ?? "",
            hiring_text:
              (team as unknown as { hiring_text?: string }).hiring_text ?? "",
            discord_url: team.discord_url ?? null,
            boosty_url: team.boosty_url ?? null,
            langs: team.langs ?? ["RU→EN"],
            tags: team.tags ?? ["Манга", "Игры", "Дорамы"],
            members: members.map((m) => ({
              username: m.profile?.username ?? "",
              role: m.role ?? "member",
            })),
          }}
          onClose={() => setIsEditOpen(false)}
          onSave={async (v) => {
            try {
              // 1) Обновление полей команды
              const { error: upErr } = await sb
                .from("translator_teams")
                .update({
                  name: v.name.trim(),
                  avatar_url: v.avatar_url.trim(),
                  bio: v.bio,
                  discord_url: v.discord_url || null,
                  boosty_url: v.boosty_url || null,
                  langs: v.langs,
                  tags: v.tags,
                  hiring_text: v.hiring_text?.trim() || null,
                })
                .eq("id", (team as any).id);
              if (upErr) throw new Error(upErr.message);

              // 2) usernames -> user_ids
              const usernames = Array.from(
                new Set(
                  v.members.map((m) => m.username.trim()).filter((u) => u.length > 0)
                )
              );
              const { data: profs, error: profErr } = await sb
                .from("profiles")
                .select("id, username")
                .in("username", usernames);
              if (profErr) throw new Error(profErr.message);

              const idByUsername = new Map((profs ?? []).map((p) => [p.username, p.id]));
              const desiredIds = new Set(
                v.members
                  .map((m) => idByUsername.get(m.username.trim()))
                  .filter((id): id is string => !!id)
              );

              const currentIds = new Set(members.map((m) => m.user_id));
              const toDeleteIds = [...currentIds].filter((id) => !desiredIds.has(id));

              const teamKey: any = (team as any).id; // оставляем как есть (uuid/number)

              const toUpsert = v.members
                .map((m) => {
                  const uid = idByUsername.get(m.username.trim());
                  return uid
                    ? {
                        team_id: teamKey,
                        user_id: uid,
                        role: m.role ?? "member",
                      }
                    : null;
                })
                .filter(Boolean) as any[];

              // 3) Синхронизация состава
              if (toDeleteIds.length) {
                const { error: delErr } = await sb
                  .from("translator_team_members")
                  .delete()
                  .in("user_id", toDeleteIds)
                  .eq("team_id", teamKey);
                if (delErr) throw new Error(delErr.message);
              }

              if (toUpsert.length) {
                const { error: upsertErr } = await sb
                  .from("translator_team_members")
                  .upsert(toUpsert, { onConflict: "team_id,user_id" });
                if (upsertErr) throw new Error(upsertErr.message);
              }

              // 4) Локально обновим базовые поля
              setTeam((t) =>
                t
                  ? {
                      ...t,
                      name: v.name.trim(),
                      avatar_url: v.avatar_url.trim(),
                      bio: v.bio,
                      discord_url: v.discord_url || null,
                      boosty_url: v.boosty_url || null,
                      langs: v.langs,
                      tags: v.tags,
                      ...(v.hiring_text !== undefined
                        ? { hiring_text: v.hiring_text }
                        : {}),
                    }
                  : t
              );

              // 5) Перезагрузим участников
              const { data: teamMembersNew, error: memErr } = await sb
                .from("translator_team_members")
                .select("user_id, role, team_id, added_at")
                .eq("team_id", teamKey);
              if (memErr) throw new Error(memErr.message);

              if (teamMembersNew) {
                const userIds = Array.from(
                  new Set(teamMembersNew.map((m) => m.user_id))
                );
                const { data: profs2, error: profErr2 } = await sb
                  .from("profiles")
                  .select("id, username, avatar_url")
                  .in("id", userIds);
                if (profErr2) throw new Error(profErr2.message);

                setMembers(
                  teamMembersNew.map((m) => ({
                    ...(m as TeamMember),
                    profile: (profs2 ?? []).find((p) => p.id === m.user_id) ?? null,
                  }))
                );
              }

              setIsEditOpen(false);
            } catch (e) {
              const msg =
                e instanceof Error ? e.message : typeof e === "string" ? e : "Unknown error";
              console.error("[Edit save]", e);
              alert(`Не удалось сохранить: ${msg}`);
            }
          }}
        />
      )}
    </div>
  );
}

/* ========= Modal ========= */
type EditModalProps = {
  initial: EditValues;
  onClose: () => void;
  onSave: (v: EditValues) => Promise<void>;
};

const EditModal: React.FC<EditModalProps> = ({ initial, onClose, onSave }) => {
  const [v, setV] = useState<EditValues>(initial);
  const [saving, setSaving] = useState(false);

  const toggleSet = (key: "langs" | "tags", value: string) => {
    setV((prev) => {
      const set = new Set(prev[key]);
      set.has(value) ? set.delete(value) : set.add(value);
      return { ...prev, [key]: Array.from(set) } as EditValues;
    });
  };

  const addMember = () => {
    setV((prev) => ({
      ...prev,
      members: [...prev.members, { username: "", role: "member" }],
    }));
  };

  const removeMember = (idx: number) => {
    setV((prev) => ({
      ...prev,
      members: prev.members.filter((_, i) => i !== idx),
    }));
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(v);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={() => !saving && onClose()}
      />
      <div className="relative w-[min(860px,92vw)] overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/5">
        <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-sky-50 to-indigo-50 px-6 py-4">
          <h3 className="text-lg font-semibold text-slate-900">Редактировать команду</h3>
          <button
            type="button"
            className="rounded-full p-2 text-slate-500 transition hover:bg-white hover:text-slate-700"
            onClick={() => !saving && onClose()}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form className="max-h-[75vh] space-y-6 overflow-y-auto px-6 py-6" onSubmit={submit}>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Название команды
              </label>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-[14px] shadow-sm outline-none transition focus:ring-4 focus:ring-sky-200/60"
                value={v.name}
                onChange={(e) => setV({ ...v, name: e.target.value })}
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Аватар (URL)
              </label>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-[14px] shadow-sm outline-none transition focus:ring-4 focus:ring-sky-200/60"
                value={v.avatar_url}
                onChange={(e) => setV({ ...v, avatar_url: e.target.value })}
                placeholder="https://..."
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Описание
              </label>
              <textarea
                className="h-28 w-full resize-y rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-[14px] shadow-sm outline-none transition focus:ring-4 focus:ring-sky-200/60"
                value={v.bio}
                onChange={(e) => setV({ ...v, bio: e.target.value })}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Мы ищем (плашка)
              </label>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-[14px] shadow-sm outline-none transition focus:ring-4 focus:ring-amber-200/70"
                value={v.hiring_text ?? ""}
                onChange={(e) => setV({ ...v, hiring_text: e.target.value })}
                placeholder="Нужен тайлсеттер"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Discord URL
              </label>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-[14px] shadow-sm outline-none transition focus:ring-4 focus:ring-sky-200/60"
                value={v.discord_url ?? ""}
                onChange={(e) => setV({ ...v, discord_url: e.target.value })}
                placeholder="https://discord.gg/..."
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Boosty URL
              </label>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-[14px] shadow-sm outline-none transition focus:ring-4 focus:ring-sky-200/60"
                value={v.boosty_url ?? ""}
                onChange={(e) => setV({ ...v, boosty_url: e.target.value })}
                placeholder="https://boosty.to/..."
              />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                Что переводят (теги)
              </div>
              <div className="flex flex-wrap gap-2">
                {["Игры", "Манга", "Дорамы"].map((t) => (
                  <button
                    type="button"
                    key={t}
                    onClick={() => toggleSet("tags", t)}
                    className={`rounded-full border px-3 py-1.5 text-[13px] transition ${
                      v.tags.includes(t)
                        ? "border-slate-900 bg-slate-900 text-white shadow"
                        : "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                Направления перевода
              </div>
              <div className="flex flex-wrap gap-2">
                {["RU→EN"].map((lng) => (
                  <button
                    type="button"
                    key={lng}
                    onClick={() => toggleSet("langs", lng)}
                    className={`rounded-full border px-3 py-1.5 text-[13px] transition ${
                      v.langs.includes(lng)
                        ? "border-sky-600 bg-sky-600 text-white shadow"
                        : "border-sky-100 bg-sky-50 text-sky-700 hover:bg-sky-100"
                    }`}
                  >
                    {lng}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              Состав команды
            </div>
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/50 p-3">
              {v.members.map((m, idx) => (
                <div key={idx} className="grid gap-2 sm:grid-cols-12">
                  <input
                    className="sm:col-span-7 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[14px] shadow-sm outline-none transition focus:ring-4 focus:ring-sky-200/60"
                    placeholder="username"
                    value={m.username}
                    onChange={(e) => {
                      const val = e.target.value;
                      setV((prev) => ({
                        ...prev,
                        members: prev.members.map((mm, i) =>
                          i === idx ? { ...mm, username: val } : mm
                        ),
                      }));
                    }}
                  />
                  <select
                    className="sm:col-span-4 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[14px] shadow-sm outline-none transition focus:ring-4 focus:ring-sky-200/60"
                    value={m.role}
                    onChange={(e) => {
                      const val = e.target.value;
                      setV((prev) => ({
                        ...prev,
                        members: prev.members.map((mm, i) =>
                          i === idx ? { ...mm, role: val } : mm
                        ),
                      }));
                    }}
                  >
                    <option value="lead">Лидер</option>
                    <option value="editor">Редактор</option>
                    <option value="member">Переводчик</option>
                  </select>
                  <button
                    type="button"
                    className="sm:col-span-1 inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100"
                    onClick={() => removeMember(idx)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addMember}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[14px] text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <Plus className="h-4 w-4" /> Добавить участника
              </button>
            </div>
          </div>

          <div className="sticky bottom-0 -mx-6 -mb-6 flex items-center justify-end gap-2 border-t border-slate-200 bg-white/90 px-6 py-4 backdrop-blur">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-2xl border border-slate-300 px-4 py-2 text-[14px] text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl bg-slate-900 px-5 py-2.5 text-[14px] font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
            >
              {saving ? "Сохранение…" : "Сохранить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ========= UI helpers ========= */
function Tab({
  children,
  active = false,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "relative -mb-px border-b-2 px-0 py-3",
        active
          ? "border-[#2196F3] text-[#2196F3]"
          : "border-transparent text-slate-600 hover:text-slate-900",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl bg-white p-6 shadow-sm">{children}</div>;
}

function SectionTitle({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2 className={["mb-4 text-[20px] font-semibold text-slate-900", className].join(" ")}>
      {children}
    </h2>
  );
}

/* ========= utils ========= */
function roleLabel(role?: string | null) {
  switch (role) {
    case "lead":
      return "Лидер";
    case "editor":
      return "Редактор";
    case "member":
      return "Переводчик";
    default:
      return role || "Участник";
  }
}
function formatK(n: number) {
  if (n >= 1000) {
    const k = (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1).replace(".0", "");
    return `${k}K`;
  }
  return String(n);
}
