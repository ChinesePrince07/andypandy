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
PRESIGN_BODY="$(SLUG="$SLUG" HAS_ICON="$HAS_ICON" /usr/bin/python3 -c '
import json, os
icon = "image/png" if os.environ["HAS_ICON"] == "true" else None
print(json.dumps({"slug": os.environ["SLUG"], "ipaContentType": "application/octet-stream", "iconContentType": icon}))')"
PRESIGN="$(curl -fsS -X POST "$SITE/api/admin/ios/upload" \
  -H "Authorization: Bearer $IOS_UPLOAD_TOKEN" -H 'Content-Type: application/json' \
  -d "$PRESIGN_BODY")"

IPA_URL="$(echo "$PRESIGN" | /usr/bin/python3 -c 'import sys,json;print(json.load(sys.stdin)["ipaUploadUrl"])')"
ICON_URL="$(echo "$PRESIGN" | /usr/bin/python3 -c 'import sys,json;print(json.load(sys.stdin).get("iconUploadUrl") or "")')"

echo "==> Uploading .ipa…"
curl -fsS -X PUT "$IPA_URL" -H 'Content-Type: application/octet-stream' --data-binary @"$IPA" >/dev/null

if $HAS_ICON && [[ -n "$ICON_URL" ]]; then
  echo "==> Uploading icon…"
  curl -fsS -X PUT "$ICON_URL" -H 'Content-Type: image/png' --data-binary @"$ICON_PATH" >/dev/null
fi

echo "==> Registering build…"
REGISTER_BODY="$(SLUG="$SLUG" APP_TITLE="$APP_TITLE" BUNDLE_ID="$BUNDLE_ID" VERSION="$VERSION" BUILD="$BUILD" SIZE="$SIZE" HAS_ICON="$HAS_ICON" /usr/bin/python3 -c '
import json, os
print(json.dumps({
    "slug": os.environ["SLUG"],
    "appName": os.environ["APP_TITLE"],
    "bundleId": os.environ["BUNDLE_ID"],
    "version": os.environ["VERSION"],
    "build": os.environ["BUILD"],
    "sizeBytes": int(os.environ["SIZE"]),
    "hasIcon": os.environ["HAS_ICON"] == "true",
}))')"
curl -fsS -X POST "$SITE/api/admin/ios/register" \
  -H "Authorization: Bearer $IOS_UPLOAD_TOKEN" -H 'Content-Type: application/json' \
  -d "$REGISTER_BODY" >/dev/null

echo "==> Done. Install at: $SITE/apps  (open in Safari on your iPhone)"
