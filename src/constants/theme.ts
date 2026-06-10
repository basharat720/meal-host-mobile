// Colors match the web app's CSS variables exactly (converted from HSL to hex)
export const colors = {
  // Deep Teal — hsl(168 65% 38%) — primary brand identity
  primary: "#2D8B7F",
  primaryForeground: "#FEFCFA",

  // Light sage — used for chip/tag backgrounds (web: --light-sage)
  secondary: "#D6EDE9",
  secondaryForeground: "#1A2626",

  // Warm cream background — hsl(45 25% 97%)
  background: "#F9F7F3",
  surface: "#FFFFFF",

  // Dark teal text — hsl(180 25% 12%)
  foreground: "#1A2626",

  card: "#FFFFFF",
  cardBorder: "#E2DDD5",

  // Soft cream — hsl(45 30% 92%)
  muted: "#EDE7DA",
  mutedForeground: "#5A706E",

  border: "#E2DDD5",

  destructive: "#E02222",
  destructiveForeground: "#FEFCFA",

  // Green — hsl(152 60% 42%)
  success: "#3BA965",
  successForeground: "#FEFCFA",

  // Golden honey — hsl(38 92% 55%)
  warning: "#F5B419",

  // Warm coral — hsl(12 85% 62%) — secondary brand CTA
  accent: "#E67043",
  accentForeground: "#FEFCFA",

  // Extra brand tokens
  warmCream: "#F5EFE3",
  lightSage: "#D6EDE9",

  // Gradient stops
  gradientPrimaryStart: "#2D8B7F",
  gradientPrimaryEnd: "#1F6B61",
  gradientSecondaryStart: "#E67043",
  gradientSecondaryEnd: "#D45A2A",

  // Dark mode
  dark: {
    background: "#0F1818",
    surface: "#182121",
    card: "#182121",
    cardBorder: "#2A3636",
    border: "#2A3636",
    muted: "#263030",
    mutedForeground: "#ADA89B",
    foreground: "#F5F2EE",
    primary: "#33B5A3",
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

// Font families — loaded in app/_layout.tsx via useFonts
export const fonts = {
  sans: "Nunito_400Regular",
  sansMedium: "Nunito_500Medium",
  sansSemiBold: "Nunito_600SemiBold",
  sansBold: "Nunito_700Bold",
  sansExtraBold: "Nunito_800ExtraBold",
  display: "PlayfairDisplay_700Bold",
  displayMedium: "PlayfairDisplay_600SemiBold",
  displaySemiBold: "PlayfairDisplay_600SemiBold",
};

export const shadow = {
  sm: {
    shadowColor: "#1A2626",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  md: {
    shadowColor: "#1A2626",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: "#2D8B7F",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  },
};
