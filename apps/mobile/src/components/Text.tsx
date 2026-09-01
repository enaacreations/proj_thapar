import {
  Text as RNText,
  type StyleProp,
  type TextProps as RNTextProps,
  type TextStyle,
} from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { fonts } from "../theme/tokens";

export type TextVariant =
  | "metric"
  | "title"
  | "section"
  | "cardTitle"
  | "body"
  | "label"
  | "caption"
  | "mono";

export type TextTone =
  | "ink"
  | "muted"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "onAccent";

interface TextProps extends RNTextProps {
  variant?: TextVariant;
  tone?: TextTone;
  style?: StyleProp<TextStyle>;
}

/** Headings use -0.012em tracking per the design system. */
const tracking = (size: number) => size * -0.012;

const VARIANTS: Record<TextVariant, TextStyle> = {
  metric: {
    fontFamily: fonts.monoSemi,
    fontSize: 30,
    lineHeight: 36,
    // Tabular figures keep columns of numbers from jittering as they update.
    fontVariant: ["tabular-nums"],
  },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: 23,
    lineHeight: 30,
    letterSpacing: tracking(23),
  },
  section: {
    fontFamily: fonts.display,
    fontSize: 17,
    lineHeight: 24,
    letterSpacing: tracking(17),
  },
  cardTitle: { fontFamily: fonts.sansSemi, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fonts.sansMedium, fontSize: 12, lineHeight: 16 },
  mono: {
    fontFamily: fonts.mono,
    fontSize: 14,
    lineHeight: 20,
    fontVariant: ["tabular-nums"],
  },
};

export function Text({
  variant = "body",
  tone = "ink",
  style,
  ...rest
}: TextProps) {
  const { c } = useTheme();

  const colorByTone: Record<TextTone, string> = {
    ink: c.ink,
    muted: c.muted,
    accent: c.accentStrong,
    success: c.success,
    warning: c.warning,
    danger: c.danger,
    info: c.info,
    onAccent: c.onAccent,
  };

  return (
    <RNText
      {...rest}
      style={[VARIANTS[variant], { color: colorByTone[tone] }, style]}
    />
  );
}
