# OTA Signed iOS App Distribution — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a remote-iOS-dev loop: a one-command Mac script archives + ad-hoc-signs an Xcode app and uploads it; andypandy.org/apps (admin-gated) lists the current build with an over-the-air **Install** button that installs it on the provisioned iPhone.

**Architecture:** The Mac does what only a Mac can — `xcodebuild archive`/`-exportArchive` produces a signed `.ipa` (the `.p12` never leaves the Mac). The script uploads `.ipa` + optional icon to R2 via presigned PUT and registers metadata in `apps/manifest.json`. The personal-site (Next app router) serves a public `itms-services` `manifest.plist` and an admin-gated listing page. All R2 work reuses `site/lib/r2-storage.ts`.

**Tech Stack:** Next.js 15 app router (route handlers + server components), TypeScript, `@aws-sdk` via existing `site/lib/r2-storage.ts`, Cloudflare R2 (shared bucket, `apps/` prefix), vitest (added to `site/` in Task 1), bash + xcodebuild on the Mac.

**Spec:** `docs/superpowers/specs/2026-06-13-ota-ios-app-distribution-design.md`

**Repo:** `/home/andy/andypandy`. Site workspace: `/home/andy/andypandy/site` (npm; `node_modules` already installed; tsconfig alias `@/* → ./*`). Run site commands from `/home/andy/andypandy/site`.

**Grounding facts the executor must know:**
- `site/lib/r2-storage.ts` exports: `r2Get`, `r2GetText(key): Promise<string|null>`, `r2Put(key, body, contentType?)`, `r2Delete`, `r2Exists`, `r2PublicUrl(key): string` (uses `R2_PUBLIC_BASE_URL`, which IS set on personal-site → returns absolute `https://…` URLs), `r2Client`, `R2_BUCKET`, `r2PresignedGet`. Bucket is shared with afilmory (`afilmory-photos`); we use the `apps/` prefix.
- Presigned **PUT** pattern (copy from `site/app/api/admin/r2-upload/route.ts`): `getSignedUrl(s3, new PutObjectCommand({Bucket, Key, ContentType}), {expiresIn})`. The R2 client already sets `requestChecksumCalculation: "WHEN_REQUIRED"` so presigned PUTs with only `Content-Type` work.
- `site/lib/admin-auth.ts`: `isAdmin()` (cookie session) for pages; `isAdminRequest(req)` (bearer==`ADMIN_PASSWORD`/`PUBLISH_SECRET`, or cookie). We add a SEPARATE `IOS_UPLOAD_TOKEN` for the upload/register endpoints (least-privilege — the Mac script never needs the full admin credential).
- Admin pages do `const admin = await isAdmin(); if (!admin) redirect("/admin");` then `export const dynamic = "force-dynamic"`. There is no `app/admin/layout.tsx`. Admin nav lives in `app/admin/post-list.tsx` under `{/* Quick links */}` (a `<Link href="/admin/r2-photos">`).
- Apple profile facts: ad-hoc, Team `VCKAK49A49`, fixed App ID `nsk-596.v-team.cn`, one provisioned device, expires 2026-11-08.
- Vercel: team `team_1nvmFqAXPpwGfovRmk6JRLgp`, project `personal-site`. Token at `/home/andy/.local/share/com.vercel.cli/auth.json` (refresh with `npx -y vercel@latest whoami` if `invalidToken`). Set env via `POST /v10/projects/personal-site/env?teamId=…&upsert=true` with `{key,value,type:"encrypted",target:["production","preview","development"]}`. NEVER print the token.
- Deploys are git-push only (CLEANUP RULE from memory: never `vercel deploy` site/afilmory from CLI). personal-site Root Directory is `site`.

---

## File structure

- `site/lib/ios-apps.ts` — **pure + R2-backed** app-catalog module. Pure (unit-tested): `slugify`, `upsertAppEntry`, `buildInstallPlist`, `bearerTokenMatches`. R2-backed: `readAppsManifest`, `writeAppsManifest`, `getApp`.
- `site/lib/ios-apps.test.ts` — vitest unit tests for the pure functions.
- `site/vitest.config.ts` — vitest config with `@` alias (site has none yet).
- `site/app/api/admin/ios/upload/route.ts` — POST: `IOS_UPLOAD_TOKEN` auth → presigned PUT URLs for `apps/<slug>/App.ipa` + `apps/<slug>/icon.png`.
- `site/app/api/admin/ios/register/route.ts` — POST: `IOS_UPLOAD_TOKEN` auth → upsert metadata into `apps/manifest.json`.
- `site/app/api/ios/[slug]/manifest.plist/route.ts` — GET, **public** → itms-services plist XML.
- `site/app/apps/page.tsx` — admin-gated listing page with Install button.
- `site/app/admin/post-list.tsx` — add an "iOS Apps" quick link (modify).
- `tools/deploy-ios.sh` — the Mac build+sign+upload script (reference copy in the repo; runs on the Mac).
- `tools/README-deploy-ios.md` — one-time Mac setup + usage.

