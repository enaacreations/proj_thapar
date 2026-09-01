import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Delete } from "lucide-react-native";
import { useTheme } from "../theme/ThemeProvider";
import { fonts, radius, space } from "../theme/tokens";
import { Text } from "./Text";

interface PinPadProps {
  value: string;
  onChange: (next: string) => void;
  length?: number;
  error?: string | null;
  busy?: boolean;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

/** Big on-screen keypad — faster and less error-prone than the OS keyboard. */
export function PinPad({
  value,
  onChange,
  length = 6,
  error,
  busy = false,
}: PinPadProps) {
  const { c } = useTheme();

  const press = (key: string) => {
    if (busy) return;
    if (key === "del") {
      onChange(value.slice(0, -1));
      return;
    }
    if (value.length < length) onChange(value + key);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.dots}>
        {Array.from({ length }, (_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                borderColor: error ? c.danger : c.border,
                backgroundColor:
                  i < value.length ? (error ? c.danger : c.accent) : "transparent",
              },
            ]}
          />
        ))}
      </View>

      {busy ? (
        <ActivityIndicator color={c.accent} />
      ) : error ? (
        <Text variant="label" tone="danger">
          {error}
        </Text>
      ) : (
        <View style={styles.spacer} />
      )}

      <View style={styles.keys}>
        {KEYS.map((key, index) =>
          key === "" ? (
            <View key={`gap-${index}`} style={styles.key} />
          ) : (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={key === "del" ? "Delete" : key}
              onPress={() => press(key)}
              style={({ pressed }) => [
                styles.key,
                pressed && { backgroundColor: c.mutedBg },
              ]}
            >
              {key === "del" ? (
                <Delete size={24} color={c.ink} strokeWidth={1.75} />
              ) : (
                <Text style={[styles.keyLabel, { color: c.ink }]}>{key}</Text>
              )}
            </Pressable>
          )
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: space.lg },
  dots: { flexDirection: "row", gap: space.md, marginTop: space.lg },
  dot: { width: 16, height: 16, borderRadius: radius.pill, borderWidth: 1.5 },
  spacer: { height: 18 },
  keys: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    maxWidth: 300,
  },
  key: {
    width: "33.333%",
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.lg,
  },
  keyLabel: { fontFamily: fonts.monoSemi, fontSize: 26, lineHeight: 32 },
});
