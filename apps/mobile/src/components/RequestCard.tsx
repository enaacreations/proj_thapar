import type { ServiceRequestKind, ServiceRequestSummary } from "@proj/shared";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import {
  CalendarHeart,
  ChevronRight,
  MessageSquareWarning,
  Shirt,
  Wrench,
  type LucideIcon,
} from "lucide-react-native";
import { useTheme } from "../theme/ThemeProvider";
import { radius, space, withAlpha } from "../theme/tokens";
import { relativeTime } from "../lib/format";
import { StatusBadge } from "./Badge";
import { Card } from "./Card";
import { Text } from "./Text";

const KIND_ICON: Record<ServiceRequestKind, LucideIcon> = {
  maintenance: Wrench,
  laundry: Shirt,
  complaint: MessageSquareWarning,
  visit: CalendarHeart,
};

const KIND_LABEL: Record<ServiceRequestKind, string> = {
  maintenance: "Maintenance",
  laundry: "Laundry",
  complaint: "Complaint",
  visit: "Visit",
};

const KIND_ROUTE: Record<ServiceRequestKind, string> = {
  maintenance: "/maintenance",
  laundry: "/laundry",
  complaint: "/complaints",
  visit: "/visits",
};

/** The one card shape used by every list of requests in the app. */
export function RequestCard({
  request,
  showKind = true,
}: {
  request: ServiceRequestSummary;
  showKind?: boolean;
}) {
  const { c } = useTheme();
  const router = useRouter();
  const Icon = KIND_ICON[request.kind];

  return (
    <Card
      accessibilityLabel={`${KIND_LABEL[request.kind]} ${request.id}, ${request.title}`}
      onPress={() =>
        router.push(`${KIND_ROUTE[request.kind]}/${request.id}` as never)
      }
    >
      <View style={styles.row}>
        <View
          style={[
            styles.chip,
            { backgroundColor: withAlpha(c.accent, 0.12) },
          ]}
        >
          <Icon size={20} color={c.accentStrong} strokeWidth={2} />
        </View>

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text variant="cardTitle" numberOfLines={1} style={styles.flex}>
              {request.title}
            </Text>
            <ChevronRight size={18} color={c.muted} strokeWidth={2} />
          </View>

          <Text variant="mono" tone="muted">
            {request.id}
          </Text>

          <View style={styles.metaRow}>
            <StatusBadge status={request.status} />
            <Text variant="caption" tone="muted">
              {showKind ? `${KIND_LABEL[request.kind]} · ` : ""}
              {relativeTime(request.createdAt)}
            </Text>
          </View>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: space.md },
  chip: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, gap: 2 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  flex: { flex: 1 },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    marginTop: space.xs,
    flexWrap: "wrap",
  },
});
