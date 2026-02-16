import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { $ } from 'execa'

export const precheck = async () => {
  if (process.env.SKIP_MANIFEST_BUILD) {
    const manifestPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/data/photos-manifest.json')
    if (fs.existsSync(manifestPath)) {
      console.log('Skipping manifest build (SKIP_MANIFEST_BUILD is set)')
      return
    }
  }

  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const workdir = path.resolve(__dirname, '../../..')

  await $({
    cwd: workdir,
    stdio: 'inherit',
  })`pnpm --filter @afilmory/builder cli`
}
