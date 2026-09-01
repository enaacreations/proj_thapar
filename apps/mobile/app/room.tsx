import { StyleSheet, View } from "react-native";
import { Building2, MapPin } from "lucide-react-native";
import { useTheme } from "../src/theme/ThemeProvider";
import { radius, space, withAlpha } from "../src/theme/tokens";
import { api } from "../src/api/client";
import { useAsync } from "../src/lib/useAsync";
import { AppHeader } from "../src/components/AppHeader";
import { Card } from "../src/components/Card";
import { KeyValue } from "../src/components/Controls";
import { Screen } from "../src/components/Screen";
import { ErrorState, Loading } from "../src/components/States";
import { Text } from "../src/components/Text";

export default function RoomScreen() {
  const { c } = useTheme();
  const { data, loading, error, reload } = useAsync(() => api.room(), []);

  return (
    <>
      <AppHeader title="My room" />
      <Screen refreshing={loading} onRefresh={() => void reload()}>
        {loading && !data ? (
          <Loading />
        ) : error || !data ? (
          <ErrorState
            message={error ?? "Couldn't load your room details."}
            onRetry={() => void reload()}
          />
        ) : (
          <>
            {/* Room number is the one thing residents look up most, so it leads. */}
            <Card>
              <View style={styles.hero}>
                <View
                  style={[
                    styles.chip,
                    { backgroundColor: withAlpha(c.accent, 0.12) },
                  ]}
                >
                  <Building2 size={24} color={c.accentStrong} strokeWidth={2} />
                </View>
                <View style={styles.heroText}>
                  <Text variant="label" tone="muted">
                    Allocated room
                  </Text>
                  <Text variant="metric">{data.roomNumber}</Text>
                  <Text variant="body" tone="muted">
                    {data.floor} · {data.wing}
                  </Text>
                </View>
              </View>
            </Card>

            <Card style={styles.card}>
              <Text variant="cardTitle">Room</Text>
              <KeyValue label="Room type" value={data.roomType} />
              <KeyValue label="Occupancy" value={data.occupancy} />
              <KeyValue label="Building" value={data.buildingName} />
            </Card>

            <Card style={styles.card}>
              <Text variant="cardTitle">Property</Text>
              <KeyValue label="Name" value={data.propertyName} />
              <View style={styles.address}>
                <MapPin size={16} color={c.muted} strokeWidth={2} />
                <Text variant="body" tone="muted" style={styles.flex}>
                  {data.propertyAddress}
                </Text>
              </View>
            </Card>
          </>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: "row", alignItems: "center", gap: space.md },
  chip: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  heroText: { flex: 1, gap: 2 },
  card: { gap: space.md },
  address: { flexDirection: "row", gap: space.sm, alignItems: "flex-start" },
  flex: { flex: 1 },
});
