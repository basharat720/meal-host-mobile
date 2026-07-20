#!/usr/bin/env bash
# One command: rebuild the Android release APK locally and ship it to Firebase
# App Distribution (group "app_testing"). No source upload to Expo.
#
# Usage:
#   ./scripts/rebuild-and-ship.sh ["release notes"]
#   ./scripts/rebuild-and-ship.sh "fixed checkout crash"
#
# With no notes, a timestamped default is used.
# Env (JAVA_HOME/ANDROID_HOME/Node) is set explicitly so it works from any shell.
set -euo pipefail

# ---- config ----
FIREBASE_ANDROID_APP_ID="${FIREBASE_ANDROID_APP_ID:-1:837237844814:android:fc78e5e547c581478e4c1f}"
TESTER_GROUP="${TESTER_GROUP:-app_testing}"
NODE_VERSION="${NODE_VERSION:-20.19.4}"
# Production backend baked into the release bundle. Exported below so it wins over
# the LAN IP in .env.local (Expo keeps an already-set EXPO_PUBLIC_* var).
BACKEND_URL="${EXPO_PUBLIC_BACKEND_API_URL:-https://api.pakwanhus.com}"

# ---- resolve paths relative to this script ----
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"w
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ANDROID_DIR="$PROJECT_DIR/android"
APK_OUT="$ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"
APK_SHIP="$PROJECT_DIR/pakwanhus-preview.apk"

RELEASE_NOTES="${1:-Pakwanhus v1.0.0 rebuild $(date '+%Y-%m-%d %H:%M')}"

# ---- toolchain env ----
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" && nvm use "$NODE_VERSION" >/dev/null
export JAVA_HOME="/opt/homebrew/opt/openjdk@17"
export ANDROID_HOME="/opt/homebrew/share/android-commandlinetools"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"

# Force the production backend into the JS bundle (overrides .env.local LAN IP).
export EXPO_PUBLIC_BACKEND_API_URL="$BACKEND_URL"

if [ ! -d "$ANDROID_DIR" ]; then
  echo "ERROR: $ANDROID_DIR not found. Run 'npx expo prebuild --platform android' first." >&2
  exit 1
fi

echo "==> Node $(node -v), Java $(java -version 2>&1 | head -1)"
echo "==> Backend baked into bundle: $EXPO_PUBLIC_BACKEND_API_URL"
echo "==> [1/3] Building release APK (gradlew assembleRelease)..."
# Delete the cached JS bundle so Metro re-bundles with the current env (a changed
# env var alone does not invalidate Gradle's up-to-date check).
rm -rf "$ANDROID_DIR/app/build/generated/assets/createBundleReleaseJsAndAssets" \
       "$ANDROID_DIR/app/build/generated/res/createBundleReleaseJsAndAssets" 2>/dev/null || true
( cd "$ANDROID_DIR" && ./gradlew assembleRelease --no-daemon )

if [ ! -f "$APK_OUT" ]; then
  echo "ERROR: build finished but APK not found at $APK_OUT" >&2
  exit 1
fi

echo "==> [2/3] Copying APK -> $APK_SHIP"
cp "$APK_OUT" "$APK_SHIP"
ls -lh "$APK_SHIP"

echo "==> [3/3] Distributing to Firebase App Distribution (group: $TESTER_GROUP)..."
firebase appdistribution:distribute "$APK_SHIP" \
  --app "$FIREBASE_ANDROID_APP_ID" \
  --groups "$TESTER_GROUP" \
  --release-notes "$RELEASE_NOTES"

echo ""
echo "==> Done. Shipped: $RELEASE_NOTES"
