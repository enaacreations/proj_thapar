import { useEffect, useRef, type ReactNode } from "react";
import {
  Animated,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme/ThemeProvider";
import { layout, space, surfaceWash } from "../theme/tokens";

interface ScreenProps {
  children: ReactNode;
  /** Set false for screens that own their own scrolling (e.g. FlatList). */
  scroll?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Sticky action area pinned above the safe-area inset. */
  footer?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}

/** Screen roots fade up on mount: 300ms, translateY 8 → 0. */
export function Screen({
  children,
  scroll = true,
  onRefresh,
  refreshing = false,
  footer,
  contentStyle,
}: ScreenProps) {
  const { c, scheme, visualStyle } = useTheme();
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;
  const gradientLook = visualStyle === "gradient";
  const wash = scheme === "dark" ? surfaceWash.dark : surfaceWash.light;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [anim]);

  const animatedStyle = {
    opacity: anim,
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [8, 0],
        }),
      },
    ],
  };

  const body = (
    <Animated.View style={[styles.flex, animatedStyle]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.content, contentStyle]}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={c.accent}
                colors={[c.accent]}
              />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      ) : (
        <View style={styles.flex}>{children}</View>
      )}
    </Animated.View>
  );

  return (
    <View
      style={[
        styles.flex,
        { backgroundColor: gradientLook ? "transparent" : c.surface },
      ]}
    >
      {gradientLook && (
        <LinearGradient
          colors={[...wash]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}
      {body}
      {footer && (
        <View
          style={[
            styles.footer,
            {
              backgroundColor: c.surface,
              borderTopColor: c.border,
              paddingBottom: Math.max(insets.bottom, layout.screenPadding),
            },
          ]}
        >
          {footer}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: layout.screenPadding,
    paddingBottom: layout.sectionGap,
    gap: layout.cardGap,
  },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: layout.screenPadding,
    paddingTop: space.md,
    gap: space.sm,
  },
});
