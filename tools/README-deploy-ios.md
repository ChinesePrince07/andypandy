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
