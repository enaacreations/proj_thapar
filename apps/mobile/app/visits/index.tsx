import { useRouter } from "expo-router";
import { CalendarHeart } from "lucide-react-native";
import { api } from "../../src/api/client";
import { useAsync } from "../../src/lib/useAsync";
import { AppHeader } from "../../src/components/AppHeader";
import { Button } from "../../src/components/Button";
import { EmptyState } from "../../src/components/EmptyState";
import { RequestCard } from "../../src/components/RequestCard";
import { Screen } from "../../src/components/Screen";
import { ErrorState, Loading } from "../../src/components/States";

export default function VisitsList() {
  const router = useRouter();
  const { data, loading, error, reload } = useAsync(() => api.visitList(), []);

  return (
    <>
      <AppHeader title="Visitors" />
      <Screen
        refreshing={loading}
        onRefresh={() => void reload()}
        footer={
          <Button
            label="Book a visit"
            emphasis
            onPress={() => router.push("/visits/new")}
          />
        }
      >
        {loading && !data ? (
          <Loading />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void reload()} />
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon={CalendarHeart}
            title="No visits booked"
            description="Let the hostel know when a parent, relative or friend is coming — and add a meal for them if you like."
            actionLabel="Book a visit"
            onAction={() => router.push("/visits/new")}
          />
        ) : (
          data.map((visit) => (
            <RequestCard key={visit.id} request={visit} showKind={false} />
          ))
        )}
      </Screen>
    </>
  );
}
