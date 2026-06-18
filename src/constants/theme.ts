// Colors match the web app's CSS variables exactly (converted from HSL to hex)
export const colors = {
  // Deep Forest Green — hsl(157 77% 10%) — primary brand identity
  primary: "#062D1E",
  primaryForeground: "#FFFFFF",

  // Warm Gold — hsl(40 62% 48%) — secondary/accent brand token
  secondary: "#C5922F",
  secondaryForeground: "#FFFFFF",

  // Pure white background (web: --background: 0 0% 100%)
  background: "#FFFFFF",
  surface: "#FFFFFF",

  // Dark forest green text — hsl(157 77% 10%)
  foreground: "#062D1E",

  card: "#FFFFFF",
  cardBorder: "#DCE5E2",

  // Soft sage muted — hsl(157 20% 96%)
  muted: "#F3F7F5",
  mutedForeground: "#4C675C",

  border: "#DCE5E2",

  destructive: "#E02222",
  destructiveForeground: "#FFFFFF",

  // Green — hsl(152 60% 42%)
  success: "#3BA965",
  successForeground: "#FFFFFF",

  // Warm gold — hsl(38 70% 42%) for warnings
  warning: "#C5922F",

  // Warm Gold accent — hsl(40 62% 48%)
  accent: "#C5922F",
  accentForeground: "#062D1E",

  // Extra brand tokens
  warmCream: "#F7F5ED",
  lightSage: "#E4F2EC",

  // Gradient stops (Deep Forest Green)
  gradientPrimaryStart: "#0D5233",
  gradientPrimaryEnd: "#062D1E",
  gradientSecondaryStart: "#C5922F",
  gradientSecondaryEnd: "#B8860B",

  // Dark mode
  dark: {
    background: "#061510",
    surface: "#0D2218",
    card: "#0D2218",
    cardBorder: "#1A3528",
    border: "#1A3528",
    muted: "#112B1E",
    mutedForeground: "#8AB09A",
    foreground: "#F0F5F3",
    primary: "#33CC91",
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
    shadowColor: "#062D1E",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  md: {
    shadowColor: "#062D1E",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: "#062D1E",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  },
};