Data shapes (defined in Task 1, used everywhere):

```ts
export interface IosApp {
  slug: string
  appName: string
  bundleId: string
  version: string   // CFBundleShortVersionString
  build: string     // CFBundleVersion
  ipaKey: string    // R2 key, e.g. apps/<slug>/App.ipa
  iconKey: string | null
  sizeBytes: number
  uploadedAt: string // ISO
}
export interface AppsManifest {
  version: 1
  apps: IosApp[]
}
```

---

### Task 1: Pure core in `lib/ios-apps.ts` (TDD)

**Files:**
- Create: `site/vitest.config.ts`
- Create: `site/lib/ios-apps.ts`
- Create: `site/lib/ios-apps.test.ts`
- Modify: `site/package.json` (add vitest devDep + `"test"` script)

- [ ] **Step 1: Add vitest to the site workspace**

```bash
cd /home/andy/andypandy/site && npm install -D vitest@^3
```

Then add to `site/package.json` `"scripts"`: `"test": "vitest run"`.

- [ ] **Step 2: Create the vitest config**

Create `site/vitest.config.ts`:

```ts
import path from 'node:path'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  test: { environment: 'node' },
})
```

- [ ] **Step 3: Write the failing tests**

Create `site/lib/ios-apps.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { bearerTokenMatches, buildInstallPlist, slugify, upsertAppEntry, type IosApp } from './ios-apps'

function app(overrides: Partial<IosApp> = {}): IosApp {
  return {
    slug: 'andy-swiss-knife',
    appName: 'Andy Swiss Knife',
    bundleId: 'nsk-596.v-team.cn',
    version: '1.2.0',
    build: '42',
    ipaKey: 'apps/andy-swiss-knife/App.ipa',
    iconKey: 'apps/andy-swiss-knife/icon.png',
    sizeBytes: 1234,
    uploadedAt: '2026-06-13T00:00:00.000Z',
    ...overrides,
  }
}

describe('slugify', () => {
  it('lowercases, hyphenates, strips junk', () => {
    expect(slugify('Andy Swiss Knife!')).toBe('andy-swiss-knife')
    expect(slugify('  My__App  ')).toBe('my-app')
  })
  it('falls back to "app" for empty input', () => {
    expect(slugify('***')).toBe('app')
  })
})

describe('upsertAppEntry (keep-latest, one entry per slug)', () => {
  it('adds a new app', () => {
    const m = upsertAppEntry({ version: 1, apps: [] }, app())
    expect(m.apps).toHaveLength(1)
    expect(m.apps[0].slug).toBe('andy-swiss-knife')
  })
  it('replaces the existing entry with the same slug', () => {
    const first = upsertAppEntry({ version: 1, apps: [] }, app({ build: '1' }))
    const second = upsertAppEntry(first, app({ build: '2', appName: 'Renamed' }))
    expect(second.apps).toHaveLength(1)
    expect(second.apps[0].build).toBe('2')
    expect(second.apps[0].appName).toBe('Renamed')
  })
  it('does not mutate the input manifest', () => {
    const input = { version: 1 as const, apps: [] }
    upsertAppEntry(input, app())
    expect(input.apps).toHaveLength(0)
  })
})

describe('buildInstallPlist', () => {
  it('produces a software-package asset pointing at the ipa url', () => {
    const xml = buildInstallPlist(app(), 'https://r2.example/App.ipa', 'https://r2.example/icon.png')
    expect(xml).toContain('<string>software-package</string>')
    expect(xml).toContain('<string>https://r2.example/App.ipa</string>')
    expect(xml).toContain('<key>bundle-identifier</key>')
    expect(xml).toContain('<string>nsk-596.v-team.cn</string>')
    expect(xml).toContain('<string>1.2.0</string>')
    expect(xml).toContain('<string>display-image</string>')
    expect(xml.startsWith('<?xml')).toBe(true)
  })
  it('omits image assets when no icon url', () => {
    const xml = buildInstallPlist(app({ iconKey: null }), 'https://r2.example/App.ipa', null)
    expect(xml).not.toContain('display-image')
    expect(xml).toContain('software-package')
  })
  it('xml-escapes the title', () => {
    const xml = buildInstallPlist(app({ appName: 'A & B <X>' }), 'https://r2.example/App.ipa', null)
    expect(xml).toContain('A &amp; B &lt;X&gt;')
  })
})

describe('bearerTokenMatches', () => {
  it('matches a correct Bearer token', () => {
    expect(bearerTokenMatches('Bearer s3cret', 's3cret')).toBe(true)
  })
  it('rejects wrong/missing/empty', () => {
    expect(bearerTokenMatches('Bearer nope', 's3cret')).toBe(false)
    expect(bearerTokenMatches(null, 's3cret')).toBe(false)
    expect(bearerTokenMatches('Bearer x', '')).toBe(false)
  })
})
```

