import {
  parsePhoneNumberFromString,
  getCountries,
  getCountryCallingCode,
  AsYouType,
  type CountryCode,
} from "libphonenumber-js";
import countryLabels from "react-phone-number-input/locale/en.json";

/**
 * Country pre-selected by the phone field when it is empty, and the country
 * assumed when parsing a legacy number that was stored without a country code.
 * See feature-docs/11-phone-number-entry.md.
 */
export const DEFAULT_PHONE_COUNTRY: CountryCode = "PK";

export const getCountryName = (country?: CountryCode): string | undefined =>
  country ? (countryLabels as Record<string, string>)[country] : undefined;

/**
 * True when the number is a valid number for whichever country it belongs to.
 * Numbers with no country code are interpreted as DEFAULT_PHONE_COUNTRY.
 */
export const isValidPhone = (phone: string): boolean =>
  Boolean(parsePhoneNumberFromString(phone, DEFAULT_PHONE_COUNTRY)?.isValid());

/**
 * Normalises anything the user (or an old database row) gives us to E.164,
 * e.g. "0300 123 4567" -> "+923001234567". Returns the input untouched when it
 * can't be parsed, so we never silently discard a number we don't understand.
 */
export const toE164 = (phone: string): string => {
  if (!phone?.trim()) return "";
  const parsed = parsePhoneNumberFromString(phone, DEFAULT_PHONE_COUNTRY);
  return parsed?.isValid() ? parsed.number : phone;
};

/** Human-readable international form, e.g. "+92 300 1234567". */
export const formatPhoneForDisplay = (phone: string): string => {
  if (!phone?.trim()) return "";
  const parsed = parsePhoneNumberFromString(phone, DEFAULT_PHONE_COUNTRY);
  return parsed?.isValid() ? parsed.formatInternational() : phone;
};

/** The country a stored number belongs to, for pre-selecting the picker. */
export const getPhoneCountry = (phone?: string): CountryCode | undefined =>
  phone ? parsePhoneNumberFromString(phone, DEFAULT_PHONE_COUNTRY)?.country : undefined;

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates a phone number against the rules of its own country. Numbers
 * without a country code are read as DEFAULT_PHONE_COUNTRY.
 */
export const validatePhoneNumber = (
  phone: string,
  required: boolean = false
): ValidationResult => {
  if (!phone || phone.trim() === "") {
    if (required) {
      return { isValid: false, error: "Phone number is required" };
    }
    return { isValid: true }; // Optional field
  }

  const parsed = parsePhoneNumberFromString(phone, DEFAULT_PHONE_COUNTRY);

  if (!parsed?.isValid()) {
    const country = getCountryName(parsed?.country);
    return {
      isValid: false,
      error: country
        ? `Enter a valid phone number for ${country}`
        : "Enter a valid phone number, including the country code",
    };
  }

  return { isValid: true };
};

// --- Picker support -------------------------------------------------------
// Web gets its country list, labels and flag artwork from
// react-phone-number-input's React components, which are DOM-only. The native
// picker is hand-rolled, so the list it renders is built here instead.

export interface PhoneCountry {
  code: CountryCode;
  /** Country name, from the same label set web uses. */
  name: string;
  /** Dial code without the "+", e.g. "92". */
  callingCode: string;
  /** Flag as regional-indicator emoji, e.g. "🇵🇰". */
  flag: string;
}

/** ISO 3166-1 alpha-2 -> regional indicator symbols, which render as a flag. */
export const countryFlagEmoji = (code: string): string =>
  code
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .split("")
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");

/** Every country libphonenumber knows, sorted by name. Built once. */
export const PHONE_COUNTRIES: PhoneCountry[] = getCountries()
  .map((code) => ({
    code,
    name: getCountryName(code) ?? code,
    callingCode: getCountryCallingCode(code),
    flag: countryFlagEmoji(code),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

/** Match a picker search term against a country's name, ISO code or dial code. */
export const matchesCountry = (country: PhoneCountry, search: string): boolean => {
  const q = search.trim().toLowerCase().replace(/^\+/, "");
  if (!q) return true;
  return (
    country.name.toLowerCase().includes(q) ||
    country.code.toLowerCase().includes(q) ||
    country.callingCode.includes(q)
  );
};

/**
 * Group the digits the user has typed so far, in their selected country's own
 * format ("3001234567" -> "300 1234567" for PK). Digits only in, so a partial
 * number never reformats into something the user didn't type.
 */
export const formatNationalAsYouType = (
  digits: string,
  country: CountryCode
): string => {
  if (!digits) return "";
  // input() returns the text formatted so far; for a national-only input that
  // is the country's own grouping. Fall back to the raw digits for countries
  // libphonenumber has no template for.
  return new AsYouType(country).input(digits) || digits;
};

/**
 * Assemble a stored E.164 value from the picker's country and the digits in
 * the text field. Returns "" for an empty field so an untouched optional
 * phone field stays empty rather than becoming a bare dial code.
 */
export const composeE164 = (country: CountryCode, nationalDigits: string): string => {
  const digits = nationalDigits.replace(/\D/g, "");
  if (!digits) return "";
  return `+${getCountryCallingCode(country)}${digits}`;
};

/**
 * Split a stored value into what the picker and the text field should show.
 * Falls back to DEFAULT_PHONE_COUNTRY for a blank or unparseable value, so a
 * legacy national-format row still lands on the right country.
 */
export const splitE164 = (
  value?: string
): { country: CountryCode; nationalDigits: string } => {
  if (!value?.trim()) return { country: DEFAULT_PHONE_COUNTRY, nationalDigits: "" };
  const parsed = parsePhoneNumberFromString(value, DEFAULT_PHONE_COUNTRY);
  if (parsed?.country) {
    return { country: parsed.country, nationalDigits: parsed.nationalNumber };
  }
  return { country: DEFAULT_PHONE_COUNTRY, nationalDigits: value.replace(/\D/g, "") };
};
