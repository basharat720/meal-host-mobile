/**
 * Helpers for the numeric profile fields — years of experience (whole years)
 * and delivery radius (km, one decimal). They are typed into text inputs but
 * stored as numbers, so input is restricted to digits as it is typed and
 * re-validated on save.
 */

/** Render a stored number back into its text input ("" when unset). */
export const numberToField = (value?: number | null): string =>
  value === null || value === undefined ? "" : String(value);

/**
 * Strip anything that cannot be part of a number as the user types, so the
 * field can never hold text the API would reject. Keeps at most one decimal
 * point, and only when the field allows decimals.
 */
export const sanitizeNumericInput = (
  value: string,
  { allowDecimal = false }: { allowDecimal?: boolean } = {},
): string => {
  const cleaned = value.replace(allowDecimal ? /[^\d.]/g : /\D/g, "");
  if (!allowDecimal) return cleaned;
  const [whole, ...rest] = cleaned.split(".");
  return rest.length ? `${whole}.${rest.join("")}` : whole;
};

/**
 * Parse a typed value for the API. Returns `null` for a blank field (an
 * explicit "clear this") and `undefined` when there is no number to send.
 */
export const fieldToNumber = (value: string): number | null | undefined => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
};

/**
 * Validate a numeric field before saving. Returns an error message, or null
 * when the value is acceptable (blank counts as acceptable — it clears the
 * stored value). Bounds mirror the backend's schema constraints so a bad
 * value is caught here rather than coming back as a 422.
 */
export const validateNumericField = (
  value: string,
  {
    label,
    min,
    max,
    integer = false,
  }: { label: string; min: number; max: number; integer?: boolean },
): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return `${label} must be a number`;
  if (integer && !Number.isInteger(parsed)) {
    return `${label} must be a whole number`;
  }
  if (parsed < min || parsed > max) {
    return `${label} must be between ${min} and ${max}`;
  }
  return null;
};
