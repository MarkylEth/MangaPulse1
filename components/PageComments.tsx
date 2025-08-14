'use client';

import { useEffect, useRef, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import { Bold, Italic, Underline, Strikethrough, Trash2 } from 'lucide-react';

type Item = { id: string; user_id: string | null; content: string; created_at: string };

function sanitize(html: string) {
  let out = (html || '').replace(/&nbsp;/gi, ' ');
  // оставляем только допустимые теги форматирования
  out = out.replace(/<(?!\/?(?:b|i|u|s|strong|em|br)\b)[^>]*>/gi, '');
  // удаляем пустые теги
  out = out.replace(/<(?:b|i|u|s|strong|em)>\s*<\/(?:b|i|u|s|strong|em)>/gi, '');
  // схлопываем множественные <br>
  out = out.replace(/(?:<br\s*\/?>\s*){3,}/gi, '<br><br>');
  return out.trim();
}

async function safePostJSON(url: string, body: any) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  if (!r.ok) throw new Error((data && data.error) || text || `HTTP ${r.status}`);
  return data;
}

export default function PageComments({ pageId }: { pageId: number | string | undefined }) {
  if (pageId === undefined || pageId === null || String(pageId).trim() === '') return null;

  const supabase = getSupabaseBrowser();

  const [me, setMe] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [sending, setSending] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);

  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setMe(data?.user?.id ?? null);
    })();
  }, [supabase]);

  async function load() {
    const r = await fetch(`/api/page-comments?pageId=${encodeURIComponent(String(pageId))}&limit=200`, { cache: 'no-store' });
    const j = await r.json();
    setItems((j.items ?? []) as Item[]);
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

  async function send() {
    if (sending) return;
    const plain = editorRef.current?.textContent?.replace(/\u00a0/g, ' ').trim() ?? '';
    if (!plain) { alert('Введите текст комментария'); return; }

    const html = sanitize(editorRef.current?.innerHTML ?? '');
    if (!html) { alert('Введите текст комментария'); return; }

    setSending(true);
    try {
      const j = await safePostJSON('/api/page-comments', { pageId, content: html });

      const { data } = await supabase.auth.getUser();
      setItems(prev => [
        // в “списковом” режиме добавляем в конец и перезагружаем (как на второй фотке)
        ...prev,
        { id: j.id, user_id: data?.user?.id ?? null, content: html, created_at: new Date().toISOString() },
      ]);

      if (editorRef.current) editorRef.current.innerHTML = '';
      setIsEmpty(true);
    } catch (e: any) {
      alert(e?.message || 'Не удалось отправить');
    } finally {
      setSending(false);
      // чтобы порядок был как у тебя на скрине, обновим с сервера
      load();
    }
  }

  async function removeItem(id: string) {
    if (!confirm('Удалить комментарий?')) return;
    const r = await fetch(`/api/page-comments`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ id }),
    });
    const t = await r.text();
    if (!r.ok) return alert(t || `HTTP ${r.status}`);
    setItems(prev => prev.filter(x => x.id !== id));
  }

  return (
    <section className="rounded-2xl border border-black/10 dark:border-white/10 bg-transparent">
      <h3 className="px-4 pt-4 text-lg font-semibold">Комментарии к странице</h3>

      {/* Панель + редактор — один тёмный блок */}
      <div className="mx-4 my-3 rounded-xl bg-slate-900 text-slate-100 p-3">
        <div className="mb-2 flex gap-2 flex-wrap">
          <button onClick={() => exec('bold')} className="px-3 py-1 rounded bg-white/10 hover:bg-white/15 inline-flex items-center gap-2">
            <Bold className="w-4 h-4" /><span>Жирный</span>
          </button>
          <button onClick={() => exec('italic')} className="px-3 py-1 rounded bg-white/10 hover:bg-white/15 inline-flex items-center gap-2">
            <Italic className="w-4 h-4" /><span>Курсив</span>
          </button>
          <button onClick={() => exec('underline')} className="px-3 py-1 rounded bg-white/10 hover:bg-white/15 inline-flex items-center gap-2">
            <Underline className="w-4 h-4" /><span>Подчёркнуть</span>
          </button>
          <button onClick={() => exec('strikeThrough')} className="px-3 py-1 rounded bg-white/10 hover:bg-white/15 inline-flex items-center gap-2">
            <Strikethrough className="w-4 h-4" /><span>Зачеркнуть</span>
          </button>
          
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
              const text = (e.clipboardData || (window as any).clipboardData).getData('text/plain');
              document.execCommand('insertText', false, text);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
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
            {sending ? 'Отправка…' : 'Отправить'}
          </button>
        </div>
      </div>

      {/* Список как на 2-й картинке: левый текст, время слева, удалить справа */}
      <div className="px-4 pb-4 space-y-5">
        {items.length === 0 && <div className="text-sm opacity-70">Пока нет комментариев — будьте первым!</div>}
        {items.map(m => (
          <div key={m.id} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs opacity-60">
                {new Date(m.created_at).toLocaleString('ru-RU', { hour12: false })}
              </div>
              <div className="mt-1 text-[15px] leading-relaxed break-words prose-invert"
                   dangerouslySetInnerHTML={{ __html: m.content }} />
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
