import {
  REQUEST_STATUS_LABELS,
  type RequestStatus,
  type TrackingEvent,
} from "@proj/shared";
import { StyleSheet, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { radius, space, type Palette } from "../theme/tokens";
import { formatDateTime } from "../lib/format";
import { Text } from "./Text";

const DOT_COLOR: Record<RequestStatus, keyof Palette> = {
  submitted: "info",
  in_progress: "warning",
  resolved: "success",
  rejected: "danger",
  cancelled: "muted",
};

/** Vertical audit trail shown on every request detail screen. */
export function Timeline({ events }: { events: TrackingEvent[] }) {
  const { c } = useTheme();

  return (
    <View style={styles.wrap}>
      {events.map((event, index) => {
        const isLast = index === events.length - 1;
        const dot = c[DOT_COLOR[event.status]];

        return (
          <View key={`${event.at}-${index}`} style={styles.row}>
            <View style={styles.rail}>
              <View style={[styles.dot, { backgroundColor: dot }]} />
              {!isLast && (
                <View style={[styles.line, { backgroundColor: c.border }]} />
              )}
            </View>
            <View style={styles.body}>
              <Text variant="cardTitle">
                {REQUEST_STATUS_LABELS[event.status]}
              </Text>
              <Text variant="body" tone="muted">
                {event.note}
              </Text>
              <Text variant="caption" tone="muted">
                {formatDateTime(event.at)}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 0 },
  row: { flexDirection: "row", gap: space.md },
  rail: { alignItems: "center", width: 12 },
  dot: { width: 12, height: 12, borderRadius: radius.pill, marginTop: 4 },
  line: { width: 2, flex: 1, marginVertical: 4 },
  body: { flex: 1, gap: 2, paddingBottom: space.lg },
});
