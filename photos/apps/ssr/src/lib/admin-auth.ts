import crypto from 'node:crypto'

import { cookies } from 'next/headers'

const SALT = 'afilmory-admin-salt'
const COOKIE_NAME = 'admin_session'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(`${SALT}:${password}`).digest('hex')
}

export async function setAdminCookie(): Promise<void> {
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) return
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, hashPassword(adminPassword), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  })
}

export async function clearAdminCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

export async function verifyAdmin(): Promise<boolean> {
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) return false
  const cookieStore = await cookies()
  const session = cookieStore.get(COOKIE_NAME)
  if (!session?.value) return false
  return session.value === hashPassword(adminPassword)
}

export async function requireAdmin(): Promise<Response | null> {
  const isAdmin = await verifyAdmin()
  if (!isAdmin) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}
