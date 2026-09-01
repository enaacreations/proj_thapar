import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CLOTHING_LABELS } from "@proj/shared";
import { space } from "../../src/theme/tokens";
import { api } from "../../src/api/client";
import { useAsync } from "../../src/lib/useAsync";
import { AppHeader } from "../../src/components/AppHeader";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { KeyValue } from "../../src/components/Controls";
import { RequestDetail } from "../../src/components/RequestDetail";
import { Screen } from "../../src/components/Screen";
import { ErrorState, Loading } from "../../src/components/States";
import { Text } from "../../src/components/Text";

export default function LaundryDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data, loading, error, reload } = useAsync(
    () => api.laundryById(id),
    [id]
  );

  return (
    <>
      <AppHeader title="Laundry" subtitle={id} />
      <Screen refreshing={loading} onRefresh={() => void reload()}>
        {loading && !data ? (
          <Loading />
        ) : error || !data ? (
          <ErrorState
            message={error ?? "Couldn't load this pickup."}
            onRetry={() => void reload()}
          />
        ) : (
          <>
            <RequestDetail
              id={data.id}
              title={`${data.totalPieces} ${data.totalPieces === 1 ? "piece" : "pieces"}`}
              status={data.status}
              createdAt={data.createdAt}
              timeline={data.timeline}
              photoUris={data.photoUris}
            >
              <Card style={styles.card}>
                <Text variant="cardTitle">What's in the bag</Text>
                {data.items.map((item) => (
                  <View key={item.type} style={styles.row}>
                    <Text variant="body" style={styles.flex}>
                      {CLOTHING_LABELS[item.type]}
                      {item.pressing ? " · pressing" : ""}
                    </Text>
                    <Text variant="mono">{item.count}</Text>
                  </View>
                ))}
                <KeyValue label="Pickup slot" value={data.pickupSlot} />
              </Card>
            </RequestDetail>

            {/* Disputes are the whole reason the hand-over photo exists. */}
            <Button
              label="Something's wrong with this order"
              variant="outline"
              onPress={() => router.push(`/complaints/new?against=${data.id}`)}
            />
          </>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
  flex: { flex: 1 },
});
