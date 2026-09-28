// Colors mirror the web app's CSS variables in `meal-host-frontend/src/index.css`
// (HSL there, hex here). FoodPal Brand Guideline v1.0 (2026).
//
//   Primary   #0003D5  electric blue   — every primary action
//   Secondary #FF3903  orange-red      — accents only, never behind small text
//   Cream     #F9F3EC  page background — white cards sit on top of it
//
// The two brand hexes are written literally rather than round-tripped through
// the web's HSL, which lands a shade off (#0004D6 / #FF3B05).
//
// White text on the brand orange measures ~3.6:1, under the WCAG AA 4.5:1
// floor — `secondaryStrong` is the darkened orange for any orange surface that
// carries text.
export const colors = {
  // Brand neutrals. White and black are palette entries in their own right
  // (Guideline v1.0 §neutrals) — named here so no screen has to spell "#fff".
  white: "#FFFFFF",
  black: "#000000",

  // FoodPal Blue — the primary action colour
  primary: "#0003D5",
  primaryForeground: "#FFFFFF",
  // Pale blue wash — tinted surfaces behind blue icons. Same value as the
  // legacy `lightSage` alias below; this is the name the rider app uses.
  primarySubtle: "#E7E7F9",

  // FoodPal Orange — accents, badges, highlights
  secondary: "#FF3903",
  secondaryForeground: "#FFFFFF",
  // AA-safe orange (~4.9:1 with white) for orange surfaces behind text
  secondaryStrong: "#D62E00",

  // Cream page, white cards on top
  background: "#F9F3EC",
  surface: "#FFFFFF",
  card: "#FFFFFF",
  cardBorder: "#E6DED6",

  foreground: "#141414",

  muted: "#F3EBE2",
  mutedForeground: "#616161",

  border: "#E6DED6",
  input: "#E2D9CF",

  // Crimson, deliberately clear of the brand orange
  destructive: "#CC1931",
  destructiveForeground: "#FFFFFF",
  destructiveSubtle: "#FDECEE",
  destructiveSubtleForeground: "#A51D2F",
  destructiveBorder: "#EFC8CD",

  // --- Status colours -------------------------------------------------
  // Meaning, not decoration. Kept distinct from brand blue/orange so a
  // status is never mistaken for a button.
  // One shade darker than the web's --success (hsl 152 60% 36% / #25935F).
  // That value carries white text at 3.88:1, under the WCAG AA floor, and it
  // is used with white text on open-kitchen badges, toasts and order-success.
  // Same hue and saturation, lightness 32% instead of 36%: 4.73:1.
  // The web has the identical problem and should take the same change.
  success: "#218355",
  successForeground: "#FFFFFF",
  successSubtle: "#E7F8F0",
  successSubtleForeground: "#156540",
  successBorder: "#BFE3D2",

  warning: "#DC8F09",
  warningForeground: "#141414",
  warningSubtle: "#FEF4E1",
  warningSubtleForeground: "#844B0B",
  warningBorder: "#F5D7A3",

  info: "#0003D5",
  infoForeground: "#FFFFFF",

  // A rating is not a status and not a brand accent
  rating: "#FAB80F",

  accent: "#FF3903",
  accentForeground: "#FFFFFF",
  // A tinted orange surface for the many places that want to read as "accent"
  // without shouting: chips, tags, selected rows, info banners, offer cards.
  // The full brand orange cannot carry text (white on it is 3.6:1, brand blue
  // on it is 2.96:1), and these surfaces all carry text. This pair measures
  // 6.8:1. The web reaches for `bg-accent/10 text-accent-foreground` here,
  // which pairs a pale tint with white text and is unreadable — not copied.
  accentSubtle: "#FFEAE3",
  accentSubtleForeground: "#9E2200",

  // --- Order status scale ---------------------------------------------
  // One entry per order status, matching --status-* on the web so an order
  // never changes colour between the app and the site.
  status: {
    pending: { bg: "#FEF4E1", fg: "#844B0B", border: "#F5D7A3" },
    active: { bg: "#E2F6F8", fg: "#0C636E", border: "#AEDDE0" },
    ready: { bg: "#F0E7FD", fg: "#5C29A3", border: "#D5C4EE" },
    done: { bg: "#E7F8F0", fg: "#156540", border: "#BFE3D2" },
    closed: { bg: "#EFEBE7", fg: "#595959", border: "#DAD2C8" },
    cancelled: { bg: "#FDECEE", fg: "#A51D2F", border: "#EFC8CD" },
  },

  // --- Legacy aliases ---------------------------------------------------
  // Names kept so existing call sites keep working; values remapped onto
  // the FoodPal palette.
  warmCream: "#F9F3EC",
  lightSage: "#E7E7F9", // pale blue tint

  // Gradient stops
  gradientPrimaryStart: "#0003D5",
  gradientPrimaryEnd: "#10089B",
  gradientSecondaryStart: "#FF3903",
  gradientSecondaryEnd: "#F05000",

  // --- Dark mode --------------------------------------------------------
  // The guideline ships no dark spec; these are the web's derived values.
  // Brand blue is lightened so it clears AA on dark surfaces.
  dark: {
    background: "#0C0C17",
    surface: "#151523",
    card: "#151523",
    cardBorder: "#2A2A3C",
    border: "#2A2A3C",
    muted: "#232334",
    mutedForeground: "#A5A5B6",
    foreground: "#F7F5F3",

    primary: "#7A81FF",
    primaryForeground: "#0C0C17",
    secondary: "#FF5F33",
    secondaryForeground: "#FFFFFF",
    // Two points darker than the web's dark --secondary-strong (13 100% 46%),
    // which carries white text at only 4.19:1. 13 100% 44% gives 4.56:1.
    secondaryStrong: "#E03100",
    accent: "#FF5F33",
    accentForeground: "#FFFFFF",
    accentSubtle: "#3A1A10",
    accentSubtleForeground: "#FFB59B",

    destructive: "#DA2F46",
    destructiveForeground: "#FFFFFF",

    success: "#38B279",
    successForeground: "#0C0C17",
    successSubtle: "#163B2A",
    successSubtleForeground: "#90DFBA",
    successBorder: "#2B5A44",

    warning: "#F6AE31",
    warningForeground: "#0C0C17",
    warningSubtle: "#3F2F12",
    warningSubtleForeground: "#F7C56E",
    warningBorder: "#685027",

    info: "#7A81FF",
    infoForeground: "#0C0C17",

    rating: "#FBC02D",

    warmCream: "#1F1F2E",
    lightSage: "#242438",

    gradientPrimaryStart: "#7A81FF",
    gradientPrimaryEnd: "#4C4EF0",
    gradientSecondaryStart: "#FF5F33",
    gradientSecondaryEnd: "#F96115",

    status: {
      pending: { bg: "#3F2F12", fg: "#F7C56E", border: "#685027" },
      active: { bg: "#103337", fg: "#6CDDE5", border: "#28575D" },
      ready: { bg: "#2A1943", fg: "#C5A3F5", border: "#483267" },
      done: { bg: "#163B2A", fg: "#90DFBA", border: "#2B5A44" },
      closed: { bg: "#272735", fg: "#A7A7B4", border: "#3D3D52" },
      cancelled: { bg: "#3F181D", fg: "#F28896", border: "#673239" },
    },
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  "2xl": 48,
  "3xl": 64,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 28,
  full: 9999,
};

export const typography = {
  xs: { fontSize: 11, lineHeight: 16 },
  sm: { fontSize: 13, lineHeight: 18 },
  base: { fontSize: 15, lineHeight: 22 },
  md: { fontSize: 16, lineHeight: 24 },
  lg: { fontSize: 18, lineHeight: 26 },
  xl: { fontSize: 20, lineHeight: 28 },
  "2xl": { fontSize: 24, lineHeight: 32 },
  "3xl": { fontSize: 28, lineHeight: 36 },
};

// Font families — loaded in app/_layout.tsx via useFonts.
// The web ships Poppins as its FoodPal face (self-hosted via @fontsource in
// `meal-host-frontend/src/main.tsx`): it is the open-licensed geometric sans
// closest to the FoodPal wordmark, since Garet itself is commercially
// licensed. Mobile uses the same family so both products read alike.
// `display*` tokens are just heavier Poppins weights — there is no serif face.
export const fonts = {
  sans: "Poppins_400Regular",
  sansMedium: "Poppins_500Medium",
  sansSemiBold: "Poppins_600SemiBold",
  sansBold: "Poppins_700Bold",
  sansExtraBold: "Poppins_800ExtraBold",
  display: "Poppins_800ExtraBold",
  displayMedium: "Poppins_700Bold",
  displaySemiBold: "Poppins_600SemiBold",
};

export const shadow = {
  sm: {
    shadowColor: "#0003D5",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  md: {
    shadowColor: "#0003D5",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: "#0003D5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  },
};
