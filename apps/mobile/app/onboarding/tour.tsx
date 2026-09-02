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
import { Compass, ImageOff, LayoutGrid, Move } from "lucide-react-native";
import type { TourPhoto, TourSpace } from "@proj/shared";
import { useTheme } from "../../src/theme/ThemeProvider";
import { radius, space } from "../../src/theme/tokens";
import { API_BASE_URL, api } from "../../src/api/client";
import { useAsync } from "../../src/lib/useAsync";
import { AppHeader } from "../../src/components/AppHeader";
import { Badge } from "../../src/components/Badge";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { Screen } from "../../src/components/Screen";
import { ErrorState, Loading } from "../../src/components/States";
import { Text } from "../../src/components/Text";

const VIEWER_HEIGHT = 220;

/**
 * How much taller than the viewport the panorama is drawn, so there's
 * something above and below to tilt towards. An equirectangular photo is 2:1,
 * so at double the width there's real vertical detail to find.
 */
const PANORAMA_SCALE = 1.6;

/**
 * Media paths come back relative to the API ("/media/tours/…"), so the app
 * decides which server they're on. Anything absolute is already a full URL.
 */
function mediaUri(uri: string): string {
  return uri.startsWith("/") ? `${API_BASE_URL}${uri}` : uri;
}

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

            <Gallery photos={active.photos} name={active.name} />

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
 * it pans the image horizontally, wrapping around, and tilts it vertically
 * within the overscan. That reads correctly for a single-storey room and needs
 * no native dependency.
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
  const imageHeight = VIEWER_HEIGHT * PANORAMA_SCALE;
  // Vertical travel: how far the image can slide before an edge shows.
  const tiltRange = imageHeight - VIEWER_HEIGHT;

  const [offset, setOffset] = useState(0);
  // Starts centred, so there's as much to look up at as down at.
  const [tilt, setTilt] = useState(-tiltRange / 2);
  const start = useRef({ x: 0, y: 0 });

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          start.current = { x: offset, y: tilt };
        },
        onPanResponderMove: (_e, gesture) => {
          setOffset((start.current.x + gesture.dx) % imageWidth);
          // Horizontal wraps; vertical stops, because a room has a floor and a
          // ceiling and sliding past either would show blank space.
          setTilt(
            Math.min(0, Math.max(-tiltRange, start.current.y + gesture.dy))
          );
        },
      }),
    [offset, tilt, imageWidth, tiltRange]
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
      <View
        style={{
          flexDirection: "row",
          marginLeft: wrapped - imageWidth,
          marginTop: tilt,
        }}
      >
        {[0, 1].map((i) =>
          tourSpace.panoramaUri ? (
            <Image
              key={i}
              source={{ uri: mediaUri(tourSpace.panoramaUri) }}
              style={{ width: imageWidth, height: imageHeight }}
              resizeMode="cover"
            />
          ) : (
            <PlaceholderPanorama
              key={i}
              width={imageWidth}
              height={imageHeight}
            />
          )
        )}
      </View>

      {!tourSpace.panoramaUri && (
        <View pointerEvents="none" style={styles.placeholderLabel}>
          <Text variant="label" tone="muted">
            No 360° photo of this space yet
          </Text>
        </View>
      )}

      <View pointerEvents="none" style={styles.dragHint}>
        <Move size={14} color={c.muted} strokeWidth={2} />
        <Text variant="caption" tone="muted">
          Drag to look around, up and down
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

/**
 * Ordinary photos of the space. The panorama shows the shape of a room; these
 * are what someone deciding whether to move in actually looks at.
 */
function Gallery({ photos, name }: { photos: TourPhoto[]; name: string }) {
  const { c } = useTheme();

  if (photos.length === 0) {
    return (
      <View
        style={[
          styles.emptyGallery,
          { borderColor: c.border, backgroundColor: c.card },
        ]}
      >
        <ImageOff size={16} color={c.muted} strokeWidth={2} />
        <Text variant="label" tone="muted" style={styles.flex}>
          No photos of {name.toLowerCase()} yet. The hostel office adds these.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.strip}>
        {photos.map((photo) => (
          <View key={photo.id} style={styles.photoWrap}>
            <Image
              source={{ uri: mediaUri(photo.uri) }}
              style={[styles.photo, { backgroundColor: c.mutedBg }]}
              resizeMode="cover"
              accessible
              accessibilityLabel={photo.caption || `Photo of ${name}`}
            />
            {photo.caption ? (
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {photo.caption}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
    </ScrollView>
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
  photoWrap: { gap: 4, width: 200 },
  photo: { width: 200, height: 134, borderRadius: radius.lg },
  emptyGallery: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
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
