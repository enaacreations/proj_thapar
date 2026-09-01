import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Star } from "lucide-react-native";
import { space } from "../../src/theme/tokens";
import { api } from "../../src/api/client";
import { useAsync } from "../../src/lib/useAsync";
import { relativeTime } from "../../src/lib/format";
import { AppHeader } from "../../src/components/AppHeader";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { Rating } from "../../src/components/Controls";
import { EmptyState } from "../../src/components/EmptyState";
import { Screen } from "../../src/components/Screen";
import { ErrorState, Loading } from "../../src/components/States";
import { Text } from "../../src/components/Text";

export default function FeedbackList() {
  const router = useRouter();
  const { data, loading, error, reload } = useAsync(
    () => api.feedbackList(),
    []
  );

  return (
    <>
      <AppHeader title="Feedback" />
      <Screen
        refreshing={loading}
        onRefresh={() => void reload()}
        footer={
          <Button
            label="Give feedback"
            emphasis
            onPress={() => router.push("/feedback/new")}
          />
        }
      >
        {loading && !data ? (
          <Loading />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void reload()} />
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon={Star}
            title="Tell us how it's going"
            description="Rate the mess, your room, laundry or facilities. It's the fastest way to get things improved."
          />
        ) : (
          data.map((entry) => (
            <Card key={entry.id} style={styles.card}>
              <View style={styles.head}>
                <View style={styles.flex}>
                  <Text variant="cardTitle">
                    {entry.categoryLabel} · {entry.subCategoryLabel}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {relativeTime(entry.createdAt)}
                  </Text>
                </View>
              </View>
              <Rating value={entry.rating} size={18} />
              {entry.remarks.length > 0 && (
                <Text variant="body" tone="muted">
                  {entry.remarks}
                </Text>
              )}
            </Card>
          ))
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.sm },
  head: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  flex: { flex: 1, gap: 2 },
});
