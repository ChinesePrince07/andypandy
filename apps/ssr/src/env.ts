import { createEnv } from '@t3-oss/env-nextjs'
import { z } from 'zod'

export const env = createEnv({
  server: {
    PG_CONNECTION_STRING: z.string().min(1).optional(),
    S3_ENDPOINT: z.string().min(1).optional(),
    S3_ACCESS_KEY_ID: z.string().min(1).optional(),
    S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    S3_BUCKET_NAME: z.string().min(1).optional(),
    ADMIN_PASSWORD: z.string().min(1).optional(),
    DEPLOY_HOOK: z.string().url().optional(),
  },
  runtimeEnv: {
    PG_CONNECTION_STRING: process.env.PG_CONNECTION_STRING,
    S3_ENDPOINT: process.env.S3_ENDPOINT,
    S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
    S3_BUCKET_NAME: process.env.S3_BUCKET_NAME,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    DEPLOY_HOOK: process.env.DEPLOY_HOOK,
  },
})
