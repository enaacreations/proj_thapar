import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import {
  CLOTHING_LABELS,
  type ClothingType,
  type LaundryItem,
} from "@proj/shared";
import { useTheme } from "../../src/theme/ThemeProvider";
import { space } from "../../src/theme/tokens";
import { api } from "../../src/api/client";
import { messageOf, useAsync } from "../../src/lib/useAsync";
import { AppHeader } from "../../src/components/AppHeader";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { SelectRow } from "../../src/components/CategoryPicker";
import { Stepper, Toggle } from "../../src/components/Controls";
import { Field } from "../../src/components/Input";
import { PhotoStrip } from "../../src/components/PhotoStrip";
import { Screen } from "../../src/components/Screen";
import { Sheet, SheetOption } from "../../src/components/Sheet";
import { Text } from "../../src/components/Text";
import { useToast } from "../../src/components/Toast";

const TYPES = Object.keys(CLOTHING_LABELS) as ClothingType[];

export default function NewLaundry() {
  const { c } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const slots = useAsync(() => api.laundrySlots(), []);

  const [counts, setCounts] = useState<Record<ClothingType, number>>(
    () => Object.fromEntries(TYPES.map((t) => [t, 0])) as Record<ClothingType, number>
  );
  const [pressing, setPressing] = useState<Record<ClothingType, boolean>>(
    () => Object.fromEntries(TYPES.map((t) => [t, false])) as Record<ClothingType, boolean>
  );
  const [slot, setSlot] = useState<string | null>(null);
  const [slotOpen, setSlotOpen] = useState(false);
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const items: LaundryItem[] = TYPES.filter((t) => counts[t] > 0).map((t) => ({
    type: t,
    count: counts[t],
    pressing: pressing[t],
  }));
  const totalPieces = items.reduce((sum, i) => sum + i.count, 0);

  const submit = async () => {
    if (totalPieces === 0) {
      setError("Add at least one item to the bag.");
      return;
    }
    if (!slot) {
      setError("Choose a pickup slot.");
      return;
    }
    if (photoUris.length === 0) {
      setError(
        "Take a photo of the clothes first. It's your proof if anything goes missing."
      );
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const created = await api.createLaundry({
        items,
        pickupSlot: slot,
        photoUris,
      });
      toast.success(`Pickup ${created.id} booked`);
      router.replace(`/laundry/${created.id}`);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <AppHeader title="Book a pickup" />
      <Screen
        footer={
          <>
            {error && (
              <Text variant="label" tone="danger">
                {error}
              </Text>
            )}
            <Button
              label={
                totalPieces > 0
                  ? `Book pickup · ${totalPieces} ${totalPieces === 1 ? "piece" : "pieces"}`
                  : "Book pickup"
              }
              emphasis
              loading={submitting}
              onPress={() => void submit()}
            />
          </>
        }
      >
        <Card style={styles.card}>
          <Text variant="cardTitle">What are you sending?</Text>
          <Text variant="label" tone="muted">
            Count each type, and mark the ones that need pressing.
          </Text>

          {TYPES.map((type) => (
            <View key={type} style={styles.itemRow}>
              <View style={styles.itemHead}>
                <Text variant="body" style={styles.flex}>
                  {CLOTHING_LABELS[type]}
                </Text>
                <Stepper
                  label={CLOTHING_LABELS[type]}
                  value={counts[type]}
                  onChange={(next) => {
                    setCounts({ ...counts, [type]: next });
                    setError(null);
                  }}
                />
              </View>
              {counts[type] > 0 && (
                <Toggle
                  checked={pressing[type]}
                  onChange={(next) => setPressing({ ...pressing, [type]: next })}
                  label="Needs pressing"
                />
              )}
            </View>
          ))}
        </Card>

        <Card style={styles.card}>
          <Field label="Pickup slot">
            <SelectRow
              value={slot}
              placeholder="Choose a slot"
              onPress={() => setSlotOpen(true)}
            />
          </Field>
        </Card>

        <Card style={styles.card}>
          <PhotoStrip
            uris={photoUris}
            onChange={(next) => {
              setPhotoUris(next);
              setError(null);
            }}
            label="Photo of the clothes"
            hint="Required. Lay the clothes out and take one clear photo."
            cameraOnly
          />
        </Card>

        {totalPieces > 0 && (
          <Card style={[styles.card, { borderColor: c.accent }]}>
            <Text variant="cardTitle">Summary</Text>
            {items.map((item) => (
              <View key={item.type} style={styles.summaryRow}>
                <Text variant="body" style={styles.flex}>
                  {CLOTHING_LABELS[item.type]}
                  {item.pressing ? " · pressing" : ""}
                </Text>
                <Text variant="mono">{item.count}</Text>
              </View>
            ))}
            <View style={styles.summaryRow}>
              <Text variant="cardTitle" style={styles.flex}>
                Total
              </Text>
              <Text variant="mono">{totalPieces}</Text>
            </View>
          </Card>
        )}
      </Screen>

      <Sheet
        visible={slotOpen}
        onClose={() => setSlotOpen(false)}
        title="Choose a pickup slot"
      >
        {(slots.data ?? []).map((option) => (
          <SheetOption
            key={option}
            label={option}
            selected={option === slot}
            onPress={() => {
              setSlot(option);
              setSlotOpen(false);
              setError(null);
            }}
          />
        ))}
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  itemRow: { gap: space.xs },
  itemHead: { flexDirection: "row", alignItems: "center", gap: space.md },
  flex: { flex: 1 },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: space.md },
});
