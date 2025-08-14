'use client';

import React, { useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  X,
  GripVertical,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpAZ,
  ArrowDownAZ,
  ArrowUp01,
  ArrowDown01,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

/** ===== helpers ===== */
const makeId = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? (crypto as any).randomUUID()
    : Math.random().toString(36).slice(2) + Date.now());

type PageItem = {
  id: string;
  file: File;
  url: string;
  name: string;
  size: number;
};

type Props = {
  mangaId: number;
  onDone?: () => void;
};

/** Collator для «умного» сравнения строк (с учётом чисел) */
const collator = new Intl.Collator('ru', { numeric: true, sensitivity: 'base' });

/** Вытаскиваем все числа из строки для «числовой» сортировки */
function extractNums(s: string) {
  return s.match(/\d+/g)?.map((n) => parseInt(n, 10)) ?? [];
}
/** Компаратор «по числам внутри имени», с fallback на collator */
function cmpByNums(a: string, b: string) {
  const aa = extractNums(a);
  const bb = extractNums(b);
  const len = Math.max(aa.length, bb.length);
  for (let i = 0; i < len; i++) {
    const x = aa[i] ?? -Infinity;
    const y = bb[i] ?? -Infinity;
    if (x !== y) return x - y;
  }
  return collator.compare(a, b);
}

export default function AddChapterButton({ mangaId, onDone }: Props) {
  const supabase: SupabaseClient = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);

  async function ensureAuthAndOpen() {
    const { data } = await supabase.auth.getUser();
    const user = data?.user;
    if (!user) {
      const go = confirm('Нужно войти, чтобы добавить главу. Перейти на страницу входа?');
      if (go) window.location.href = '/login';
      return;
    }
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={ensureAuthAndOpen}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
      >
        <Upload className="w-4 h-4" />
        Добавить главу
      </button>

      <AnimatePresence>
        {open && (
          <Dialog onClose={() => setOpen(false)}>
            <Uploader
              mangaId={mangaId}
              onClose={() => setOpen(false)}
              onDone={onDone}
              supabase={supabase}
            />
          </Dialog>
        )}
      </AnimatePresence>
    </>
  );
}

