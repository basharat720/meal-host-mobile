#!/usr/bin/env bash
# Downloads the latest finished Android "preview" APK from EAS and uploads it to
# Firebase App Distribution.
#
# Prerequisites (one-time):
#   - eas login   and   firebase login
#   - Android app registered in Firebase project "mealhost-dev" with package
#     com.mealhost.mobile  ->  copy its App ID (1:837237844814:android:....)
#   - Set FIREBASE_ANDROID_APP_ID below (or export it in your shell).
#
# Usage:
#   ./scripts/distribute.sh "Release notes describing what changed"
set -euo pipefail

# 1:837237844814:android:XXXXXXXX  -- fill this in after registering the
# Android app in the Firebase console (see the guide, Step 4).
FIREBASE_ANDROID_APP_ID="${FIREBASE_ANDROID_APP_ID:-1:837237844814:android:fc78e5e547c581478e4c1f}"
TESTER_GROUP="${TESTER_GROUP:-app_testing}"
RELEASE_NOTES="${1:-New Pakwanhus internal build}"

if [[ "$FIREBASE_ANDROID_APP_ID" == REPLACE_* ]]; then
  echo "ERROR: set FIREBASE_ANDROID_APP_ID in scripts/distribute.sh first." >&2
  exit 1
fi

echo "==> Fetching latest finished Android preview build URL from EAS..."
APK_URL=$(eas build:list --platform android --profile preview \
  --status finished --limit 1 --json --non-interactive \
  | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const b=JSON.parse(d)[0];if(!b){console.error("No finished build found");process.exit(1);}process.stdout.write(b.artifacts.buildUrl)})')

echo "==> Downloading APK..."
curl -L -o /tmp/pakwanhus-preview.apk "$APK_URL"

echo "==> Uploading to Firebase App Distribution..."
firebase appdistribution:distribute /tmp/pakwanhus-preview.apk \
  --app "$FIREBASE_ANDROID_APP_ID" \
  --groups "$TESTER_GROUP" \
  --release-notes "$RELEASE_NOTES"

echo "==> Done."
