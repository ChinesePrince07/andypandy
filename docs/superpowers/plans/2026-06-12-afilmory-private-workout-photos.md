# Afilmory Private Workout Photos + Deploy Pipeline Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair the afilmory Vercel project's broken git-deploy pipeline, then add private (`isHidden`) workout-progress photos: hidden from public visitors, visible to the logged-in admin in the gallery and on a new `/admin/workout` timeline page.

**Architecture:** The afilmory SSR app (Next.js, `photos/apps/ssr`) injects a runtime manifest from R2 into every HTML response. ALL public exposure of the manifest flows through `getManifestSafe()` in `apps/ssr/src/lib/manifest.ts` — we make that function filter out `isHidden` photos unless `verifyAdmin()` is true. Admin API routes use `getManifest()` (unfiltered) and are untouched by filtering. A shared `manifest-view.ts` module holds the pure filter + the `rebuildCameras`/`rebuildLenses` helpers currently duplicated in two routes.

**Tech Stack:** Next.js 15 app router (route handlers), pnpm workspace monorepo, Cloudflare R2, Vercel REST API (token at `/home/andy/.local/share/com.vercel.cli/auth.json`), vitest (added in Task 4) for the one pure function.

**Spec:** `docs/superpowers/specs/2026-06-12-afilmory-private-workout-photos-design.md`

**Repo:** `/home/andy/andypandy` (run all git/pnpm commands from there unless stated). The photos workspace root is `/home/andy/andypandy/photos`.

**Key facts the executor must know:**
- Vercel team id: `team_1nvmFqAXPpwGfovRmk6JRLgp`. Project: `afilmory`. GitHub repoId: `1262965928` (ChinesePrince07/andypandy). Current production deployment: `dpl_EZkCEpvkA39Q5eXeJeo9MNYm5w1s` (CLI-deployed 2026-06-10 from an unknown working copy).
- The project's `rootDirectory` is currently `null` — that's the bug. Git/deploy-hook builds run at the monorepo root and fail with "No Next.js version detected".
- Token: read from `auth.json`. If any API call returns `{"error":{"invalidToken":true}}`, run `npx -y vercel@latest whoami` (refreshes the token file) and re-read it. NEVER print the token or commit it anywhere.
- NEVER run `vercel deploy` for afilmory — CLI deploys from the wrong cwd are what clobbered the project settings. Git deploys only.
- A failed Vercel build leaves the prior production deployment live (safe to retry).
- Scratch files: write to `~/afilmory-recon/` (NOT `/tmp` — `/tmp` writes were permission-denied in this environment).

---

### Task 1: Phase 0a — Reconcile production vs. local (read-only, STOP gate)

**Files:** none modified. Investigation only.

**Why:** Production runs a CLI deploy whose commits don't exist in local git. A git redeploy REPLACES production. We must prove local `photos/` is not behind production before deploying anything.

- [ ] **Step 1: Set up API access**

```bash
mkdir -p ~/afilmory-recon
TOKEN=$(python3 -c "import json;print(json.load(open('/home/andy/.local/share/com.vercel.cli/auth.json'))['token'])")
TEAM=team_1nvmFqAXPpwGfovRmk6JRLgp
curl -s "https://api.vercel.com/v9/projects/afilmory?teamId=$TEAM" -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import json,sys;d=json.load(sys.stdin);print('rootDirectory =', d.get('rootDirectory'))"
```

Expected: `rootDirectory = None`. If the call returns `invalidToken`, run `npx -y vercel@latest whoami`, re-read TOKEN, retry.

- [ ] **Step 2: Confirm which deployment is current production**

```bash
curl -s "https://api.vercel.com/v6/deployments?teamId=$TEAM&app=afilmory&target=production&limit=5" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import json,sys;[print(d['uid'], d['state'], d.get('meta',{}).get('githubCommitMessage') or d.get('name'), d['created']) for d in json.load(sys.stdin)['deployments']]"
```

Expected: newest READY deployment is `dpl_EZkCEpvkA39Q5eXeJeo9MNYm5w1s` (or a sibling CLI deploy). Note the actual current-production uid as `$DPL`.

- [ ] **Step 3: List the production deployment's source files**

```bash
curl -s "https://api.vercel.com/v6/deployments/$DPL/files?teamId=$TEAM" \
  -H "Authorization: Bearer $TOKEN" > ~/afilmory-recon/prod-files.json
python3 - <<'EOF'
import json
def walk(node, prefix=""):
    name = prefix + node.get("name", "")
    if node.get("type") == "directory":
        for c in node.get("children", []):
            walk(c, name + "/")
    else:
        print(name, node.get("uid", ""))
tree = json.load(open("/home/andy/afilmory-recon/prod-files.json"))
for n in tree:
    walk(n)
EOF
```

(If the response shape differs, adapt — the goal is a flat list of `path uid` pairs. Save it to `~/afilmory-recon/prod-paths.txt`.)

- [ ] **Step 4: Diff the path list against local `photos/`**

Compare the deployment's source paths (under `src/` — CLI deploys from `photos/` so paths are relative to it) against `git -C /home/andy/andypandy ls-files photos/ | sed 's|^photos/||'`. Focus on `apps/ssr/src/app` and `apps/ssr/src/lib`. List any file present in production but absent locally, and vice versa.

