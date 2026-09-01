import { useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { MANDATE_STATUS_LABELS } from "@proj/shared";
import { Info, Landmark } from "lucide-react-native";
import { useTheme } from "../../src/theme/ThemeProvider";
import { space } from "../../src/theme/tokens";
import { API_BASE_URL, api } from "../../src/api/client";
import { messageOf, useAsync } from "../../src/lib/useAsync";
import { formatRupees } from "../../src/lib/format";
import { AppHeader } from "../../src/components/AppHeader";
import { Badge } from "../../src/components/Badge";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { KeyValue, Stepper } from "../../src/components/Controls";
import { EmptyState } from "../../src/components/EmptyState";
import { Input } from "../../src/components/Input";
import { Screen } from "../../src/components/Screen";
import { ErrorState, Loading } from "../../src/components/States";
import { Text } from "../../src/components/Text";
import { useToast } from "../../src/components/Toast";

export default function AutopayScreen() {
  const { c } = useTheme();
  const toast = useToast();
  const { data, loading, error, reload, setData } = useAsync(
    () => api.mandate(),
    []
  );

  const [limit, setLimit] = useState("25000");
  const [day, setDay] = useState(5);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    try {
      const mandate = await api.createMandate({
        maxAmount: Number(limit),
        dayOfMonth: day,
      });
      setData(mandate);
      if (mandate.approvalUrl) {
        await Linking.openURL(`${API_BASE_URL}${mandate.approvalUrl}`);
        toast.show("Approve it in your browser, then pull down to refresh.");
      }
    } catch (err) {
      toast.error(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (resume: boolean) => {
    try {
      setData(await api.setMandatePaused(resume));
    } catch (err) {
      toast.error(messageOf(err));
    }
  };

  const cancel = async () => {
    try {
      await api.cancelMandate();
      await reload();
      toast.show("Auto-debit cancelled");
    } catch (err) {
      toast.error(messageOf(err));
    }
  };

  return (
    <>
      <AppHeader title="Auto-debit" />
      <Screen refreshing={loading} onRefresh={() => void reload()}>
        {loading && !data && !error ? (
          <Loading />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void reload()} />
        ) : !data ? (
          <>
            <EmptyState
              icon={Landmark}
              title="Pay rent automatically"
              description="Set a monthly limit and a date, and rent is collected without you doing anything."
            />

            <Card style={styles.card}>
              <Input
                label="Maximum per debit (₹)"
                value={limit}
                onChangeText={(v) => setLimit(v.replace(/\D/g, ""))}
                keyboardType="number-pad"
                hint="Your bank refuses anything above this."
              />
              <View style={styles.dayRow}>
                <Text variant="body" style={styles.flex}>
                  Collect on day
                </Text>
                <Stepper
                  label="day of month"
                  value={day}
                  onChange={setDay}
                  min={1}
                  max={28}
                />
              </View>
              <Text variant="caption" tone="muted">
                Capped at 28 so every month has that date.
              </Text>
              <Button
                label="Set up auto-debit"
                emphasis
                loading={busy}
                disabled={Number(limit) <= 0}
                onPress={() => void create()}
              />
            </Card>
          </>
        ) : (
          <>
            <Card style={styles.card}>
              <View style={styles.head}>
                <Text variant="cardTitle" style={styles.flex}>
                  Auto-debit
                </Text>
                <Badge
                  label={MANDATE_STATUS_LABELS[data.status]}
                  tone={
                    data.status === "active"
                      ? "success"
                      : data.status === "pending"
                        ? "warning"
                        : "neutral"
                  }
                />
              </View>
              <KeyValue
                label="Limit per debit"
                value={formatRupees(data.maxAmount)}
                mono
              />
              <KeyValue label="Collected on" value={`Day ${data.dayOfMonth}`} />
            </Card>

            {data.status === "pending" && data.approvalUrl && (
              <Button
                label="Approve with your bank"
                emphasis
                onPress={() =>
                  void Linking.openURL(`${API_BASE_URL}${data.approvalUrl}`)
                }
              />
            )}

            {data.status === "active" && (
              <Button
                label="Pause auto-debit"
                variant="secondary"
                onPress={() => void toggle(false)}
              />
            )}
            {data.status === "paused" && (
              <Button
                label="Resume auto-debit"
                variant="secondary"
                onPress={() => void toggle(true)}
              />
            )}

            <Button label="Cancel auto-debit" variant="outline" onPress={() => void cancel()} />

            <Card style={styles.card}>
              <View style={styles.noteRow}>
                <Info size={16} color={c.muted} strokeWidth={2} />
                <Text variant="label" tone="muted" style={styles.flex}>
                  This is a test gateway. No real mandate is registered with any
                  bank and nothing is debited.
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
  card: { gap: space.md },
  head: { flexDirection: "row", alignItems: "center", gap: space.sm },
  flex: { flex: 1 },
  dayRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  noteRow: { flexDirection: "row", gap: space.sm, alignItems: "flex-start" },
});
