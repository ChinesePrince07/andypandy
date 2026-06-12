# OTA signed-app distribution (andypandy.org/apps)

**Date:** 2026-06-13 · **Status:** Approved in conversation ("ok continue")

Remote iOS dev loop: update an Xcode project on the Mac → one command builds,
signs, and publishes a `.ipa` → install it over-the-air on the iPhone from
andypandy.org/apps.

## Signing setup (decoded from the user's profile)

- **Ad-hoc distribution** profile, Team `VCKAK49A49` ("shupeng yan").
- Expires **2026-11-08** (~5 months). After that: re-export profile + re-import
  `.p12`, no code change.
- **One provisioned device** (single iPhone UDID) — OTA install works only on
  that device. Acceptable; it's personal.
- **Specific App ID** `nsk-596.v-team.cn` (NOT a wildcard). Signed apps are
  rebranded to this bundle id, so one app at a time lives under the profile —
  matches the single-app iterate loop. The build passes
  `PRODUCT_BUNDLE_IDENTIFIER=nsk-596.v-team.cn` so the Xcode project needs no
  edits.
- `get-task-allow=false` → distribution build (installs OTA, not debuggable).

## Decisions (Andy, 2026-06-13)

1. **Sign on the Mac at build time.** Xcode signs natively during export; the
   `.p12` private key NEVER leaves the Mac. Server only stores + serves.
2. **Trigger: one command** (`deploy-ios.sh`) run in the project when ready to
   publish. No auto-build on commit / no watcher.
3. **Page admin-gated, keep latest only.** andypandy.org/apps behind the
   existing admin login; each upload replaces the previous build (one current
   version per app).

## Hard constraint

Compiling Swift → `.app`/`.ipa` requires a Mac with Xcode. This Linux session
and Vercel cannot build iOS apps. This feature automates everything AFTER
`xcodebuild`; the build itself runs on the Mac.

## Architecture

### Mac — `deploy-ios.sh` (in the Xcode project)

- `xcodebuild archive` → `.xcarchive`, then `xcodebuild -exportArchive` with a
  generated `ExportOptions.plist` (`method: release-testing` (ad-hoc), manual
  signing, `teamID: VCKAK49A49`, the provisioning profile). Passes
  `PRODUCT_BUNDLE_IDENTIFIER=nsk-596.v-team.cn` at archive time.
- Auto-bumps `CFBundleVersion`; extracts `CFBundleShortVersionString`, app
  name, and the largest `AppIcon` PNG from the built `.app`.
- `curl`s `POST /api/admin/ios/upload` (bearer `IOS_UPLOAD_TOKEN`) → presigned
  PUT URLs → PUTs `.ipa` + icon to R2 → posts metadata to register the build.
- `--dry-run` builds and prints the upload plan without uploading.
- One-time Mac setup (documented in the script header): import `.p12` into the
  login keychain; install the `.mobileprovision`; export `IOS_UPLOAD_TOKEN`.

### Server — personal-site (Next app router), reusing `lib/r2-storage.ts` + admin auth

- `POST /api/admin/ios/upload` — auth via dedicated bearer token
  `IOS_UPLOAD_TOKEN` (least-privilege; not the full admin cookie). Returns
  presigned PUT URLs for `apps/<slug>/App.ipa` and `apps/<slug>/icon.png`, then
  upserts metadata (slug, appName, bundleId, version, build, sizeBytes,
  uploadedAt, ipaKey, iconKey) into `apps/manifest.json` in R2. Keep-latest:
  stable keys overwrite, one entry per slug.
- `GET /api/ios/<slug>/manifest.plist` — **public** (iOS's install daemon
  fetches it with no cookie). Generates the `itms-services` plist: software
  package URL → public `.ipa` URL; bundle-identifier; bundle-version; title;
  display-image / full-size-image → icon URL.
- The `.ipa` + plist must be publicly fetchable (the listing PAGE is gated, but
  iOS install URLs can't carry the cookie). They live at unguessable keys in
  the existing public R2 bucket; only the one provisioned device can install.

### Page — `andypandy.org/apps` (server component, admin-gated → redirect)

Reads `apps/manifest.json`; lists the current build (name, version, build,
size, date) with an **Install** button →
`itms-services://?action=download-manifest&url=https://andypandy.org/api/ios/<slug>/manifest.plist`,
plus a direct `.ipa` link. (itms-services only acts in iOS Safari — expected.)

### R2 layout

`apps/<slug>/App.ipa`, `apps/<slug>/icon.png`, `apps/manifest.json`. Reuses the
site's existing R2 client/creds.

## Error handling

- Upload endpoint rejects missing/!bearer with 401; validates required
  metadata fields; bad slug → 400.
- manifest.plist for an unknown slug → 404.
- Mac script: fail fast on archive/export error, non-2xx upload, or missing
  keychain identity, with a clear message; `set -euo pipefail`.
- A failed upload leaves the previous build live (stable keys only overwrite on
  success after PUT + register).

## Testing

- Unit: pure `manifest.plist` generator (inputs → valid plist XML), and the
  keep-latest apps-manifest read/upsert/replace logic.
- `deploy-ios.sh --dry-run` builds + prints the upload plan, no upload.
- E2E after deploy: `GET /api/ios/<slug>/manifest.plist` returns valid XML; the
  page lists the app. Final acceptance = actual OTA install on the iPhone.

## Security

- `.p12` stays on the Mac (Mac-side signing).
- Upload endpoint gated by a dedicated bearer token, not the admin cookie.
- `.ipa`/plist public-but-unguessable; only the provisioned device installs.
- `IOS_UPLOAD_TOKEN` set via Vercel REST API (encrypted env), mirrored on the
  Mac. Never committed.

## Out of scope (YAGNI)

Version history / rollback, multiple concurrent apps, server-side resigning
(zsign), CI builds, non-provisioned-device install.
