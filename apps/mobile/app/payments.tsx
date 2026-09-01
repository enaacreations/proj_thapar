import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import {
  INVOICE_STATUS_LABELS,
  MANDATE_STATUS_LABELS,
  type Invoice,
} from "@proj/shared";
import {
  AlertTriangle,
  FileText,
  Landmark,
  Receipt,
  Users,
} from "lucide-react-native";
import { useTheme } from "../src/theme/ThemeProvider";
import { radius, space, withAlpha } from "../src/theme/tokens";
import { api } from "../src/api/client";
import { useAsync } from "../src/lib/useAsync";
import { formatDate, formatRupees } from "../src/lib/format";
import { AppHeader } from "../src/components/AppHeader";
import { Badge } from "../src/components/Badge";
import { Button } from "../src/components/Button";
import { Card } from "../src/components/Card";
import { EmptyState } from "../src/components/EmptyState";
import { Screen } from "../src/components/Screen";
import { ErrorState, Loading } from "../src/components/States";
import { Text } from "../src/components/Text";

export default function PaymentsScreen() {
  const { c } = useTheme();
  const router = useRouter();
  const { data, loading, error, reload } = useAsync(
    () => api.financeOverview(),
    []
  );

  const unpaid =
    data?.invoices.filter((i) => i.status !== "paid" && i.status !== "void") ??
    [];

  return (
    <>
      <AppHeader title="Payments" />
      <Screen refreshing={loading} onRefresh={() => void reload()}>
        {loading && !data ? (
          <Loading />
        ) : error || !data ? (
          <ErrorState
            message={error ?? "Couldn't load your payments."}
            onRetry={() => void reload()}
          />
        ) : (
          <>
            <Card style={styles.card}>
              <Text variant="label" tone="muted">
                Outstanding
              </Text>
              <Text variant="metric">{formatRupees(data.outstanding)}</Text>
              {data.nextDueOn ? (
                <Text variant="body" tone="muted">
                  Next {formatRupees(data.nextDueAmount ?? 0)} due{" "}
                  {formatDate(data.nextDueOn)}
                </Text>
              ) : (
                <Text variant="body" tone="muted">
                  Nothing due right now.
                </Text>
              )}

              {data.overdueCount > 0 && (
                <View
                  style={[styles.alert, { backgroundColor: c.dangerBg }]}
                >
                  <AlertTriangle size={16} color={c.danger} strokeWidth={2} />
                  <Text variant="label" tone="danger" style={styles.flex}>
                    {data.overdueCount}{" "}
                    {data.overdueCount === 1 ? "invoice is" : "invoices are"}{" "}
                    past their due date.
                  </Text>
                </View>
              )}
            </Card>

            <View style={styles.quick}>
              <QuickTile
                icon={Landmark}
                label="Auto-debit"
                value={
                  data.mandate
                    ? MANDATE_STATUS_LABELS[data.mandate.status]
                    : "Not set up"
                }
                tint={c.info}
                onPress={() => router.push("/payments/autopay")}
              />
              <QuickTile
                icon={Users}
                label="Split bills"
                value={
                  data.splitNetBalance === 0
                    ? "All settled"
                    : data.splitNetBalance > 0
                      ? `${formatRupees(data.splitNetBalance)} owed to you`
                      : `You owe ${formatRupees(-data.splitNetBalance)}`
                }
                tint={c.pop}
                onPress={() => router.push("/payments/splits")}
              />
              <QuickTile
                icon={Receipt}
                label="Deposit"
                value={
                  data.deposit.status === "none"
                    ? "Not collected"
                    : formatRupees(data.deposit.refundable)
                }
                tint={c.success}
                onPress={() => router.push("/payments/deposit")}
              />
              <QuickTile
                icon={FileText}
                label="Documents"
                value="Invoices, receipts, HRA"
                tint={c.accent}
                onPress={() => router.push("/payments/documents")}
              />
            </View>

            {data.activePlan && (
              <Card style={styles.card}>
                <Text variant="cardTitle">Instalment plan</Text>
                <Text variant="label" tone="muted">
                  {data.activePlan.count} instalments ·{" "}
                  {formatRupees(data.activePlan.totalPayable)} total
                </Text>
                {data.activePlan.instalments.map((inst) => (
                  <View key={inst.id} style={styles.instRow}>
                    <Text variant="body" style={styles.flex}>
                      #{inst.seq} · {formatDate(inst.dueOn)}
                    </Text>
                    <Text variant="mono">{formatRupees(inst.amount)}</Text>
                    <Badge
                      label={inst.status === "paid" ? "Paid" : inst.status === "overdue" ? "Overdue" : "Due"}
                      tone={
                        inst.status === "paid"
                          ? "success"
                          : inst.status === "overdue"
                            ? "danger"
                            : "neutral"
                      }
                    />
                  </View>
                ))}
              </Card>
            )}

            <Text variant="section" style={styles.sectionHead}>
              {unpaid.length > 0 ? "To pay" : "Invoices"}
            </Text>

            {data.invoices.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title="No invoices yet"
                description="Your monthly rent invoice appears here once your agreement is signed."
              />
            ) : (
              data.invoices.map((invoice) => (
                <InvoiceCard
                  key={invoice.id}
                  invoice={invoice}
                  onPress={() => router.push(`/payments/invoice/${invoice.id}`)}
                />
              ))
            )}
          </>
        )}
      </Screen>
    </>
  );
}

