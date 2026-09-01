import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react-native";
import { useTheme } from "../theme/ThemeProvider";
import { layout, radius, space } from "../theme/tokens";
import { toIsoDate } from "../lib/format";
import { Text } from "./Text";

interface CalendarProps {
  /** ISO date, e.g. "2026-09-14". */
  value: string | null;
  onChange: (iso: string) => void;
  minDate?: string;
  maxDate?: string;
  /** Highlights a second date to show an inclusive range (used for pauses). */
  rangeEnd?: string | null;
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

type CalendarView = "days" | "months" | "years";

/**
 * Month grid picker. Avoids a native date-picker dependency and matches the
 * theme. The month/year header is tappable so far-off dates (a date of birth
 * two decades back) take three taps instead of hundreds of arrow presses.
 */
export function Calendar({
  value,
  onChange,
  minDate,
  maxDate,
  rangeEnd,
}: CalendarProps) {
  const { c } = useTheme();
  const [view, setView] = useState<CalendarView>("days");

  const [cursor, setCursor] = useState(() => {
    // Opening on today would show an all-disabled month whenever the allowed
    // range ends in the past, so start inside the range.
    const base = value ? new Date(value) : new Date();
    const clamped = clamp(base, minDate, maxDate);
    return new Date(clamped.getFullYear(), clamped.getMonth(), 1);
  });

  const minYear = minDate
    ? Number(minDate.slice(0, 4))
    : cursor.getFullYear() - 100;
  const maxYear = maxDate
    ? Number(maxDate.slice(0, 4))
    : cursor.getFullYear() + 10;

  // Newest first: a date of birth is usually only a few years back from the
  // top of the range, and a visit date is this year.
  const years = useMemo(
    () =>
      Array.from({ length: maxYear - minYear + 1 }, (_, i) => maxYear - i),
    [minYear, maxYear]
  );

  const cells = useMemo(() => {
    const firstWeekday = cursor.getDay();
    const daysInMonth = new Date(
      cursor.getFullYear(),
      cursor.getMonth() + 1,
      0
    ).getDate();

    const out: (string | null)[] = Array(firstWeekday).fill(null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      out.push(toIsoDate(new Date(cursor.getFullYear(), cursor.getMonth(), day)));
    }
    return out;
  }, [cursor]);

  const shiftMonth = (delta: number) =>
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));

  const isDisabled = (iso: string) =>
    (minDate !== undefined && iso < minDate) ||
    (maxDate !== undefined && iso > maxDate);

  /** Greys out an arrow when every date in the next month is out of range. */
  const monthOutOfRange = (delta: number) => {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1);
    const last = new Date(next.getFullYear(), next.getMonth() + 1, 0);
    if (maxDate !== undefined && toIsoDate(next) > maxDate) return true;
    if (minDate !== undefined && toIsoDate(last) < minDate) return true;
    return false;
  };

  const monthDisabled = (monthIndex: number) => {
    const first = new Date(cursor.getFullYear(), monthIndex, 1);
    const last = new Date(cursor.getFullYear(), monthIndex + 1, 0);
    if (maxDate !== undefined && toIsoDate(first) > maxDate) return true;
    if (minDate !== undefined && toIsoDate(last) < minDate) return true;
    return false;
  };

  const inRange = (iso: string) =>
    value !== null &&
    rangeEnd != null &&
    iso > (value < rangeEnd ? value : rangeEnd) &&
    iso < (value < rangeEnd ? rangeEnd : value);

  /* ------------------------------------------------------------- years */

  if (view === "years") {
    return (
      <View style={styles.wrap}>
        <PickerHeader
          label="Select year"
          onBack={() => setView("days")}
        />
        <ScrollView style={styles.pickerScroll} contentContainerStyle={styles.pickerGrid}>
          {years.map((year) => {
            const selected = year === cursor.getFullYear();
            return (
              <Pressable
                key={year}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => {
                  setCursor(
                    clampMonth(
                      new Date(year, cursor.getMonth(), 1),
                      minDate,
                      maxDate
                    )
                  );
                  setView("months");
                }}
                style={[
                  styles.pickerCell,
                  {
                    borderColor: selected ? c.accent : c.border,
                    backgroundColor: selected ? c.accent : "transparent",
                  },
                ]}
              >
                <Text variant="body" tone={selected ? "onAccent" : "ink"}>
                  {year}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  /* ------------------------------------------------------------ months */

  if (view === "months") {
    return (
      <View style={styles.wrap}>
        <PickerHeader
          label={String(cursor.getFullYear())}
          onBack={() => setView("days")}
          onLabelPress={() => setView("years")}
        />
        <View style={styles.pickerGrid}>
          {MONTHS.map((month, index) => {
            const selected = index === cursor.getMonth();
            const disabled = monthDisabled(index);
            return (
              <Pressable
                key={month}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled }}
                disabled={disabled}
                onPress={() => {
                  setCursor(new Date(cursor.getFullYear(), index, 1));
                  setView("days");
                }}
                style={[
                  styles.pickerCell,
                  {
                    borderColor: selected ? c.accent : c.border,
                    backgroundColor: selected ? c.accent : "transparent",
                    opacity: disabled ? 0.4 : 1,
                  },
                ]}
              >
                <Text variant="body" tone={selected ? "onAccent" : "ink"}>
                  {month}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  /* -------------------------------------------------------------- days */

  const prevBlocked = monthOutOfRange(-1);
  const nextBlocked = monthOutOfRange(1);

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          accessibilityState={{ disabled: prevBlocked }}
          disabled={prevBlocked}
          onPress={() => shiftMonth(-1)}
          style={[styles.navButton, prevBlocked && styles.dim]}
        >
          <ChevronLeft size={20} color={c.ink} strokeWidth={2} />
        </Pressable>

        {/* Tapping the title is the way out of the month-by-month grind. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose month and year"
          onPress={() => setView("years")}
          style={styles.title}
        >
          <Text variant="section">
            {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
          </Text>
          <ChevronDown size={18} color={c.accentStrong} strokeWidth={2} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          accessibilityState={{ disabled: nextBlocked }}
          disabled={nextBlocked}
          onPress={() => shiftMonth(1)}
          style={[styles.navButton, nextBlocked && styles.dim]}
        >
          <ChevronRight size={20} color={c.ink} strokeWidth={2} />
        </Pressable>
      </View>

      <View style={styles.grid}>
        {WEEKDAYS.map((day, i) => (
          <View key={`${day}-${i}`} style={styles.cell}>
            <Text variant="caption" tone="muted">
              {day}
            </Text>
          </View>
        ))}

        {cells.map((iso, index) => {
          if (iso === null) return <View key={`pad-${index}`} style={styles.cell} />;

          const selected = iso === value || iso === rangeEnd;
          const disabled = isDisabled(iso);
          const between = inRange(iso);

          return (
            <Pressable
              key={iso}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled }}
              accessibilityLabel={iso}
              disabled={disabled}
              onPress={() => onChange(iso)}
              style={styles.cell}
            >
              <View
                style={[
                  styles.day,
                  between && { backgroundColor: c.mutedBg },
                  selected && { backgroundColor: c.accent },
                ]}
              >
                <Text
                  variant="body"
                  tone={selected ? "onAccent" : disabled ? "muted" : "ink"}
                  style={disabled ? styles.dim : undefined}
                >
                  {Number(iso.slice(8))}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function PickerHeader({
  label,
  onBack,
  onLabelPress,
}: {
  label: string;
  onBack: () => void;
  onLabelPress?: () => void;
}) {
  const { c } = useTheme();

  return (
    <View style={styles.head}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to days"
        onPress={onBack}
        style={styles.navButton}
      >
        <ChevronLeft size={20} color={c.ink} strokeWidth={2} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        disabled={!onLabelPress}
        onPress={onLabelPress}
        style={styles.title}
      >
        <Text variant="section">{label}</Text>
        {onLabelPress && (
          <ChevronDown size={18} color={c.accentStrong} strokeWidth={2} />
        )}
      </Pressable>
      <View style={styles.navButton} />
    </View>
  );
}

/** Pulls a date inside [minDate, maxDate] so the grid opens somewhere usable. */
function clamp(date: Date, minDate?: string, maxDate?: string): Date {
  const iso = toIsoDate(date);
  if (maxDate !== undefined && iso > maxDate) return new Date(maxDate);
  if (minDate !== undefined && iso < minDate) return new Date(minDate);
  return date;
}

/** Same idea, but keeps the whole month in range after a year change. */
function clampMonth(date: Date, minDate?: string, maxDate?: string): Date {
  const first = toIsoDate(date);
  if (maxDate !== undefined && first > maxDate) {
    const max = new Date(maxDate);
    return new Date(max.getFullYear(), max.getMonth(), 1);
  }
  const last = toIsoDate(new Date(date.getFullYear(), date.getMonth() + 1, 0));
  if (minDate !== undefined && last < minDate) {
    const min = new Date(minDate);
    return new Date(min.getFullYear(), min.getMonth(), 1);
  }
  return date;
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: layout.minTapTarget,
    paddingHorizontal: space.sm,
  },
  navButton: {
    width: layout.minTapTarget,
    height: layout.minTapTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  day: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  pickerScroll: { maxHeight: 260 },
  pickerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
  },
  pickerCell: {
    width: "30%",
    flexGrow: 1,
    minHeight: layout.minTapTarget,
    borderWidth: 1,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  dim: { opacity: 0.4 },
});
