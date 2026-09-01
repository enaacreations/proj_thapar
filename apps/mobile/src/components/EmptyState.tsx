import { StyleSheet, View } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { useTheme } from "../theme/ThemeProvider";
import { radius, space } from "../theme/tokens";
import { Button } from "./Button";
import { Text } from "./Text";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  /** One line explaining what the screen is for. */
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const { c } = useTheme();

  return (
    <View style={styles.wrap}>
      <View style={[styles.circle, { backgroundColor: c.mutedBg }]}>
        <Icon size={28} color={c.muted} strokeWidth={1.75} />
      </View>
      <Text variant="section" style={styles.center}>
        {title}
      </Text>
      <Text variant="body" tone="muted" style={styles.center}>
        {description}
      </Text>
      {actionLabel && onAction && (
        <Button
          label={actionLabel}
          onPress={onAction}
          fullWidth={false}
          style={styles.action}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: space.xxl,
    paddingHorizontal: space.lg,
    gap: space.sm,
  },
  circle: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.xs,
  },
  center: { textAlign: "center" },
  action: { marginTop: space.md },
});
