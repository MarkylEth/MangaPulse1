// lib/auth/route-guards.ts
import { NextRequest } from 'next/server'
import { query } from '@/lib/db'

/** Унифицированно получаем UUID текущего юзера */
export async function getViewerId(req: NextRequest): Promise<string | null> {
  // 1) DEV-заголовок (мы его будем слать с фронта)
  const hdr = req.headers.get('x-user-id')?.trim()
  if (hdr && /^[0-9a-f-]{32,36}$/i.test(hdr)) return hdr

  // 2) (необязательно) взять из cookie, если ты её где-то ставишь
  try {
    const { cookies } = await import('next/headers')
    const c = cookies().get('x-user-id')?.value
    if (c && /^[0-9a-f-]{32,36}$/i.test(c)) return c
  } catch {}

  return null
}

export async function getAuthUser(req: NextRequest): Promise<{ id: string } | null> {
  const id = await getViewerId(req)
  return id ? { id } : null
}

export async function requireViewer(req: NextRequest) {
  const id = await getViewerId(req)
  if (!id) throw new Error('UNAUTHORIZED')
  return id
}

/** Небольшой хелпер, если нужно подтянуть профиль */
export async function getViewerProfile(userId: string) {
  const r = await query<{ id: string; username: string | null; avatar_url: string | null }>(
    'select id, username, avatar_url from profiles where id=$1',
    [userId]
  )
  return r.rows[0] ?? null
}
