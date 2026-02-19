import crypto from 'node:crypto'

import { cookies } from 'next/headers'

import { env } from '@env'

const SALT = 'afilmory-admin-salt'
const COOKIE_NAME = 'admin_session'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(`${SALT}:${password}`).digest('hex')
}

export async function setAdminCookie(): Promise<void> {
  if (!env.ADMIN_PASSWORD) return
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, hashPassword(env.ADMIN_PASSWORD), {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  })
}

export async function clearAdminCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

export async function verifyAdmin(): Promise<boolean> {
  if (!env.ADMIN_PASSWORD) return false
  const cookieStore = await cookies()
  const session = cookieStore.get(COOKIE_NAME)
  if (!session?.value) return false
  return session.value === hashPassword(env.ADMIN_PASSWORD)
}

export async function requireAdmin(): Promise<Response | null> {
  const isAdmin = await verifyAdmin()
  if (!isAdmin) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}
