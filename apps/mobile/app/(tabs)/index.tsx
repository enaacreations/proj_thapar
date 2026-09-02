import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bell, MapPin, Search, X } from "lucide-react-native";
import { useTheme } from "../../src/theme/ThemeProvider";
import {
  iconWash,
  layout,
  radius,
  space,
  withAlpha,
} from "../../src/theme/tokens";
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

export default function HomeScreen() {
  const { c, scheme, visualStyle } = useTheme();
  const gradientLook = visualStyle === "gradient";
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [query, setQuery] = useState("");

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
    const wash = iconWash[module.pastel][scheme];

    return (
      <Card
        key={module.key}
        style={[styles.tile, gradientLook && styles.tileWash]}
        accessibilityLabel={module.name}
        onPress={() => router.push(module.href as never)}
      >
        {gradientLook && (
          <LinearGradient
            colors={[c.card, withAlpha(wash[0], 0.35)]}
            start={{ x: 0.15, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={[StyleSheet.absoluteFill, styles.tileWashFill]}
            pointerEvents="none"
          />
        )}
        {gradientLook ? (
          <LinearGradient
            colors={[...wash]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconChip}
          >
            <module.icon size={22} color={c.ink} strokeWidth={2} />
          </LinearGradient>
        ) : (
          <View
            style={[styles.iconChip, { backgroundColor: withAlpha(tint, 0.12) }]}
          >
            <module.icon size={22} color={tint} strokeWidth={2} />
          </View>
        )}
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
    width: "31%",
    flexGrow: 0,
    flexShrink: 0,
    gap: 4,
    minHeight: 96,
    paddingVertical: space.sm,
    alignItems: "center",
  },
  tileWash: { overflow: "hidden" },
  tileWashFill: { borderRadius: radius.xl },
  tileName: { textAlign: "center" },
  iconChip: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.xs,
    overflow: "hidden",
  },
  nudge: {
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: space.xs,
  },
});
