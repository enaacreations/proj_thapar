import { useMemo, useRef, useState } from "react";
import {
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { Compass, LayoutGrid, MoveHorizontal } from "lucide-react-native";
import type { TourSpace } from "@proj/shared";
import { useTheme } from "../../src/theme/ThemeProvider";
import { radius, space } from "../../src/theme/tokens";
import { api } from "../../src/api/client";
import { useAsync } from "../../src/lib/useAsync";
import { AppHeader } from "../../src/components/AppHeader";
import { Badge } from "../../src/components/Badge";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { Screen } from "../../src/components/Screen";
import { ErrorState, Loading } from "../../src/components/States";
import { Text } from "../../src/components/Text";

const VIEWER_HEIGHT = 220;

export default function TourScreen() {
  const router = useRouter();
  const { data, loading, error, reload } = useAsync(() => api.tours(), []);
  const [activeId, setActiveId] = useState<string | null>(null);

  const active = useMemo(
    () => data?.find((s) => s.id === activeId) ?? data?.[0] ?? null,
    [data, activeId]
  );

  return (
    <>
      <AppHeader title="Look around" />
      <Screen refreshing={loading} onRefresh={() => void reload()}>
        {loading && !data ? (
          <Loading />
        ) : error || !data || !active ? (
          <ErrorState
            message={error ?? "Couldn't load the tour."}
            onRetry={() => void reload()}
          />
        ) : (
          <>
            <Panorama space={active} onJump={setActiveId} />

            <Card style={styles.card}>
              <View style={styles.head}>
                <Text variant="section" style={styles.flex}>
                  {active.name}
                </Text>
                <Badge
                  label={
                    active.kind === "room"
                      ? "Room"
                      : active.kind === "common"
                        ? "Shared"
                        : "Amenity"
                  }
                  tone="neutral"
                />
              </View>
              <Text variant="body" tone="muted">
                {active.description}
              </Text>
            </Card>

            <Text variant="section" style={styles.sectionHead}>
              All spaces
            </Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.strip}>
                {data.map((space_) => (
                  <SpaceChip
                    key={space_.id}
                    space={space_}
                    active={space_.id === active.id}
                    onPress={() => setActiveId(space_.id)}
                  />
                ))}
              </View>
            </ScrollView>

            <Button
              label="Plan where your things go"
              variant="secondary"
              icon={<LayoutGrid size={20} strokeWidth={2} />}
              onPress={() => router.push("/onboarding/layout")}
            />
          </>
        )}
      </Screen>
    </>
  );
}

/**
 * Drag-to-look viewer for an equirectangular photo. Not a true 3D projection —
 * it pans the image horizontally and wraps around, which reads correctly for
 * a single-storey room and needs no native dependency.
 */
function Panorama({
  space: tourSpace,
  onJump,
}: {
  space: TourSpace;
  onJump: (id: string) => void;
}) {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const viewWidth = width - 32;

  // The panorama is drawn twice side by side so panning can wrap seamlessly.
  const imageWidth = viewWidth * 2;
  const [offset, setOffset] = useState(0);
  const start = useRef(0);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          start.current = offset;
        },
        onPanResponderMove: (_e, gesture) => {
          const next = (start.current + gesture.dx) % imageWidth;
          setOffset(next);
        },
      }),
    [offset, imageWidth]
  );

  const wrapped = ((offset % imageWidth) + imageWidth) % imageWidth;

  return (
    <View
      {...responder.panHandlers}
      style={[
        styles.viewer,
        { height: VIEWER_HEIGHT, borderColor: c.border, backgroundColor: c.mutedBg },
      ]}
    >
      <View style={{ flexDirection: "row", marginLeft: wrapped - imageWidth }}>
        {[0, 1].map((i) =>
          tourSpace.panoramaUri ? (
            <Image
              key={i}
              source={{ uri: tourSpace.panoramaUri }}
              style={{ width: imageWidth, height: VIEWER_HEIGHT }}
              resizeMode="cover"
            />
          ) : (
            <PlaceholderPanorama
              key={i}
              width={imageWidth}
              height={VIEWER_HEIGHT}
            />
          )
        )}
      </View>

      {!tourSpace.panoramaUri && (
        <View pointerEvents="none" style={styles.placeholderLabel}>
          <Text variant="label" tone="muted">
            360° photo not uploaded yet
          </Text>
        </View>
      )}

      <View pointerEvents="none" style={styles.dragHint}>
        <MoveHorizontal size={14} color={c.muted} strokeWidth={2} />
        <Text variant="caption" tone="muted">
          Drag to look around
        </Text>
      </View>

      {/* Hotspots sit at their fractional position and follow the pan. */}
      {tourSpace.hotspots.map((hotspot) => {
        const x =
          (hotspot.x * imageWidth + wrapped - imageWidth + imageWidth) %
          imageWidth;
        if (x > viewWidth) return null;

        return (
          <Pressable
            key={`${hotspot.target}-${hotspot.x}`}
            accessibilityRole="button"
            accessibilityLabel={`Go to ${hotspot.label}`}
            onPress={() => onJump(hotspot.target)}
            style={[
              styles.hotspot,
              { left: Math.max(8, x - 40), borderColor: c.border, backgroundColor: c.card },
            ]}
          >
            <Compass size={13} color={c.accentStrong} strokeWidth={2} />
            <Text variant="caption">{hotspot.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Stand-in so the drag interaction is visible before real photos exist. */
function PlaceholderPanorama({
  width,
  height,
}: {
  width: number;
  height: number;
}) {
  const { c } = useTheme();

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="sky" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={c.mutedBg} />
          <Stop offset="0.25" stopColor={c.border} />
          <Stop offset="0.5" stopColor={c.mutedBg} />
          <Stop offset="0.75" stopColor={c.border} />
          <Stop offset="1" stopColor={c.mutedBg} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height * 0.62} fill="url(#sky)" />
      <Rect
        x={0}
        y={height * 0.62}
        width={width}
        height={height * 0.38}
        fill={c.secondaryBorder}
      />
    </Svg>
  );
}

function SpaceChip({
  space: tourSpace,
  active,
  onPress,
}: {
  space: TourSpace;
  active: boolean;
  onPress: () => void;
}) {
  const { c } = useTheme();

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[
        styles.spaceChip,
        {
          borderColor: active ? c.accent : c.border,
          backgroundColor: active ? c.accent : c.card,
        },
      ]}
    >
      <Text variant="label" tone={active ? "onAccent" : "ink"}>
        {tourSpace.name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  viewer: { borderWidth: 1, borderRadius: radius.xl, overflow: "hidden" },
  card: { gap: space.sm },
  head: { flexDirection: "row", alignItems: "center", gap: space.sm },
  flex: { flex: 1 },
  sectionHead: { marginTop: space.md },
  strip: { flexDirection: "row", gap: space.sm, paddingVertical: 2 },
  spaceChip: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    minHeight: 40,
    justifyContent: "center",
  },
  placeholderLabel: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  dragHint: {
    position: "absolute",
    bottom: 8,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  hotspot: {
    position: "absolute",
    top: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    minHeight: 32,
  },
});
