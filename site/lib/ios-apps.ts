import crypto from 'node:crypto'

export interface IosApp {
  slug: string
  appName: string
  bundleId: string
  version: string
  build: string
  ipaKey: string
  iconKey: string | null
  sizeBytes: number
  uploadedAt: string
}

export interface AppsManifest {
  version: 1
  apps: IosApp[]
}

export function slugify(input: string): string {
  const s = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return s || 'app'
}

/** Keep-latest: replace any entry with the same slug, else append. Pure. */
export function upsertAppEntry(manifest: AppsManifest, app: IosApp): AppsManifest {
  const others = manifest.apps.filter((a) => a.slug !== app.slug)
  return { version: 1, apps: [...others, app] }
}

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** itms-services install manifest. `iconUrl` null → omit image assets. Pure. */
export function buildInstallPlist(app: IosApp, ipaUrl: string, iconUrl: string | null): string {
  const imageAssets = iconUrl
    ? `
        <dict>
          <key>kind</key><string>display-image</string>
          <key>url</key><string>${xmlEscape(iconUrl)}</string>
        </dict>
        <dict>
          <key>kind</key><string>full-size-image</string>
          <key>url</key><string>${xmlEscape(iconUrl)}</string>
        </dict>`
    : ''
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>items</key>
  <array>
    <dict>
      <key>assets</key>
      <array>
        <dict>
          <key>kind</key><string>software-package</string>
          <key>url</key><string>${xmlEscape(ipaUrl)}</string>
        </dict>${imageAssets}
      </array>
      <key>metadata</key>
      <dict>
        <key>bundle-identifier</key><string>${xmlEscape(app.bundleId)}</string>
        <key>bundle-version</key><string>${xmlEscape(app.version)}</string>
        <key>kind</key><string>software</string>
        <key>title</key><string>${xmlEscape(app.appName)}</string>
      </dict>
    </dict>
  </array>
</dict>
</plist>
`
}

/** Timing-safe Bearer check. Pure (takes the header + expected token). */
export function bearerTokenMatches(authHeader: string | null, expected: string): boolean {
  if (!expected || !authHeader || !authHeader.startsWith('Bearer ')) return false
  // Hash both sides to a fixed 32-byte digest so timingSafeEqual always sees
  // equal-length buffers and the secret's length doesn't leak via timing.
  const got = crypto.createHash('sha256').update(authHeader.slice(7)).digest()
  const want = crypto.createHash('sha256').update(expected).digest()
  return crypto.timingSafeEqual(got, want)
}