- [ ] **Step 5: Content-compare the 3 highest-risk files**

For each of `apps/ssr/src/app/api/admin/photos/process/route.ts`, `apps/ssr/src/lib/manifest.ts`, `apps/ssr/src/lib/r2.ts`: fetch the deployment file content and diff against local:

```bash
# fileUid from the listing in Step 3
curl -s "https://api.vercel.com/v7/deployments/$DPL/files/$FILE_UID?teamId=$TEAM" \
  -H "Authorization: Bearer $TOKEN" > ~/afilmory-recon/remote-file.json
# v7 returns {"data": "<base64>"}; decode and diff:
python3 -c "import json,base64,sys;print(base64.b64decode(json.load(open('/home/andy/afilmory-recon/remote-file.json'))['data']).decode())" > ~/afilmory-recon/remote-file.ts
diff ~/afilmory-recon/remote-file.ts /home/andy/andypandy/photos/apps/ssr/src/app/api/admin/photos/process/route.ts
```

- [ ] **Step 6: STOP GATE — decide**

- If local matches or is a superset of production (expected — the local tree at `b3da014d` contains the full R2/admin feature set): record "reconciled, safe to deploy" and continue to Task 2.
- If production contains code that does NOT exist locally: **STOP. Do not deploy. Report the differing files to Andy** and wait for instruction. Deploying would roll back live functionality.

---

### Task 2: Phase 0b — Restore Root Directory and redeploy from git

**Files:** none in repo. Vercel project settings + a deployment.

- [ ] **Step 1: PATCH rootDirectory**

```bash
curl -s -X PATCH "https://api.vercel.com/v9/projects/afilmory?teamId=$TEAM" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"rootDirectory":"photos"}' \
  | python3 -c "import json,sys;print('rootDirectory =', json.load(sys.stdin).get('rootDirectory'))"
```

Expected: `rootDirectory = photos`.

- [ ] **Step 2: Trigger a production git deploy of main**

```bash
curl -s -X POST "https://api.vercel.com/v13/deployments?teamId=$TEAM" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"afilmory","project":"afilmory","target":"production","gitSource":{"type":"github","repoId":1262965928,"ref":"main"}}' \
  | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('id'), d.get('readyState'))"
```

Note the deployment id as `$NEWDPL`.

- [ ] **Step 3: Poll until READY (or ERROR)**

```bash
curl -s "https://api.vercel.com/v13/deployments/$NEWDPL?teamId=$TEAM" -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import json,sys;print(json.load(sys.stdin).get('readyState'))"
```

Repeat every ~30s (build takes several minutes — vite + next). Expected: `READY`. If `ERROR`, fetch build logs (`GET /v3/deployments/$NEWDPL/events?builds=1&limit=-1`), diagnose, fix, and do NOT proceed — prior production stays live.

- [ ] **Step 4: Verify the live site**

```bash
curl -s -o /dev/null -w "%{http_code} %{header_json}" https://pics.andypandy.org/ | head -c 300
curl -s https://pics.andypandy.org/ | grep -c "__MANIFEST__"
```

Expected: HTTP 200 with `x-ssr: 1` header, and `__MANIFEST__` present (count ≥ 1). Also confirm the manifest is non-empty:

```bash
curl -s https://pics.andypandy.org/ | python3 -c "
import sys,re,json
m=re.search(r'window.__MANIFEST__ = (\{.*?\});</script>', sys.stdin.read(), re.S)
print('photos:', len(json.loads(m.group(1))['data']))"
```

Expected: same photo count as production had before (non-zero). If the regex misses, adjust (the script tag is `<script id=\"manifest\">`).

---

### Task 3: Phase 0c — Remove vestigial rebuild triggers from personal-site

**Files:**
- Modify: `site/app/api/admin/r2-upload/route.ts`
- Modify: `site/app/api/admin/r2-photos/route.ts`
- Modify: `site/app/api/admin/r2-photos/move/route.ts`
- Modify: `site/app/api/admin/r2-photos/exif/route.ts`
- Modify: `site/app/admin/r2-photos/page.tsx`
- Delete: `site/app/admin/r2-photos/r2-uploader.tsx`

**Why:** The manifest is read from R2 at request time; rebuilds after upload accomplish nothing. Worse, the site's legacy `/admin/r2-photos` upload page puts raw files into R2 (key = bare filename, never enters the manifest) and fires the deploy hook — this is the exact "upload photos and vercel rebuild fails" flow Andy hit. Replace the page with a pointer to the real uploader; strip the hook from the API routes (which stay, minus the hook, since they're generic R2 management endpoints).

- [ ] **Step 1: Strip the hook from `r2-upload/route.ts`**

Remove the line `const DEPLOY_HOOK = (process.env.AFILMORY_DEPLOY_HOOK || "").trim();` and replace the trigger block + return:

```ts
  // Trigger afilmory rebuild if requested
  let deployTriggered = false;
  if (triggerDeploy && DEPLOY_HOOK) {
    try {
      await fetch(DEPLOY_HOOK, { method: "POST" });
      deployTriggered = true;
    } catch {
      // non-critical
    }
  }

  return Response.json({ urls, deployTriggered });
```

