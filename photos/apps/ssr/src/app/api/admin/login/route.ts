import type { NextRequest } from 'next/server'

import { setAdminCookie } from '~/lib/admin-auth'

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json()
    const adminPassword = process.env.ADMIN_PASSWORD

    if (!adminPassword || password !== adminPassword) {
      return Response.json({ error: 'Invalid password' }, { status: 401 })
    }

    await setAdminCookie()
    return Response.json({ success: true })
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 })
  }
}
