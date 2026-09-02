import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { layout, radius, withAlpha } from "../theme/tokens";

interface CardProps {
  children: ReactNode;
  /** Whole card becomes tappable when provided — the pattern for navigation. */
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  accessibilityLabel?: string;
}

export function Card({
  children,
  onPress,
  style,
  padded = true,
  accessibilityLabel,
}: CardProps) {
  const { c, scheme, visualStyle } = useTheme();
  const gradientLook = visualStyle === "gradient";

  const base: StyleProp<ViewStyle> = [
    styles.card,
    {
      backgroundColor: gradientLook
        ? withAlpha(c.card, scheme === "dark" ? 0.88 : 0.94)
        : c.card,
      borderColor: c.border,
      padding: padded ? layout.cardPadding : 0,
      overflow: gradientLook ? "visible" : "hidden",
    },
    gradientLook && styles.shadow,
    gradientLook && {
      shadowColor: scheme === "dark" ? "#000000" : "#241A15",
    },
    style,
  ];

  if (!onPress) return <View style={base}>{children}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={base}
    >
      {({ pressed }) => (
        <>
          {pressed && (
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: c.pressOverlay, borderRadius: radius.xl },
              ]}
            />
          )}
          {children}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Flat by design: a hairline border separates surfaces, never a shadow.
  // Gradient look adds a soft lift; overflow stays visible so the shadow shows.
  card: { borderRadius: radius.xl, borderWidth: 1 },
  shadow: {
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 5,
  },
});