with:

```ts
  // Note: no rebuild needed — the afilmory manifest is read from R2 at request time.
  return Response.json({ urls, deployTriggered: false });
```

Also remove the now-unused `triggerDeploy` from the destructure: change `const { files, triggerDeploy } = await req.json();` to `const { files } = await req.json();`.

- [ ] **Step 2: Strip the hook from the three `r2-photos` routes**

In each of `route.ts`, `move/route.ts`, `exif/route.ts`: delete the `const DEPLOY_HOOK = ...` line and the entire `triggerDeploy()` helper function (the one containing `await fetch(DEPLOY_HOOK, { method: "POST" })`), then replace each call site so the response keeps its shape:

- `r2-photos/route.ts` line ~160: `const deployTriggered = body?.triggerDeploy === false ? false : (deleted.length > 0 ? await triggerDeploy() : false);` → `const deployTriggered = false;`
- `r2-photos/move/route.ts` line ~55: `const deployTriggered = shouldDeploy === false ? false : await triggerDeploy();` → `const deployTriggered = false;` (also remove the now-unused `shouldDeploy` variable/destructure if it becomes unreferenced)
- `r2-photos/exif/route.ts` line ~149: `const deployTriggered = body?.triggerDeploy === false ? false : await triggerDeploy();` → `const deployTriggered = false;`

Read each file before editing; remove any other now-unused references the TypeScript compiler would flag.

- [ ] **Step 3: Replace the legacy upload page**

Overwrite `site/app/admin/r2-photos/page.tsx` with:

```tsx
import { isAdmin } from "@/lib/admin-auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function R2PhotosPage() {
  const admin = await isAdmin();
  if (!admin) redirect("/admin");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Upload Photos</h1>
      <p className="text-sm text-gray-500 mb-6">
        Photo uploads moved to the gallery&apos;s own admin, which extracts
        EXIF, generates thumbnails, and updates the gallery instantly — no
        rebuild needed.
      </p>
      <a
        href="https://pics.andypandy.org/admin/upload"
        className="inline-block rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-black"
      >
        Open Gallery Uploader →
      </a>
    </div>
  );
}
```

Then delete `site/app/admin/r2-photos/r2-uploader.tsx`.

- [ ] **Step 4: Typecheck the site app**

```bash
cd /home/andy/andypandy/site && npx tsc --noEmit
```

Expected: no NEW errors (if the repo has pre-existing errors, capture a baseline first with `git stash && npx tsc --noEmit; git stash pop` and compare).

- [ ] **Step 5: Commit**

```bash
cd /home/andy/andypandy
git add site/app/api/admin/r2-upload/route.ts site/app/api/admin/r2-photos/ site/app/admin/r2-photos/
git commit -m "site: remove vestigial afilmory rebuild hooks; point legacy upload page at gallery admin

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: `isHidden` type + pure manifest filter (TDD)

**Files:**
- Modify: `photos/packages/typing/src/photo.ts` (~line 75, inside `PhotoManifestItem`)
- Create: `photos/apps/ssr/src/lib/manifest-view.ts`
- Create: `photos/apps/ssr/src/lib/manifest-view.test.ts`
- Modify: `photos/apps/ssr/package.json` (add vitest devDep + test script)

- [ ] **Step 1: Add the field to `PhotoManifestItem`**

In `photos/packages/typing/src/photo.ts`, inside `interface PhotoManifestItem`, after `isHDR?: boolean`:

```ts
  /** Private photo — excluded from the manifest served to non-admin viewers. */
  isHidden?: boolean
```

- [ ] **Step 2: Install vitest in the ssr workspace**

```bash
cd /home/andy/andypandy/photos
pnpm --filter @afilmory/ssr add -D vitest
```

Add to `photos/apps/ssr/package.json` scripts: `"test": "vitest run"`.

- [ ] **Step 3: Write the failing test**

Create `photos/apps/ssr/src/lib/manifest-view.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import type { AfilmoryManifest, PhotoManifestItem } from '@afilmory/typing'

import { filterManifestForViewer } from './manifest-view'

function photo(id: string, overrides: Partial<PhotoManifestItem> = {}): PhotoManifestItem {
  return {
    id,
    title: id,
    description: '',
    dateTaken: '2026-06-01T00:00:00.000Z',
    tags: [],
    originalUrl: `https://r2.example/photos/original/${id}.jpg`,
    thumbnailUrl: `https://r2.example/photos/thumb/${id}.webp`,
    ogImageUrl: null,
    thumbHash: null,
    width: 100,
    height: 100,
    aspectRatio: 1,
    s3Key: `photos/original/${id}.jpg`,
    format: 'jpeg',
    size: 1,
    lastModified: '2026-06-01T00:00:00.000Z',
    exif: null,
    toneAnalysis: null,
    location: null,
    ...overrides,
  }
}

const manifest: AfilmoryManifest = {
  version: 'v10',
  data: [
    photo('pub1', { exif: { Make: 'FUJIFILM', Model: 'X-T5' } as PhotoManifestItem['exif'] }),
    photo('priv1', {
      isHidden: true,
      exif: { Make: 'Apple', Model: 'iPhone 15', LensModel: 'iPhone lens' } as PhotoManifestItem['exif'],
    }),
  ],
  cameras: [],
  lenses: [],
  albums: [{ id: 'a1', name: 'Album', photoIds: ['pub1', 'priv1'] } as never],
}

