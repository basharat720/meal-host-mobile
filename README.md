# Pakwanhus Mobile

Expo SDK 56 · React Native · Expo Router · TypeScript

## Prerequisites

- Node.js 18+
- [Expo Go](https://expo.dev/go) on your phone (iOS or Android)
- Mac/PC and phone on the **same Wi-Fi**

## Setup

```bash
npm install
cp .env.local.example .env.local   # then fill in values (see below)
npx expo start --clear
```

Scan the QR code with Expo Go.

## Environment Variables (`.env.local`)

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_BACKEND_API_URL` | Backend API base URL — use your Mac's **LAN IP** (e.g. `http://192.168.18.71:8000`) so the phone can reach it. Find it with `ipconfig getifaddr en0`. |
| `EXPO_PUBLIC_FIREBASE_API_KEY` | Firebase project API key |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | e.g. `your-project.firebaseapp.com` |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID |
| `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` | e.g. `your-project.firebasestorage.app` |
| `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | Firebase app ID |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Google OAuth web client ID (optional — Google Sign-In requires a custom dev build, not Expo Go) |
| `EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name (for image uploads) |
| `EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | Cloudinary unsigned upload preset |

> **Never commit `.env.local`** — it is gitignored.

## Running the backend locally

The backend (FastAPI) must be started with `--host 0.0.0.0` so the phone can reach it:

```bash
cd ../meal-host
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Then set `EXPO_PUBLIC_BACKEND_API_URL=http://<your-lan-ip>:8000` in `.env.local`.

## Notes

- **Stripe** is not wired in Expo Go — only CASH payment works.
- **Google Sign-In** requires a custom dev build (`eas build`).
- **Push notifications** require an EAS build with FCM configured.
