import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bell, MapPin, Search, X } from "lucide-react-native";
import { useTheme } from "../../src/theme/ThemeProvider";
import { layout, radius, space, withAlpha } from "../../src/theme/tokens";
import { api } from "../../src/api/client";
import { useAsync } from "../../src/lib/useAsync";
import {
  filterModules,
  MODULE_GROUPS,
  modulesInGroup,
  type ModuleTile,
} from "../../src/lib/modules";
import { greeting } from "../../src/lib/format";
import { Avatar } from "../../src/components/Avatar";
import { Card } from "../../src/components/Card";
import { EmptyState } from "../../src/components/EmptyState";
import { Input } from "../../src/components/Input";
import { ProgressRing } from "../../src/components/ProgressRing";
import { Screen } from "../../src/components/Screen";
import { Text } from "../../src/components/Text";

/**
 * Tiles per row. The width that goes with it is measured, not guessed: a
 * percentage width and a fixed gap don't compose, because the percentage
 * scales with the device and the gap doesn't. Three 31% tiles plus two 12dp
 * gaps came to 329dp inside a 328dp phone, so the third tile wrapped and left
 * a column of dead space — on that handset only, which is what made it look
 * like a rendering problem rather than arithmetic.
 */
const COLUMNS = 3;

export default function HomeScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [query, setQuery] = useState("");

  // Recomputed on rotation and on a foldable opening, which a static width
  // in the stylesheet wouldn't survive.
  const { width } = useWindowDimensions();
  const tileWidth =
    (width - layout.screenPadding * 2 - layout.cardGap * (COLUMNS - 1)) /
    COLUMNS;

  const profile = useAsync(() => api.profile(), []);
  const room = useAsync(() => api.room(), []);
  const attendance = useAsync(() => api.attendance(), []);
  const requests = useAsync(() => api.requests(), []);
  const notifications = useAsync(() => api.notifications(), []);

  const searching = query.trim().length > 0;
  const tiles = filterModules(query);
  const unreadCount =
    notifications.data?.filter((n) => !n.read).length ?? 0;

  const openRequests =
    requests.data?.filter(
      (r) => r.status === "submitted" || r.status === "in_progress"
    ).length ?? 0;

  // Two things a resident should do daily; the ring nudges without nagging.
  const dailyDone =
    (attendance.data?.todayMarked ? 1 : 0) + (openRequests === 0 ? 1 : 0);

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
    profile.loading ||
    attendance.loading ||
    requests.loading ||
    notifications.loading;

  const renderTile = (module: ModuleTile) => {
    const badge = badgeFor(module);
    const tint = c[module.tint];

    return (
      <Card
        key={module.key}
        style={[styles.tile, { width: tileWidth }]}
        accessibilityLabel={module.name}
        onPress={() => router.push(module.href as never)}
      >
        <View
          style={[styles.iconChip, { backgroundColor: withAlpha(tint, 0.12) }]}
        >
          <module.icon size={22} color={tint} strokeWidth={2} />
        </View>
        <Text variant="label" numberOfLines={2} style={styles.tileName}>
          {module.name}
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
  };

  return (
    <Screen
      contentStyle={{ paddingTop: insets.top + space.xl }}
      refreshing={refreshing}
      onRefresh={() => {
        void profile.reload();
        void attendance.reload();
        void requests.reload();
        void notifications.reload();
      }}
    >
      <View style={styles.header}>
        <Avatar
          name={profile.data?.fullName ?? "Resident"}
          photoUrl={profile.data?.photoUrl}
          size={52}
        />
        <View style={styles.headerText}>
          <Text variant="label" tone="muted">
            {greeting()}
          </Text>
          <Text variant="title" numberOfLines={1}>
            {profile.data?.fullName?.split(" ")[0] ?? "there"}
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

        <View style={styles.headerActions}>
          <ProgressRing value={dailyDone / 2} size={52}>
            <Text variant="caption" tone="muted">
              {dailyDone}/2
            </Text>
          </ProgressRing>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              unreadCount > 0
                ? `Alerts, ${unreadCount} unread`
                : "Alerts"
            }
            onPress={() => router.push("/(tabs)/notifications")}
            style={({ pressed }) => [
              styles.bellButton,
              { backgroundColor: pressed ? c.mutedBg : c.card, borderColor: c.border },
            ]}
          >
            <Bell size={22} color={c.ink} strokeWidth={2} />
            {unreadCount > 0 && (
              <View style={[styles.unreadDot, { backgroundColor: c.accent }]} />
            )}
          </Pressable>
        </View>
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
      ) : searching ? (
        <View style={styles.grid}>{tiles.map(renderTile)}</View>
      ) : (
        <View style={styles.sections}>
          {MODULE_GROUPS.map((group) => {
            const groupTiles = modulesInGroup(group.key, query);
            if (groupTiles.length === 0) return null;

            return (
              <View key={group.key} style={styles.section}>
                <Text variant="label" tone="muted" style={styles.sectionLabel}>
                  {group.label}
                </Text>
                <View style={styles.grid}>{groupTiles.map(renderTile)}</View>
              </View>
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
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  bellButton: {
    width: layout.minTapTarget,
    height: layout.minTapTarget,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: radius.pill,
  },
  scope: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  search: { marginBottom: space.xs },
  sections: { gap: layout.sectionGap },
  section: { gap: space.sm },
  sectionLabel: {
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: layout.cardGap,
  },
  tile: {
    // Width is applied inline from the measured column size.
    flexGrow: 0,
    flexShrink: 0,
    gap: 4,
    minHeight: 96,
    paddingVertical: space.sm,
    /**
     * Card pads all four sides with cardPadding (16). Overriding only the
     * vertical left 32dp of horizontal padding on a ~101dp tile, so the label
     * had ~68dp to work with and Android broke "Attendance" and "Housekeeping"
     * mid-word. A grid cell this small can't carry full card padding.
     */
    paddingHorizontal: space.xs,
    alignItems: "center",
  },
  tileName: { textAlign: "center" },
  iconChip: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.xs,
  },
  nudge: {
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: space.xs,
  },
});