describe('filterManifestForViewer', () => {
  it('returns the manifest untouched for admins', () => {
    expect(filterManifestForViewer(manifest, true)).toBe(manifest)
  })

  it('removes hidden photos for non-admins', () => {
    const out = filterManifestForViewer(manifest, false)
    expect(out.data.map((p) => p.id)).toEqual(['pub1'])
  })

  it('rebuilds camera/lens aggregates from visible photos only', () => {
    const out = filterManifestForViewer(manifest, false)
    expect(out.cameras.map((c) => c.model)).toEqual(['X-T5'])
    expect(out.lenses).toEqual([])
  })

  it('strips hidden photo ids from albums', () => {
    const out = filterManifestForViewer(manifest, false)
    expect((out.albums?.[0] as { photoIds: string[] }).photoIds).toEqual(['pub1'])
  })

  it('does not mutate the input manifest', () => {
    filterManifestForViewer(manifest, false)
    expect(manifest.data).toHaveLength(2)
    expect((manifest.albums?.[0] as { photoIds: string[] }).photoIds).toHaveLength(2)
  })
})
```

(If `AfilmoryManifest`'s `albums` element type doesn't match the literal, adjust the casts — keep the assertions.)

- [ ] **Step 4: Run the test, verify it fails**

```bash
cd /home/andy/andypandy/photos && pnpm --filter @afilmory/ssr exec vitest run src/lib/manifest-view.test.ts
```

Expected: FAIL — `Cannot find module './manifest-view'` (or equivalent).

- [ ] **Step 5: Implement `manifest-view.ts`**

Create `photos/apps/ssr/src/lib/manifest-view.ts`. The two rebuild functions are MOVED verbatim from `api/admin/photos/process/route.ts` (lines 25–61); this module must stay pure (no `next/headers`, no R2 imports) so it's unit-testable:

```ts
import type { AfilmoryManifest, CameraInfo, LensInfo, PhotoManifestItem } from '@afilmory/typing'

export function rebuildCameras(photos: PhotoManifestItem[]): CameraInfo[] {
  const seen = new Map<string, CameraInfo>()
  for (const photo of photos) {
    const make = photo.exif?.Make
    const model = photo.exif?.Model
    if (make && model) {
      const key = `${make}|||${model}`
      if (!seen.has(key)) {
        seen.set(key, {
          make,
          model,
          displayName: `${make} ${model}`,
        })
      }
    }
  }
  return Array.from(seen.values())
}

export function rebuildLenses(photos: PhotoManifestItem[]): LensInfo[] {
  const seen = new Map<string, LensInfo>()
  for (const photo of photos) {
    const model = photo.exif?.LensModel
    if (model) {
      const make = photo.exif?.LensMake
      const key = `${make || ''}|||${model}`
      if (!seen.has(key)) {
        seen.set(key, {
          make: make || undefined,
          model,
          displayName: make ? `${make} ${model}` : model,
        })
      }
    }
  }
  return Array.from(seen.values())
}

/**
 * Viewer-facing manifest projection. Admins see everything; everyone else
 * gets hidden photos stripped out, with camera/lens aggregates and album
 * photo lists rebuilt from the visible set so nothing leaks via counts.
 */
export function filterManifestForViewer(manifest: AfilmoryManifest, isAdmin: boolean): AfilmoryManifest {
  if (isAdmin) return manifest
  const visible = manifest.data.filter((p) => !p.isHidden)
  if (visible.length === manifest.data.length) return manifest

  const visibleIds = new Set(visible.map((p) => p.id))
  return {
    ...manifest,
    data: visible,
    cameras: rebuildCameras(visible),
    lenses: rebuildLenses(visible),
    albums: (manifest.albums ?? []).map((album) => ({
      ...album,
      photoIds: album.photoIds.filter((id: string) => visibleIds.has(id)),
    })),
  }
}
```

- [ ] **Step 6: Run the test, verify it passes**

```bash
cd /home/andy/andypandy/photos && pnpm --filter @afilmory/ssr exec vitest run src/lib/manifest-view.test.ts
```

Expected: 5 passed.

- [ ] **Step 7: Commit**

```bash
cd /home/andy/andypandy
git add photos/packages/typing/src/photo.ts photos/apps/ssr/src/lib/manifest-view.ts photos/apps/ssr/src/lib/manifest-view.test.ts photos/apps/ssr/package.json photos/pnpm-lock.yaml
git commit -m "photos: add isHidden field + pure viewer manifest filter (with tests)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Wire filtering into `getManifestSafe()` + dedupe rebuild helpers

**Files:**
- Modify: `photos/apps/ssr/src/lib/manifest.ts`
- Modify: `photos/apps/ssr/src/app/api/admin/photos/process/route.ts` (delete local rebuild fns, lines 25–61; import instead)
- Modify: `photos/apps/ssr/src/app/api/admin/photos/[id]/route.ts` (delete local rebuild fns, lines 10–46; import instead)

