import { useRouter } from "expo-router";
import { MessageSquareWarning } from "lucide-react-native";
import { api } from "../../src/api/client";
import { useAsync } from "../../src/lib/useAsync";
import { AppHeader } from "../../src/components/AppHeader";
import { Button } from "../../src/components/Button";
import { EmptyState } from "../../src/components/EmptyState";
import { RequestCard } from "../../src/components/RequestCard";
import { Screen } from "../../src/components/Screen";
import { ErrorState, Loading } from "../../src/components/States";

export default function ComplaintsList() {
  const router = useRouter();
  const { data, loading, error, reload } = useAsync(
    () => api.complaintList(),
    []
  );

  return (
    <>
      <AppHeader title="Complaints" />
      <Screen
        refreshing={loading}
        onRefresh={() => void reload()}
        footer={
          <Button
            label="Raise a complaint"
            emphasis
            onPress={() => router.push("/complaints/new")}
          />
        }
      >
        {loading && !data ? (
          <Loading />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void reload()} />
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon={MessageSquareWarning}
            title="No complaints raised"
            description="If something isn't right — food, cleaning, security, staff — raise it here and track what happens."
          />
        ) : (
          data.map((complaint) => (
            <RequestCard key={complaint.id} request={complaint} showKind={false} />
          ))
        )}
      </Screen>
    </>
  );
}
