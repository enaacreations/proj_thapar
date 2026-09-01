import { StyleSheet, View } from "react-native";
import { DEPOSIT_STATUS_LABELS } from "@proj/shared";
import { CheckCircle2, Minus, ShieldCheck } from "lucide-react-native";
import { useTheme } from "../../src/theme/ThemeProvider";
import { radius, space } from "../../src/theme/tokens";
import { api } from "../../src/api/client";
import { useAsync } from "../../src/lib/useAsync";
import { formatDate, formatDateTime, formatRupees } from "../../src/lib/format";
import { AppHeader } from "../../src/components/AppHeader";
import { Badge } from "../../src/components/Badge";
import { Card } from "../../src/components/Card";
import { KeyValue } from "../../src/components/Controls";
import { EmptyState } from "../../src/components/EmptyState";
import { Screen } from "../../src/components/Screen";
import { ErrorState, Loading } from "../../src/components/States";
import { Text } from "../../src/components/Text";

export default function DepositScreen() {
  const { c } = useTheme();
  const { data, loading, error, reload } = useAsync(() => api.deposit(), []);

  const stage =
    data?.status === "refunded"
      ? 2
      : data?.status === "refund_initiated"
        ? 1
        : 0;

  return (
    <>
      <AppHeader title="Security deposit" />
      <Screen refreshing={loading} onRefresh={() => void reload()}>
        {loading && !data ? (
          <Loading />
        ) : error || !data ? (
          <ErrorState
            message={error ?? "Couldn't load your deposit."}
            onRetry={() => void reload()}
          />
        ) : data.status === "none" ? (
          <EmptyState
            icon={ShieldCheck}
            title="No deposit collected"
            description="Once the hostel office records your security deposit, it shows here with anything deducted from it."
          />
        ) : (
          <>
            <Card style={styles.card}>
              <View style={styles.head}>
                <View style={styles.flex}>
                  <Text variant="label" tone="muted">
                    Refundable to you
                  </Text>
                  <Text variant="metric">{formatRupees(data.refundable)}</Text>
                </View>
                <Badge
                  label={DEPOSIT_STATUS_LABELS[data.status]}
                  tone={
                    data.status === "refunded"
                      ? "success"
                      : data.status === "forfeited"
                        ? "danger"
                        : data.status === "refund_initiated"
                          ? "info"
                          : "neutral"
                  }
                />
              </View>
              <KeyValue label="Deposit paid" value={formatRupees(data.amount)} mono />
              {data.totalDeducted > 0 && (
                <KeyValue
                  label="Deducted"
                  value={`− ${formatRupees(data.totalDeducted)}`}
                  mono
                />
              )}
              {data.heldSince && (
                <KeyValue label="Held since" value={formatDate(data.heldSince)} />
              )}
            </Card>

            {/* Three-step tracker so "where is my money" always has an answer. */}
            <Card style={styles.card}>
              <Text variant="cardTitle">Refund progress</Text>
              {["Held during your stay", "Refund being processed", "Money sent"].map(
                (label, i) => (
                  <View key={label} style={styles.stepRow}>
                    <View
                      style={[
                        styles.stepDot,
                        {
                          backgroundColor: i <= stage ? c.success : c.mutedBg,
                          borderColor: i <= stage ? c.success : c.border,
                        },
                      ]}
                    >
                      {i <= stage && (
                        <CheckCircle2 size={12} color={c.card} strokeWidth={3} />
                      )}
                    </View>
                    <Text
                      variant="body"
                      tone={i <= stage ? "ink" : "muted"}
                      style={styles.flex}
                    >
                      {label}
                    </Text>
                  </View>
                )
              )}
              {data.refundedAt && (
                <Text variant="label" tone="muted">
                  Sent {formatDateTime(data.refundedAt)} · reference{" "}
                  {data.refundReference}
                </Text>
              )}
            </Card>

            <Text variant="section" style={styles.sectionHead}>
              Deductions
            </Text>

            {data.deductions.length === 0 ? (
              <Card>
                <Text variant="body" tone="muted">
                  Nothing has been deducted. You'll see every deduction here
                  with its reason before any refund is released.
                </Text>
              </Card>
            ) : (
              data.deductions.map((d) => (
                <Card key={d.id} style={styles.deduction}>
                  <View style={styles.head}>
                    <Minus size={16} color={c.danger} strokeWidth={2.5} />
                    <Text variant="cardTitle" style={styles.flex}>
                      {formatRupees(d.amount)}
                    </Text>
                  </View>
                  <Text variant="body">{d.reason}</Text>
                  <Text variant="caption" tone="muted">
                    Added by {d.createdBy} · {formatDateTime(d.createdAt)}
                  </Text>
                </Card>
              ))
            )}

            <Card style={styles.card}>
              <Text variant="cardTitle">How deductions work</Text>
              {data.policy.map((rule, i) => (
                <View key={rule} style={styles.ruleRow}>
                  <Text variant="mono" tone="muted">
                    {i + 1}.
                  </Text>
                  <Text variant="body" style={styles.flex}>
                    {rule}
                  </Text>
                </View>
              ))}
            </Card>
          </>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  head: { flexDirection: "row", alignItems: "center", gap: space.sm },
  flex: { flex: 1 },
  sectionHead: { marginTop: space.md },
  deduction: { gap: 6 },
  ruleRow: { flexDirection: "row", gap: space.sm },
  stepRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
