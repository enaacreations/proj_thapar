import { useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  INVOICE_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  type InstalmentQuote,
  type PaymentMethod,
} from "@proj/shared";
import { CalendarClock, CreditCard, Info, Landmark, Smartphone } from "lucide-react-native";
import { useTheme } from "../../../src/theme/ThemeProvider";
import { radius, space } from "../../../src/theme/tokens";
import { API_BASE_URL, api } from "../../../src/api/client";
import { messageOf, useAsync } from "../../../src/lib/useAsync";
import { formatDate, formatRupees } from "../../../src/lib/format";
import { AppHeader } from "../../../src/components/AppHeader";
import { Badge } from "../../../src/components/Badge";
import { Button } from "../../../src/components/Button";
import { Card } from "../../../src/components/Card";
import { KeyValue, Segmented } from "../../../src/components/Controls";
import { Screen } from "../../../src/components/Screen";
import { Sheet, SheetOption } from "../../../src/components/Sheet";
import { ErrorState, Loading } from "../../../src/components/States";
import { Text } from "../../../src/components/Text";
import { useToast } from "../../../src/components/Toast";

const METHODS: { value: PaymentMethod; icon: typeof CreditCard }[] = [
  { value: "upi", icon: Smartphone },
  { value: "card", icon: CreditCard },
  { value: "netbanking", icon: Landmark },
];

const COUNTS = [2, 3, 4, 6];

