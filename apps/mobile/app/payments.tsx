import { StyleSheet, View } from "react-native";
import { Receipt } from "lucide-react-native";
import type { PaymentMode } from "@proj/shared";
import { useTheme } from "../src/theme/ThemeProvider";
import { space } from "../src/theme/tokens";
import { api } from "../src/api/client";
import { useAsync } from "../src/lib/useAsync";
import { formatDate, formatRupees } from "../src/lib/format";
import { AppHeader } from "../src/components/AppHeader";
import { Badge } from "../src/components/Badge";
import { Card } from "../src/components/Card";
import { KeyValue } from "../src/components/Controls";
import { EmptyState } from "../src/components/EmptyState";
import { Screen } from "../src/components/Screen";
import { ErrorState, Loading } from "../src/components/States";
import { Text } from "../src/components/Text";

const MODE_LABELS: Record<PaymentMode, string> = {
  cash: "Cash",
  upi: "UPI",
  card: "Card",
  netbanking: "Net banking",
};

export default function PaymentsScreen() {
  const { c } = useTheme();
  const { data, loading, error, reload } = useAsync(() => api.payments(), []);

  const dueSoon =
    data?.nextDueOn != null &&
    // Within 30 days counts as "coming up" and gets a warning tone.
    new Date(data.nextDueOn).getTime() - Date.now() < 30 * 86_400_000;

  return (
    <>
      <AppHeader title="Payments" />
      <Screen refreshing={loading} onRefresh={() => void reload()}>
        {loading && !data ? (
          <Loading />
        ) : error || !data ? (
          <ErrorState
            message={error ?? "Couldn't load your payment details."}
            onRetry={() => void reload()}
          />
        ) : (
          <>
            <Card>
              <Text variant="label" tone="muted">
                Paid so far
              </Text>
              <Text variant="metric">{formatRupees(data.totalPaid)}</Text>
              <View style={styles.badgeRow}>
                <Badge label={`${data.plan} plan`} tone="accent" />
                <Badge
                  label={`Covered to ${formatDate(data.paidUpTo)}`}
                  tone="success"
                />
              </View>
            </Card>

            {data.nextDueOn && data.nextDueAmount != null && (
              <Card style={styles.card}>
                <Text variant="cardTitle">Next payment</Text>
                <KeyValue
                  label="Amount"
                  value={formatRupees(data.nextDueAmount)}
                  mono
                />
                <KeyValue label="Due on" value={formatDate(data.nextDueOn)} />
                <Badge
                  label={dueSoon ? "Coming up" : "Not due yet"}
                  tone={dueSoon ? "warning" : "neutral"}
                />
                <Text variant="label" tone="muted">
                  Pay at the hostel office. Receipts appear here within a day.
                </Text>
              </Card>
            )}

            <Text variant="section" style={styles.sectionHead}>
              Payment history
            </Text>

            {data.entries.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title="No payments yet"
                description="Once the office records your first payment, the receipt shows up here."
              />
            ) : (
              data.entries.map((entry) => (
                <Card key={entry.id} style={styles.card}>
                  <View style={styles.entryHead}>
                    <Text variant="cardTitle">{formatRupees(entry.amount)}</Text>
                    <Badge label={MODE_LABELS[entry.mode]} tone="neutral" />
                  </View>
                  <KeyValue label="Paid on" value={formatDate(entry.paidOn)} />
                  <KeyValue
                    label="Covers"
                    value={`${formatDate(entry.periodFrom)} – ${formatDate(entry.periodTo)}`}
                  />
                  <View style={styles.receiptRow}>
                    <Receipt size={14} color={c.muted} strokeWidth={2} />
                    <Text variant="mono" tone="muted">
                      {entry.receiptNo}
                    </Text>
                  </View>
                </Card>
              ))
            )}
          </>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  badgeRow: {
    flexDirection: "row",
    gap: space.sm,
    marginTop: space.sm,
    flexWrap: "wrap",
  },
  sectionHead: { marginTop: space.md },
  entryHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
  },
  receiptRow: { flexDirection: "row", alignItems: "center", gap: 6 },
});
