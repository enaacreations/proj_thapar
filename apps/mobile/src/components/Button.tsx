import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { fonts, layout, radius } from "../theme/tokens";
import { Text } from "./Text";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive"
  | "link";

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  /** The screen's single main action — renders 52dp tall. */
  emphasis?: boolean;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  fullWidth?: boolean;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  emphasis = false,
  disabled = false,
  loading = false,
  icon,
  style,
  fullWidth = true,
}: ButtonProps) {
  const { c } = useTheme();
  const inactive = disabled || loading;

  const palette: Record<
    ButtonVariant,
    { bg: string; fg: string; border?: string }
  > = {
    primary: { bg: c.accent, fg: c.onAccent },
    secondary: { bg: c.mutedBg, fg: c.ink, border: c.secondaryBorder },
    outline: { bg: "transparent", fg: c.ink, border: c.border },
    ghost: { bg: "transparent", fg: c.ink },
    destructive: { bg: c.danger, fg: "#FFFFFF" },
    link: { bg: "transparent", fg: c.accentStrong },
  };

  const style_ = palette[variant];
  const height = variant === "link" ? undefined : emphasis ? layout.primaryButtonHeight : layout.buttonHeight;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      accessibilityLabel={label}
      onPress={onPress}
      disabled={inactive}
      style={[
        styles.base,
        {
          height,
          minHeight: layout.minTapTarget,
          backgroundColor: style_.bg,
          borderColor: style_.border ?? "transparent",
          borderWidth: style_.border ? 1 : 0,
          opacity: inactive ? 0.5 : 1,
          alignSelf: fullWidth ? "stretch" : "flex-start",
          paddingHorizontal: variant === "link" ? 0 : 20,
        },
        style,
      ]}
    >
      {({ pressed }) => (
        <>
          {/* Press feedback is a tint overlay, never an elevation change. */}
          {pressed && (
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: c.pressOverlay, borderRadius: radius.lg },
              ]}
            />
          )}
          {loading ? (
            <ActivityIndicator color={style_.fg} />
          ) : (
            <View style={styles.content}>
              {icon}
              <Text
                style={{
                  fontFamily: fonts.sansSemi,
                  fontSize: 16,
                  color: style_.fg,
                  textDecorationLine:
                    variant === "link" ? "underline" : "none",
                }}
              >
                {label}
              </Text>
            </View>
          )}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { flexDirection: "row", alignItems: "center", gap: 8 },
});
