import type { NextRequest } from 'next/server'

import { env } from '@env'
import { setAdminCookie } from '~/lib/admin-auth'

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json()

    if (!env.ADMIN_PASSWORD || password !== env.ADMIN_PASSWORD) {
      return Response.json({ error: 'Invalid password' }, { status: 401 })
    }

    await setAdminCookie()
    return Response.json({ success: true })
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 })
  }
}