/* =================== Модальное окно-обёртка =================== */
function Dialog({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <motion.div
      className="fixed inset-0 z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <motion.div
        role="dialog"
        aria-modal="true"
        className="absolute inset-x-0 top-6 mx-auto w-[min(1100px,calc(100vw-24px))] rounded-2xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl"
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 12, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 40 }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

/* ===================== Загрузка/упорядочивание ===================== */
function Uploader({
  mangaId,
  onClose,
  onDone,
  supabase,
}: {
  mangaId: number;
  onClose: () => void;
  onDone?: () => void;
  supabase: SupabaseClient;
}) {
  const [volume, setVolume] = useState<number | ''>('');
  const [chapter, setChapter] = useState<number | ''>('');
  const [title, setTitle] = useState('');

  const [pages, setPages] = useState<PageItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // dnd state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [insertBefore, setInsertBefore] = useState(true);
  const dragging = dragIndex !== null;

  // refs
  const inputRef = useRef<HTMLInputElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);

  /** собрать элементы из FileList (input/drag&drop) */
  function addFiles(fs: FileList | File[]) {
    const list = Array.from(fs || []).filter((f) => f.type.startsWith('image/'));
    if (!list.length) return;

    const newItems: PageItem[] = list.map((file) => ({
      id: makeId(),
      file,
      url: URL.createObjectURL(file),
      name: file.name,
      size: file.size,
    }));

    setPages((prev) => [...prev, ...newItems]);
  }

  function onSelectInput(e: React.ChangeEvent<HTMLInputElement>) {
    const fs = e.target.files;
    if (!fs?.length) return;
    addFiles(fs);
    e.currentTarget.value = ''; // сбросить, чтобы можно было выбрать те же
  }

  function onDropFiles(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
  }

  function prevent(e: React.DragEvent) {
    e.preventDefault();
  }

  /** сортировки */
  const [nameAsc, setNameAsc] = useState(true);
  const [numAsc, setNumAsc] = useState(true);

  function sortByName() {
    setPages((prev) =>
      [...prev].sort((a, b) => (nameAsc ? 1 : -1) * collator.compare(a.name, b.name)),
    );
    setNameAsc((v) => !v);
  }
  function sortByNumbers() {
    setPages((prev) =>
      [...prev].sort((a, b) => (numAsc ? 1 : -1) * cmpByNums(a.name, b.name)),
    );
    setNumAsc((v) => !v);
  }

  /** перемещение карточки в начало/конец */
  function moveToStart(i: number) {
    setPages((prev) => {
      const next = [...prev];
      const [it] = next.splice(i, 1);
      next.unshift(it);
      return next;
    });
  }
  function moveToEnd(i: number) {
    setPages((prev) => {
      const next = [...prev];
      const [it] = next.splice(i, 1);
      next.push(it);
      return next;
    });
  }

  /** DnD */
  function onDragStartCard(e: React.DragEvent<HTMLLIElement>, i: number) {
    e.dataTransfer.effectAllowed = 'move';
    try {
      e.dataTransfer.setData('text/plain', String(i));
    } catch {}
    setDragIndex(i);
  }
  function onDragOverCard(e: React.DragEvent<HTMLLIElement>, i: number) {
    if (!dragging) return;
    e.preventDefault();
    const rect = (e.currentTarget as HTMLLIElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    setOverIndex(i);
    setInsertBefore(x < rect.width / 2);
  }
  function onDropOnCard(e: React.DragEvent<HTMLLIElement>, i: number) {
    e.preventDefault();
    if (dragIndex === null) return;

    setPages((prev) => {
      let from = dragIndex!;
      let to = insertBefore ? i : i + 1;
      if (from < to) to -= 1;
      const next = [...prev];
      const [it] = next.splice(from, 1);
      next.splice(to, 0, it);
      return next;
    });

    setDragIndex(null);
    setOverIndex(null);
  }
  function onDragEndCard() {
    setDragIndex(null);
    setOverIndex(null);
  }
  function onDropToEdge(edge: 'start' | 'end') {
    if (dragIndex === null) return;
    setPages((prev) => {
      const next = [...prev];
      const [it] = next.splice(dragIndex!, 1);
      if (edge === 'start') next.unshift(it);
      else next.push(it);
      return next;
    });
    setDragIndex(null);
    setOverIndex(null);
  }

  /** удалить карточку */
  function removeAt(i: number) {
    setPages((prev) => {
      const next = [...prev];
      const [it] = next.splice(i, 1);
      URL.revokeObjectURL(it.url);
      return next;
    });
  }

  /** отправка на /api/chapters — порядок сохраняется ровно как в pages */
  async function submit() {
    setError(null);

    if (!chapter && chapter !== 0) {
      setError('Укажите номер главы');
      return;
    }
    if (!pages.length) {
      setError('Добавьте страницы');
      return;
    }

    setBusy(true);
    try {
      // проверим, что юзер авторизован и возьмём access token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token ?? null;
      if (!token) {
        const go = confirm('Сессия не найдена. Войти сейчас?');
        if (go) window.location.href = '/login';
        return;
      }

      const fd = new FormData();
      fd.append('mangaId', String(mangaId));
      fd.append('chapterNumber', String(chapter));
      if (volume !== '') fd.append('volume', String(volume));
      if (title.trim()) fd.append('title', title.trim());
      pages.forEach((p) => fd.append('pages', p.file, p.name)); // порядок важен

      const res = await fetch('/api/chapters', {
        method: 'POST',
        body: fd,
        cache: 'no-store',
        credentials: 'include', // <-- пробрасываем cookie supabase
        headers: {
          // <-- и дублируем токен на случай, если сервер ждёт Authorization
          Authorization: `Bearer ${token}`,
        },
      });

      // пробуем аккуратно распарсить
      let payload: any = null;
      try {
        const text = await res.text();
        payload = text ? JSON.parse(text) : null;
      } catch {
        payload = null;
      }

      if (!res.ok) {
        // удобные сообщения для частых кейсов
        if (res.status === 401) {
          throw new Error('Не авторизован. Войдите в аккаунт и попробуйте снова.');
        }
        if (res.status === 403) {
          throw new Error('Недостаточно прав для добавления главы.');
        }
        const msg = payload?.error || `Не удалось загрузить главу (HTTP ${res.status})`;
        throw new Error(msg);
      }

      onClose();
      onDone?.();
    } catch (e: any) {
      const m = String(e?.message || e);
      // подсказки для RLS/UUID
      if (/row level security|RLS/i.test(m)) {
        setError('Политики RLS не разрешают вставку. Проверьте правила для таблиц chapters/chapter_pages.');
      } else if (/uuid/i.test(m) && /uploaded_by/i.test(m)) {
        setError('Поле uploaded_by должно быть UUID. Убедитесь, что сервер записывает uploaded_by = auth.uid().');
      } else {
        setError(m);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
        <h3 className="text-lg font-semibold">Новая глава</h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white"
          aria-label="Закрыть"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6 p-6">
        {/* ====== Левая колонка — форма + дропзона ====== */}
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-slate-400">Том</label>
            <input
              type="number"
              inputMode="numeric"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 outline-none focus:border-slate-500"
              placeholder="0"
              value={volume}
              onChange={(e) => setVolume(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-400">Номер главы *</label>
            <input
              type="number"
              inputMode="numeric"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 outline-none focus:border-slate-500"
              placeholder="например, 12"
              value={chapter}
              onChange={(e) => setChapter(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-400">Название (необязательно)</label>
            <input
              type="text"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 outline-none focus:border-slate-500"
              placeholder="Название"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Дропзона */}
          <div
            onDrop={onDropFiles}
            onDragOver={prevent}
            className="grid place-items-center rounded-xl border border-slate-700 bg-slate-800 p-6 text-center"
          >
            <div className="text-slate-300">
              Перетащите изображения сюда<br />
              <span className="text-slate-500">или</span>
            </div>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-2 rounded-md bg-slate-700 px-3 py-1.5 text-sm hover:bg-slate-600"
            >
              выбрать файлы
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={onSelectInput}
              className="hidden"
            />
            <div className="mt-3 text-xs text-slate-500">
              Порядок можно менять ниже. Файлы конвертируются в WebP на сервере.
            </div>
          </div>
        </div>

        {/* ====== Правая колонка — управление страницами ====== */}
        <div className="flex min-h-[420px] flex-col">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-sm text-slate-400">Страницы</span>
            <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
              {pages.length}
            </span>

            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={sortByName}
                className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs hover:bg-slate-700"
                title="Сортировать по имени (А↔Я)"
              >
                {nameAsc ? <ArrowUpAZ className="w-4 h-4" /> : <ArrowDownAZ className="w-4 h-4" />}
                Имя
              </button>
              <button
                type="button"
                onClick={sortByNumbers}
                className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs hover:bg-slate-700"
                title="Сортировать по числам (1↔9)"
              >
                {numAsc ? <ArrowUp01 className="w-4 h-4" /> : <ArrowDown01 className="w-4 h-4" />}
                Числа
              </button>
            </div>
          </div>

          {/* Drop-зона «в начало» */}
          <DropEdge
            visible={dragging}
            label="Отпустить здесь — в начало"
            onDrop={() => onDropToEdge('start')}
          />

          {/* GRID */}
          <div
            ref={gridRef}
            className="relative max-h:[58vh] max-h-[58vh] flex-1 overflow-auto rounded-xl border border-slate-800 bg-slate-900/60 p-3"
          >
            {pages.length === 0 ? (
              <div className="grid h-full place-items-center text-sm text-slate-400">
                Страницы не выбраны
              </div>
            ) : (
              <ul
                className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
                onDragOver={(e) => e.preventDefault()}
              >
                {pages.map((p, i) => {
                  const isOverCard = overIndex === i && dragging;
                  const isDragging = dragIndex === i && dragging;

                  return (
                    <motion.li
                      key={p.id}
                      layout
                      transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                      className={[
                        'relative group select-none rounded-xl border overflow-hidden shadow-sm',
                        'bg-slate-900 border-slate-800',
                        isDragging ? 'opacity-60 scale-[0.98]' : 'hover:border-slate-700',
                        isOverCard ? 'border-sky-400' : '',
                      ].join(' ')}
                      draggable
                      onDragStartCapture={(e: React.DragEvent<HTMLLIElement>) =>
                        onDragStartCard(e, i)
                      }
                      onDragOver={(e: React.DragEvent<HTMLLIElement>) => onDragOverCard(e, i)}
                      onDrop={(e: React.DragEvent<HTMLLIElement>) => onDropOnCard(e, i)}
                      onDragEndCapture={() => onDragEndCard()}
                      title={p.name}
                    >
                      {/* превью */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.url}
                        alt={p.name}
                        className="aspect-[3/4] h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        draggable={false}
                      />

                      {/* overlay-крышка для перетаскивания */}
                      <div className="absolute inset-0 pointer-events-none">
                        {isOverCard && (
                          <div
                            className={`absolute top-0 ${
                              insertBefore ? 'left-0' : 'right-0'
                            } h-full w-[3px] bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,.8)]`}
                          />
                        )}
                      </div>

                      {/* хедер карточки: ручка / в начало / в конец / удалить */}
                      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-1 bg-gradient-to-b from-black/40 to-transparent px-2 py-1">
                        <span className="inline-flex items-center gap-1 rounded bg-black/50 px-1.5 py-0.5 text-[11px] text-slate-200">
                          <GripVertical className="h-3.5 w-3.5" />
                          {i + 1}
                        </span>

                        <div className="ml-auto flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => moveToStart(i)}
                            className="rounded bg-black/50 p-1 text-white hover:bg-black/60"
                            title="В начало"
                          >
                            <ChevronsLeft className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveToEnd(i)}
                            className="rounded bg-black/50 p-1 text-white hover:bg-black/60"
                            title="В конец"
                          >
                            <ChevronsRight className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeAt(i)}
                            className="rounded bg-black/50 p-1 text-white hover:bg-red-600/80"
                            title="Удалить"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* имя файла снизу */}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1">
                        <div className="truncate text-xs text-white drop-shadow">
                          {p.name}
                        </div>
                      </div>
                    </motion.li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Drop-зона «в конец» */}
          <DropEdge
            visible={dragging}
            label="Отпустить здесь — в конец"
            onDrop={() => onDropToEdge('end')}
          />

          {error && (
            <div className="mt-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}

          <div className="mt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700"
              disabled={busy}
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={submit}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-60"
              disabled={busy}
            >
              {busy ? 'Загрузка…' : 'Загрузить'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ===================== Drop-зона края ===================== */
function DropEdge({
  visible,
  label,
  onDrop,
}: {
  visible: boolean;
  label: string;
  onDrop: () => void;
}) {
  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.div
          className="mb-3 grid place-items-center rounded-lg border border-dashed border-sky-500/50 bg-sky-500/10 px-3 py-2 text-xs text-sky-200"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            onDrop();
          }}
        >
          {label}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
