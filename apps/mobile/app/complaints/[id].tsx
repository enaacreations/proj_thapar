import { StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { space } from "../../src/theme/tokens";
import { api } from "../../src/api/client";
import { useAsync } from "../../src/lib/useAsync";
import { AppHeader } from "../../src/components/AppHeader";
import { Card } from "../../src/components/Card";
import { KeyValue } from "../../src/components/Controls";
import { RequestDetail } from "../../src/components/RequestDetail";
import { Screen } from "../../src/components/Screen";
import { ErrorState, Loading } from "../../src/components/States";
import { Text } from "../../src/components/Text";

export default function ComplaintDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading, error, reload } = useAsync(
    () => api.complaintById(id),
    [id]
  );

  return (
    <>
      <AppHeader title="Complaint" subtitle={id} />
      <Screen refreshing={loading} onRefresh={() => void reload()}>
        {loading && !data ? (
          <Loading />
        ) : error || !data ? (
          <ErrorState
            message={error ?? "Couldn't load this complaint."}
            onRetry={() => void reload()}
          />
        ) : (
          <RequestDetail
            id={data.id}
            title={data.title}
            status={data.status}
            createdAt={data.createdAt}
            timeline={data.timeline}
          >
            <Card style={styles.card}>
              <Text variant="cardTitle">Details</Text>
              <KeyValue label="Category" value={data.categoryLabel} />
              <KeyValue label="Issue" value={data.subCategoryLabel} />
              <KeyValue label="What you said" value={data.remarks} />
              {data.againstRequestId && (
                <KeyValue label="Linked to" value={data.againstRequestId} mono />
              )}
            </Card>
          </RequestDetail>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
});
