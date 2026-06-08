import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const precheck = async () => {
  // Manifest is now managed via Vercel Blob and injected at runtime by SSR.
  // Just verify the placeholder manifest file exists so Vite can build.
  const manifestPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/data/photos-manifest.json')
  if (fs.existsSync(manifestPath)) {
    console.log('Manifest file exists, skipping builder (managed via Vercel Blob)')
    return
  }

  // Create empty manifest if missing
  fs.writeFileSync(manifestPath, JSON.stringify({ version: 'v10', data: [], cameras: [], lenses: [] }, null, 2))
  console.log('Created empty manifest placeholder')
}