**Why this one choke point suffices:** every public-facing handler (`app/route.ts`, `app/[...all]/route.ts`, `app/photos/[photoId]/prod.ts`, `lib/ssr-meta.ts`, all `app/api/og/*` routes, all `app/tag|album|camera|lens/*` routes, and the admin dashboard server component) reads via `getManifestSafe()`. Admin API routes use `getManifest()` and stay unfiltered. After this task, hidden photos vanish from public HTML injection, OG images (hidden photo id → not found → existing 404 path), deep-link meta, and tag/camera/lens counts — with zero per-route edits.

- [ ] **Step 1: Update `manifest.ts`**

Replace `getManifestSafe` in `photos/apps/ssr/src/lib/manifest.ts` and add imports:

```ts
import { verifyAdmin } from './admin-auth'
import { filterManifestForViewer } from './manifest-view'
```

```ts
/**
 * Viewer-facing safe variant for SSR rendering: never throws, and strips
 * hidden photos unless the request carries a valid admin cookie.
 * Admin API routes must keep using getManifest() (unfiltered).
 */
export async function getManifestSafe(): Promise<AfilmoryManifest> {
  try {
    const manifest = await getManifest()
    const isAdmin = await verifyAdmin()
    return filterManifestForViewer(manifest, isAdmin)
  } catch (error) {
    console.error('Failed to load manifest:', error)
    return emptyManifest()
  }
}
```

Note: `verifyAdmin()` uses `cookies()` from `next/headers`, which is valid in every current caller (route handlers and server components). If it ever throws, the `catch` returns the empty manifest — failing closed.

- [ ] **Step 2: Dedupe `rebuildCameras`/`rebuildLenses`**

In `process/route.ts`: delete the local `rebuildCameras` and `rebuildLenses` function definitions (lines 25–61), remove `CameraInfo, LensInfo` from the `@afilmory/typing` type import if now unused, and add:

```ts
import { rebuildCameras, rebuildLenses } from '~/lib/manifest-view'
```

In `photos/[id]/route.ts`: same — delete the local copies (lines 10–46), fix the type import, add the same import line.

- [ ] **Step 3: Typecheck**

```bash
cd /home/andy/andypandy/photos/apps/ssr && npx tsc --noEmit
```

Expected: no NEW errors vs. baseline (capture baseline before editing if needed). Also re-run the unit tests: `pnpm --filter @afilmory/ssr exec vitest run` → pass.

- [ ] **Step 4: Commit**

```bash
cd /home/andy/andypandy
git add photos/apps/ssr/src/lib/manifest.ts "photos/apps/ssr/src/app/api/admin/photos/process/route.ts" "photos/apps/ssr/src/app/api/admin/photos/[id]/route.ts"
git commit -m "photos: filter hidden photos from all public manifest exposure

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Upload flow — Private toggle

**Files:**
- Modify: `photos/apps/ssr/src/app/api/admin/photos/process/route.ts`
- Modify: `photos/apps/ssr/src/app/admin/(protected)/upload/page.tsx`

- [ ] **Step 1: Accept `isHidden` in the process route**

Line ~85, change the destructure:

```ts
    const { id, key, filename, tags: userTags, title: userTitle, isHidden } = body
```

In the `photoItem` literal (after `isHDR: false,`):

```ts
      isHDR: false,
      isHidden: isHidden === true ? true : undefined,
```

(`undefined` is dropped by `JSON.stringify`, so public photos keep their old shape.)

- [ ] **Step 2: Add per-photo + batch Private controls to the upload page**

In `upload/page.tsx`:

a. Extend the interface (line ~8):

```ts
interface UploadFile {
  file: File
  previewUrl: string
  status: FileStatus
  error?: string
  tags: string[]
  isPrivate: boolean
}
```

b. In `addFiles` (line ~30), add `isPrivate: false` to the mapped object:

```ts
    const uploadFiles: UploadFile[] = fileArray.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'pending' as const,
      tags: [],
      isPrivate: false,
    }))
```

c. After `updateFileTags` (line ~107), add:

```ts
  const toggleFilePrivate = useCallback((index: number) => {
    setFiles((prev) => prev.map((f, i) => (i === index ? { ...f, isPrivate: !f.isPrivate } : f)))
  }, [])

  const toggleAllPrivate = useCallback(() => {
    setFiles((prev) => {
      const anyPublicPending = prev.some((f) => f.status === 'pending' && !f.isPrivate)
      return prev.map((f) => (f.status === 'pending' ? { ...f, isPrivate: anyPublicPending } : f))
    })
  }, [])
```

d. In `handleUploadAll`'s process fetch body (line ~163), add the flag:

```ts
          body: JSON.stringify({
            id,
            key,
            filename: uploadFile.file.name,
            tags: uploadFile.tags.length > 0 ? uploadFile.tags : undefined,
            isHidden: uploadFile.isPrivate || undefined,
          }),
```

e. In the batch-tag row (the `{/* Batch tag input */}` block, line ~330), add a button after the "Apply to All" button, inside the same flex container:

```tsx
              <button
                onClick={toggleAllPrivate}
                className="rounded-lg border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-300 transition-colors hover:border-neutral-500 hover:text-white"
              >
                {files.some((f) => f.status === 'pending' && !f.isPrivate) ? 'Mark All Private' : 'Mark All Public'}
              </button>
