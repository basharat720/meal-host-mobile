#!/usr/bin/env bash
# Pushes the EXPO_PUBLIC_* variables to the EAS "preview" environment so cloud
# builds have them (EAS does NOT read your local .env.local).
# These are all client-embedded (EXPO_PUBLIC_*) values, so "plaintext" is fine.
# Run once, and re-run whenever a value changes.  Requires: eas login first.
set -euo pipefail

ENVIRONMENT=preview

create() {
  # create, or update if it already exists
  eas env:create --environment "$ENVIRONMENT" --name "$1" --value "$2" \
    --visibility plaintext --non-interactive --force
}

# IMPORTANT: production backend, NOT the LAN IP used for local dev.
create EXPO_PUBLIC_BACKEND_API_URL          "https://api.pakwanhus.com"

create EXPO_PUBLIC_FIREBASE_API_KEY         "AIzaSyB2wArLAPSwUP1NCmz_u8hz52V9Y9lmSW8"
create EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN      "mealhost-dev.firebaseapp.com"
create EXPO_PUBLIC_FIREBASE_PROJECT_ID       "mealhost-dev"
create EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET   "mealhost-dev.firebasestorage.app"
create EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID "837237844814"
create EXPO_PUBLIC_FIREBASE_APP_ID           "1:837237844814:web:224a6b389f8b173f8e4c1f"

create EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME     "dip5rqzz5"
create EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET  "food-images"

echo ""
echo "Done. Verify with: eas env:list --environment $ENVIRONMENT"