export default function InvoiceScreen() {
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  const router = useRouter();
  const toast = useToast();

  const invoice = useAsync(() => api.invoice(id), [id]);
  const mandate = useAsync(() => api.mandate(), []);

  const [paying, setPaying] = useState(false);
  const [emiOpen, setEmiOpen] = useState(false);
  const [count, setCount] = useState(3);
  const [quote, setQuote] = useState<InstalmentQuote | null>(null);
  const [busy, setBusy] = useState(false);

  const outstanding = invoice.data
    ? invoice.data.total - invoice.data.amountPaid
    : 0;

  const pay = async (method: PaymentMethod) => {
    setPaying(false);
    setBusy(true);
    try {
      const order = await api.startPayment({
        invoiceId: id,
        amount: outstanding,
        method,
        // Ties the retry of a tap to the same order rather than a new charge.
        idempotencyKey: `inv-${id}-${outstanding}-${method}`,
      });

      if (order.status === "succeeded") {
        toast.success("Paid");
        await invoice.reload();
        return;
      }

      if (order.authorisationUrl) {
        await Linking.openURL(`${API_BASE_URL}${order.authorisationUrl}`);
        toast.show("Finish in your browser, then pull down to refresh.");
      }
    } catch (err) {
      toast.error(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  const openEmi = async (n: number) => {
    setCount(n);
    try {
      setQuote(await api.instalmentQuote(id, n));
    } catch (err) {
      toast.error(messageOf(err));
    }
  };

  const createPlan = async () => {
    setBusy(true);
    try {
      await api.createInstalmentPlan(id, count);
      setEmiOpen(false);
      toast.success("Instalment plan created");
      router.replace("/payments");
    } catch (err) {
      toast.error(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  const payable =
    invoice.data?.status !== "paid" && invoice.data?.status !== "void";

  return (
    <>
      <AppHeader title="Invoice" subtitle={invoice.data?.number} />
      <Screen
        refreshing={invoice.loading}
        onRefresh={() => void invoice.reload()}
        footer={
          payable ? (
            <>
              <Button
                label={`Pay ${formatRupees(outstanding)}`}
                emphasis
                loading={busy}
                onPress={() => setPaying(true)}
              />
              <Button
                label="Split into instalments"
                variant="outline"
                icon={<CalendarClock size={20} color={c.ink} strokeWidth={2} />}
                onPress={() => {
                  setEmiOpen(true);
                  void openEmi(3);
                }}
              />
            </>
          ) : undefined
        }
      >
        {invoice.loading && !invoice.data ? (
          <Loading />
        ) : invoice.error || !invoice.data ? (
          <ErrorState
            message={invoice.error ?? "Couldn't load this invoice."}
            onRetry={() => void invoice.reload()}
          />
        ) : (
          <>
            <Card style={styles.card}>
              <View style={styles.head}>
                <Text variant="metric" style={styles.flex}>
                  {formatRupees(outstanding > 0 ? outstanding : invoice.data.total)}
                </Text>
                <Badge
                  label={INVOICE_STATUS_LABELS[invoice.data.status]}
                  tone={
                    invoice.data.status === "paid"
                      ? "success"
                      : invoice.data.status === "overdue"
                        ? "danger"
                        : "warning"
                  }
                />
              </View>
              <KeyValue
                label="Billing period"
                value={`${formatDate(invoice.data.periodFrom)} – ${formatDate(invoice.data.periodTo)}`}
              />
              <KeyValue label="Due on" value={formatDate(invoice.data.dueOn)} />
              {invoice.data.amountPaid > 0 && (
                <KeyValue
                  label="Already paid"
                  value={formatRupees(invoice.data.amountPaid)}
                  mono
                />
              )}
            </Card>

            <Card style={styles.card}>
              <Text variant="cardTitle">Charges</Text>
              {invoice.data.lines.map((line) => (
                <View key={line.description} style={styles.lineRow}>
                  <Text variant="body" style={styles.flex}>
                    {line.description}
                  </Text>
                  <Text variant="mono">{formatRupees(line.amount)}</Text>
                </View>
              ))}
              <View style={[styles.lineRow, styles.totalRow, { borderTopColor: c.border }]}>
                <Text variant="cardTitle" style={styles.flex}>
                  Total
                </Text>
                <Text variant="mono">{formatRupees(invoice.data.total)}</Text>
              </View>
            </Card>

            <Card style={styles.card}>
              <View style={styles.noteRow}>
                <Info size={16} color={c.muted} strokeWidth={2} />
                <Text variant="label" tone="muted" style={styles.flex}>
                  Payments run through a test gateway. No money leaves your
                  account.
                </Text>
              </View>
            </Card>
          </>
        )}
      </Screen>

      <Sheet
        visible={paying}
        onClose={() => setPaying(false)}
        title={`Pay ${formatRupees(outstanding)}`}
        subtitle="Choose how you'd like to pay."
      >
        {METHODS.map((m) => (
          <SheetOption
            key={m.value}
            label={PAYMENT_METHOD_LABELS[m.value]}
            onPress={() => void pay(m.value)}
          />
        ))}
        {mandate.data?.status === "active" && (
          <SheetOption
            label="Auto-debit"
            description={`Up to ${formatRupees(mandate.data.maxAmount)} per debit`}
            onPress={() => void pay("mandate")}
          />
        )}
      </Sheet>

      <Sheet
        visible={emiOpen}
        onClose={() => setEmiOpen(false)}
        title="Split into instalments"
        subtitle="Pay over a few months instead of all at once."
      >
        <Segmented<string>
          value={String(count)}
          onChange={(v) => void openEmi(Number(v))}
          options={COUNTS.map((n) => ({ value: String(n), label: `${n}×` }))}
        />

        {quote && (
          <Card style={styles.card}>
            <Text variant="metric" style={styles.emiAmount}>
              {formatRupees(quote.perInstalment)}
            </Text>
            <Text variant="body" tone="muted">
              per month for {quote.count} months
            </Text>
            <KeyValue
              label={`Convenience fee (${quote.feePercent}%)`}
              value={formatRupees(quote.feeAmount)}
              mono
            />
            <KeyValue
              label="Total you'll pay"
              value={formatRupees(quote.totalPayable)}
              mono
            />
          </Card>
        )}

        <Button
          label="Create plan"
          emphasis
          loading={busy}
          onPress={() => void createPlan()}
        />
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  head: { flexDirection: "row", alignItems: "center", gap: space.sm },
  flex: { flex: 1 },
  lineRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  totalRow: { borderTopWidth: 1, paddingTop: space.sm },
  noteRow: { flexDirection: "row", gap: space.sm, alignItems: "flex-start" },
  emiAmount: { fontSize: 26, lineHeight: 32 },
});
