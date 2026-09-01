import { useMemo, useRef, useState } from "react";
import { PanResponder, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useTheme } from "../theme/ThemeProvider";
import { radius, space } from "../theme/tokens";
import { Button } from "./Button";
import { Text } from "./Text";

interface SignaturePadProps {
  /** SVG path data, or "" when empty. */
  value: string;
  onChange: (path: string) => void;
  height?: number;
}

const round = (n: number) => Math.round(n * 10) / 10;

/**
 * Captures a signature as SVG path data — no native dependency, and the result
 * is a plain string that stores and re-renders cleanly.
 */
export function SignaturePad({
  value,
  onChange,
  height = 180,
}: SignaturePadProps) {
  const { c } = useTheme();

  /** Finished strokes. */
  const [strokes, setStrokes] = useState<string[]>([]);
  /** The stroke currently under the finger. */
  const [live, setLive] = useState("");

  // PanResponder is created once, so it reads the latest handler through a ref.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,

        onPanResponderGrant: (e) => {
          const { locationX, locationY } = e.nativeEvent;
          setLive(`M${round(locationX)} ${round(locationY)}`);
        },

        onPanResponderMove: (e) => {
          const { locationX, locationY } = e.nativeEvent;
          setLive((d) => `${d} L${round(locationX)} ${round(locationY)}`);
        },

        onPanResponderRelease: () => {
          setLive((finished) => {
            if (finished) {
              setStrokes((prev) => {
                const next = [...prev, finished];
                onChangeRef.current(next.join(" "));
                return next;
              });
            }
            return "";
          });
        },
      }),
    []
  );

  const clear = () => {
    setStrokes([]);
    setLive("");
    onChange("");
  };

  const drawn = [...strokes, live].filter(Boolean).join(" ");
  const empty = drawn.length === 0 && value.length === 0;

  return (
    <View style={styles.wrap}>
      <View
        {...responder.panHandlers}
        style={[
          styles.pad,
          { height, borderColor: c.border, backgroundColor: c.card },
        ]}
      >
        <Svg width="100%" height={height}>
          {drawn.length > 0 && (
            <Path
              d={drawn}
              stroke={c.ink}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          )}
        </Svg>

        {empty && (
          <View pointerEvents="none" style={styles.hint}>
            <Text variant="label" tone="muted">
              Sign here with your finger
            </Text>
          </View>
        )}

        <View
          pointerEvents="none"
          style={[styles.baseline, { backgroundColor: c.border }]}
        />
      </View>

      {!empty && (
        <Button
          label="Clear and sign again"
          variant="link"
          fullWidth={false}
          onPress={clear}
          style={styles.clear}
        />
      )}
    </View>
  );
}

/** Read-only rendering of a stored signature. */
export function SignatureImage({
  path,
  height = 90,
}: {
  path: string;
  height?: number;
}) {
  const { c } = useTheme();

  return (
    <View style={{ height }}>
      <Svg width="100%" height={height}>
        <Path
          d={path}
          stroke={c.ink}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  pad: {
    borderWidth: 1,
    borderRadius: radius.lg,
    overflow: "hidden",
    justifyContent: "center",
  },
  hint: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  baseline: { position: "absolute", left: 24, right: 24, bottom: 36, height: 1 },
  clear: { alignSelf: "flex-end" },
});
