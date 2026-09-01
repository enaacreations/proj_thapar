/**
 * Uniliv "Sunset" theme. Values are copied verbatim from the design system
 * spec — do not restyle them here.
 */

export const light = {
  surface: "#FCF9F6",
  card: "#FFFFFF",
  border: "#EFE6DE",
  ink: "#241A15",
  muted: "#7C6E64",
  mutedBg: "#F4EDE6",
  secondaryBorder: "#E6D9CE",
  badgeOutline: "#E0D3C7",
  accent: "#E8602C",
  accentStrong: "#C24A1C",
  pop: "#7C5CFF",
  success: "#157F5B",
  successBg: "#E7F3EE",
  warning: "#9A6206",
  warningBg: "#F7EEDD",
  danger: "#C73B33",
  dangerBg: "#F9E9E8",
  info: "#3666CF",
  infoBg: "#E9EFFA",
  pressOverlay: "rgba(120,110,100,0.18)",
  onAccent: "#FFFFFF",
};

export const dark: typeof light = {
  surface: "#181210",
  card: "#221A16",
  border: "#322620",
  ink: "#F2E9E3",
  muted: "#A99C92",
  mutedBg: "#2A201B",
  secondaryBorder: "#3A2C24",
  badgeOutline: "#3A2C24",
  accent: "#F2703A",
  accentStrong: "#FF8A52",
  pop: "#9B82FF",
  success: "#34C58A",
  successBg: "#12291F",
  warning: "#E0A33A",
  warningBg: "#2E2410",
  danger: "#F0857C",
  dangerBg: "#331715",
  info: "#6FA0F0",
  infoBg: "#14213A",
  pressOverlay: "rgba(255,255,255,0.12)",
  onAccent: "#FFFFFF",
};

export type Palette = typeof light;

export const radius = { sm: 6, md: 8, lg: 10, xl: 14, pill: 999 } as const;

/** 4px grid. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const layout = {
  screenPadding: 16,
  cardPadding: 16,
  cardGap: 12,
  sectionGap: 24,
  buttonHeight: 48,
  primaryButtonHeight: 52,
  inputHeight: 48,
  minTapTarget: 44,
} as const;

/** Signature brand gradient — accents only, never a page background. */
export const gradient = ["#FF9A3D", "#F2603C", "#C2459A"] as const;

export const fonts = {
  sans: "DMSans_400Regular",
  sansMedium: "DMSans_500Medium",
  sansSemi: "DMSans_600SemiBold",
  display: "HankenGrotesk_600SemiBold",
  displayBold: "HankenGrotesk_700Bold",
  mono: "JetBrainsMono_400Regular",
  monoSemi: "JetBrainsMono_600SemiBold",
} as const;

/** Semantic colour groups used by status pills and banners. */
export type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

export function toneColors(
  c: Palette,
  tone: Tone
): { fg: string; bg: string } {
  switch (tone) {
    case "success":
      return { fg: c.success, bg: c.successBg };
    case "warning":
      return { fg: c.warning, bg: c.warningBg };
    case "danger":
      return { fg: c.danger, bg: c.dangerBg };
    case "info":
      return { fg: c.info, bg: c.infoBg };
    case "accent":
      return { fg: c.accentStrong, bg: withAlpha(c.accent, 0.12) };
    default:
      return { fg: c.muted, bg: c.mutedBg };
  }
}

/** Hex + alpha → rgba, for the 12%-tint badge rule. */
export function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
