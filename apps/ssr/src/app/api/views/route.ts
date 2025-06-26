import { eq, sql } from 'drizzle-orm'
import type { NextRequest } from 'next/server'

import { guardDbEnabled } from '~/lib/api-guard'
import { views } from '~/schemas'

import { DbManager } from '../../../lib/db'
import { ViewDto } from './dto'

export const runtime = 'edge'
export const POST = guardDbEnabled(async (req: NextRequest) => {
  const { refKey } = ViewDto.parse(await req.json())

  const db = DbManager.shared.getDb()
  await db
    .update(views)
    .set({
      views: sql`${views.views} + 1`,
    })
    .where(eq(views.refKey, refKey))
})
