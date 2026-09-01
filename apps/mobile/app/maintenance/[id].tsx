import { StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
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

export default function MaintenanceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data, loading, error, reload } = useAsync(
    () => api.maintenanceById(id),
    [id]
  );

  return (
    <>
      <AppHeader title="Request" subtitle={id} />
      <Screen refreshing={loading} onRefresh={() => void reload()}>
        {loading && !data ? (
          <Loading />
        ) : error || !data ? (
          <ErrorState
            message={error ?? "Couldn't load this request."}
            onRetry={() => void reload()}
          />
        ) : (
          <>
            <RequestDetail
              id={data.id}
              title={data.title}
              status={data.status}
              createdAt={data.createdAt}
              timeline={data.timeline}
              photoUris={data.photoUris}
            >
              <Card style={styles.card}>
                <Text variant="cardTitle">Details</Text>
                <KeyValue label="Category" value={data.categoryLabel} />
                <KeyValue label="Problem" value={data.subCategoryLabel} />
                <KeyValue label="Your note" value={data.remarks} />
              </Card>
            </RequestDetail>

            {data.status !== "resolved" && (
              <Button
                label="Raise a complaint about this"
                variant="outline"
                onPress={() =>
                  router.push(`/complaints/new?against=${data.id}`)
                }
              />
            )}
          </>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
});
