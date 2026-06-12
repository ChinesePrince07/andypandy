# Afilmory: private workout photos + deploy-pipeline fix

**Date:** 2026-06-12
**Status:** Approved by Andy (conversation, 2026-06-12)

## Goal

Andy wants to upload workout progress photos (Strava screenshots, rowing erg
times, etc.) to pics.andypandy.org for personal use. These photos must be
**private**: invisible to public visitors, visible to Andy when logged in as
admin — both inside the normal gallery and on a dedicated chronological
timeline page. Metadata stays minimal: date + tags only (the screenshot itself
carries the workout data).

Prerequisite: the afilmory Vercel project currently cannot deploy from git
(Root Directory setting was wiped), so no feature can ship until the pipeline
is repaired.

## Non-goals

- Structured workout fields (type/duration/split) or stats/charts.
- True access control on image bytes. Originals/thumbnails remain on the
  public R2 base URL: a hidden photo is *unlisted* (unguessable random id),
  not encrypted. Accepted explicitly.
- Notes/captions beyond the existing title/description fields.

## Phase 0 — Fix the deploy pipeline (prerequisite)

Context: the afilmory Vercel project (`team_1nvmFqAXPpwGfovRmk6JRLgp`) has
`rootDirectory = null`, so deploy-hook/git builds run at the monorepo root and
die with "No Next.js version detected". Production (`dpl_EZkCEpvkA39Q5eXeJeo9MNYm5w1s`)
was deployed 2026-06-10 via CLI from a working copy whose commits are not in
local git, though the local tree contains the same R2/admin feature set and is
clean at `b3da014d`.

1. **Reconcile production vs. local.** List the production deployment's
   source files via the Vercel API and diff against local `photos/`. Do NOT
   trigger a git deploy before confirming local is not behind production —
   a git redeploy replaces the live build.
2. **Restore Root Directory.** `PATCH /v9/projects/afilmory` with
   `{"rootDirectory": "photos"}`.
3. **Redeploy from git** (`POST /v13/deployments`, gitSource main), confirm
   READY and pics.andypandy.org works (gallery loads, admin login works).
4. **Remove vestigial rebuild triggers.** The manifest is read from R2 at
   request time, so post-upload rebuilds are useless. Remove the
   `AFILMORY_DEPLOY_HOOK` calls from the four `site/app/api/admin/r2-*`
   routes. Audit whether the site-admin upload path is still coherent (it may
   write to R2 without updating the manifest); if broken, remove it or
   redirect to pics.andypandy.org/admin/upload.

## Feature design

### Data model

- Add `isHidden?: boolean` to `PhotoManifestItem`
  (`photos/packages/typing/src/photo.ts`). Absent = public, so all existing
  manifest entries stay valid (manifest version unchanged).

### Server-side privacy filtering (one choke point)

- New helper in `photos/apps/ssr/src/lib/manifest.ts`:
  `filterManifestForViewer(manifest, isAdmin)` — when `isAdmin` is false,
  drop `isHidden` items from `data` and rebuild the `cameras` / `lenses`
  aggregates from the remaining photos. Move `rebuildCameras` /
  `rebuildLenses` out of `api/admin/photos/process/route.ts` into a shared
  lib module so both call sites use one implementation.
- Apply at every public manifest exposure:
  - `app/route.ts` and `app/[...all]/route.ts` (manifest injection into HTML)
  - `lib/ssr-meta.ts` (hidden photo deep links get generic site meta, not
    photo meta)
  - `app/api/og/photo/[id]/route.tsx` → 404 for hidden ids (non-admin)
  - tag / album / camera / lens OG routes → exclude hidden photos from
    collages and counts
- Admin requests receive the unfiltered manifest (existing `verifyAdmin()`
  per-request check), so hidden photos appear in the normal gallery when
  logged in with zero client changes.

### Upload + edit

- `admin/(protected)/upload/page.tsx`: per-photo **Private** checkbox plus a
  batch "mark all private" toggle; value passed to
  `api/admin/photos/process`, which stores `isHidden` on the manifest item.
- `admin/(protected)/photos/[id]/edit`: same toggle for existing photos;
  `PATCH api/admin/photos/[id]` accepts `isHidden`.

### Workout timeline page

- New admin-only page `admin/(protected)/workout/page.tsx`, linked from the
  admin dashboard. Server-side: read manifest, select `isHidden` photos,
  optional tag filter (simple pill row), group by month, newest first.
  Thumbnails labeled with date, linking to the photo in the main gallery.

### Gallery badge

- Web app (`apps/web`): photo cards render a small lock badge when
  `photo.isHidden` is set. Public visitors never receive hidden items, so no
  client-side guard is needed — the badge is informational only.

## Error handling

- Filtering failure must fail closed: `filterManifestForViewer` is pure
  (filter + rebuild); if manifest load fails the existing
  `getManifestSafe()` empty-manifest fallback already applies.
- `isHidden` absent on old entries → treated as public (explicit `!== true`
  not required; falsy check suffices).
- OG/meta for hidden photos must not leak title/thumbnail URL to non-admins.

## Testing

- **Logged out:** hidden photos absent from injected `window.__MANIFEST__`;
  `og/photo/<hidden-id>` 404s; tag/camera/lens counts exclude hidden items;
  deep link to a hidden photo serves generic meta.
- **Admin:** hidden photos visible in gallery with lock badge; timeline page
  groups by month; upload with Private toggle round-trips
  (`isHidden: true` in stored manifest); edit-page toggle flips the flag.
- **End-to-end after deploy:** upload a test screenshot at
  pics.andypandy.org/admin/upload with Private on → appears for admin,
  absent in incognito → delete it.

## Decisions log

- Approach chosen: first-class `isHidden` flag (over magic-tag convention or
  fully separate pipeline) — explicit, single server-side filter point.
- Viewing: both in-gallery (when admin) and dedicated timeline page.
- Metadata: date + tags only.
- Unlisted-not-encrypted image URLs: accepted.
