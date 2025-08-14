'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// ===== вспомогалки =====
function splitToArray(s: string) {
  return s
    .split(/[;,]+|\n/).map(v => v.trim()).filter(Boolean);
}
function blankToNull(s: string) {
  const v = (s || '').trim();
  return v ? v : null;
}
function slugify(s: string) {
  const map: Record<string, string> = {
    а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'i',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'c',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'
  };
  return s
    .toLowerCase()
    .split('').map(ch => map[ch] ?? ch).join('')
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/(^-|-$)/g, '');
}

// ===== кнопка-обёртка =====
export default function CreateTeamButton({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={['rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700', className].join(' ')}
      >
        Создать команду
      </button>
      {open && <CreateTeamDialog onClose={() => setOpen(false)} />}
    </>
  );
}

// ===== модалка + форма =====
function CreateTeamDialog({ onClose }: { onClose: () => void }) {
  const sb = useMemo(() => createClient(), []);
  const router = useRouter();

  // форма
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugDirty, setSlugDirty] = useState(false);
  const [mangaId, setMangaId] = useState<number | ''>('');
  const [bio, setBio] = useState('');
  const [tags, setTags] = useState('');
  const [langs, setLangs] = useState('');
  const [telegram, setTelegram] = useState('');
  const [vk, setVk] = useState('');
  const [discord, setDiscord] = useState('');
  const [boosty, setBoosty] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const [mangaOptions, setMangaOptions] = useState<{ id: number; title: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // подгрузка тайтлов
  useEffect(() => {
    (async () => {
      const { data, error } = await sb.from('manga').select('id, title').order('title', { ascending: true }).limit(200);
      if (!error) setMangaOptions((data ?? []) as any);
    })();
  }, [sb]);

  // автослаг
  useEffect(() => {
    if (!slugDirty) setSlug(slugify(name));
  }, [name, slugDirty]);

  // === DIAGNOSTIC onSubmit ===
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    console.time('create-team');

    try {
      // 1) user
      console.log('[1] getUser');
      const { data: userRes, error: userErr } = await sb.auth.getUser();
      if (userErr) throw userErr;
      const uid = userRes?.user?.id;
      if (!uid) throw new Error('Вы не авторизованы');

      // валидация
      if (!name?.trim()) throw new Error('Введите название');
      if (!slug?.trim()) throw new Error('Введите slug');
      if (!mangaId) throw new Error('Выберите тайтл');

      // 2) (ПОКА) не грузим аватар чтобы исключить Storage из уравнения
      let avatar_url: string | null = null;

      // Если Storage уже настроен — раскомментируй:
      /*
      if (avatarFile) {
        console.log('[2] upload avatar');
        const path = `teams/${uid}/${Date.now()}-${avatarFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const up = await sb.storage.from('avatars').upload(path, avatarFile, { upsert: true, cacheControl: '3600' });
        if (up.error) throw up.error;
        const pub = sb.storage.from('avatars').getPublicUrl(path);
        avatar_url = pub.data.publicUrl;
      }
      */

      // 3) insert team
      console.log('[3] insert translator_teams');
      const { data: team, error: insErr } = await sb
        .from('translator_teams')
        .insert({
          name,
          slug,
          manga_id: Number(mangaId),
          bio,
          tags: splitToArray(tags),
          langs: splitToArray(langs),
          telegram_url: blankToNull(telegram),
          vk_url: blankToNull(vk),
          discord_url: blankToNull(discord),
          boosty_url: blankToNull(boosty),
          avatar_url,
          created_by: uid, // критично для RLS
        })
        .select('id, slug')
        .single();

      if (insErr) {
        console.error('Insert teams error:', insErr);
        throw insErr;
      }
      console.log('[4] team inserted:', team);

      // 4) member lead
      console.log('[5] insert translator_team_members');
      const { error: memErr } = await sb
        .from('translator_team_members')
        .insert({ team_id: team.id, user_id: uid, role: 'lead' });

      if (memErr) {
        console.warn('Member insert warning:', memErr);
      }

      console.log('[6] redirect');
      onClose();
      router.push(`/team/${team.slug}`);
    } catch (err: any) {
      console.error('[ERR]', err);
      setError(err?.message ?? 'Неизвестная ошибка');
    } finally {
      console.timeEnd('create-team');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl">
        {/* header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="text-lg font-semibold text-slate-900">Новая команда</div>
          <button onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">✕</button>
        </div>

        {/* form */}
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2 text-slate-900">
          <div>
            <label className="mb-1 block text-sm font-medium">Название</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Slug</label>
            <input
              value={slug}
              onChange={(e) => { setSlug(e.target.value); setSlugDirty(true); }}
              className="w-full rounded-lg border px-3 py-2"
            />
            <div className="mt-1 text-xs text-slate-500">Будет в URL: /team/{slug || 'slug'}</div>
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">Тайтл</label>
            <select
              value={mangaId}
              onChange={(e) => setMangaId(Number(e.target.value))}
              className="w-full rounded-lg border px-3 py-2"
            >
              <option value="" disabled>Выберите тайтл…</option>
              {mangaOptions.map((m) => (
                <option key={m.id} value={m.id}>{m.title}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">Аватар</label>
            <input type="file" accept="image/*" onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)} className="block w-full text-sm" />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">О команде</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              className="w-full rounded-lg border px-3 py-2"
              placeholder="Пара слов о команде…"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Теги (через запятую)</label>
            <input value={tags} onChange={(e) => setTags(e.target.value)} className="w-full rounded-lg border px-3 py-2" placeholder="Манга, Игры, Дорамы" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Языки (через запятую)</label>
            <input value={langs} onChange={(e) => setLangs(e.target.value)} className="w-full rounded-lg border px-3 py-2" placeholder="EN→RU, JP→RU" />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Telegram</label>
            <input value={telegram} onChange={(e) => setTelegram(e.target.value)} className="w-full rounded-lg border px-3 py-2" placeholder="https://t.me/…" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">VK</label>
            <input value={vk} onChange={(e) => setVk(e.target.value)} className="w-full rounded-lg border px-3 py-2" placeholder="https://vk.com/…" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Discord</label>
            <input value={discord} onChange={(e) => setDiscord(e.target.value)} className="w-full rounded-lg border px-3 py-2" placeholder="https://discord.gg/…" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Boosty</label>
            <input value={boosty} onChange={(e) => setBoosty(e.target.value)} className="w-full rounded-lg border px-3 py-2" placeholder="https://boosty.to/…" />
          </div>

          {error && (
            <div className="md:col-span-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="md:col-span-2 flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm hover:bg-slate-100">Отмена</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
              {saving ? 'Создаю…' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
