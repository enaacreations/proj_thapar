import { useRouter } from "expo-router";
import { Wrench } from "lucide-react-native";
import { api } from "../../src/api/client";
import { useAsync } from "../../src/lib/useAsync";
import { AppHeader } from "../../src/components/AppHeader";
import { Button } from "../../src/components/Button";
import { EmptyState } from "../../src/components/EmptyState";
import { RequestCard } from "../../src/components/RequestCard";
import { Screen } from "../../src/components/Screen";
import { ErrorState, Loading } from "../../src/components/States";

export default function MaintenanceList() {
  const router = useRouter();
  const { data, loading, error, reload } = useAsync(
    () => api.maintenanceList(),
    []
  );

  return (
    <>
      <AppHeader title="Room maintenance" />
      <Screen
        refreshing={loading}
        onRefresh={() => void reload()}
        footer={
          <Button
            label="Report a problem"
            emphasis
            onPress={() => router.push("/maintenance/new")}
          />
        }
      >
        {loading && !data ? (
          <Loading />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void reload()} />
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title="Nothing broken so far"
            description="Report a faulty light, AC, tap or lock and the maintenance team gets it straight away."
            actionLabel="Report a problem"
            onAction={() => router.push("/maintenance/new")}
          />
        ) : (
          data.map((request) => (
            <RequestCard key={request.id} request={request} showKind={false} />
          ))
        )}
      </Screen>
    </>
  );
}
