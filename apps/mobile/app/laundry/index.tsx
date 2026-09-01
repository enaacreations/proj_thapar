import { useRouter } from "expo-router";
import { Shirt } from "lucide-react-native";
import { api } from "../../src/api/client";
import { useAsync } from "../../src/lib/useAsync";
import { AppHeader } from "../../src/components/AppHeader";
import { Button } from "../../src/components/Button";
import { EmptyState } from "../../src/components/EmptyState";
import { RequestCard } from "../../src/components/RequestCard";
import { Screen } from "../../src/components/Screen";
import { ErrorState, Loading } from "../../src/components/States";

export default function LaundryList() {
  const router = useRouter();
  const { data, loading, error, reload } = useAsync(() => api.laundryList(), []);

  return (
    <>
      <AppHeader title="Laundry" />
      <Screen
        refreshing={loading}
        onRefresh={() => void reload()}
        footer={
          <Button
            label="Book a pickup"
            emphasis
            onPress={() => router.push("/laundry/new")}
          />
        }
      >
        {loading && !data ? (
          <Loading />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void reload()} />
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon={Shirt}
            title="No pickups yet"
            description="Count your clothes, take a photo of the bag, and pick a slot. You can track every bag from here."
            actionLabel="Book a pickup"
            onAction={() => router.push("/laundry/new")}
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
