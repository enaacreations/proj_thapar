import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { layout, radius } from "../theme/tokens";

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
  const { c } = useTheme();

  const base: StyleProp<ViewStyle> = [
    styles.card,
    {
      backgroundColor: c.card,
      borderColor: c.border,
      padding: padded ? layout.cardPadding : 0,
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
  card: { borderRadius: radius.xl, borderWidth: 1, overflow: "hidden" },
});
