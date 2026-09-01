import { StyleSheet, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { MEAL_LABELS, RELATION_LABELS } from "@proj/shared";
import { space } from "../../src/theme/tokens";
import { api } from "../../src/api/client";
import { useAsync } from "../../src/lib/useAsync";
import { formatDate } from "../../src/lib/format";
import { AppHeader } from "../../src/components/AppHeader";
import { Card } from "../../src/components/Card";
import { KeyValue } from "../../src/components/Controls";
import { RequestDetail } from "../../src/components/RequestDetail";
import { Screen } from "../../src/components/Screen";
import { ErrorState, Loading } from "../../src/components/States";
import { Text } from "../../src/components/Text";

export default function VisitDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading, error, reload } = useAsync(
    () => api.visitById(id),
    [id]
  );

  return (
    <>
      <AppHeader title="Visit" subtitle={id} />
      <Screen refreshing={loading} onRefresh={() => void reload()}>
        {loading && !data ? (
          <Loading />
        ) : error || !data ? (
          <ErrorState
            message={error ?? "Couldn't load this visit."}
            onRetry={() => void reload()}
          />
        ) : (
          <RequestDetail
            id={data.id}
            title={data.visitorName}
            status={data.status}
            createdAt={data.createdAt}
            timeline={data.timeline}
          >
            <Card style={styles.card}>
              <Text variant="cardTitle">Visit details</Text>
              <KeyValue
                label="Relation"
                value={RELATION_LABELS[data.relation]}
              />
              <KeyValue label="Date" value={formatDate(data.visitDate)} />
              <KeyValue label="Duration" value={`${data.durationHours} hours`} />
              <KeyValue
                label="Food"
                value={data.foodRequired ? "Ordered" : "Not ordered"}
              />
            </Card>

            {data.foodSelections.length > 0 && (
              <Card style={styles.card}>
                <Text variant="cardTitle">Meals ordered</Text>
                {data.foodSelections.map((selection) => (
                  <View key={selection.meal} style={styles.mealRow}>
                    <Text variant="label" tone="muted">
                      {MEAL_LABELS[selection.meal]}
                    </Text>
                    <Text variant="body">{selection.items.join(", ")}</Text>
                  </View>
                ))}
              </Card>
            )}
          </RequestDetail>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  mealRow: { gap: 2 },
});
