'use client';

import { useEffect, useRef, useState } from 'react';
import { Bold, Italic, Underline, Strikethrough } from 'lucide-react';

type Item = { id: string; user_id: string | null; content: string; created_at: string };

export default function PageComments({ pageId }: { pageId: number | string | undefined }) {
  if (pageId === undefined || pageId === null || String(pageId).trim() === '') return null;

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const editorRef = useRef<HTMLDivElement | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  async function load() {
    try {
      setLoading(true);
      const r = await fetch(`/api/pages/${encodeURIComponent(String(pageId))}/comments?limit=200`, { cache: 'no-store' });
      const j = await r.json().catch(() => ({}));
      setItems((j.items ?? []) as Item[]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [pageId]);

  const updateEmpty = () => {
    const plain = editorRef.current?.textContent?.replace(/\u00a0/g, ' ').trim() ?? '';
    setIsEmpty(!plain);
  };

  function exec(cmd: 'bold'|'italic'|'underline'|'strikeThrough') {
    document.execCommand(cmd);
    editorRef.current?.focus();
  }

  function trySend() {
    alert('Добавление комментариев временно отключено до внедрения кастомной авторизации.');
  }

  return (
    <section className="rounded-2xl border border-black/10 dark:border-white/10 bg-transparent">
      <h3 className="px-4 pt-4 text-lg font-semibold">Комментарии к странице</h3>

      {/* Панель + редактор — неактивные (read-only) */}
      <div className="mx-4 my-3 rounded-xl bg-slate-900 text-slate-100 p-3">
        <div className="mb-2 flex gap-2 flex-wrap">
          <button onClick={() => exec('bold')} disabled className="px-3 py-1 rounded bg-white/10 inline-flex items-center gap-2 opacity-50">
            <Bold className="w-4 h-4" /><span>Жирный</span>
          </button>
          <button onClick={() => exec('italic')} disabled className="px-3 py-1 rounded bg-white/10 inline-flex items-center gap-2 opacity-50">
            <Italic className="w-4 h-4" /><span>Курсив</span>
          </button>
          <button onClick={() => exec('underline')} disabled className="px-3 py-1 rounded bg-white/10 inline-flex items-center gap-2 opacity-50">
            <Underline className="w-4 h-4" /><span>Подчёркнуть</span>
          </button>
          <button onClick={() => exec('strikeThrough')} disabled className="px-3 py-1 rounded bg-white/10 inline-flex items-center gap-2 opacity-50">
            <Strikethrough className="w-4 h-4" /><span>Зачеркнуть</span>
          </button>
        </div>

        <div className="relative">
          {isEmpty && (
            <span className="pointer-events-none absolute left-3 top-3 text-sm text-slate-400">
              Добавление комментариев временно отключено
            </span>
          )}
          <div
            ref={editorRef}
            role="textbox"
            aria-label="Поле ввода комментария"
            contentEditable={false}
            suppressContentEditableWarning
            className="min-h-[64px] rounded-lg bg-slate-800/30 p-3 outline-none cursor-not-allowed"
            onInput={updateEmpty}
          />
        </div>

        <div className="mt-2 flex justify-end">
          <button
            onClick={trySend}
            className="px-4 py-2 rounded bg-indigo-500 opacity-60 cursor-not-allowed"
            disabled
          >
            Отправить
          </button>
        </div>
      </div>

      {/* Список */}
      <div className="px-4 pb-4 space-y-5">
        {loading && <div className="text-sm opacity-70">Загрузка…</div>}
        {!loading && items.length === 0 && <div className="text-sm opacity-70">Пока нет комментариев — будьте первым!</div>}
        {items.map(m => (
          <div key={m.id} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs opacity-60">
                {new Date(m.created_at).toLocaleString('ru-RU', { hour12: false })}
              </div>
              <div className="mt-1 text-[15px] leading-relaxed break-words prose-invert"
                   dangerouslySetInnerHTML={{ __html: m.content }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
