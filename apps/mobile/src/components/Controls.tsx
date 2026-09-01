import { Pressable, StyleSheet, View } from "react-native";
import { Minus, Plus, Star } from "lucide-react-native";
import { useTheme } from "../theme/ThemeProvider";
import { layout, radius, space } from "../theme/tokens";
import { Text } from "./Text";

/* ------------------------------------------------------ segmented control */

interface SegmentedProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: SegmentedProps<T>) {
  const { c } = useTheme();

  return (
    <View
      style={[
        styles.segmented,
        { backgroundColor: c.mutedBg, borderColor: c.border },
      ]}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            style={[
              styles.segment,
              active && { backgroundColor: c.card, borderColor: c.border },
            ]}
          >
            <Text
              variant="label"
              tone={active ? "ink" : "muted"}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* --------------------------------------------------------------- stepper */

interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label: string;
}

/** Plus/minus counter — easier than a keyboard for counting laundry pieces. */
export function Stepper({
  value,
  onChange,
  min = 0,
  max = 99,
  label,
}: StepperProps) {
  const { c } = useTheme();

  const step = (delta: number) => {
    const next = Math.min(max, Math.max(min, value + delta));
    if (next !== value) onChange(next);
  };

  return (
    <View style={styles.stepper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Decrease ${label}`}
        onPress={() => step(-1)}
        disabled={value <= min}
        style={[
          styles.stepButton,
          { borderColor: c.border, opacity: value <= min ? 0.4 : 1 },
        ]}
      >
        <Minus size={18} color={c.ink} strokeWidth={2} />
      </Pressable>
      <Text variant="mono" style={styles.stepValue}>
        {value}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Increase ${label}`}
        onPress={() => step(1)}
        disabled={value >= max}
        style={[
          styles.stepButton,
          { borderColor: c.border, opacity: value >= max ? 0.4 : 1 },
        ]}
      >
        <Plus size={18} color={c.ink} strokeWidth={2} />
      </Pressable>
    </View>
  );
}

/* ---------------------------------------------------------------- rating */

interface RatingProps {
  value: number;
  onChange?: (value: number) => void;
  size?: number;
}

/** 5 highest, 1 lowest. Read-only when `onChange` is omitted. */
export function Rating({ value, onChange, size = 32 }: RatingProps) {
  const { c } = useTheme();

  return (
    <View style={styles.rating}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= value;
        const content = (
          <Star
            size={size}
            color={filled ? c.warning : c.muted}
            fill={filled ? c.warning : "transparent"}
            strokeWidth={1.75}
          />
        );

        if (!onChange) return <View key={star}>{content}</View>;

        return (
          <Pressable
            key={star}
            accessibilityRole="radio"
            accessibilityState={{ selected: filled }}
            accessibilityLabel={`${star} of 5 stars`}
            onPress={() => onChange(star)}
            style={styles.star}
          >
            {content}
          </Pressable>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------- key/value */

export function KeyValue({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <View style={styles.kv}>
      <Text variant="label" tone="muted" style={styles.kvLabel}>
        {label}
      </Text>
      <Text
        variant={mono ? "mono" : "body"}
        style={styles.kvValue}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

/* -------------------------------------------------------------- checkbox */

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
}) {
  const { c } = useTheme();

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={() => onChange(!checked)}
      style={styles.toggleRow}
    >
      <View style={styles.toggleText}>
        <Text variant="cardTitle">{label}</Text>
        {description && (
          <Text variant="label" tone="muted">
            {description}
          </Text>
        )}
      </View>
      <View
        style={[
          styles.track,
          {
            backgroundColor: checked ? c.accent : c.mutedBg,
            borderColor: checked ? c.accent : c.secondaryBorder,
          },
        ]}
      >
        <View
          style={[
            styles.knob,
            {
              backgroundColor: c.card,
              alignSelf: checked ? "flex-end" : "flex-start",
            },
          ]}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  segmented: {
    flexDirection: "row",
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "transparent",
    paddingHorizontal: 6,
  },
  stepper: { flexDirection: "row", alignItems: "center", gap: space.md },
  stepButton: {
    width: layout.minTapTarget,
    height: layout.minTapTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stepValue: { minWidth: 24, textAlign: "center", fontSize: 16 },
  rating: { flexDirection: "row", gap: space.sm },
  star: { padding: 6 },
  kv: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  kvLabel: { width: 120 },
  kvValue: { flex: 1, textAlign: "right" },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: layout.minTapTarget,
    paddingVertical: 4,
  },
  toggleText: { flex: 1, gap: 2 },
  track: {
    width: 48,
    height: 28,
    borderRadius: radius.pill,
    borderWidth: 1,
    padding: 2,
    justifyContent: "center",
  },
  knob: { width: 22, height: 22, borderRadius: radius.pill },
});
