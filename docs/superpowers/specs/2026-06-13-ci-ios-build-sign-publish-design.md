# CI build + sign + publish for Andy-Swiss-Knife (supersedes deploy-ios.sh)

**Date:** 2026-06-13 · **Status:** Approved in conversation ("go ahead")

Move iOS publishing off the Mac entirely: a GitHub Actions **macOS runner**
builds, ad-hoc-signs (native codesign), and publishes the app to
andypandy.org/apps. Triggered by push to main + a manual button. Replaces the
local `tools/deploy-ios.sh` (retired).

## Context / constraints (verified by cloning ChinesePrince07/Andy-Swiss-Knife)

- App: bundle id `com.andyzhang.AndySwissKnife`, built with **XcodeGen**
  (`project.yml`; `project.pbxproj` committed but no shared scheme → regenerate
  in CI). No SPM packages. `Config/Secrets.swift` is gitignored but UNUSED by
  committed code (`Config.swift` reads `UserSettings`, not `Secrets`) — no CI
  stub needed.
- Has a **widget extension** `SwissKnifeWidgets`
  (`com.andyzhang.AndySwissKnife.widgets`); app + widget use app group
  `group.com.andyzhang.AndySwissKnife`.
- Borrowed signing assets (`.p12` + `.mobileprovision`): Team `VCKAK49A49`
  ("shupeng yan"), **explicit** App ID `nsk-596.v-team.cn` (not wildcard), app
  group `group.nsk-596.v-team.cn`, one provisioned device, expires 2026-11-08.
- Mismatch → the borrowed profile can't sign the widget (no `.widgets`
  profile) or the app's app group. **Decision: strip the widget**, sign an
  app-only build rebranded to `nsk-596.v-team.cn` with empty entitlements.

## The workflow

`.github/workflows/publish-ios.yml` in `ChinesePrince07/Andy-Swiss-Knife`,
`runs-on: macos-14`, triggers: `push: [main]` + `workflow_dispatch`,
`concurrency` group so pushes don't pile up.

Steps:
1. `actions/checkout@v4`.
2. `brew install xcodegen yq`.
3. **Strip widget**: `yq` deletes `.targets.SwissKnifeWidgets` and the app's
   `dependencies[] | select(.target=="SwissKnifeWidgets")` from `project.yml`.
   Write `ci-empty.entitlements` (`<dict/>`) — empty ⊆ profile, sidesteps the
   app-group mismatch. (Runtime: the app's `group.com.andyzhang…` store returns
   nil — harmless without the widget.)
4. `xcodegen generate` → project + shared `AndySwissKnife` scheme.
5. **Import signing assets** into an ephemeral keychain in `$RUNNER_TEMP`;
   `set-key-partition-list` so codesign can use the key; add keychain to the
   user search list. Decode the profile, extract its real `UUID`/`Name` (via
   `security cms -D` + PlistBuddy), install under `<UUID>.mobileprovision`,
   read the signing identity from `security find-identity`. Export
   UUID/Name/identity/keychain to `$GITHUB_ENV` (self-configuring — no
   hardcoded name guesses).
6. **Archive + export**: `xcodebuild archive` with `PRODUCT_BUNDLE_IDENTIFIER=
   nsk-596.v-team.cn`, `CODE_SIGN_STYLE=Manual`, `DEVELOPMENT_TEAM=VCKAK49A49`,
   `CODE_SIGN_IDENTITY=<found>`, `PROVISIONING_PROFILE_SPECIFIER=<profile name>`,
   `CODE_SIGN_ENTITLEMENTS=ci-empty.entitlements`,
   `OTHER_CODE_SIGN_FLAGS=--keychain <keychain>`; then `-exportArchive` with an
   ad-hoc (`release-testing`) ExportOptions plist.
7. **Publish**: read version/build/size from the archived app Info.plist;
   presign → PUT `.ipa` → register, against `$SITE` (www.andypandy.org, with
   `curl -L`) using `IOS_UPLOAD_TOKEN`. Same endpoints the prior E2E verified.

## Secrets (in the Andy-Swiss-Knife repo)

- `IOS_UPLOAD_TOKEN` — set by Claude via `gh` (value already on Vercel).
- `IOS_P12_BASE64`, `IOS_P12_PASSWORD`, `IOS_MOBILEPROVISION_BASE64` — set by
  Andy from his Mac (files live there). Never committed.

## Server side

Unchanged. `tools/deploy-ios.sh` + `tools/README-deploy-ios.md` retired
(removed; recoverable from git history).

## Testing / risk

Can't run a macOS runner from this Linux session — the first push is the
integration test. Likely first-run snags: signing identity/profile specifier
exactness, a leftover widget reference, or live-activity code referencing the
removed extension. Iterate from the Actions log. Lost: Home Screen widgets +
Pomodoro Lock Screen live activity (widget removed) — accepted.

## Out of scope (YAGNI)

Signing the widget, the user's own Apple account, version history, multi-app.
