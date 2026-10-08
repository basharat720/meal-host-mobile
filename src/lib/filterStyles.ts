/**
 * Orange tokens for the advanced-filter controls.
 *
 * The mobile mirror of `meal-host-frontend/src/lib/filterStyles.ts`: on the web
 * the shared UI primitives are brand blue — which is right for the rest of the
 * app — and the filter panels override them to orange. The same split applies
 * here, so these are exported as tokens the filter sheets reach for rather than
 * being baked into `components/ui`, which the chef dashboard and dish page
 * share and which stay blue.
 *
 * `secondaryStrong` is the darkened brand orange. The raw `secondary` falls
 * below the WCAG AA contrast floor, and these are interactive controls.
 */
import { colors } from "@/constants/theme";

/** Selected chip / radio / switch / slider colour. */
export const FILTER_ACCENT = colors.secondaryStrong;

/** Text and icons sitting on a solid `FILTER_ACCENT` fill. */
export const FILTER_ACCENT_ON = colors.secondaryForeground;

/** Tinted fill behind a selected chip — the web's `bg-secondary-strong/10`. */
export const FILTER_ACCENT_SUBTLE = `${colors.secondaryStrong}1A`;

/** The slider's unfilled track — the web's `bg-secondary-strong/20`. */
export const FILTER_ACCENT_TRACK = `${colors.secondaryStrong}33`;

/** Border of an idle chip that hints at the accent — `border-secondary-strong/50`. */
export const FILTER_ACCENT_BORDER_IDLE = `${colors.secondaryStrong}80`;
