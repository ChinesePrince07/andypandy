import { createEnv } from '@t3-oss/env-nextjs'
import { z } from 'zod'

export const env = createEnv({
  server: {
    ADMIN_PASSWORD: z.string().min(1).optional(),
    BLOB_READ_WRITE_TOKEN: z.string().min(1).optional(),
    DEPLOY_HOOK: z.string().url().optional(),
  },
  runtimeEnv: {
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
    DEPLOY_HOOK: process.env.DEPLOY_HOOK,
  },
})
