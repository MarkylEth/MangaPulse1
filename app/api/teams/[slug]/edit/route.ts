import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getViewerId } from '@/lib/auth/route-guards'
import { isTeamEditor, resolveTeamBySlug } from '../_utils'

type Params = { params: { slug: string } }

const isHttpUrl = (v: unknown): string | null => {
  const s = String(v ?? '').trim()
  if (!s) return null
  try {
    const u = new URL(s)
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.toString()
    return null
  } catch {
    return null
  }
}

const toStringOrNull = (v: unknown) => {
  const s = (v ?? '').toString().trim()
  return s.length ? s : null
}

const toBool = (v: unknown) => (typeof v === 'boolean' ? v : String(v ?? '').toLowerCase() === 'true')

const toTextArray = (v: unknown, { maxLen = 64, maxItems = 64 } = {}) => {
  const arr = Array.isArray(v) ? v : []
  const out: string[] = []
  for (const x of arr) {
    const s = String(x ?? '').trim()
    if (!s) continue
    out.push(s.slice(0, maxLen))
    if (out.length >= maxItems) break
  }
  return out
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const team = await resolveTeamBySlug(params.slug)
    if (!team) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    const uid = await getViewerId(req)
    if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const can = await isTeamEditor(team.id, uid)
    if (!can) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

    const body = await req.json().catch(() => ({} as any))

    // Собирам динамический апдейт
    const sets: string[] = []
    const paramsArr: any[] = []

    const pushSet = (sqlFragment: string, value: any) => {
      paramsArr.push(value)
      sets.push(sqlFragment.replace('?', `$${paramsArr.length}`))
    }

    // Разрешённые текстовые поля
    const name = toStringOrNull(body.name)
    if (name) pushSet('name = ?', name)

    const bio = toStringOrNull(body.bio)
    pushSet('bio = ?', bio) // допускаем null → очистка

    const hiring_text = toStringOrNull(body.hiring_text)
    pushSet('hiring_text = ?', hiring_text)

    // Даты
    const started_at_raw = toStringOrNull(body.started_at)
    if (started_at_raw) {
      // YYYY-MM-DD
      if (!/^\d{4}-\d{2}-\d{2}$/.test(started_at_raw)) {
        return NextResponse.json({ error: 'bad_started_at' }, { status: 400 })
      }
      pushSet('started_at = ?::date', started_at_raw)
    } else if (body.started_at === null) {
      pushSet('started_at = ?', null)
    }

    // Булева
    if (typeof body.hiring_enabled !== 'undefined') {
      pushSet('hiring_enabled = ?', toBool(body.hiring_enabled))
    }

    // Соцсети/URls
    const urlFields: Array<[keyof typeof body, string]> = [
      ['avatar_url', 'avatar_url'],
      ['banner_url', 'banner_url'],
      ['telegram_url', 'telegram_url'],
      ['vk_url', 'vk_url'],
      ['discord_url', 'discord_url'],
      ['boosty_url', 'boosty_url'],
    ]

    const invalid: string[] = []
    for (const [srcKey, col] of urlFields) {
      if (srcKey in body) {
        const norm = isHttpUrl(body[srcKey])
        if (body[srcKey] && !norm) invalid.push(col)
        pushSet(`${col} = ?`, norm) // null если пусто/некорректно
      }
    }
    if (invalid.length) {
      return NextResponse.json({ error: 'invalid_urls', fields: invalid }, { status: 400 })
    }

    // Массивы
    if ('tags' in body) {
      pushSet('tags = ?::text[]', toTextArray(body.tags))
    }
    if ('langs' in body) {
      pushSet('langs = ?::text[]', toTextArray(body.langs))
    }

    // Ничего не прислано
    if (sets.length === 0) {
      return NextResponse.json({ error: 'empty_patch' }, { status: 400 })
    }

    // updated_at
    sets.push('updated_at = now()')

    // Выполняем UPDATE
    paramsArr.push(team.id)
    const sql = `update translator_teams set ${sets.join(', ')} where id = $${paramsArr.length} returning *`
    const updated = await query(sql, paramsArr)

    return NextResponse.json({ ok: true, team: updated.rows[0] })
  } catch (e) {
    console.error('team edit PATCH error', e)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
