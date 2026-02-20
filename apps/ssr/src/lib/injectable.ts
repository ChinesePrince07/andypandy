import siteConfig from '@config'
import type { AfilmoryManifest } from '@afilmory/typing'
import type { DOMParser } from 'linkedom'

type HtmlElement = ReturnType<typeof DOMParser.prototype.parseFromString>
type OnlyHTMLDocument = HtmlElement extends infer T ? (T extends { [key: string]: any; head: any } ? T : never) : never
export const injectConfigToDocument = (document: OnlyHTMLDocument) => {
  const $config = document.head.querySelector('#config')
  const injectConfigBase = {
    useApi: false,
    useNext: true,
  }
  if ($config) {
    $config.innerHTML = `window.__CONFIG__ = ${JSON.stringify(injectConfigBase)};window.__SITE_CONFIG__ = ${JSON.stringify(siteConfig)};`
  }
  return document
}

export const injectManifestToDocument = (document: OnlyHTMLDocument, manifest: AfilmoryManifest) => {
  const $manifest = document.head.querySelector('#manifest')
  if ($manifest) {
    $manifest.innerHTML = `window.__MANIFEST__ = ${JSON.stringify(manifest)};`
  }
  return document
}

export const injectAdminButton = (document: OnlyHTMLDocument) => {
  const body = document.body || document.querySelector('body')
  if (body) {
    const div = document.createElement('div')
    div.setAttribute('id', 'admin-fab')
    div.innerHTML = `<a href="/admin" style="position:fixed;bottom:20px;right:20px;z-index:9999;background:rgba(255,255,255,0.9);color:#000;padding:8px 16px;border-radius:8px;font-size:13px;font-weight:500;text-decoration:none;box-shadow:0 2px 10px rgba(0,0,0,0.3);backdrop-filter:blur(8px)">Admin</a>`
    body.appendChild(div)
  }
  return document
}