function InvoiceCard({
  invoice,
  onPress,
}: {
  invoice: Invoice;
  onPress: () => void;
}) {
  const outstanding = invoice.total - invoice.amountPaid;

  return (
    <Card accessibilityLabel={`Invoice ${invoice.number}`} onPress={onPress}>
      <View style={styles.invoiceHead}>
        <View style={styles.flex}>
          <Text variant="cardTitle">
            {invoice.periodFrom.slice(0, 7)} rent
          </Text>
          <Text variant="mono" tone="muted">
            {invoice.number}
          </Text>
        </View>
        <Badge
          label={INVOICE_STATUS_LABELS[invoice.status]}
          tone={
            invoice.status === "paid"
              ? "success"
              : invoice.status === "overdue"
                ? "danger"
                : invoice.status === "void"
                  ? "neutral"
                  : "warning"
          }
        />
      </View>

      <View style={styles.invoiceFoot}>
        <Text variant="metric" style={styles.amount}>
          {formatRupees(outstanding > 0 ? outstanding : invoice.total)}
        </Text>
        <Text variant="label" tone="muted">
          {invoice.status === "paid"
            ? "Paid in full"
            : `Due ${formatDate(invoice.dueOn)}`}
        </Text>
      </View>
    </Card>
  );
}

function QuickTile({
  icon: Icon,
  label,
  value,
  tint,
  onPress,
}: {
  icon: typeof Receipt;
  label: string;
  value: string;
  tint: string;
  onPress: () => void;
}) {
  return (
    <Card style={styles.tile} accessibilityLabel={label} onPress={onPress}>
      <View
        style={[styles.tileIcon, { backgroundColor: withAlpha(tint, 0.12) }]}
      >
        <Icon size={20} color={tint} strokeWidth={2} />
      </View>
      <Text variant="cardTitle">{label}</Text>
      <Text variant="label" tone="muted" numberOfLines={2}>
        {value}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.sm },
  flex: { flex: 1 },
  alert: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    borderRadius: radius.lg,
    padding: 12,
    marginTop: space.sm,
  },
  quick: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  tile: { width: "48%", flexGrow: 1, gap: 4, minHeight: 124 },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.xs,
  },
  sectionHead: { marginTop: space.md },
  invoiceHead: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  invoiceFoot: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: space.md,
    marginTop: space.sm,
  },
  amount: { fontSize: 24, lineHeight: 30 },
  instRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
});
