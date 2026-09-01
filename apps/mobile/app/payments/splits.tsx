import { useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import {
  SPLIT_CATEGORY_LABELS,
  type SplitBill,
  type SplitCategory,
} from "@proj/shared";
import { Check, Plus, Trash2, Users } from "lucide-react-native";
import { useTheme } from "../../src/theme/ThemeProvider";
import { radius, space } from "../../src/theme/tokens";
import { API_BASE_URL, api } from "../../src/api/client";
import { messageOf, useAsync } from "../../src/lib/useAsync";
import { formatRupees, relativeTime } from "../../src/lib/format";
import { AppHeader } from "../../src/components/AppHeader";
import { Badge } from "../../src/components/Badge";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { Segmented } from "../../src/components/Controls";
import { EmptyState } from "../../src/components/EmptyState";
import { Field, Input } from "../../src/components/Input";
import { Screen } from "../../src/components/Screen";
import { Sheet } from "../../src/components/Sheet";
import { ErrorState, Loading } from "../../src/components/States";
import { Text } from "../../src/components/Text";
import { useToast } from "../../src/components/Toast";

const CATEGORIES = Object.keys(SPLIT_CATEGORY_LABELS) as SplitCategory[];

export default function SplitsScreen() {
  const { c } = useTheme();
  const toast = useToast();

  const splits = useAsync(() => api.splits(), []);
  const candidates = useAsync(() => api.splitCandidates(), []);

  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<SplitCategory>("utilities");
  const [amount, setAmount] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    setFormError(null);
    try {
      await api.createSplit({
        title: title.trim(),
        category,
        totalAmount: Number(amount),
        participantIds: picked,
      });
      setAdding(false);
      setTitle("");
      setAmount("");
      setPicked([]);
      await splits.reload();
      toast.success("Bill split");
    } catch (err) {
      setFormError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  const payShare = async (bill: SplitBill) => {
    const share = bill.shares.find((s) => s.isMe && s.status === "pending");
    if (!share) return;

    try {
      const order = await api.startPayment({
        splitShareId: share.id,
        amount: share.amount,
        method: "upi",
        idempotencyKey: `share-${share.id}`,
      });
      if (order.authorisationUrl) {
        await Linking.openURL(`${API_BASE_URL}${order.authorisationUrl}`);
        toast.show("Finish in your browser, then pull down to refresh.");
      }
    } catch (err) {
      toast.error(messageOf(err));
    }
  };

  const remove = async (id: string) => {
    try {
      await api.deleteSplit(id);
      await splits.reload();
    } catch (err) {
      toast.error(messageOf(err));
    }
  };

  // Each share must be at least a rupee for the split to make sense.
  const canSubmit =
    title.trim().length >= 2 &&
    Number(amount) >= picked.length + 1 &&
    picked.length > 0;

  return (
    <>
      <AppHeader title="Split bills" />
      <Screen
        refreshing={splits.loading}
        onRefresh={() => void splits.reload()}
        footer={
          <Button
            label="Split a bill"
            emphasis
            icon={<Plus size={20} color={c.onAccent} strokeWidth={2} />}
            onPress={() => setAdding(true)}
          />
        }
      >
        {splits.loading && !splits.data ? (
          <Loading />
        ) : splits.error || !splits.data ? (
          <ErrorState
            message={splits.error ?? "Couldn't load your bills."}
            onRetry={() => void splits.reload()}
          />
        ) : (
          <>
            <Card style={styles.card}>
              <Text variant="label" tone="muted">
                {splits.data.netBalance >= 0 ? "Owed to you" : "You owe"}
              </Text>
              <Text
                variant="metric"
                tone={splits.data.netBalance >= 0 ? "success" : "danger"}
              >
                {formatRupees(Math.abs(splits.data.netBalance))}
              </Text>
              <Text variant="label" tone="muted">
                {formatRupees(splits.data.owedToYou)} coming in ·{" "}
                {formatRupees(splits.data.youOwe)} going out
              </Text>
            </Card>

            {splits.data.bills.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Nothing split yet"
                description="Share the cost of utilities, groceries or a party with your roommates, and track who's paid."
              />
            ) : (
              splits.data.bills.map((bill) => {
                const myShare = bill.shares.find((s) => s.isMe);
                const iOwe = myShare?.status === "pending";

                return (
                  <Card key={bill.id} style={styles.card}>
                    <View style={styles.head}>
                      <View style={styles.flex}>
                        <Text variant="cardTitle">{bill.title}</Text>
                        <Text variant="label" tone="muted">
                          {SPLIT_CATEGORY_LABELS[bill.category]} ·{" "}
                          {formatRupees(bill.totalAmount)} ·{" "}
                          {relativeTime(bill.createdAt)}
                        </Text>
                      </View>
                      {bill.settledAt ? (
                        <Badge label="Settled" tone="success" icon={Check} />
                      ) : (
                        <Badge label="Open" tone="warning" />
                      )}
                    </View>

                    {bill.shares.map((share) => (
                      <View key={share.id} style={styles.shareRow}>
                        <Text variant="body" style={styles.flex}>
                          {share.isMe ? "You" : share.residentName}
                        </Text>
                        <Text variant="mono">{formatRupees(share.amount)}</Text>
                        <Badge
                          label={share.status === "settled" ? "Paid" : "Pending"}
                          tone={share.status === "settled" ? "success" : "neutral"}
                        />
                      </View>
                    ))}

                    {iOwe && (
                      <Button
                        label={`Pay your ${formatRupees(myShare?.amount ?? 0)}`}
                        variant="secondary"
                        onPress={() => void payShare(bill)}
                      />
                    )}

                    {bill.isOwner && !bill.settledAt && (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Delete ${bill.title}`}
                        onPress={() => void remove(bill.id)}
                        style={styles.deleteRow}
                        hitSlop={8}
                      >
                        <Trash2 size={16} color={c.danger} strokeWidth={2} />
                        <Text variant="label" tone="danger">
                          Delete this bill
                        </Text>
                      </Pressable>
                    )}
                  </Card>
                );
              })
            )}
          </>
        )}
      </Screen>

      <Sheet
        visible={adding}
        onClose={() => setAdding(false)}
        title="Split a bill"
        subtitle="You've paid it — pick who owes you a share."
      >
        <Input
          label="What was it for?"
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Electricity bill"
        />
        <Field label="Category">
          <Segmented<SplitCategory>
            value={category}
            onChange={setCategory}
            options={CATEGORIES.slice(0, 3).map((v) => ({
              value: v,
              label: SPLIT_CATEGORY_LABELS[v],
            }))}
          />
        </Field>
        <Input
          label="Total amount (₹)"
          value={amount}
          onChangeText={(v) => setAmount(v.replace(/\D/g, ""))}
          placeholder="0"
          keyboardType="number-pad"
        />

        <Field
          label="Split with"
          hint="Roommates are listed first."
        >
          <View style={styles.chips}>
            {(candidates.data ?? []).map((person) => {
              const on = picked.includes(person.residentId);
              return (
                <Pressable
                  key={person.residentId}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  onPress={() =>
                    setPicked((prev) =>
                      on
                        ? prev.filter((p) => p !== person.residentId)
                        : [...prev, person.residentId]
                    )
                  }
                  style={[
                    styles.chip,
                    {
                      borderColor: on ? c.accent : c.border,
                      backgroundColor: on ? c.accent : c.card,
                    },
                  ]}
                >
                  {on && <Check size={14} color={c.onAccent} strokeWidth={2.5} />}
                  <Text variant="label" tone={on ? "onAccent" : "ink"}>
                    {person.fullName}
                    {person.sameRoom ? " · roommate" : ""}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Field>

        {picked.length > 0 && Number(amount) > 0 && (
          <Text variant="label" tone="muted">
            {formatRupees(Math.floor(Number(amount) / (picked.length + 1)))} each,
            across {picked.length + 1} people.
          </Text>
        )}

        {formError && (
          <Text variant="label" tone="danger">
            {formError}
          </Text>
        )}

        <Button
          label="Split it"
          emphasis
          loading={busy}
          disabled={!canSubmit}
          onPress={() => void create()}
        />
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  head: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  flex: { flex: 1 },
  shareRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  deleteRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    minHeight: 38,
  },
});
