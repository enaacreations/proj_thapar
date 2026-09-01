import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  AlertTriangle,
  BellOff,
  CheckCircle2,
  Info,
  XCircle,
  type LucideIcon,
} from "lucide-react-native";
import type { AppNotification } from "@proj/shared";
import { useTheme } from "../../src/theme/ThemeProvider";
import { radius, space, toneColors, type Tone } from "../../src/theme/tokens";
import { api } from "../../src/api/client";
import { useAsync } from "../../src/lib/useAsync";
import { relativeTime } from "../../src/lib/format";
import { Card } from "../../src/components/Card";
import { EmptyState } from "../../src/components/EmptyState";
import { Screen } from "../../src/components/Screen";
import { ErrorState, Loading } from "../../src/components/States";
import { Text } from "../../src/components/Text";

const ICONS: Record<AppNotification["kind"], LucideIcon> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
};

export default function NotificationsScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data, loading, error, reload, setData } = useAsync(
    () => api.notifications(),
    []
  );

  const open = async (item: AppNotification) => {
    if (!item.read) {
      // Optimistic: the badge should clear the moment it's tapped.
      setData(
        (data ?? []).map((n) => (n.id === item.id ? { ...n, read: true } : n))
      );
      void api.markNotificationRead(item.id).catch(() => undefined);
    }
    if (item.href) router.push(item.href as never);
  };

  return (
    <Screen
      contentStyle={{ paddingTop: insets.top + space.xl }}
      refreshing={loading}
      onRefresh={() => void reload()}
    >
      <Text variant="title">Alerts</Text>

      {loading && !data ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void reload()} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title="You're all caught up"
          description="Updates about your requests, meals and attendance will appear here."
        />
      ) : (
        data.map((item) => {
          const Icon = ICONS[item.kind];
          const tint = toneColors(c, item.kind as Tone);

          return (
            <Card
              key={item.id}
              onPress={() => void open(item)}
              accessibilityLabel={item.title}
            >
              <View style={styles.row}>
                <View style={[styles.chip, { backgroundColor: tint.bg }]}>
                  <Icon size={20} color={tint.fg} strokeWidth={2} />
                </View>
                <View style={styles.body}>
                  <View style={styles.titleRow}>
                    <Text variant="cardTitle" style={styles.flex}>
                      {item.title}
                    </Text>
                    {!item.read && (
                      <View
                        style={[styles.unread, { backgroundColor: c.accent }]}
                      />
                    )}
                  </View>
                  <Text variant="body" tone="muted">
                    {item.body}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {relativeTime(item.createdAt)}
                  </Text>
                </View>
              </View>
            </Card>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: space.md },
  chip: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, gap: 3 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  flex: { flex: 1 },
  unread: { width: 8, height: 8, borderRadius: radius.pill },
});