- [ ] **Step 4: Run the tests, verify they fail**

```bash
cd /home/andy/andypandy/site && npx vitest run lib/ios-apps.test.ts
```

Expected: FAIL — `Cannot find module './ios-apps'`.

- [ ] **Step 5: Implement the pure core**

Create `site/lib/ios-apps.ts`:

```ts
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
  const got = Buffer.from(authHeader.slice(7))
  const want = Buffer.from(expected)
  if (got.length !== want.length) return false
  return crypto.timingSafeEqual(got, want)
}
```

- [ ] **Step 6: Run the tests, verify they pass**

```bash
cd /home/andy/andypandy/site && npx vitest run lib/ios-apps.test.ts
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
cd /home/andy/andypandy
git add site/vitest.config.ts site/lib/ios-apps.ts site/lib/ios-apps.test.ts site/package.json site/package-lock.json
git commit -m "site: ios-apps pure core (plist, slug, upsert, auth) + vitest

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: R2-backed catalog helpers in `lib/ios-apps.ts`

**Files:**
- Modify: `site/lib/ios-apps.ts` (append R2 functions)

- [ ] **Step 1: Append the R2-backed helpers**

Add to the TOP imports of `site/lib/ios-apps.ts`:

```ts
import { r2GetText, r2Put } from './r2-storage'
```

Append at the END of `site/lib/ios-apps.ts`:

```ts
const APPS_MANIFEST_KEY = 'apps/manifest.json'

const EMPTY_MANIFEST: AppsManifest = { version: 1, apps: [] }

/** Read the apps catalog from R2; empty manifest if absent or unparseable. */
export async function readAppsManifest(): Promise<AppsManifest> {
  const text = await r2GetText(APPS_MANIFEST_KEY)
  if (!text) return { ...EMPTY_MANIFEST, apps: [] }
  try {
    const parsed = JSON.parse(text) as AppsManifest
    if (!parsed || !Array.isArray(parsed.apps)) return { ...EMPTY_MANIFEST, apps: [] }
    return parsed
  } catch {
    return { ...EMPTY_MANIFEST, apps: [] }
  }
}

/** Write the apps catalog to R2 (no-store JSON). */
export async function writeAppsManifest(manifest: AppsManifest): Promise<void> {
  await r2Put(APPS_MANIFEST_KEY, JSON.stringify(manifest), 'application/json')
}

