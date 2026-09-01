import { useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ClipboardList } from "lucide-react-native";
import { useRouter } from "expo-router";
import type { ServiceRequestKind } from "@proj/shared";
import { space } from "../../src/theme/tokens";
import { api } from "../../src/api/client";
import { useAsync } from "../../src/lib/useAsync";
import { Segmented } from "../../src/components/Controls";
import { EmptyState } from "../../src/components/EmptyState";
import { RequestCard } from "../../src/components/RequestCard";
import { Screen } from "../../src/components/Screen";
import { ErrorState, Loading } from "../../src/components/States";
import { Text } from "../../src/components/Text";

type Filter = "all" | ServiceRequestKind;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "maintenance", label: "Repairs" },
  { value: "laundry", label: "Laundry" },
  { value: "complaint", label: "Issues" },
  { value: "visit", label: "Visits" },
];

export default function RequestsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");

  const { data, loading, error, reload } = useAsync(() => api.requests(), []);
  const visible =
    filter === "all" ? data : (data?.filter((r) => r.kind === filter) ?? null);

  return (
    <Screen
      contentStyle={{ paddingTop: insets.top + space.md }}
      refreshing={loading}
      onRefresh={() => void reload()}
    >
      <View style={{ gap: space.md }}>
        <Text variant="title">All requests</Text>
        <Segmented options={FILTERS} value={filter} onChange={setFilter} />
      </View>

      {loading && !data ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void reload()} />
      ) : !visible || visible.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nothing here yet"
          description="Anything you raise — a repair, a laundry pickup, a complaint or a visit — shows up here with its status."
          actionLabel="Go to Home"
          onAction={() => router.replace("/(tabs)")}
        />
      ) : (
        visible.map((request) => (
          <RequestCard key={request.id} request={request} />
        ))
      )}
    </Screen>
  );
}
