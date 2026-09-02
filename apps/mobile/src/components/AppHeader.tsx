import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useTheme } from "../theme/ThemeProvider";
import { layout, radius, space, surfaceWash } from "../theme/tokens";
import { Text } from "./Text";

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  /** Hidden on tab roots, shown on every pushed screen. */
  back?: boolean;
  right?: ReactNode;
}

export function AppHeader({
  title,
  subtitle,
  back = true,
  right,
}: AppHeaderProps) {
  const { c, scheme, visualStyle } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const gradientLook = visualStyle === "gradient";
  const washTop =
    scheme === "dark" ? surfaceWash.dark[0] : surfaceWash.light[0];

  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: gradientLook ? washTop : c.surface,
          borderBottomColor: c.border,
          borderBottomWidth: gradientLook ? 0 : 1,
          paddingTop: insets.top + space.md,
        },
      ]}
    >
      {back && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
          style={({ pressed }) => [
            styles.backButton,
            pressed && { backgroundColor: c.mutedBg },
          ]}
        >
          <ArrowLeft size={22} color={c.ink} strokeWidth={2} />
        </Pressable>
      )}
      <View style={styles.titleBlock}>
        <Text variant="title" numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          <Text variant="label" tone="muted" numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: layout.screenPadding,
    paddingBottom: space.md,
  },
  backButton: {
    width: layout.minTapTarget,
    height: layout.minTapTarget,
    marginLeft: -10,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  titleBlock: { flex: 1, gap: 2 },
});
