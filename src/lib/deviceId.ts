/**
 * This phone's ID, sent to the backend as `X-Device-Id`.
 *
 * The backend uses it so a first-order offer is one per device, not one per
 * account: signing up again with another email on the same phone doesn't get
 * the discount twice.
 *
 * - Android: the Android ID (stable for this app on this phone, survives a
 *   reinstall).
 * - iOS: the vendor ID, saved in the Keychain on first read. The Keychain
 *   outlives a reinstall, while the vendor ID itself can change after one.
 *
 * Never throws: if nothing can be read the request just goes without it.
 * See the `meal-host` repo's feature-docs/27-vouchers.md ("One first-order
 * discount per device and phone number").
 */
import * as Application from "expo-application";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const STORE_KEY = "foodpal_device_id";
// What the backend accepts: 8–128 of letters, digits and . _ : -
const VALID = /^[A-Za-z0-9._:-]{8,128}$/;

let pending: Promise<string | null> | null = null;

function randomHex(): string {
  let out = "";
  for (let i = 0; i < 32; i++) out += Math.floor(Math.random() * 16).toString(16);
  return out;
}

async function resolve(): Promise<string | null> {
  try {
    const saved = await SecureStore.getItemAsync(STORE_KEY);
    if (saved && VALID.test(saved)) return saved;
  } catch {
    // Keychain unavailable: fall through and read the OS ID each launch.
  }

  let raw: string | null = null;
  try {
    if (Platform.OS === "android") raw = Application.getAndroidId();
    else if (Platform.OS === "ios") raw = await Application.getIosIdForVendorAsync();
  } catch {
    raw = null;
  }
  const id = `${Platform.OS}:${(raw || randomHex()).replace(/[^A-Za-z0-9-]/g, "")}`.slice(0, 128);
  if (!VALID.test(id)) return null;

  try {
    await SecureStore.setItemAsync(STORE_KEY, id);
  } catch {
    // Not saved: the next launch reads the OS ID again.
  }
  return id;
}

/** This phone's device ID, or null if none could be made. */
export function getDeviceId(): Promise<string | null> {
  if (!pending) {
    pending = resolve().catch(() => null);
  }
  return pending;
}