/** Look up a single app by slug. */
export async function getApp(slug: string): Promise<IosApp | null> {
  const manifest = await readAppsManifest()
  return manifest.apps.find((a) => a.slug === slug) ?? null
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /home/andy/andypandy/site && ./node_modules/.bin/tsc --noEmit 2>&1 | grep -i "ios-apps"
```

Expected: no output (no type errors in `ios-apps.ts`). Re-run `npx vitest run lib/ios-apps.test.ts` → still passing (pure tests unaffected).

- [ ] **Step 3: Commit**

```bash
cd /home/andy/andypandy
git add site/lib/ios-apps.ts
git commit -m "site: R2-backed ios apps catalog (read/write/get)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Upload presign endpoint

**Files:**
- Create: `site/app/api/admin/ios/upload/route.ts`

- [ ] **Step 1: Implement the route**

Create `site/app/api/admin/ios/upload/route.ts`:

```ts
import { NextRequest } from 'next/server'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

import { r2Client as s3, R2_BUCKET as BUCKET } from '@/lib/r2-storage'
import { bearerTokenMatches, slugify } from '@/lib/ios-apps'

export const dynamic = 'force-dynamic'

const TOKEN = (process.env.IOS_UPLOAD_TOKEN || '').trim()

export async function POST(req: NextRequest) {
  if (!bearerTokenMatches(req.headers.get('authorization'), TOKEN)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { slug?: string; ipaContentType?: string; iconContentType?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const slug = slugify(body.slug || '')
  if (!body.slug) {
    return Response.json({ error: 'Missing slug' }, { status: 400 })
  }

  const ipaKey = `apps/${slug}/App.ipa`
  const iconKey = `apps/${slug}/icon.png`

  const ipaUploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: BUCKET, Key: ipaKey, ContentType: body.ipaContentType || 'application/octet-stream' }),
    { expiresIn: 900 },
  )
  const iconUploadUrl = body.iconContentType
    ? await getSignedUrl(
        s3,
        new PutObjectCommand({ Bucket: BUCKET, Key: iconKey, ContentType: body.iconContentType }),
        { expiresIn: 900 },
      )
    : null

  return Response.json({ slug, ipaKey, iconKey, ipaUploadUrl, iconUploadUrl })
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /home/andy/andypandy/site && ./node_modules/.bin/tsc --noEmit 2>&1 | grep -i "ios/upload"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd /home/andy/andypandy
git add site/app/api/admin/ios/upload/route.ts
git commit -m "site: POST /api/admin/ios/upload presigned PUT endpoint

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Register endpoint

**Files:**
- Create: `site/app/api/admin/ios/register/route.ts`

- [ ] **Step 1: Implement the route**

Create `site/app/api/admin/ios/register/route.ts`:

```ts
import { NextRequest } from 'next/server'

import { bearerTokenMatches, readAppsManifest, slugify, upsertAppEntry, writeAppsManifest, type IosApp } from '@/lib/ios-apps'

export const dynamic = 'force-dynamic'

const TOKEN = (process.env.IOS_UPLOAD_TOKEN || '').trim()

export async function POST(req: NextRequest) {
  if (!bearerTokenMatches(req.headers.get('authorization'), TOKEN)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Partial<IosApp> & { hasIcon?: boolean }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const required = ['slug', 'appName', 'bundleId', 'version', 'build'] as const
  for (const field of required) {
    if (typeof body[field] !== 'string' || !body[field]) {
      return Response.json({ error: `Missing field: ${field}` }, { status: 400 })
    }
  }

  const slug = slugify(body.slug as string)
  const app: IosApp = {
    slug,
    appName: body.appName as string,
    bundleId: body.bundleId as string,
    version: body.version as string,
    build: body.build as string,
    ipaKey: `apps/${slug}/App.ipa`,
    iconKey: body.hasIcon ? `apps/${slug}/icon.png` : null,
    sizeBytes: typeof body.sizeBytes === 'number' ? body.sizeBytes : 0,
    uploadedAt: new Date().toISOString(),
  }

  const manifest = await readAppsManifest()
  await writeAppsManifest(upsertAppEntry(manifest, app))

  return Response.json({ ok: true, slug })
}

// DELETE ?slug=… — remove an app from the catalog (e.g. retire a build).
export async function DELETE(req: NextRequest) {
  if (!bearerTokenMatches(req.headers.get('authorization'), TOKEN)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const slug = slugify(new URL(req.url).searchParams.get('slug') || '')
  const manifest = await readAppsManifest()
  await writeAppsManifest({ version: 1, apps: manifest.apps.filter((a) => a.slug !== slug) })
  return Response.json({ ok: true, removed: slug })
}
```

The DELETE handler needs `slugify` imported — update the import line at the top of the file to:

```ts
import { bearerTokenMatches, readAppsManifest, slugify, upsertAppEntry, writeAppsManifest, type IosApp } from '@/lib/ios-apps'
```

(It is already in the import list above — confirm `slugify` is present.)

- [ ] **Step 2: Typecheck**

```bash
cd /home/andy/andypandy/site && ./node_modules/.bin/tsc --noEmit 2>&1 | grep -i "ios/register"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd /home/andy/andypandy
git add site/app/api/admin/ios/register/route.ts
git commit -m "site: /api/admin/ios/register upsert + delete apps manifest

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Public manifest.plist endpoint

**Files:**
- Create: `site/app/api/ios/[slug]/manifest.plist/route.ts`

Note: the folder name literally contains a dot (`manifest.plist`) so the route serves at `/api/ios/<slug>/manifest.plist` — iOS expects a `.plist` URL. **Public** (no auth): iOS's install daemon fetches it without the admin cookie.

- [ ] **Step 1: Implement the route**

Create `site/app/api/ios/[slug]/manifest.plist/route.ts`:

```ts
import { buildInstallPlist, getApp } from '@/lib/ios-apps'
import { r2PublicUrl } from '@/lib/r2-storage'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const app = await getApp(slug)
  if (!app) {
    return new Response('Not found', { status: 404 })
  }

  const ipaUrl = r2PublicUrl(app.ipaKey)
  const iconUrl = app.iconKey ? r2PublicUrl(app.iconKey) : null
  const xml = buildInstallPlist(app, ipaUrl, iconUrl)

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'no-store',
    },
  })
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /home/andy/andypandy/site && ./node_modules/.bin/tsc --noEmit 2>&1 | grep -i "manifest.plist"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd /home/andy/andypandy
git add "site/app/api/ios/[slug]/manifest.plist/route.ts"
git commit -m "site: public GET /api/ios/[slug]/manifest.plist (itms-services)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Admin /apps listing page + nav link

**Files:**
- Create: `site/app/apps/page.tsx`
- Modify: `site/app/admin/post-list.tsx` (add quick link)

- [ ] **Step 1: Create the page**

Create `site/app/apps/page.tsx` (admin-gated server component, matching the `isAdmin()→redirect` pattern):

```tsx
import { isAdmin } from '@/lib/admin-auth'
import { redirect } from 'next/navigation'

import { readAppsManifest } from '@/lib/ios-apps'
import { r2PublicUrl } from '@/lib/r2-storage'

export const dynamic = 'force-dynamic'

function formatSize(bytes: number): string {
  if (!bytes) return ''
  const mb = bytes / (1024 * 1024)
  return `${mb.toFixed(1)} MB`
}

export default async function AppsPage() {
  const admin = await isAdmin()
  if (!admin) redirect('/admin')

  const { apps } = await readAppsManifest()
  const sorted = [...apps].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold mb-2">iOS Apps</h1>
      <p className="text-sm text-gray-500 mb-8">
        Install on your provisioned iPhone. Open this page in Safari on the device, then tap Install.
      </p>

      {sorted.length === 0 ? (
        <p className="text-sm text-gray-500">No builds yet. Run <code>deploy-ios.sh</code> on your Mac.</p>
      ) : (
        <ul className="space-y-4">
          {sorted.map((app) => {
            const installUrl = `itms-services://?action=download-manifest&url=https://andypandy.org/api/ios/${app.slug}/manifest.plist`
            return (
              <li key={app.slug} className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                <div className="flex items-center gap-3">
                  {app.iconKey && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r2PublicUrl(app.iconKey)} alt="" className="h-12 w-12 rounded-lg" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{app.appName}</p>
                    <p className="text-xs text-gray-500">
                      v{app.version} ({app.build}) · {formatSize(app.sizeBytes)} ·{' '}
                      {new Date(app.uploadedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <a
                    href={installUrl}
                    className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
                  >
                    Install
                  </a>
                  <a href={r2PublicUrl(app.ipaKey)} className="text-sm text-gray-500 hover:text-gray-800">
                    Download .ipa
                  </a>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add the admin nav link**

In `site/app/admin/post-list.tsx`, inside the `{/* Quick links */}` `<div className="flex gap-3 mb-8">`, after the existing `Upload Photos` `<Link>`, add:

```tsx
        <Link
          href="/apps"
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          iOS Apps
        </Link>
```

(Confirm `Link` is already imported in that file — it is, used by the existing quick link.)

- [ ] **Step 3: Typecheck**

```bash
cd /home/andy/andypandy/site && ./node_modules/.bin/tsc --noEmit 2>&1 | grep -iE "apps/page|post-list"
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
cd /home/andy/andypandy
git add site/app/apps/page.tsx site/app/admin/post-list.tsx
git commit -m "site: admin /apps install page + nav link

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Mac build+sign+upload script

**Files:**
- Create: `tools/deploy-ios.sh`
- Create: `tools/README-deploy-ios.md`

These run on the **Mac**, not in CI; our only local check is `bash -n` (syntax). The script fails fast (`set -euo pipefail`). Icon is OPTIONAL (modern asset catalogs compile icons into `Assets.car`; rather than parse that, the script uploads an icon only if `ICON_PATH` points to a PNG). Build/version are READ from the built app (no fragile project mutation); if the user wants the OTA to register as an update they bump the version in Xcode.

- [ ] **Step 1: Write the script**

Create `tools/deploy-ios.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

# One-command: archive + ad-hoc-sign an Xcode app and publish it to
# andypandy.org/apps for OTA install. RUN ON THE MAC. See README-deploy-ios.md.
#
# Required env: IOS_UPLOAD_TOKEN
# Common overrides (env): PROJECT or WORKSPACE, SCHEME, SLUG, APP_TITLE,
#   PROFILE_NAME, ICON_PATH, SITE, DRY_RUN=1

SITE="${SITE:-https://andypandy.org}"
BUNDLE_ID="${BUNDLE_ID:-nsk-596.v-team.cn}"
TEAM_ID="${TEAM_ID:-VCKAK49A49}"
PROFILE_NAME="${PROFILE_NAME:-cert}"          # the provisioning profile's Name
SCHEME="${SCHEME:?set SCHEME to your Xcode scheme}"
SLUG="${SLUG:-$(echo "$SCHEME" | tr '[:upper:] ' '[:lower:]-')}"
APP_TITLE="${APP_TITLE:-$SCHEME}"
DRY_RUN="${DRY_RUN:-0}"
: "${IOS_UPLOAD_TOKEN:?set IOS_UPLOAD_TOKEN (matches the Vercel env)}"

# Project vs workspace flag
if [[ -n "${WORKSPACE:-}" ]]; then
  XCODE_TARGET=(-workspace "$WORKSPACE")
elif [[ -n "${PROJECT:-}" ]]; then
  XCODE_TARGET=(-project "$PROJECT")
else
  # auto-detect a single .xcodeproj / .xcworkspace in cwd
  if ls ./*.xcworkspace >/dev/null 2>&1; then
    XCODE_TARGET=(-workspace "$(ls -d ./*.xcworkspace | head -1)")
  else
    XCODE_TARGET=(-project "$(ls -d ./*.xcodeproj | head -1)")
  fi
fi

WORK="$(mktemp -d)"
ARCHIVE="$WORK/app.xcarchive"
EXPORT_DIR="$WORK/export"
mkdir -p "$EXPORT_DIR"

echo "==> Archiving $SCHEME (bundle id forced to $BUNDLE_ID)…"
xcodebuild "${XCODE_TARGET[@]}" -scheme "$SCHEME" -configuration Release \
  -archivePath "$ARCHIVE" -destination 'generic/platform=iOS' \
  -allowProvisioningUpdates=NO \
  PRODUCT_BUNDLE_IDENTIFIER="$BUNDLE_ID" \
  archive

cat > "$EXPORT_DIR/ExportOptions.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key><string>release-testing</string>
  <key>signingStyle</key><string>manual</string>
  <key>teamID</key><string>$TEAM_ID</string>
  <key>stripSwiftSymbols</key><true/>
  <key>compileBitcode</key><false/>
  <key>provisioningProfiles</key>
  <dict>
    <key>$BUNDLE_ID</key><string>$PROFILE_NAME</string>
  </dict>
</dict>
</plist>
PLIST

echo "==> Exporting signed .ipa…"
xcodebuild -exportArchive -archivePath "$ARCHIVE" \
  -exportPath "$EXPORT_DIR" -exportOptionsPlist "$EXPORT_DIR/ExportOptions.plist"

IPA="$(ls "$EXPORT_DIR"/*.ipa | head -1)"
APP_DIR="$(ls -d "$ARCHIVE"/Products/Applications/*.app | head -1)"
INFO_PLIST="$APP_DIR/Info.plist"
VERSION="$(/usr/libexec/PlistBuddy -c 'Print CFBundleShortVersionString' "$INFO_PLIST")"
BUILD="$(/usr/libexec/PlistBuddy -c 'Print CFBundleVersion' "$INFO_PLIST")"
SIZE="$(stat -f%z "$IPA")"

HAS_ICON=false
if [[ -n "${ICON_PATH:-}" && -f "$ICON_PATH" ]]; then HAS_ICON=true; fi

echo "==> Built: $APP_TITLE v$VERSION ($BUILD), $((SIZE/1024/1024)) MB, slug=$SLUG, icon=$HAS_ICON"
echo "    ipa: $IPA"

if [[ "$DRY_RUN" == "1" ]]; then
  echo "==> DRY_RUN=1 — not uploading."
  exit 0
fi

echo "==> Requesting upload URLs…"
ICON_CT='null'
if $HAS_ICON; then ICON_CT='"image/png"'; fi
PRESIGN="$(curl -fsS -X POST "$SITE/api/admin/ios/upload" \
  -H "Authorization: Bearer $IOS_UPLOAD_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"slug\":\"$SLUG\",\"ipaContentType\":\"application/octet-stream\",\"iconContentType\":$ICON_CT}")"

IPA_URL="$(echo "$PRESIGN" | /usr/bin/python3 -c 'import sys,json;print(json.load(sys.stdin)["ipaUploadUrl"])')"
ICON_URL="$(echo "$PRESIGN" | /usr/bin/python3 -c 'import sys,json;print(json.load(sys.stdin).get("iconUploadUrl") or "")')"

echo "==> Uploading .ipa…"
curl -fsS -X PUT "$IPA_URL" -H 'Content-Type: application/octet-stream' --data-binary @"$IPA" >/dev/null

if $HAS_ICON && [[ -n "$ICON_URL" ]]; then
  echo "==> Uploading icon…"
  curl -fsS -X PUT "$ICON_URL" -H 'Content-Type: image/png' --data-binary @"$ICON_PATH" >/dev/null
fi

echo "==> Registering build…"
curl -fsS -X POST "$SITE/api/admin/ios/register" \
  -H "Authorization: Bearer $IOS_UPLOAD_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"slug\":\"$SLUG\",\"appName\":\"$APP_TITLE\",\"bundleId\":\"$BUNDLE_ID\",\"version\":\"$VERSION\",\"build\":\"$BUILD\",\"sizeBytes\":$SIZE,\"hasIcon\":$HAS_ICON}" >/dev/null

echo "==> Done. Install at: $SITE/apps  (open in Safari on your iPhone)"
```

- [ ] **Step 2: Syntax check + make executable**

```bash
cd /home/andy/andypandy && bash -n tools/deploy-ios.sh && chmod +x tools/deploy-ios.sh && echo "syntax OK"
```

Expected: `syntax OK`.

- [ ] **Step 3: Write the README**

Create `tools/README-deploy-ios.md`:

```markdown
# deploy-ios.sh — OTA publish for andypandy.org/apps

Builds, ad-hoc-signs, and publishes an Xcode app so it installs over-the-air
on the provisioned iPhone. **Runs on the Mac.**

## One-time setup

1. Import the signing identity into your login keychain:
   `security import /path/to/cert.p12 -k ~/Library/Keychains/login.keychain-db -P '<p12 password>' -T /usr/bin/codesign`
2. Install the provisioning profile (double-click the `.mobileprovision`, or
   copy it into `~/Library/MobileDevice/Provisioning Profiles/`). Note its
   **Name** (decode with `security cms -D -i cert.mobileprovision`); pass it as
   `PROFILE_NAME` if it isn't `cert`.
3. Set the upload token (same value as the Vercel `IOS_UPLOAD_TOKEN` env):
   `export IOS_UPLOAD_TOKEN='…'` (put it in your shell profile).

## Usage

From the Xcode project directory:

```bash
SCHEME='Andy-Swiss-Knife' APP_TITLE='Andy Swiss Knife' ./deploy-ios.sh
```

- `DRY_RUN=1` — build + print, no upload.
- `ICON_PATH=/path/to/icon-512.png` — attach an icon to the install prompt.
- `WORKSPACE=App.xcworkspace` or `PROJECT=App.xcodeproj` — if auto-detect picks wrong.
- `SLUG=…` — override the URL slug (default: lowercased scheme).

Then open `https://andypandy.org/apps` in **Safari on the iPhone** and tap
**Install**. Only the provisioned device can install. The signing key never
leaves your Mac.

## Notes
- The app is rebranded to bundle id `nsk-596.v-team.cn` (the profile's App ID).
  Only one app at a time lives under this profile — a new publish replaces the
  previous app on the phone.
- Profile expires 2026-11-08: re-export it and re-import, no code change.
```

- [ ] **Step 4: Commit**

```bash
cd /home/andy/andypandy
git add tools/deploy-ios.sh tools/README-deploy-ios.md
git commit -m "tools: deploy-ios.sh Mac build+sign+publish script + README

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Env, deploy, and end-to-end verification

- [ ] **Step 1: Generate and set `IOS_UPLOAD_TOKEN` on personal-site**

```bash
TOKEN=$(python3 -c "import json;print(json.load(open('/home/andy/.local/share/com.vercel.cli/auth.json'))['token'])")
TEAM=team_1nvmFqAXPpwGfovRmk6JRLgp
SECRET=$(python3 -c "import secrets;print(secrets.token_urlsafe(32))")
curl -s -X POST "https://api.vercel.com/v10/projects/personal-site/env?teamId=$TEAM&upsert=true" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"key\":\"IOS_UPLOAD_TOKEN\",\"value\":\"$SECRET\",\"type\":\"encrypted\",\"target\":[\"production\",\"preview\",\"development\"]}" \
  | python3 -c "import json,sys;d=json.load(sys.stdin);print('set:', d.get('key', d.get('error')))"
# Print ONCE so the user can put it in their Mac shell profile, then forget it:
echo "IOS_UPLOAD_TOKEN=$SECRET"
```

Give the user that value to `export IOS_UPLOAD_TOKEN=…` on the Mac. (If the call returns `invalidToken`, run `npx -y vercel@latest whoami` and retry.)

- [ ] **Step 2: Full site build**

```bash
cd /home/andy/andypandy/site && ./node_modules/.bin/tsc --noEmit 2>&1 | grep -iE "ios|apps" || echo "no ios/apps type errors"
npx vitest run lib/ios-apps.test.ts
npm run build 2>&1 | tail -8
```

Expected: no ios/apps type errors; vitest green; `next build` exits 0 with the new routes listed (`/apps`, `/api/admin/ios/upload`, `/api/admin/ios/register`, `/api/ios/[slug]/manifest.plist`).

- [ ] **Step 3: Push (triggers the personal-site git deploy)**

```bash
cd /home/andy/andypandy && git push origin main
```

- [ ] **Step 4: Wait for the personal-site deployment to be READY**

Poll `GET https://api.vercel.com/v6/deployments?teamId=$TEAM&app=personal-site&limit=1` until `readyState=READY`. If `ERROR`, fetch `GET /v3/deployments/{id}/events?builds=1&limit=-1`, fix, repeat.

- [ ] **Step 5: End-to-end verify with a synthetic build (no Mac needed)**

Simulate the Mac script against production using the token from Step 1:

```bash
TOK="<the IOS_UPLOAD_TOKEN from step 1>"
SITE=https://andypandy.org
# 1) presign
P=$(curl -fsS -X POST "$SITE/api/admin/ios/upload" -H "Authorization: Bearer $TOK" \
  -H 'Content-Type: application/json' \
  -d '{"slug":"selftest","ipaContentType":"application/octet-stream"}')
echo "$P"
IPA_URL=$(echo "$P" | python3 -c 'import sys,json;print(json.load(sys.stdin)["ipaUploadUrl"])')
# 2) put a dummy ipa
head -c 2048 /dev/urandom > /tmp/selftest.ipa
curl -fsS -X PUT "$IPA_URL" -H 'Content-Type: application/octet-stream' --data-binary @/tmp/selftest.ipa
# 3) register
curl -fsS -X POST "$SITE/api/admin/ios/register" -H "Authorization: Bearer $TOK" \
  -H 'Content-Type: application/json' \
  -d '{"slug":"selftest","appName":"Self Test","bundleId":"nsk-596.v-team.cn","version":"0.0.1","build":"1","sizeBytes":2048,"hasIcon":false}'
# 4) public plist is valid + points at the ipa
curl -fsS "$SITE/api/ios/selftest/manifest.plist" | head -20
# 5) auth is enforced
curl -s -o /dev/null -w "no-auth upload => %{http_code}\n" -X POST "$SITE/api/admin/ios/upload" -d '{}'
```

Expected: presign returns URLs; PUT 200; register `{"ok":true}`; the plist is valid XML containing `software-package` and the ipa URL; unauthorized upload returns `401`.

- [ ] **Step 6: Confirm the admin page lists it (and is gated)**

```bash
curl -s -o /dev/null -w "anon /apps => %{http_code} (expect 307 redirect to /admin)\n" https://andypandy.org/apps
```

Then the user opens https://andypandy.org/apps logged in and sees "Self Test".

- [ ] **Step 7: Clean up the self-test entry**

Remove the `selftest` entry via the DELETE handler from Task 4:

```bash
curl -fsS -X DELETE "https://andypandy.org/api/admin/ios/register?slug=selftest" \
  -H "Authorization: Bearer $TOK" | python3 -m json.tool
# confirm gone:
curl -s -o /dev/null -w "selftest plist => %{http_code} (expect 404)\n" https://andypandy.org/api/ios/selftest/manifest.plist
```

Expected: `{"ok": true, "removed": "selftest"}` then `404`. (The dummy `apps/selftest/App.ipa` R2 object is orphaned but harmless — unreferenced and unguessable; leave it.)

- [ ] **Step 8: Report + memory**

Report to the user: the `IOS_UPLOAD_TOKEN` value (once), the Mac one-time setup steps, and the publish command. Update `/home/andy/.claude/projects/-home-andy/memory/andypandy-migration-gotchas.md` with: andypandy.org/apps OTA flow, `IOS_UPLOAD_TOKEN` env, R2 `apps/` prefix + `apps/manifest.json`, ad-hoc profile bundle id `nsk-596.v-team.cn` / expiry 2026-11-08, and that builds run on the Mac via `tools/deploy-ios.sh`.

---

## Notes for the executor

- **Order:** Tasks 1–7 are local commits; nothing deploys until Task 8's push. Task 8 Step 1 (set env) must happen before Step 5 (E2E uses the token), but can run any time before the push.
- **Auth model:** upload/register use `IOS_UPLOAD_TOKEN` (bearer); the `/apps` page uses the admin cookie (`isAdmin`); the `manifest.plist` + `.ipa` are public (iOS install daemon has no cookie). This split is intentional — don't "tighten" the plist/ipa or OTA install breaks.
- **The `.ipa` is publicly downloadable** at an unguessable R2 key; only the provisioned device can install. Accepted in the spec.
- **No `vercel deploy`** for personal-site — git push only (clobbers Root Directory otherwise; see memory).
- **The build genuinely needs a Mac.** Task 8's E2E uses a dummy `.ipa` to exercise the server path end-to-end without a Mac; the real install is the user's acceptance test on the iPhone. The dummy is registered under slug `selftest` and removed via the DELETE handler in Step 7, so the catalog ends clean.
