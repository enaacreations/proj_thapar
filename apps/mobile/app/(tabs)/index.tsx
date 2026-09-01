import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MapPin, Search, X } from "lucide-react-native";
import { useTheme } from "../../src/theme/ThemeProvider";
import { layout, radius, space, withAlpha } from "../../src/theme/tokens";
import { api } from "../../src/api/client";
import { useAsync } from "../../src/lib/useAsync";
import { filterModules, type ModuleTile } from "../../src/lib/modules";
import { greeting } from "../../src/lib/format";
import { Card } from "../../src/components/Card";
import { EmptyState } from "../../src/components/EmptyState";
import { Input } from "../../src/components/Input";
import { ProgressRing } from "../../src/components/ProgressRing";
import { Screen } from "../../src/components/Screen";
import { Text } from "../../src/components/Text";

export default function HomeScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [query, setQuery] = useState("");

  const profile = useAsync(() => api.profile(), []);
  const room = useAsync(() => api.room(), []);
  const attendance = useAsync(() => api.attendance(), []);
  const requests = useAsync(() => api.requests(), []);

  const tiles = filterModules(query);

  const openRequests =
    requests.data?.filter(
      (r) => r.status === "submitted" || r.status === "in_progress"
    ).length ?? 0;

  // Two things a resident should do daily; the ring nudges without nagging.
  const dailyDone = (attendance.data?.todayMarked ? 1 : 0) + (openRequests === 0 ? 1 : 0);

  const badgeFor = (module: ModuleTile): string | null => {
    if (module.key === "attendance" && attendance.data?.todayMarked === false) {
      return "Due today";
    }
    if (module.key === "requests" && openRequests > 0) {
      return `${openRequests} open`;
    }
    return null;
  };

  const refreshing =
    profile.loading || attendance.loading || requests.loading;

  return (
    <Screen
      contentStyle={{ paddingTop: insets.top + space.md }}
      refreshing={refreshing}
      onRefresh={() => {
        void profile.reload();
        void attendance.reload();
        void requests.reload();
      }}
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text variant="label" tone="muted">
            {greeting()}
          </Text>
          <Text variant="title" numberOfLines={1}>
            {profile.data?.fullName.split(" ")[0] ?? "there"}
          </Text>
          <View style={styles.scope}>
            <MapPin size={13} color={c.muted} strokeWidth={2} />
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {room.data
                ? `${room.data.propertyName} · Room ${room.data.roomNumber}`
                : "Loading your room…"}
            </Text>
          </View>
        </View>

        <ProgressRing value={dailyDone / 2} size={58}>
          <Text variant="caption" tone="muted">
            {dailyDone}/2
          </Text>
        </ProgressRing>
      </View>

      <Input
        value={query}
        onChangeText={setQuery}
        placeholder="Search food, laundry, repairs…"
        style={styles.search}
        right={
          query ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              onPress={() => setQuery("")}
              hitSlop={8}
            >
              <X size={20} color={c.muted} strokeWidth={2} />
            </Pressable>
          ) : (
            <Search size={20} color={c.muted} strokeWidth={2} />
          )
        }
      />

      {tiles.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Nothing matches that"
          description="Try a different word, like 'laundry' or 'AC'."
          actionLabel="Clear search"
          onAction={() => setQuery("")}
        />
      ) : (
        <View style={styles.grid}>
          {tiles.map((module) => {
            const badge = badgeFor(module);
            const tint = c[module.tint];

            return (
              <Card
                key={module.key}
                style={styles.tile}
                accessibilityLabel={module.name}
                onPress={() => router.push(module.href as never)}
              >
                <View
                  style={[
                    styles.iconChip,
                    { backgroundColor: withAlpha(tint, 0.12) },
                  ]}
                >
                  <module.icon size={22} color={tint} strokeWidth={2} />
                </View>
                <Text variant="cardTitle" numberOfLines={1}>
                  {module.name}
                </Text>
                <Text variant="label" tone="muted" numberOfLines={2}>
                  {module.description}
                </Text>
                {badge && (
                  <View
                    style={[
                      styles.nudge,
                      { backgroundColor: withAlpha(c.accent, 0.12) },
                    ]}
                  >
                    <Text variant="caption" tone="accent">
                      {badge}
                    </Text>
                  </View>
                )}
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    marginBottom: space.xs,
  },
  headerText: { flex: 1, gap: 2 },
  scope: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  search: { marginBottom: space.xs },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: layout.cardGap,
  },
  tile: {
    // Two columns with a 12dp gutter.
    width: "48%",
    flexGrow: 1,
    gap: 4,
    minHeight: 132,
  },
  iconChip: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.xs,
  },
  nudge: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: space.xs,
  },
});