```

f. In the per-photo pending section (inside `{uploadFile.status === 'pending' && (` block, after the tags `<input>`, line ~527), add:

```tsx
                      <label className="mt-2 flex cursor-pointer items-center gap-1.5 text-[11px] text-neutral-400">
                        <input
                          type="checkbox"
                          checked={uploadFile.isPrivate}
                          onChange={() => toggleFilePrivate(index)}
                          className="h-3 w-3 accent-white"
                        />
                        Private (only visible to you)
                      </label>
```

g. For non-pending photos (the `{uploadFile.status !== 'pending' && uploadFile.tags.length > 0 && (` block, line ~531), show a marker — change the condition to `{uploadFile.status !== 'pending' && (uploadFile.tags.length > 0 || uploadFile.isPrivate) && (` and inside the flex div add before the tags map:

```tsx
                      {uploadFile.isPrivate && (
                        <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-400">private</span>
                      )}
```

- [ ] **Step 3: Typecheck**

```bash
cd /home/andy/andypandy/photos/apps/ssr && npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
cd /home/andy/andypandy
git add "photos/apps/ssr/src/app/api/admin/photos/process/route.ts" "photos/apps/ssr/src/app/admin/(protected)/upload/page.tsx"
git commit -m "photos: private toggle in upload flow

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Edit page — hide/unhide existing photos

**Files:**
- Modify: `photos/apps/ssr/src/app/api/admin/photos/[id]/route.ts` (PATCH handler)
- Modify: `photos/apps/ssr/src/app/admin/(protected)/photos/[id]/edit/page.tsx`

- [ ] **Step 1: PATCH route accepts `isHidden`**

In the PATCH handler of `photos/[id]/route.ts`, after `if (Array.isArray(body.tags)) photo.tags = body.tags` (line ~211), add:

```ts
  if (typeof body.isHidden === 'boolean') {
    if (body.isHidden) photo.isHidden = true
    else delete photo.isHidden
  }
```

- [ ] **Step 2: Edit page toggle**

In `edit/page.tsx`:

a. The `PhotoData` interface (line ~130s, the one with `location` and `exif`): add `isHidden?: boolean` next to the other scalar fields.

b. Form state (after `const [tags, setTags] = useState('')`, line ~176):

```ts
  const [isHidden, setIsHidden] = useState(false)
```

c. In `fetchPhoto` populate (after `setTags(...)`, line ~214):

```ts
      setIsHidden(data.isHidden === true)
```

d. In `handleSave`'s `body` literal (line ~295):

```ts
      const body: Record<string, unknown> = {
        title,
        description,
        dateTaken: dateTaken ? new Date(dateTaken).toISOString() : photo?.dateTaken,
        tags: parsedTags,
        isHidden,
      }
```

e. UI — after the Tags field block (the `<div>` ending with `<p ...>Separate tags with commas</p></div>`, line ~506), add:

```tsx
                <div>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-400">
                    <input
                      type="checkbox"
                      checked={isHidden}
                      onChange={(e) => setIsHidden(e.target.checked)}
                      className="h-4 w-4 accent-white"
                    />
                    Private — only visible to you (workout/progress photos)
                  </label>
                </div>
```

- [ ] **Step 3: Typecheck**

```bash
cd /home/andy/andypandy/photos/apps/ssr && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
cd /home/andy/andypandy
git add "photos/apps/ssr/src/app/api/admin/photos/[id]/route.ts" "photos/apps/ssr/src/app/admin/(protected)/photos/[id]/edit/page.tsx"
git commit -m "photos: hide/unhide toggle on photo edit page

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Workout timeline page + admin nav link

**Files:**
- Create: `photos/apps/ssr/src/app/admin/(protected)/workout/page.tsx`
- Modify: `photos/apps/ssr/src/app/admin/(protected)/layout.tsx` (nav, after the Albums link ~line 26)

- [ ] **Step 1: Create the page**

`photos/apps/ssr/src/app/admin/(protected)/workout/page.tsx` (server component; the `(protected)` layout already enforces admin, and `getManifestSafe()` returns the full manifest for admins):

```tsx
import Link from 'next/link'

import type { PhotoManifestItem } from '@afilmory/typing'

import { getManifestSafe } from '~/lib/manifest'

export const dynamic = 'force-dynamic'

function monthLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'Unknown date'
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
}

function dayLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default async function WorkoutTimelinePage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string }>
}) {
  const { tag } = await searchParams
  const manifest = await getManifestSafe()
  const hidden = manifest.data.filter((p) => p.isHidden)
  const allTags = Array.from(new Set(hidden.flatMap((p) => p.tags))).sort()
  const photos = tag ? hidden.filter((p) => p.tags.includes(tag)) : hidden

  // manifest.data is already sorted newest-first; group by month preserving order
  const groups: { label: string; photos: PhotoManifestItem[] }[] = []
  for (const photo of photos) {
    const label = monthLabel(photo.dateTaken)
    const last = groups.at(-1)
    if (last && last.label === label) last.photos.push(photo)
    else groups.push({ label, photos: [photo] })
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Workout Progress</h1>
          <span className="rounded-full bg-neutral-800 px-2.5 py-0.5 text-xs font-medium text-neutral-300">
            {photos.length}
          </span>
        </div>
        <Link
          href="/admin/upload"
          className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-neutral-200 transition-colors"
        >
          Upload
        </Link>
      </div>

      {allTags.length > 0 && (
        <div className="mb-8 flex flex-wrap gap-2">
          <Link
            href="/admin/workout"
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              !tag ? 'bg-white text-black' : 'bg-neutral-800 text-neutral-400 hover:text-white'
            }`}
          >
            All
          </Link>
          {allTags.map((t) => (
            <Link
              key={t}
              href={`/admin/workout?tag=${encodeURIComponent(t)}`}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                tag === t ? 'bg-white text-black' : 'bg-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              {t}
            </Link>
          ))}
        </div>
      )}

      {photos.length === 0 ? (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-12 text-center">
          <p className="text-sm text-neutral-500">
            No private photos yet. Upload one with the <span className="text-neutral-300">Private</span> toggle on.
          </p>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.label} className="mb-10">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">{group.label}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {group.photos.map((photo) => (
                <Link
                  key={photo.id}
                  href={`/photos/${photo.id}`}
                  className="group relative overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.thumbnailUrl}
                    alt={photo.title}
                    loading="lazy"
                    className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                    <p className="truncate text-xs font-medium text-white">{photo.title}</p>
                    <p className="text-[10px] text-neutral-400">{dayLabel(photo.dateTaken)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add the nav link**

Read `photos/apps/ssr/src/app/admin/(protected)/layout.tsx`; after the Albums `<Link>` element (line ~26), insert a sibling matching the existing style:

```tsx
            <Link href="/admin/workout" className="text-sm text-neutral-400 hover:text-white transition-colors">
              Workout
            </Link>
```

- [ ] **Step 3: Typecheck**

```bash
cd /home/andy/andypandy/photos/apps/ssr && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
cd /home/andy/andypandy
git add "photos/apps/ssr/src/app/admin/(protected)/workout/page.tsx" "photos/apps/ssr/src/app/admin/(protected)/layout.tsx"
git commit -m "photos: admin workout progress timeline page

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Gallery lock badge (web app)

**Files:**
- Modify: `photos/apps/web/src/modules/gallery/MasonryPhotoItem.tsx` (~line 185, after the `<img>` element)

The web app renders `window.__MANIFEST__`; public visitors never receive hidden items, so this badge is informational for the logged-in admin only. `PhotoManifest` re-exports `PhotoManifestItem` from `@afilmory/typing` via `@afilmory/builder`, so `data.isHidden` typechecks after Task 4.

- [ ] **Step 1: Add the badge**

In the returned JSX, directly after the `{!imageError && (<img ... />)}` block:

```tsx
      {data.isHidden && (
        <div
          className="absolute right-2 top-2 z-10 rounded-full bg-black/60 p-1.5 backdrop-blur-sm"
          title="Private — only you can see this"
        >
          <svg className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      )}
```

- [ ] **Step 2: Typecheck the web app**

```bash
cd /home/andy/andypandy/photos/apps/web && npx tsc --noEmit
```

Expected: no new errors vs. baseline.

- [ ] **Step 3: Commit**

```bash
cd /home/andy/andypandy
git add photos/apps/web/src/modules/gallery/MasonryPhotoItem.tsx
git commit -m "photos: lock badge on private photos in gallery

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: Full build, deploy, end-to-end verification

- [ ] **Step 1: Full local build of the photos app (catches anything tsc missed)**

```bash
cd /home/andy/andypandy/photos && pnpm run build
```

Expected: vite build of `apps/web` then `next build` of `apps/ssr`, exit 0. This takes several minutes and needs ~7GB RAM (build script sets `--max-old-space-size=7168`). If it fails, fix before pushing.

- [ ] **Step 2: Push (triggers git deploys for all linked projects)**

```bash
cd /home/andy/andypandy && git push origin main
```

- [ ] **Step 3: Watch the afilmory deployment**

Poll `GET /v6/deployments?teamId=$TEAM&app=afilmory&limit=1` until the newest deployment (it will carry the last commit message in `meta.githubCommitMessage`) reaches `READY`. Also check the `personal-site` project's newest deployment goes READY (Task 3 touched `site/`).

- [ ] **Step 4: Verify public filtering (no admin cookie)**

```bash
curl -s https://pics.andypandy.org/ | python3 -c "
import sys,re,json
html=sys.stdin.read()
m=re.search(r'window.__MANIFEST__ = (\{.*?\});</script>', html, re.S)
d=json.loads(m.group(1))
hidden=[p['id'] for p in d['data'] if p.get('isHidden')]
print('total photos:', len(d['data']), '| hidden leaked:', hidden)"
```

Expected: `hidden leaked: []`. (Right now no photo is hidden yet, so also re-run this after Step 5's test upload.)

- [ ] **Step 5: Admin end-to-end — upload a private test photo**

Get the admin password from Vercel env (do NOT echo it):

```bash
PW=$(curl -s "https://api.vercel.com/v9/projects/afilmory/env?teamId=$TEAM&decrypt=true" -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import json,sys;envs=json.load(sys.stdin)['envs'];print(next(e.get('value','') for e in envs if e['key']=='ADMIN_PASSWORD'))")
# login, capture cookie
curl -s -c ~/afilmory-recon/cookies.txt -X POST https://pics.andypandy.org/api/admin/login \
  -H 'Content-Type: application/json' -d "{\"password\":\"$PW\"}"
```

Then drive the upload API directly with a tiny generated image:

```bash
python3 -c "
from PIL import Image
Image.new('RGB',(40,40),(200,40,40)).save('/home/andy/afilmory-recon/test-workout.jpg')" 2>/dev/null \
  || python3 -c "open('/home/andy/afilmory-recon/test-workout.jpg','wb').write(bytes.fromhex('ffd8ffe000104a46494600010100000100010000ffdb004300ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffc2000b080001000101011100ffc40014100100000000000000000000000000000000ffda0008010100013f10ffd9'))"
# presign
RESP=$(curl -s -b ~/afilmory-recon/cookies.txt -X POST https://pics.andypandy.org/api/admin/photos/upload \
  -H 'Content-Type: application/json' -d '{"filename":"test-workout.jpg","contentType":"image/jpeg"}')
ID=$(echo "$RESP" | python3 -c "import json,sys;print(json.load(sys.stdin)['id'])")
KEY=$(echo "$RESP" | python3 -c "import json,sys;print(json.load(sys.stdin)['key'])")
URL=$(echo "$RESP" | python3 -c "import json,sys;print(json.load(sys.stdin)['uploadUrl'])")
curl -s -X PUT "$URL" -H 'Content-Type: image/jpeg' --data-binary @/home/andy/afilmory-recon/test-workout.jpg
# process with isHidden
curl -s -b ~/afilmory-recon/cookies.txt -X POST https://pics.andypandy.org/api/admin/photos/process \
  -H 'Content-Type: application/json' \
  -d "{\"id\":\"$ID\",\"key\":\"$KEY\",\"filename\":\"test-workout.jpg\",\"tags\":[\"workout\",\"test\"],\"isHidden\":true}" \
  | python3 -c "import json,sys;d=json.load(sys.stdin);print('isHidden =', d.get('isHidden'), '| id =', d.get('id'))"
```

Expected: `isHidden = True`.

- [ ] **Step 6: Verify visibility split**

```bash
# anon: must NOT contain the test photo
curl -s https://pics.andypandy.org/ | grep -c "$ID"          # expect 0
# admin: MUST contain it
curl -s -b ~/afilmory-recon/cookies.txt https://pics.andypandy.org/ | grep -c "$ID"   # expect >= 1
# anon OG for hidden id: 404
curl -s -o /dev/null -w "%{http_code}\n" "https://pics.andypandy.org/api/og/photo/$ID"  # expect 404
# admin workout page renders and lists it
curl -s -b ~/afilmory-recon/cookies.txt https://pics.andypandy.org/admin/workout | grep -c "$ID"  # expect >= 1
```

- [ ] **Step 7: Clean up the test photo**

```bash
curl -s -b ~/afilmory-recon/cookies.txt -X DELETE "https://pics.andypandy.org/api/admin/photos/$ID"
```

Expected: `{"success":true,...}`. Then `rm -rf ~/afilmory-recon` (it contains a session cookie).

- [ ] **Step 8: Verify the legacy site flow is gone**

```bash
curl -s https://www.andypandy.org/admin/r2-photos 2>/dev/null | grep -ci "pics.andypandy.org/admin/upload"
```

(Will redirect to /admin if not logged in — a 3xx/login response is also fine; the point is no more auto-rebuild messaging. Skip if auth blocks it.)

- [ ] **Step 9: Report + memory**

Report results to Andy, including: pipeline fixed (rootDirectory restored, git deploys green), private photos working end-to-end, and the standing rule — upload at pics.andypandy.org/admin/upload, never via the old site page, and never `vercel deploy` the afilmory project from the CLI. Update `/home/andy/.claude/projects/-home-andy/memory/andypandy-migration-gotchas.md` with: afilmory rootDirectory was wiped by a CLI deploy (2026-06-10) and restored 2026-06-12; `isHidden` filtering lives in `getManifestSafe()`; admin APIs must use `getManifest()`.

---

## Notes for the executor

- **Order matters:** Tasks 1–2 must complete (STOP gate passed, pipeline green) before any push. Tasks 3–9 are local commits only; nothing deploys until Task 10's push.
- **`getManifest()` vs `getManifestSafe()`:** the unfiltered `getManifest()` is for admin-authenticated API routes only. If you add any new public route, use `getManifestSafe()`.
- **Don't trust `git log -- photos/`** for history questions — subtree import rewrites paths (known gotcha); use plain `git log`.
- **Permission quirks in this environment:** WebFetch and the Vercel/Playwright MCP tools are permission-denied; use `curl` via Bash with the token. `/tmp` writes are denied; use `~/afilmory-recon/`.
- Image bytes on R2 stay publicly addressable (unlisted, unguessable ids) — accepted in the spec; do not attempt signed URLs.
