import { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { CheckCircle2, Circle, Lock, Plus, Trash2 } from "lucide-react-native";
import {
  CONDITION_LABELS,
  type InventoryCondition,
  type MoveInState,
} from "@proj/shared";
import { useTheme } from "../../src/theme/ThemeProvider";
import { radius, space } from "../../src/theme/tokens";
import { api } from "../../src/api/client";
import { messageOf, useAsync } from "../../src/lib/useAsync";
import { formatDateTime } from "../../src/lib/format";
import { AppHeader } from "../../src/components/AppHeader";
import { Badge } from "../../src/components/Badge";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { Segmented } from "../../src/components/Controls";
import { Field, Input } from "../../src/components/Input";
import { PhotoStrip } from "../../src/components/PhotoStrip";
import { Screen } from "../../src/components/Screen";
import { Sheet } from "../../src/components/Sheet";
import { ErrorState, Loading } from "../../src/components/States";
import { Text } from "../../src/components/Text";
import { useToast } from "../../src/components/Toast";

const CONDITIONS: InventoryCondition[] = ["good", "fair", "damaged", "missing"];

export default function MoveInScreen() {
  const { c } = useTheme();
  const toast = useToast();

  const { data, loading, error, reload, setData } = useAsync(
    () => api.moveIn(),
    []
  );
  const template = useAsync(() => api.inventoryTemplate(), []);

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [condition, setCondition] = useState<InventoryCondition>("good");
  const [notes, setNotes] = useState("");
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const locked = data?.inventorySubmittedAt != null;

  const toggleTask = async (key: string, done: boolean) => {
    try {
      setData(await api.setMoveInTask(key, done));
    } catch (err) {
      toast.show(messageOf(err), "warning");
    }
  };

  const addItem = async () => {
    setBusy(true);
    setFormError(null);
    try {
      setData(
        await api.addInventoryItem({ name, condition, notes, photoUris })
      );
      setAdding(false);
      setName("");
      setCondition("good");
      setNotes("");
      setPhotoUris([]);
    } catch (err) {
      setFormError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  const submitInventory = async () => {
    setBusy(true);
    try {
      setData(await api.submitInventory());
      toast.success("Room condition recorded");
    } catch (err) {
      toast.error(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  const remaining = (state: MoveInState) =>
    (template.data ?? []).filter(
      (item) => !state.inventory.some((i) => i.name === item)
    );

  return (
    <>
      <AppHeader title="Move-in checklist" />
      <Screen refreshing={loading} onRefresh={() => void reload()}>
        {loading && !data ? (
          <Loading />
        ) : error || !data ? (
          <ErrorState
            message={error ?? "Couldn't load your checklist."}
            onRetry={() => void reload()}
          />
        ) : (
          <>
            <Card style={styles.card}>
              <Text variant="cardTitle">
                {data.tasks.filter((t) => t.done).length} of {data.tasks.length}{" "}
                done
              </Text>
              {data.completedAt && (
                <Badge label="All done" tone="success" icon={CheckCircle2} />
              )}
            </Card>

            {data.tasks.map((task) => (
              <Card key={task.key}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: task.done }}
                  accessibilityLabel={task.label}
                  onPress={() => void toggleTask(task.key, !task.done)}
                  style={styles.taskRow}
                >
                  {task.done ? (
                    <CheckCircle2 size={22} color={c.success} strokeWidth={2} />
                  ) : (
                    <Circle size={22} color={c.muted} strokeWidth={2} />
                  )}
                  <View style={styles.flex}>
                    <Text
                      variant="cardTitle"
                      tone={task.done ? "muted" : "ink"}
                      style={task.done ? styles.struck : undefined}
                    >
                      {task.label}
                    </Text>
                    <Text variant="label" tone="muted">
                      {task.description}
                    </Text>
                  </View>
                  {task.blockedBy && !task.done && (
                    <Lock size={16} color={c.muted} strokeWidth={2} />
                  )}
                </Pressable>
              </Card>
            ))}

            <Text variant="section" style={styles.sectionHead}>
              Room condition
            </Text>

            <Card style={styles.card}>
              <Text variant="body" tone="muted">
                Walk around and record anything already broken or worn, with a
                photo. This is what protects your deposit when you move out.
              </Text>
              {locked ? (
                <Badge
                  label={`Submitted ${formatDateTime(data.inventorySubmittedAt as string)}`}
                  tone="success"
                  icon={Lock}
                />
              ) : (
                <Button
                  label="Add an item"
                  variant="secondary"
                  icon={<Plus size={20} color={c.ink} strokeWidth={2} />}
                  onPress={() => setAdding(true)}
                />
              )}
            </Card>

            {data.inventory.map((item) => (
              <Card key={item.id} style={styles.card}>
                <View style={styles.itemHead}>
                  <View style={styles.flex}>
                    <Text variant="cardTitle">{item.name}</Text>
                    {item.notes.length > 0 && (
                      <Text variant="label" tone="muted">
                        {item.notes}
                      </Text>
                    )}
                  </View>
                  <Badge
                    label={CONDITION_LABELS[item.condition]}
                    tone={
                      item.condition === "good"
                        ? "success"
                        : item.condition === "fair"
                          ? "warning"
                          : "danger"
                    }
                  />
                  {!locked && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${item.name}`}
                      hitSlop={8}
                      onPress={() =>
                        void api
                          .removeInventoryItem(item.id)
                          .then(setData)
                          .catch((e) => toast.error(messageOf(e)))
                      }
                    >
                      <Trash2 size={18} color={c.danger} strokeWidth={2} />
                    </Pressable>
                  )}
                </View>

                {item.photoUris.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.thumbs}>
                      {item.photoUris.map((uri) => (
                        <Image key={uri} source={{ uri }} style={styles.thumb} />
                      ))}
                    </View>
                  </ScrollView>
                )}
              </Card>
            ))}

            {!locked && data.inventory.length > 0 && (
              <>
                {remaining(data).length > 0 && (
                  <Text variant="label" tone="muted">
                    Not yet checked: {remaining(data).join(", ")}.
                  </Text>
                )}
                <Button
                  label="Submit room condition"
                  emphasis
                  loading={busy}
                  onPress={() => void submitInventory()}
                />
                <Text variant="caption" tone="muted">
                  Once submitted this can't be changed, so check it first.
                </Text>
              </>
            )}
          </>
        )}
      </Screen>

      <Sheet
        visible={adding}
        onClose={() => setAdding(false)}
        title="Record an item"
        subtitle="Anything already damaged needs a photo."
      >
        <Field label="What is it?">
          <Input
            value={name}
            onChangeText={setName}
            placeholder="e.g. Mirror"
          />
        </Field>

        {(template.data ?? []).length > 0 && name.length === 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chips}>
              {(template.data ?? []).map((item) => (
                <Pressable
                  key={item}
                  accessibilityRole="button"
                  onPress={() => setName(item)}
                  style={[styles.chip, { borderColor: c.border }]}
                >
                  <Text variant="label">{item}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        )}

        <Field label="Condition">
          <Segmented<InventoryCondition>
            value={condition}
            onChange={setCondition}
            options={CONDITIONS.map((v) => ({
              value: v,
              label: CONDITION_LABELS[v],
            }))}
          />
        </Field>

        <Input
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          placeholder="e.g. Crack in the bottom-left corner"
          multiline
        />

        <PhotoStrip
          uris={photoUris}
          onChange={setPhotoUris}
          label="Photos"
          hint={
            condition === "damaged" || condition === "missing"
              ? "Required for damaged or missing items."
              : "Optional, but useful."
          }
        />

        {formError && (
          <Text variant="label" tone="danger">
            {formError}
          </Text>
        )}

        <Button
          label="Add item"
          emphasis
          loading={busy}
          disabled={name.trim().length === 0}
          onPress={() => void addItem()}
        />
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  flex: { flex: 1 },
  taskRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  struck: { textDecorationLine: "line-through" },
  sectionHead: { marginTop: space.md },
  itemHead: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  thumbs: { flexDirection: "row", gap: space.sm },
  thumb: { width: 88, height: 88, borderRadius: radius.md },
  chips: { flexDirection: "row", gap: space.sm, paddingVertical: 2 },
  chip: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    minHeight: 36,
    justifyContent: "center",
  },
});
