'use client'

import { useEffect, useMemo, useReducer, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { useTheme } from '@/lib/theme/context'
import { Header } from '@/components/Header'

/* ======================== Supabase ======================== */
const SUPABASE_TABLE = 'manga'
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/* ======================== Справочники ======================== */
const GENRES = [
  'Арт','Безумие','Боевик','Боевые искусства','Вампиры','Военное','Гарем','Гендерная интрига',
  'Героическое фэнтези','Демоны','Детектив','Дзёсэй','Драма','Игра','Исекай','История','Киберпанк',
  'Кодомо','Комедия','Космос','Магия','Махо-сёдзё','Машины','Меха','Мистика','Музыка',
  'Научная фантастика','Омегаверс','Пародия','Повседневность','Полиция','Постапокалиптика',
  'Приключения','Психология','Романтика','Самурайский боевик','Сверхъестественное',
  'Сёдзё','Сёнен','Спорт','Супер сила','Сэйнэн','Трагедия','Триллер','Ужасы',
  'Фантастика','Фэнтези','Школа','Эротика','Этти'
] as const

const TAGS = [
  'Азартные игры','Алхимия','Амнезия / Потеря памяти','Ангелы','Антигерой','Антиутопия','Апокалипсис',
  'Армия','Артефакты','Боги','Бои на мечах','Борьба за власть','Брат и сестра','Будущее','Ведьма',
  'Вестерн','Видеоигры','Виртуальная реальность','Владыка демонов','Военные','Война',
  'Волшебники / маги','Волшебные существа','Воспоминания из другого мира','Выживание',
  'ГГ женщина','ГГ имба','ГГ мужчина','Геймеры','Гильдии','ГГ глупый','Гоблины','Горничные',
  'Гуро','Гяру','Демоны','Драконы','Дружба','Жестокий мир','Животные компаньоны',
  'Завоевание мира','Зверолюди','Злые духи','Зомби','Игровые элементы','Империи','Исторические',
  'Камера','Квесты','Космос','Кулинария','Культивирование','ЛГБТ','Легендарное оружие','Лоли',
  'Магическая академия','Магия','Мафия','Медицина','Месть','Монстро-девушки','Монстры','Мурим',
  'На проверке','Навыки / способности','Наёмники','Насилие / жестокость','Нежить','Ниндзя',
  'Обмен телами','Обратный Гарем','Огнестрельное оружие','Офисные Работники','Пародия','Пираты',
  'Подземелья','Политика','Полиция','Полностью CGI','Преступники / Криминал','Призраки / Духи',
  'Путешествие во времени','Рабы','Разумные расы','Ранги силы','Регрессия','Реинкарнация','Роботы',
  'Рыцари','Самураи','Сгенерировано ИИ','Система','Скрытые личности','Содержит нецензурную брань',
  'Спасение мира','Спортивное тело','Средневековье','Стимпанк','Супергерои','Традиционные игры',
  'ГГ умный','Учитель','Фермерство','Философия','Хикикомори','Холодное оружие','Шантаж','Эльфы',
  'Якудза','Яндере','Япония'
] as const

const TYPES  = ['Манга','Манхва','Маньхуа'] as const
const AGE    = ['0+','12+','16+','18+'] as const
const TITLE_STATUS       = ['Онгоинг','Завершён','Пауза'] as const
const TRANSLATION_STATUS = ['Продолжается','Завершён','Заброшен'] as const
const FORMAT = ['4-кома','В цвете','Веб','Печать','Сборник','Сингл'] as const
const OTHER  = ['Не переведено','Лицензировано','Можно приобрести'] as const
const MY_LISTS = ['Читаю','В планах','Любимое','Брошено','Прочитано'] as const

/* ======================== Типы ======================== */
type OneOf<T extends readonly string[]> = T[number]
type Tri = 0 | 1 | -1
type Range = { min?: number; max?: number }

type MangaItem = {
  id: string
  title: string
  author: string
  type: OneOf<typeof TYPES>
  genres?: OneOf<typeof GENRES>[]
  tags?: OneOf<typeof TAGS>[]
  year: number
  chapters: number
  rating10: number
  age: OneOf<typeof AGE>
  titleStatus: OneOf<typeof TITLE_STATUS>
  translationStatus: OneOf<typeof TRANSLATION_STATUS>
  format: OneOf<typeof FORMAT>[]
  other?: OneOf<typeof OTHER>[]
  my?: OneOf<typeof MY_LISTS>[]
  views: number
  popularity: number
  dateAdded: string
  coverClass: string
  coverUrl?: string
}

/* ======================== Фильтры/редьюсер ======================== */
type FiltersState = {
  genresTri: Map<string, Tri>
  tagsTri: Map<string, Tri>
  genreStrict: boolean
  tagStrict: boolean
  type: Set<OneOf<typeof TYPES>>
  age: Set<OneOf<typeof AGE>>
  titleStatus: Set<OneOf<typeof TITLE_STATUS>>
  translationStatus: Set<OneOf<typeof TRANSLATION_STATUS>>
  format: Set<OneOf<typeof FORMAT>>
  other: Set<OneOf<typeof OTHER>>
  my: Set<OneOf<typeof MY_LISTS>>
  year: Range
  chapters: Range
  rating10: Range
  search: string
  sort: 'pop'|'rating'|'views'|'date'|'year'|'nameAZ'|'nameZA'
}

type Action =
  | { type: 'cycleTri'; field: 'genresTri' | 'tagsTri'; item: string }
  | { type: 'clearTri'; field: 'genresTri' | 'tagsTri' }
  | { type: 'setStrict'; field: 'genreStrict' | 'tagStrict'; value: boolean }
  | { type: 'toggleMulti'; field: keyof Pick<FiltersState,'type'|'age'|'titleStatus'|'translationStatus'|'format'|'other'|'my'>; value: string }
  | { type: 'setRange'; field: keyof Pick<FiltersState,'year'|'chapters'|'rating10'>; range: Range }
  | { type: 'setSearch'; value: string }
  | { type: 'setSort'; value: FiltersState['sort'] }
  | { type: 'reset' }

const initialState: FiltersState = {
  genresTri: new Map(), tagsTri: new Map(), genreStrict: false, tagStrict: false,
  type: new Set(), age: new Set(), titleStatus: new Set(), translationStatus: new Set(),
  format: new Set(), other: new Set(), my: new Set(),
  year: {}, chapters: {}, rating10: {},
  search: '', sort: 'pop'
}

function reducer(state: FiltersState, action: Action): FiltersState {
  switch (action.type) {
    case 'cycleTri': {
      const m = new Map(state[action.field])
      const prev = m.get(action.item) ?? 0
      const next: Tri = prev === 0 ? 1 : prev === 1 ? -1 : 0
      if (next === 0) m.delete(action.item); else m.set(action.item, next)
      return { ...state, [action.field]: m }
    }
    case 'clearTri': {
      const m = new Map(state[action.field]); m.clear()
      return { ...state, [action.field]: m }
    }
    case 'setStrict':     return { ...state, [action.field]: action.value }
    case 'toggleMulti': {
      const s = new Set(state[action.field] as Set<string>)
      if (s.has(action.value)) s.delete(action.value); else s.add(action.value)
      return { ...state, [action.field]: s } as FiltersState
    }
    case 'setRange':      return { ...state, [action.field]: { ...state[action.field], ...action.range } }
    case 'setSearch':     return { ...state, search: action.value }
    case 'setSort':       return { ...state, sort: action.value }
    case 'reset':         return initialState
    default:              return state
  }
}

function inRange(val: number, r: Range) {
  if (r.min !== undefined && val < r.min) return false
  if (r.max !== undefined && val > r.max) return false
  return true
}

function triToSets(tri: Map<string, Tri>) {
  const include = new Set<string>()
  const exclude = new Set<string>()
  tri.forEach((v,k) => { if (v===1) include.add(k); if (v===-1) exclude.add(k) })
  return { include, exclude }
}

// безопасная проверка (если у записи нет genres/tags — не отсекаем)
function matchTri(tri: Map<string, Tri>, values: string[] | undefined, strict: boolean) {
  const vals = values ?? []
  const { include, exclude } = triToSets(tri)
  for (const ex of exclude) if (vals.includes(ex)) return false
  if (include.size === 0) return true
  if (strict) { for (const inc of include) if (!vals.includes(inc)) return false; return true }
  return vals.some(v => include.has(v))
}

/* ======================== Помощники для обложки ======================== */
// Пытаемся вытащить URL из разных полей/форматов.
function resolveCoverUrl(input: any): string | undefined {
  if (!input) return undefined
  if (typeof input === 'string') {
    const s = input.trim()
    if (!s) return undefined
    if (/^https?:\/\//i.test(s)) return s
    // bucket:path или bucket/path
    const byColon = s.includes(':') ? s.split(':', 2) : null
    const bySlash = s.includes('/') ? s.split('/', 2) : null
    let bucket: string | undefined
    let path: string | undefined
    if (byColon && byColon[1]) { bucket = byColon[0]; path = byColon[1] }
    else if (bySlash && bySlash[1]) { bucket = bySlash[0]; path = bySlash.slice(1).join('/') }
    if (bucket && path) {
      const { data } = supabase.storage.from(bucket).getPublicUrl(path)
      return data.publicUrl
    }
    return undefined
  }
  if (typeof input === 'object') {
    if (typeof (input as any).url === 'string') return resolveCoverUrl((input as any).url)
    if (typeof (input as any).href === 'string') return resolveCoverUrl((input as any).href)
    if (typeof (input as any).path === 'string') {
      const bucket = (input as any).bucket || (input as any).bucketName
      if (bucket) {
        const { data } = supabase.storage.from(String(bucket)).getPublicUrl((input as any).path)
        return data.publicUrl
      }
      return resolveCoverUrl((input as any).path)
    }
  }
  return undefined
}

function fallbackGradient(seed: string) {
  const gradients = [
    'from-blue-500 to-blue-600',
    'from-orange-500 to-red-500',
    'from-purple-500 to-purple-600',
    'from-teal-500 to-cyan-500',
    'from-slate-600 to-slate-700',
    'from-red-500 to-pink-500'
  ]
  let h = 0
  for (let i=0; i<seed.length; i++) h = (h*31 + seed.charCodeAt(i)) >>> 0
  return gradients[h % gradients.length]
}

/* ======================== Нормализация данных из БД ======================== */
function asStrArray(x: any): string[] | undefined {
  if (x == null) return undefined
  if (Array.isArray(x)) return x.map(String)
  if (typeof x === 'string') return x.split(',').map(s => s.trim()).filter(Boolean)
  return [String(x)]
}
function mapTitleStatus(v: any): MangaItem['titleStatus'] {
  const s = String(v ?? '').toLowerCase()
  if (['ongoing','онгоинг','выпускается'].includes(s)) return 'Онгоинг'
  if (['completed','завершен','завершён','end'].includes(s)) return 'Завершён'
  if (['paused','пауза','hiatus'].includes(s)) return 'Пауза'
  return 'Онгоинг'
}
function mapTranslationStatus(v: any): MangaItem['translationStatus'] {
  const s = String(v ?? '').toLowerCase()
  if (['ongoing','продолжается'].includes(s)) return 'Продолжается'
  if (['completed','завершен','завершён'].includes(s)) return 'Завершён'
  if (['dropped','abandoned','заброшен','заброшено'].includes(s)) return 'Заброшен'
  return 'Продолжается'
}
function mapType(v: any): MangaItem['type'] {
  const s = String(v ?? '').toLowerCase()
  if (['манхва','manhwa'].includes(s)) return 'Манхва'
  if (['маньхуа','manhua'].includes(s)) return 'Маньхуа'
  return 'Манга'
}
function mapAge(v: any): MangaItem['age'] {
  const s = String(v ?? '').replace(/\s/g,'')
  if (['0+','0'].includes(s)) return '0+'
  if (['12+','12'].includes(s)) return '12+'
  if (['16+','16'].includes(s)) return '16+'
  if (['18+','18'].includes(s)) return '18+'
  return '12+'
}

function normalizeRow(row: any): MangaItem {
  const year = Number(row.year ?? new Date(row.date_added ?? row.created_at ?? Date.now()).getFullYear())
  const rating10 = typeof row.rating10 === 'number'
    ? row.rating10
    : typeof row.rating === 'number'
      ? Math.max(0, Math.min(10, row.rating * (row.rating <= 5 ? 2 : 1)))
      : 0

  const coverUrl =
    resolveCoverUrl(row.cover_url) ??
    resolveCoverUrl(row.cover) ??
    resolveCoverUrl(row.image) ??
    resolveCoverUrl(row.poster) ??
    resolveCoverUrl(row.thumbnail)

  return {
    id: String(row.id),
    title: String(row.title ?? 'Без названия'),
    author: String(row.author ?? 'Неизвестный автор'),
    type: mapType(row.type ?? row.kind),
    genres: asStrArray(row.genres) as any,
    tags: asStrArray(row.tags) as any,
    year,
    chapters: Number(row.chapters ?? row.chapters_count ?? 0),
    rating10,
    age: mapAge(row.age),
    titleStatus: mapTitleStatus(row.title_status ?? row.status),
    translationStatus: mapTranslationStatus(row.translation_status),
    format: (asStrArray(row.format) ?? ['Веб']) as any,
    other: asStrArray(row.other) as any,
    my: asStrArray(row.my) as any,
    views: Number(row.views ?? 0),
    popularity: Number(row.popularity ?? row.views ?? 0),
    dateAdded: String(row.date_added ?? row.created_at ?? new Date().toISOString()),
    coverClass: String(row.cover_class ?? fallbackGradient(String(row.id))),
    coverUrl
  }
}

/* ======================== Страница ======================== */
export default function CatalogPage() {
  const { theme } = useTheme()
  const mode: 'light' | 'dark' = theme === 'light' ? 'light' : 'dark'
  const textClass = mode === 'light' ? 'text-gray-900' : 'text-white'

  const [filters, dispatch] = useReducer(reducer, initialState)
  const [items, setItems] = useState<MangaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true); setError(null)
      const { data, error } = await supabase
        .from(SUPABASE_TABLE)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)

      if (cancelled) return
      if (error) { setError(error.message); setItems([]); setLoading(false); return }
      setItems((data ?? []).map(normalizeRow))
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  const data = useMemo(() => {
    const arr = items.filter(it => {
      if (filters.search) {
        const q = filters.search.toLowerCase()
        if (!(`${it.title} ${it.author}`.toLowerCase().includes(q))) return false
      }
      if (!matchTri(filters.genresTri, it.genres, filters.genreStrict)) return false
      if (!matchTri(filters.tagsTri, it.tags, filters.tagStrict)) return false
      if (filters.type.size && !filters.type.has(it.type)) return false
      if (filters.age.size && !filters.age.has(it.age)) return false
      if (filters.titleStatus.size && !filters.titleStatus.has(it.titleStatus)) return false
      if (filters.translationStatus.size && !filters.translationStatus.has(it.translationStatus)) return false
      if (filters.format.size && !it.format.some(f => filters.format.has(f))) return false
      if (filters.other.size && !it.other?.some(o => filters.other.has(o))) return false
      if (filters.my.size && !it.my?.some(o => filters.my.has(o))) return false
      if (!inRange(it.year, filters.year)) return false
      if (!inRange(it.chapters, filters.chapters)) return false
      if (!inRange(it.rating10, filters.rating10)) return false
      return true
    })

    switch (filters.sort) {
      case 'rating': arr.sort((a,b)=>b.rating10-a.rating10); break
      case 'views' : arr.sort((a,b)=>b.views-a.views); break
      case 'date'  : arr.sort((a,b)=>+new Date(b.dateAdded)-+new Date(a.dateAdded)); break
      case 'year'  : arr.sort((a,b)=>b.year-a.year); break
      case 'nameAZ': arr.sort((a,b)=>a.title.localeCompare(b.title)); break
      case 'nameZA': arr.sort((a,b)=>b.title.localeCompare(a.title)); break
      default      : arr.sort((a,b)=>b.popularity-a.popularity)
    }
    return arr
  }, [items, filters])

  return (
    <div className={`min-h-screen ${mode==='light'?'bg-gray-50':'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950'}`}>
      <Header showSearch={false} />

      <div className="flex max-w-7xl mx-auto gap-8 p-6">
        {/* Sidebar */}
        <aside className="w-80 flex-shrink-0">
          <div className={`${mode==='light'?'bg-white':'bg-slate-800/50'} rounded-xl p-4 mb-4 border ${mode==='light'?'border-gray-200':'border-slate-700'}`}>
            <input
              value={filters.search}
              onChange={(e)=>dispatch({type:'setSearch', value:e.target.value})}
              placeholder="Поиск по названию/автору…"
              className={`w-full rounded-lg border px-3 py-2 text-sm ${mode==='light'
                ? 'bg-white border-gray-300 text-gray-800 placeholder-gray-400'
                : 'bg-slate-900/60 border-slate-700 text-slate-200 placeholder-slate-500'}`}
            />
            <div className="mt-3">
              <label className={`block text-xs mb-1 ${mode==='light'?'text-gray-500':'text-slate-400'}`}>Сортировка</label>
              <select
                value={filters.sort}
                onChange={(e)=>dispatch({type:'setSort', value:e.target.value as FiltersState['sort']})}
                className={`w-full rounded-lg border px-3 py-2 text-sm ${mode==='light'
                  ? 'bg-white border-gray-300 text-gray-800'
                  : 'bg-slate-900/60 border-slate-700 text-slate-200'}`}
              >
                <option value="pop">По популярности</option>
                <option value="rating">По рейтингу</option>
                <option value="views">По просмотрам</option>
                <option value="date">По дате добавления</option>
                <option value="year">По году</option>
                <option value="nameAZ">По названию (А-Я)</option>
                <option value="nameZA">По названию (Я-А)</option>
              </select>
            </div>
          </div>

          <Section title="Жанры" theme={mode} defaultOpen={false} onReset={()=>dispatch({type:'clearTri', field:'genresTri'})}>
            {({close})=>(
              <>
                <TriList
                  items={GENRES}
                  tri={filters.genresTri}
                  onCycle={(item)=>dispatch({type:'cycleTri', field:'genresTri', item})}
                  theme={mode}
                  strict={filters.genreStrict}
                  onToggleStrict={(v)=>dispatch({type:'setStrict', field:'genreStrict', value:v})}
                />
                <div className="mt-3 flex gap-2">
                  <button onClick={()=>dispatch({type:'clearTri', field:'genresTri'})} className="px-3 py-2 text-sm rounded-lg border border-slate-600/40 hover:bg-slate-600/10">Сбросить</button>
                  <button onClick={close} className="px-3 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700">Выбрать</button>
                </div>
              </>
            )}
          </Section>

          <Section title="Теги" theme={mode} defaultOpen={false} onReset={()=>dispatch({type:'clearTri', field:'tagsTri'})}>
            {({close})=>(
              <>
                <TriList
                  items={TAGS}
                  tri={filters.tagsTri}
                  onCycle={(item)=>dispatch({type:'cycleTri', field:'tagsTri', item})}
                  theme={mode}
                  strict={filters.tagStrict}
                  onToggleStrict={(v)=>dispatch({type:'setStrict', field:'tagStrict', value:v})}
                />
                <div className="mt-3 flex gap-2">
                  <button onClick={()=>dispatch({type:'clearTri', field:'tagsTri'})} className="px-3 py-2 text-sm rounded-lg border border-slate-600/40 hover:bg-slate-600/10">Сбросить</button>
                  <button onClick={close} className="px-3 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700">Выбрать</button>
                </div>
              </>
            )}
          </Section>

          <Section title="Количество глав" theme={mode} defaultOpen>
            {() => (
              <RangeInputs
                value={filters.chapters}
                onChange={(r)=>dispatch({type:'setRange', field:'chapters', range:r})}
                placeholderMin="от, напр. 10"
                placeholderMax="до, напр. 200"
                theme={mode}
              />
            )}
          </Section>

          <Section title="Год релиза" theme={mode} defaultOpen>
            {() => (
              <RangeInputs
                value={filters.year}
                onChange={(r)=>dispatch({type:'setRange', field:'year', range:r})}
                placeholderMin="от, напр. 2010"
                placeholderMax="до, напр. 2025"
                theme={mode}
              />
            )}
          </Section>

          <Section title="Оценка (0–10)" theme={mode} defaultOpen>
            {() => (
              <RangeInputs
                value={filters.rating10}
                onChange={(r)=>dispatch({type:'setRange', field:'rating10', range:r})}
                placeholderMin="минимум"
                placeholderMax="максимум"
                theme={mode}
              />
            )}
          </Section>

          <Section title="Тип" theme={mode} defaultOpen>
            {() => (
              <MultiCheck
                items={TYPES}
                selected={filters.type as Set<any>}
                onToggle={(v)=>dispatch({type:'toggleMulti', field:'type', value:v})}
                theme={mode}
                columns={1}
              />
            )}
          </Section>

          <Section title="Возрастной рейтинг" theme={mode} defaultOpen>
            {() => (
              <MultiCheck
                items={AGE}
                selected={filters.age as Set<any>}
                onToggle={(v)=>dispatch({type:'toggleMulti', field:'age', value:v})}
                theme={mode}
                columns={4}
              />
            )}
          </Section>

          <Section title="Статус тайтла" theme={mode} defaultOpen>
            {() => (
              <MultiCheck
                items={TITLE_STATUS}
                selected={filters.titleStatus as Set<any>}
                onToggle={(v)=>dispatch({type:'toggleMulti', field:'titleStatus', value:v})}
                theme={mode}
                columns={1}
              />
            )}
          </Section>

          <Section title="Статус перевода" theme={mode} defaultOpen>
            {() => (
              <MultiCheck
                items={TRANSLATION_STATUS}
                selected={filters.translationStatus as Set<any>}
                onToggle={(v)=>dispatch({type:'toggleMulti', field:'translationStatus', value:v})}
                theme={mode}
                columns={1}
              />
            )}
          </Section>

          <Section title="Формат выпуска" theme={mode} defaultOpen>
            {() => (
              <MultiCheck
                items={FORMAT}
                selected={filters.format as Set<any>}
                onToggle={(v)=>dispatch({type:'toggleMulti', field:'format', value:v})}
                theme={mode}
                columns={3}
              />
            )}
          </Section>

          <Section title="Другое" theme={mode} defaultOpen>
            {() => (
              <MultiCheck
                items={OTHER}
                selected={filters.other as Set<any>}
                onToggle={(v)=>dispatch({type:'toggleMulti', field:'other', value:v})}
                theme={mode}
                columns={1}
              />
            )}
          </Section>

          <Section title="Мои списки" theme={mode} defaultOpen>
            {() => (
              <MultiCheck
                items={MY_LISTS}
                selected={filters.my as Set<any>}
                onToggle={(v)=>dispatch({type:'toggleMulti', field:'my', value:v})}
                theme={mode}
                columns={2}
              />
            )}
          </Section>

          <button
            onClick={()=>dispatch({type:'reset'})}
            className="w-full mt-2 rounded-lg border border-transparent bg-slate-600 text-white py-2.5 text-sm hover:opacity-90"
          >
            Сбросить всё
          </button>
        </aside>

        {/* Main */}
        <main className="flex-1">
          <div className="flex justify-between items-center mb-6">
            <h1 className={`text-3xl font-bold ${textClass}`}>Каталог</h1>
          </div>

          {loading && <div className={`${mode==='light'?'text-gray-600':'text-slate-400'}`}>Загрузка…</div>}
          {error && <div className="text-red-500">Ошибка загрузки: {error}</div>}

          {!loading && !error && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
              {data.map((manga) => (
                <article
                  key={manga.id}
                  className={`${mode==='light'?'bg-white':'bg-slate-800/50'} rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] border ${mode==='light'?'border-gray-200':'border-slate-700'}`}
                >
                  <Link href={`/manga/${manga.id}`} className="block">
                    <div className="relative w-full bg-slate-900/40 rounded-2xl overflow-hidden" style={{ aspectRatio: '2 / 3' }}>
                      {manga.coverUrl ? (
                        <Image
                          src={manga.coverUrl}
                          alt={manga.title}
                          fill
                          className="object-contain"
                          sizes="(min-width: 1536px) 300px, (min-width: 1280px) 260px, (min-width: 1024px) 25vw, 50vw"
                          priority={false}
                          quality={85}
                          unoptimized
                        />
                      ) : (
                        <div className={`absolute inset-0 bg-gradient-to-br ${manga.coverClass}`} />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                    </div>
                  </Link>

                  <div className="p-4">
                    <Link href={`/manga/${manga.id}`} className="hover:underline">
                      <h3 className={`font-semibold text-lg mb-1 ${textClass}`}>{manga.title}</h3>
                    </Link>
                    <p className={`${mode==='light'?'text-gray-600':'text-slate-400'} text-sm mb-3`}>{manga.author}</p>
                    <div className="flex flex-wrap gap-2 mb-3">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-500/10 border border-slate-500/20">{manga.titleStatus}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-500/10 border border-slate-500/20">{manga.translationStatus}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-500/10 border border-slate-500/20">{manga.year}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-500/10 border border-slate-500/20">{manga.chapters} гл.</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => {
                          const filled = i < Math.round(manga.rating10/2)
                          return <span key={i} className={`text-sm ${filled ? 'text-yellow-400' : 'text-gray-300'}`}>★</span>
                        })}
                        <span className={`${mode==='light'?'text-gray-600':'text-slate-400'} text-xs ml-1`}>{manga.rating10.toFixed(1)} / 10</span>
                      </div>
                      <Link
                        href={`/manga/${manga.id}`}
                        className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                      >
                        Читать
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
              {data.length === 0 && (
                <div className={`${mode==='light'?'text-gray-600':'text-slate-400'}`}>Ничего не найдено по заданным фильтрам.</div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

/* ======================== Мелкие UI-компоненты ======================== */
function Section({
  title, theme, defaultOpen = false, onReset, children
}: {
  title: string
  theme: 'light' | 'dark'
  defaultOpen?: boolean
  onReset?: () => void
  children: (controls: { close: () => void }) => React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={`${theme==='light'?'bg-white':'bg-slate-800/50'} rounded-xl border ${theme==='light'?'border-gray-200':'border-slate-700'} mb-4`}>
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={()=>setOpen(o=>!o)} className="font-semibold">
          <span className={theme==='light'?'text-gray-900':'text-white'}>{open ? '▾ ' : '▸ '}{title}</span>
        </button>
        {onReset && (
          <button onClick={onReset} className="text-xs opacity-70 hover:opacity-100">сбросить</button>
        )}
      </div>
      {open && <div className="px-4 pb-4">{children({ close: () => setOpen(false) })}</div>}
    </div>
  )
}

function TriList({
  items, tri, onCycle, theme, strict, onToggleStrict
}: {
  items: readonly string[]
  tri: Map<string, Tri>
  onCycle: (item: string) => void
  theme: 'light'|'dark'
  strict: boolean
  onToggleStrict: (v:boolean)=>void
}) {
  const [q, setQ] = useState('')
  const filtered = items.filter(i => i.toLowerCase().includes(q.toLowerCase()))
  const box = (v?: Tri) =>
    `size-4 rounded-sm border flex items-center justify-center text-[10px] leading-none
     ${v===1 ? 'border-emerald-500 bg-emerald-500/40' :
       v===-1 ? 'border-rose-500 bg-rose-500/40' :
       theme==='light' ? 'border-gray-300 bg-white' : 'border-slate-600 bg-slate-900/60'}`
  const labelColor = theme==='light'?'text-gray-700':'text-slate-300'
  const holder = theme==='light'
    ? 'bg-white border-gray-300 text-gray-800 placeholder-gray-400'
    : 'bg-slate-900/60 border-slate-700 text-slate-200 placeholder-slate-500'

  return (
    <>
      <input
        value={q}
        onChange={(e)=>setQ(e.target.value)}
        placeholder="Фильтр по списку…"
        className={`w-full rounded-lg border px-3 py-2 text-sm mb-3 ${holder}`}
      />

      <label className="flex items-center gap-2 mb-3 select-none">
        <input type="checkbox" className="accent-blue-600" checked={strict} onChange={(e)=>onToggleStrict(e.target.checked)} />
        <span className={labelColor}>Строгое совпадение</span>
        <span className="ml-auto text-[11px] opacity-60">Пусто → ✓ включить → ✕ исключить</span>
      </label>

      <div className="max-h-72 overflow-auto pr-1 space-y-1">
        {filtered.map((name)=> {
          const state = tri.get(name) ?? 0
          return (
            <button key={name} onClick={()=>onCycle(name)} className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-500/10 transition text-left">
              <span className={box(state)}>{state===1?'✓':state===-1?'✕':''}</span>
              <span className={`${labelColor} flex-1`}>{name}</span>
            </button>
          )
        })}
      </div>
    </>
  )
}

function MultiCheck<T extends string>({
  items, selected, onToggle, theme, columns = 3
}: {
  items: readonly T[]
  selected: Set<T>
  onToggle: (val: T) => void
  theme: 'light'|'dark'
  columns?: 1|2|3|4
}) {
  const labelColor = theme==='light' ? 'text-gray-700' : 'text-slate-300'
  const boxOff   = theme==='light' ? 'border-gray-300 bg-white' : 'border-slate-600 bg-slate-900/60'

  const colsClass = columns===1 ? 'grid-cols-1'
                  : columns===2 ? 'grid-cols-2'
                  : columns === 3 ? 'grid-cols-3'
                  : 'grid-cols-4'

  return (
    <div className={`grid ${colsClass} gap-2`}>
      {items.map((it)=> {
        const checked = selected.has(it)
        return (
          <label key={it} className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={checked}
              onChange={() => onToggle(it)}
              className="sr-only"
            />
            <span
              className={`size-4 rounded-sm border flex items-center justify-center text-[10px] leading-none
                ${checked ? 'border-blue-600 bg-blue-600 text-white' : boxOff}`}
            >
              {checked ? '✓' : ''}
            </span>
            <span className={labelColor}>{it}</span>
          </label>
        )
      })}
    </div>
  )
}

function RangeInputs({
  value, onChange, placeholderMin, placeholderMax, theme
}: {
  value: Range
  onChange: (r: Range) => void
  placeholderMin?: string
  placeholderMax?: string
  theme: 'light' | 'dark'
}) {
  const cls = theme==='light'
    ? 'bg-white border-gray-300 text-gray-800 placeholder-gray-400'
    : 'bg-slate-900/60 border-slate-700 text-slate-200 placeholder-slate-500'
  return (
    <div className="flex items-center gap-3">
      <input inputMode="numeric" className={`w-full rounded-lg border px-3 py-2 text-sm ${cls}`} placeholder={placeholderMin ?? 'от'} value={value.min ?? ''} onChange={(e)=>onChange({ min: e.target.value ? Number(e.target.value) : undefined })}/>
      <span className={theme==='light'?'text-gray-500':'text-slate-400'}>—</span>
      <input inputMode="numeric" className={`w-full rounded-lg border px-3 py-2 text-sm ${cls}`} placeholder={placeholderMax ?? 'до'} value={value.max ?? ''} onChange={(e)=>onChange({ max: e.target.value ? Number(e.target.value) : undefined })}/>
    </div>
  )
}
