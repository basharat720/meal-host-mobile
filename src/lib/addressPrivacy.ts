/**
 * A chef's exact street address is private until an order is confirmed, so
 * anything shown before that point goes through here first: the customer sees
 * a locality, a postal code and roughly how far away it is, never the door.
 *
 * Ported from the web app's src/lib/utils.ts. See its
 * documentation/ADDRESS_PRIVACY_IMPLEMENTATION.md.
 */

/**
 * Extract a postal code from an address.
 * Supports Pakistani (54000), US (12345), Canadian (M5V 3A8) and UK (SW1A 2AA)
 * formats. Returns null when there's nothing that looks like one.
 */
export function extractPostalCode(address: string | undefined | null): string | null {
  if (!address) return null;

  // Canadian: A1A 1A1 or A1A1A1. Checked first so it isn't read as UK.
  const canadian = address.match(/\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b/i);
  if (canadian) return canadian[0].toUpperCase();

  // UK: SW1A 1AA and friends.
  const uk = address.match(/\b[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}\b/i);
  if (uk) return uk[0].toUpperCase();

  // US ZIP+4: 12345-6789. Checked before the 5-digit form so it isn't clipped.
  const zipPlusFour = address.match(/\b\d{5}-\d{4}\b/);
  if (zipPlusFour) return zipPlusFour[0];

  // Pakistani / US 5-digit, but not the leading digits of a longer number.
  const fiveDigit = address.match(/\b\d{5}(?!\d)/);
  if (fiveDigit) return fiveDigit[0];

  return null;
}

/** Great-circle distance in kilometres between two points. */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometres
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/** "~800m away" / "~2.4km away". */
export function formatDistance(km: number): string {
  if (km < 1) return `~${Math.round(km * 1000)}m away`;
  return `~${km.toFixed(1)}km away`;
}

/**
 * Pull a locality out of a Pakistani-style address by name.
 *
 * Only very specific, unambiguous shapes are matched — a loose pattern here
 * risks reporting the wrong area, which is worse than falling through to the
 * comma-splitting logic below.
 */
function extractPakistaniArea(address: string): string | null {
  const trimmed = address.trim();

  const patterns = [
    // Gulshan / Gulberg / Gulistan areas
    /\b(Gul(?:shan|berg|istan)[-e\s]+[\w\s-]+?)(?:,|\s+Block|\s+Sector|\s*$)/i,
    // DHA phases
    /\b(DHA\s*Phase[-\s]?\d+)/i,
    // Bahria Town
    /\b(Bahria\s+Town(?:\s+Phase\s+\d+)?)/i,
    // Named towns
    /\b((?:Model|Garden|Johar)\s+Town)/i,
    // Sectors, e.g. "G-11" or "F-10/3"
    /\b([A-Z]-\d+(?:\/\d+)?)/,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match) return match[1].trim();
  }

  // Null means "let the comma logic handle it".
  return null;
}

// Too generic to identify an area, so never shown on their own.
const PROVINCES = ["punjab", "sindh", "kpk", "balochistan", "baluchistan", "pakistan"];
const GENERIC_TERMS = [
  "road",
  "street",
  "avenue",
  "lane",
  "boulevard",
  "campus",
  "university",
  "college",
  "school",
];
// Building identifiers — precise enough to be the thing we're hiding.
const BUILDING_PREFIXES = ["house", "plot", "flat", "apartment", "apt", "unit", "shop"];

/**
 * Mask an address down to its locality, with the postal code and, when known,
 * the distance to the customer.
 *
 * @param address  The chef's full address.
 * @param distance Distance to the customer in km. Omit when unknown.
 */
export function maskAddressEnhanced(
  address: string | undefined | null,
  distance?: number
): string {
  if (!address || address.trim() === "") {
    return "Pickup area will be confirmed";
  }

  const postalCode = extractPostalCode(address);
  const trimmed = address.trim();
  let result = "";

  const pakistaniArea = extractPakistaniArea(trimmed);
  if (pakistaniArea) {
    result = postalCode ? `${pakistaniArea} (${postalCode})` : pakistaniArea;
  } else if (trimmed.includes(",")) {
    const parts = trimmed
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    const meaningfulParts = parts.filter((p) => {
      const lower = p.toLowerCase();
      if (PROVINCES.includes(lower)) return false;
      if (GENERIC_TERMS.includes(lower)) return false;
      // "House 567", "Plot 123" — a building number, not an area.
      if (BUILDING_PREFIXES.some((prefix) => lower.startsWith(prefix + " "))) return false;
      // Very long parts are usually a whole address crammed into one field.
      if (p.length > 50) return false;
      return true;
    });

    // Addresses run specific → general ("Askari X, Lahore, Punjab, Pakistan"),
    // so the first part that looks like a locality name is the best one.
    let bestPart: string | null = null;
    for (const part of meaningfulParts) {
      const wordCount = part.split(/\s+/).length;
      if (wordCount >= 1 && wordCount <= 4 && part.length <= 35) {
        const hasGenericTerm = GENERIC_TERMS.some((term) =>
          part.toLowerCase().includes(term)
        );
        if (!hasGenericTerm) {
          bestPart = part;
          break;
        }
      }
    }

    // Nothing specific enough: fall back to the last part, usually the city.
    if (!bestPart && meaningfulParts.length > 0) {
      bestPart = meaningfulParts[meaningfulParts.length - 1];
    }
    if (!bestPart && parts.length > 0) {
      bestPart = parts[0];
    }

    if (bestPart) {
      result = postalCode ? `${bestPart} (${postalCode})` : bestPart;
    } else {
      result = postalCode ? `Postal area: ${postalCode}` : "General area";
    }
  } else {
    // No commas to split on.
    if (postalCode) {
      result = `Postal area: ${postalCode}`;
    } else {
      // Last resort: keep the tail, star out the rest.
      const visibleLength = Math.floor(trimmed.length * 0.3);
      const maskedLength = trimmed.length - visibleLength;
      if (maskedLength > 0) {
        result = `${"*".repeat(Math.min(maskedLength, 15))}${trimmed.slice(maskedLength)}`;
      } else {
        result = "Pickup area near chef";
      }
    }
  }

  if (distance !== undefined && distance >= 0) {
    result = `${result} • ${formatDistance(distance)}`;
  }

  return result;
}

/**
 * Format a 24-hour clock string ("HH:MM" / "HH:MM:SS") as 12-hour time.
 * Always 12-hour regardless of device locale. Returns "" if unparseable.
 */
export function formatTime12h(hhmm: string | undefined | null): string {
  if (!hhmm) return "";

  const match = /^(\d{1,2}):(\d{2})/.exec(hhmm.trim());
  if (!match) return "";

  const hours24 = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours24 > 23 || minutes > 59) return "";

  const suffix = hours24 < 12 ? "AM" : "PM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;

  return `${hours12}:${match[2]} ${suffix}`;
}
