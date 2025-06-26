import { readFileSync } from 'node:fs'
import path from 'node:path'

import type { Plugin } from 'vite'

const dirname = path.dirname(new URL(import.meta.url).pathname)
export function manifestInjectPlugin(): Plugin {
  // 定位到 manifest 文件的实际位置
  const manifestPath = path.resolve(
    dirname,
    '../../packages/data/src/photos-manifest.json',
  )

  function getManifestContent(): string {
    try {
      const content = readFileSync(manifestPath, 'utf-8')
      return content
    } catch (error) {
      console.warn('Failed to read manifest file:', error)
      return '{}'
    }
  }

  return {
    name: 'manifest-inject',

    configureServer(server) {
      // 监听 manifest 文件变化
      server.watcher.add(manifestPath)

      server.watcher.on('change', (file) => {
        if (file === manifestPath) {
          console.info(
            '[manifest-inject] Manifest file changed, triggering HMR...',
          )
          // 触发页面重新加载
          server.ws.send({
            type: 'full-reload',
          })
        }
      })
    },

    transformIndexHtml(html) {
      const manifestContent = getManifestContent()

      // 将 manifest 内容注入到 script#manifest 标签中
      const scriptContent = `window.__MANIFEST__ = ${manifestContent};`

      return html.replace(
        '<script id="manifest"></script>',
        `<script id="manifest">${scriptContent}</script>`,
      )
    },
  }
}
