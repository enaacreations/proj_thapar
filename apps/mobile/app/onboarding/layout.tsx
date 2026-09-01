import { useMemo, useRef, useState } from "react";
import {
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { Info, Plus, RotateCcw, Trash2 } from "lucide-react-native";
import type { LayoutPiece, RoomPlan } from "@proj/shared";
import { useTheme } from "../../src/theme/ThemeProvider";
import { radius, space, withAlpha } from "../../src/theme/tokens";
import { api } from "../../src/api/client";
import { useAsync } from "../../src/lib/useAsync";
import { AppHeader } from "../../src/components/AppHeader";
import { Card } from "../../src/components/Card";
import { Screen } from "../../src/components/Screen";
import { ErrorState, Loading } from "../../src/components/States";
import { Text } from "../../src/components/Text";

interface Placed {
  uid: string;
  piece: LayoutPiece;
  xCm: number;
  yCm: number;
}

/**
 * Top-down room planner. A true AR overlay needs ARKit/ARCore through a
 * development build; this works on every phone today and answers the same
 * question — will my things actually fit.
 */
export default function LayoutScreen() {
  const { c } = useTheme();
  const { width } = useWindowDimensions();

  const plan = useAsync(() => api.roomPlan(), []);
  const pieces = useAsync(() => api.layoutPieces(), []);

  const [placed, setPlaced] = useState<Placed[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  const canvasWidth = width - 64;
  const scale = plan.data ? canvasWidth / plan.data.widthCm : 1;
  const canvasHeight = plan.data ? plan.data.depthCm * scale : 200;

  const add = (piece: LayoutPiece) => {
    const uid = `${piece.id}-${placed.length}-${Math.round(scale * 1000)}`;
    setPlaced((prev) => [
      ...prev,
      { uid, piece, xCm: 20, yCm: 20 },
    ]);
    setSelected(uid);
  };

  const usedArea = placed.reduce(
    (sum, p) => sum + p.piece.widthCm * p.piece.depthCm,
    0
  );
  const floorArea = plan.data ? plan.data.widthCm * plan.data.depthCm : 1;
  const fixtureArea = (plan.data?.fixtures ?? []).reduce(
    (sum, f) => sum + f.widthCm * f.depthCm,
    0
  );
  const freePercent = Math.max(
    0,
    Math.round(((floorArea - fixtureArea - usedArea) / floorArea) * 100)
  );

  return (
    <>
      <AppHeader title="Room planner" />
      <Screen>
        {plan.loading && !plan.data ? (
          <Loading />
        ) : plan.error || !plan.data ? (
          <ErrorState
            message={plan.error ?? "Couldn't load the room plan."}
            onRetry={() => void plan.reload()}
          />
        ) : (
          <>
            <Card style={styles.card}>
              <View style={styles.noteRow}>
                <Info size={16} color={c.muted} strokeWidth={2} />
                <Text variant="label" tone="muted" style={styles.flex}>
                  Top-down view of a {plan.data.widthCm / 100}m ×{" "}
                  {plan.data.depthCm / 100}m room, drawn to scale. Drag your
                  things around to see what fits.
                </Text>
              </View>
            </Card>

            <View
              style={[
                styles.canvas,
                {
                  width: canvasWidth,
                  height: canvasHeight,
                  borderColor: c.ink,
                  backgroundColor: c.card,
                },
              ]}
            >
              {plan.data.fixtures.map((fixture) => (
                <View
                  key={fixture.name}
                  style={[
                    styles.fixture,
                    {
                      left: fixture.xCm * scale,
                      top: fixture.yCm * scale,
                      width: fixture.widthCm * scale,
                      height: fixture.depthCm * scale,
                      backgroundColor: c.mutedBg,
                      borderColor: c.secondaryBorder,
                    },
                  ]}
                >
                  <Text variant="caption" tone="muted" numberOfLines={1}>
                    {fixture.name}
                  </Text>
                </View>
              ))}

              {placed.map((item) => (
                <DraggablePiece
                  key={item.uid}
                  item={item}
                  scale={scale}
                  bounds={{ w: plan.data!.widthCm, d: plan.data!.depthCm }}
                  selected={item.uid === selected}
                  onSelect={() => setSelected(item.uid)}
                  onMove={(xCm, yCm) =>
                    setPlaced((prev) =>
                      prev.map((p) => (p.uid === item.uid ? { ...p, xCm, yCm } : p))
                    )
                  }
                />
              ))}
            </View>

            <View style={styles.statsRow}>
              <Text variant="label" tone="muted">
                About {freePercent}% of the floor still free
              </Text>
              {placed.length > 0 && (
                <View style={styles.actions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Remove selected"
                    onPress={() =>
                      setPlaced((prev) => prev.filter((p) => p.uid !== selected))
                    }
                    hitSlop={8}
                    style={styles.iconButton}
                  >
                    <Trash2 size={18} color={c.danger} strokeWidth={2} />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Clear all"
                    onPress={() => {
                      setPlaced([]);
                      setSelected(null);
                    }}
                    hitSlop={8}
                    style={styles.iconButton}
                  >
                    <RotateCcw size={18} color={c.muted} strokeWidth={2} />
                  </Pressable>
                </View>
              )}
            </View>

            <Text variant="section" style={styles.sectionHead}>
              Add your things
            </Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.strip}>
                {(pieces.data ?? []).map((piece) => (
                  <Pressable
                    key={piece.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${piece.name}`}
                    onPress={() => add(piece)}
                    style={[styles.pieceChip, { borderColor: c.border }]}
                  >
                    <Plus size={14} color={c.accentStrong} strokeWidth={2.5} />
                    <View>
                      <Text variant="label">{piece.name}</Text>
                      <Text variant="caption" tone="muted">
                        {piece.widthCm} × {piece.depthCm} cm
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </>
        )}
      </Screen>
    </>
  );
}

function DraggablePiece({
  item,
  scale,
  bounds,
  selected,
  onSelect,
  onMove,
}: {
  item: Placed;
  scale: number;
  bounds: { w: number; d: number };
  selected: boolean;
  onSelect: () => void;
  onMove: (xCm: number, yCm: number) => void;
}) {
  const { c } = useTheme();
  const start = useRef({ x: item.xCm, y: item.yCm });

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          start.current = { x: item.xCm, y: item.yCm };
          onSelect();
        },
        onPanResponderMove: (_e, gesture) => {
          // Clamp so a piece can't be dragged through a wall.
          const x = clamp(
            start.current.x + gesture.dx / scale,
            0,
            bounds.w - item.piece.widthCm
          );
          const y = clamp(
            start.current.y + gesture.dy / scale,
            0,
            bounds.d - item.piece.depthCm
          );
          onMove(Math.round(x), Math.round(y));
        },
      }),
    [item.xCm, item.yCm, item.piece, scale, bounds, onMove, onSelect]
  );

  return (
    <View
      {...responder.panHandlers}
      style={[
        styles.piece,
        {
          left: item.xCm * scale,
          top: item.yCm * scale,
          width: item.piece.widthCm * scale,
          height: item.piece.depthCm * scale,
          backgroundColor: withAlpha(c.accent, selected ? 0.35 : 0.18),
          borderColor: selected ? c.accent : c.accentStrong,
        },
      ]}
    >
      <Text variant="caption" numberOfLines={2} style={styles.pieceLabel}>
        {item.piece.name}
      </Text>
    </View>
  );
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const styles = StyleSheet.create({
  card: { gap: space.sm },
  noteRow: { flexDirection: "row", gap: space.sm, alignItems: "flex-start" },
  flex: { flex: 1 },
  canvas: {
    alignSelf: "center",
    borderWidth: 2,
    borderRadius: radius.md,
    position: "relative",
    overflow: "hidden",
  },
  fixture: {
    position: "absolute",
    borderWidth: 1,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    padding: 2,
  },
  piece: {
    position: "absolute",
    borderWidth: 1.5,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    padding: 2,
  },
  pieceLabel: { textAlign: "center" },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  actions: { flexDirection: "row", gap: space.sm },
  iconButton: { padding: 6 },
  sectionHead: { marginTop: space.md },
  strip: { flexDirection: "row", gap: space.sm, paddingVertical: 2 },
  pieceChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    minHeight: 52,
  },
});
