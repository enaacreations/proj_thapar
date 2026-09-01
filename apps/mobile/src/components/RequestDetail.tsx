import type { ReactNode } from "react";
import { Image, ScrollView, StyleSheet, View } from "react-native";
import type { RequestStatus, TrackingEvent } from "@proj/shared";
import { radius, space } from "../theme/tokens";
import { formatDateTime } from "../lib/format";
import { StatusBadge } from "./Badge";
import { Card } from "./Card";
import { Text } from "./Text";
import { Timeline } from "./Timeline";

interface RequestDetailProps {
  id: string;
  title: string;
  status: RequestStatus;
  createdAt: string;
  timeline: TrackingEvent[];
  photoUris?: string[];
  /** Module-specific rows, rendered in their own card above the timeline. */
  children?: ReactNode;
}

/** Shared layout for every request detail screen — same shape everywhere. */
export function RequestDetail({
  id,
  title,
  status,
  createdAt,
  timeline,
  photoUris = [],
  children,
}: RequestDetailProps) {
  return (
    <>
      <Card style={styles.card}>
        <View style={styles.head}>
          <View style={styles.flex}>
            <Text variant="section">{title}</Text>
            <Text variant="mono" tone="muted">
              {id}
            </Text>
          </View>
          <StatusBadge status={status} />
        </View>
        <Text variant="label" tone="muted">
          Raised on {formatDateTime(createdAt)}
        </Text>
      </Card>

      {children}

      {photoUris.length > 0 && (
        <Card style={styles.card}>
          <Text variant="cardTitle">Photos</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.photos}
          >
            {photoUris.map((uri) => (
              <Image key={uri} source={{ uri }} style={styles.photo} />
            ))}
          </ScrollView>
        </Card>
      )}

      <Card style={styles.card}>
        <Text variant="cardTitle">Tracking</Text>
        <Timeline events={timeline} />
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  head: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  flex: { flex: 1, gap: 2 },
  photos: { gap: space.sm },
  photo: { width: 96, height: 96, borderRadius: radius.lg },
});
