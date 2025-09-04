// lib/auth/route-guards.ts - ОБНОВЛЕННАЯ ВЕРСИЯ
import { NextRequest } from 'next/server'
import { query } from '@/lib/db'

/** Унифицированно получаем UUID текущего юзера */
export async function getViewerId(req: NextRequest): Promise<string | null> {
  try {
    // 1) DEV-заголовок (основной способ для развития)
    const hdr = req.headers.get('x-user-id')?.trim()
    if (hdr && isValidUUID(hdr)) {
      console.log('User ID from header:', hdr)
      return hdr
    }

    // 2) Попробуем получить из cookie (если используется)
    try {
      const { cookies } = await import('next/headers')
      const cookieStore = await cookies()
      const cookieValue = cookieStore.get('x-user-id')?.value?.trim()
      if (cookieValue && isValidUUID(cookieValue)) {
        console.log('User ID from cookie:', cookieValue)
        return cookieValue
      }
    } catch (cookieError) {
      // Игнорируем ошибки cookies в dev-среде
      console.warn('Cookie access failed:', cookieError)
    }

    // 3) Попробуем получить из сессии (если есть auth система)
    try {
      // Здесь можно добавить интеграцию с вашей системой аутентификации
      // const session = await getServerSession(req)
      // if (session?.user?.id) return session.user.id
    } catch (authError) {
      console.warn('Auth check failed:', authError)
    }

    console.log('No user ID found in request')
    return null

  } catch (error) {
    console.error('Error in getViewerId:', error)
    return null
  }
}

/** Проверяем валидность UUID */
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(uuid)
}

/** Совместимость со старым API */
export async function getAuthUser(req: NextRequest): Promise<{ id: string } | null> {
  const id = await getViewerId(req)
  return id ? { id } : null
}

/** Требует авторизованного пользователя */
export async function requireViewer(req: NextRequest): Promise<string> {
  const id = await getViewerId(req)
  if (!id) {
    throw new Error('UNAUTHORIZED: User ID is required')
  }
  return id
}

/** Получить профиль пользователя по ID */
export async function getViewerProfile(userId: string) {
  try {
    const r = await query<{ 
      id: string
      username: string | null
      avatar_url: string | null
      role: string | null
    }>(
      'SELECT id, username, avatar_url, role FROM profiles WHERE id = $1::uuid LIMIT 1',
      [userId]
    )
    return r.rows[0] ?? null
  } catch (error) {
    console.error('Error fetching viewer profile:', error)
    return null
  }
}

/** Проверить, является ли пользователь администратором */
export async function isUserAdmin(userId: string): Promise<boolean> {
  try {
    const profile = await getViewerProfile(userId)
    return profile?.role?.toLowerCase() === 'admin'
  } catch (error) {
    console.error('Error checking admin status:', error)
    return false
  }
}

/** Получить пользователя с проверкой прав */
export async function getAuthUserWithPermissions(req: NextRequest) {
  const userId = await getViewerId(req)
  if (!userId) return null

  const profile = await getViewerProfile(userId)
  if (!profile) return null

  return {
    id: userId,
    username: profile.username,
    avatar_url: profile.avatar_url,
    role: profile.role,
    isAdmin: profile.role?.toLowerCase() === 'admin'
  }
}