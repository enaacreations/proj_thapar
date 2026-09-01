import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../src/theme/ThemeProvider";
import { gradient, layout, space } from "../../src/theme/tokens";
import { useAuth } from "../../src/auth/AuthProvider";
import { Button } from "../../src/components/Button";
import { Text } from "../../src/components/Text";

export default function Welcome() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { lastMobile } = useAuth();

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: c.surface,
          paddingTop: insets.top + space.xxl,
          paddingBottom: Math.max(insets.bottom, space.lg),
        },
      ]}
    >
      <View style={styles.hero}>
        <LinearGradient
          colors={[...gradient]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.mark}
        >
          <Text style={styles.markLetter}>U</Text>
        </LinearGradient>

        <View style={styles.copy}>
          <Text variant="title" style={styles.headline}>
            Your hostel, in your pocket
          </Text>
          <Text variant="body" tone="muted" style={styles.headline}>
            Meals, laundry, room repairs, attendance and visits — all in one
            place.
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Button
          label={lastMobile ? "Sign in" : "I already have an account"}
          onPress={() => router.push("/(auth)/login")}
          emphasis
        />
        <Button
          label="Register as a new resident"
          variant="secondary"
          onPress={() => router.push("/(auth)/register")}
        />
        <Text variant="caption" tone="muted" style={styles.headline}>
          Registration needs approval from the hostel office before you can
          sign in.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: layout.screenPadding,
    justifyContent: "space-between",
  },
  hero: { flex: 1, justifyContent: "center", alignItems: "center", gap: space.xl },
  mark: {
    width: 88,
    height: 88,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  markLetter: {
    color: "#FFFFFF",
    fontFamily: "HankenGrotesk_700Bold",
    fontSize: 44,
    lineHeight: 52,
  },
  copy: { gap: space.sm, paddingHorizontal: space.md },
  headline: { textAlign: "center" },
  actions: { gap: space.md },
});
