import { ActivityIndicator, StyleSheet, View } from "react-native";
import { WifiOff } from "lucide-react-native";
import { useTheme } from "../theme/ThemeProvider";
import { space } from "../theme/tokens";
import { Button } from "./Button";
import { Text } from "./Text";

export function Loading({ label = "Loading…" }: { label?: string }) {
  const { c } = useTheme();

  return (
    <View style={styles.center}>
      <ActivityIndicator color={c.accent} />
      <Text variant="label" tone="muted">
        {label}
      </Text>
    </View>
  );
}

/** Friendly error with the one action that usually fixes it. */
export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  const { c } = useTheme();

  return (
    <View style={styles.center}>
      <WifiOff size={28} color={c.muted} strokeWidth={1.75} />
      <Text variant="body" tone="muted" style={styles.text}>
        {message}
      </Text>
      {onRetry && (
        <Button
          label="Try again"
          variant="secondary"
          fullWidth={false}
          onPress={onRetry}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    justifyContent: "center",
    gap: space.md,
    paddingVertical: space.xxl,
    paddingHorizontal: space.lg,
  },
  text: { textAlign: "center" },
});
