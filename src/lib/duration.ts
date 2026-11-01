/**
 * Human-friendly duration formatting for preparation times and ETAs.
 *
 * Durations are stored in MINUTES throughout the app. Anything over an hour is
 * rendered in hours, and a day or more in days + hours (1440 min → "1 day",
 * not "24 hrs" or "1440 min").
 */

const MINUTES_PER_DAY = 24 * 60;

/** Format a single duration (in minutes) as a label. */
export function formatDuration(
  minutes: number | null | undefined,
  opts?: { compact?: boolean }
): string {
  const compact = opts?.compact ?? false;
  const m = Number(minutes);
  if (!Number.isFinite(m) || m <= 0) return compact ? "0m" : "0 min";

  // Up to and including 60 minutes → keep minutes.
  if (m <= 60) return compact ? `${Math.round(m)}m` : `${Math.round(m)} min`;

  // A day or more → days + hours; leftover minutes round into the hour.
  if (m >= MINUTES_PER_DAY) {
    const totalHours = Math.round(m / 60);
    const days = Math.floor(totalHours / 24);
    const hrs = totalHours % 24;
    if (compact) return hrs === 0 ? `${days}d` : `${days}d ${hrs}h`;
    const dayLabel = `${days} ${days === 1 ? "day" : "days"}`;
    return hrs === 0 ? dayLabel : `${dayLabel} ${hrs} ${hrs === 1 ? "hr" : "hrs"}`;
  }

  // Over 60 minutes → hours (with a minutes remainder when not a whole hour).
  const hrs = Math.floor(m / 60);
  const rem = Math.round(m % 60);
  if (compact) return rem === 0 ? `${hrs}h` : `${hrs}h ${rem}m`;
  const hourLabel = hrs === 1 ? "hr" : "hrs";
  return rem === 0 ? `${hrs} ${hourLabel}` : `${hrs} ${hourLabel} ${rem} min`;
}

/**
 * Format an ETA range (min–max, in minutes). Returns null when there is no
 * lower bound. Collapses to a single "~value" when both bounds match, keeps the
 * compact "lo–hi min" form while both bounds are within an hour, and switches to
 * hours once either bound exceeds 60 minutes.
 */
export function formatDurationRange(
  minMinutes: number | null | undefined,
  maxMinutes: number | null | undefined
): string | null {
  const lo = Number(minMinutes);
  const hi = maxMinutes == null ? lo : Number(maxMinutes);
  if (!Number.isFinite(lo) || lo <= 0) return null;
  if (lo === hi) return `~${formatDuration(lo)}`;
  if (lo <= 60 && hi <= 60) return `${Math.round(lo)}–${Math.round(hi)} min`;
  return `${formatDuration(lo)} – ${formatDuration(hi)}`;
}
