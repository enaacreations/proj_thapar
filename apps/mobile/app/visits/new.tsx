import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Check, Info } from "lucide-react-native";
import {
  MEAL_LABELS,
  MEAL_TYPES,
  RELATION_LABELS,
  type MealType,
  type VisitorRelation,
} from "@proj/shared";
import { useTheme } from "../../src/theme/ThemeProvider";
import { radius, space } from "../../src/theme/tokens";
import { api } from "../../src/api/client";
import { messageOf, useAsync } from "../../src/lib/useAsync";
import { addDays, formatDate, toIsoDate } from "../../src/lib/format";
import { AppHeader } from "../../src/components/AppHeader";
import { Button } from "../../src/components/Button";
import { Calendar } from "../../src/components/Calendar";
import { Card } from "../../src/components/Card";
import { SelectRow } from "../../src/components/CategoryPicker";
import { Stepper, Toggle } from "../../src/components/Controls";
import { Field, Input } from "../../src/components/Input";
import { Screen } from "../../src/components/Screen";
import { Sheet, SheetOption } from "../../src/components/Sheet";
import { Text } from "../../src/components/Text";
import { useToast } from "../../src/components/Toast";

const RELATIONS = Object.keys(RELATION_LABELS) as VisitorRelation[];

export default function NewVisit() {
  const { c } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const menu = useAsync(() => api.menu(14), []);

  const [visitorName, setVisitorName] = useState("");
  const [relation, setRelation] = useState<VisitorRelation>("parent");
  const [relationOpen, setRelationOpen] = useState(false);
  const [visitDate, setVisitDate] = useState<string | null>(null);
  const [durationHours, setDurationHours] = useState(3);
  const [foodRequired, setFoodRequired] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Mess needs a day's notice, so food can only be added from tomorrow on.
  const foodCutoffDate = toIsoDate(addDays(new Date(), 1));
  const foodAllowed = visitDate !== null && visitDate >= foodCutoffDate;

  const dayMenu = useMemo(
    () => menu.data?.find((d) => d.date === visitDate) ?? null,
    [menu.data, visitDate]
  );

  const toggleItem = (meal: MealType, item: string) => {
    const key = `${meal}::${item}`;
    setSelected({ ...selected, [key]: !selected[key] });
  };

  const foodSelections = MEAL_TYPES.map((meal) => ({
    meal,
    items: Object.entries(selected)
      .filter(([key, on]) => on && key.startsWith(`${meal}::`))
      .map(([key]) => key.split("::")[1] as string),
  })).filter((s) => s.items.length > 0);

  const submit = async () => {
    if (visitorName.trim().length < 2) {
      setError("Enter the visitor's name.");
      return;
    }
    if (!visitDate) {
      setError("Pick the day of the visit.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const created = await api.createVisit({
        visitorName: visitorName.trim(),
        relation,
        visitDate,
        durationHours,
        foodRequired: foodRequired && foodAllowed,
        foodSelections: foodRequired && foodAllowed ? foodSelections : [],
      });
      toast.success(`Visit ${created.id} requested`);
      router.replace(`/visits/${created.id}`);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <AppHeader title="Book a visit" />
      <Screen
        footer={
          <>
            {error && (
              <Text variant="label" tone="danger">
                {error}
              </Text>
            )}
            <Button
              label="Send request"
              emphasis
              loading={submitting}
              onPress={() => void submit()}
            />
          </>
        }
      >
        <Card style={styles.card}>
          <Text variant="cardTitle">Who's visiting?</Text>
          <Input
            label="Visitor's name"
            value={visitorName}
            onChangeText={(text) => {
              setVisitorName(text);
              setError(null);
            }}
            placeholder="e.g. Sunita Mehta"
            autoCapitalize="words"
          />
          <Field label="Relation to you">
            <SelectRow
              value={RELATION_LABELS[relation]}
              placeholder="Choose"
              onPress={() => setRelationOpen(true)}
            />
          </Field>
        </Card>

        <Card style={styles.card}>
          <Text variant="cardTitle">When?</Text>
          <Calendar
            value={visitDate}
            minDate={toIsoDate(new Date())}
            onChange={(iso) => {
              setVisitDate(iso);
              setError(null);
              if (iso < foodCutoffDate) setFoodRequired(false);
            }}
          />
          {visitDate && (
            <Text variant="label" tone="muted">
              Visiting on {formatDate(visitDate)}
            </Text>
          )}
          <View style={styles.durationRow}>
            <Text variant="body" style={styles.flex}>
              How many hours?
            </Text>
            <Stepper
              label="hours"
              value={durationHours}
              onChange={setDurationHours}
              min={1}
              max={12}
            />
          </View>
        </Card>

        <Card style={styles.card}>
          <Text variant="cardTitle">Meals for your visitor</Text>

          {!visitDate ? (
            <Text variant="label" tone="muted">
              Pick a visit date first.
            </Text>
          ) : !foodAllowed ? (
            <View style={[styles.notice, { backgroundColor: c.warningBg }]}>
              <Info size={16} color={c.warning} strokeWidth={2} />
              <Text variant="label" tone="warning" style={styles.flex}>
                The mess needs a day's notice. Book the visit for tomorrow or
                later to add meals.
              </Text>
            </View>
          ) : (
            <>
              <Toggle
                checked={foodRequired}
                onChange={setFoodRequired}
                label="Order food for the visit"
                description="Choose dishes from that day's menu"
              />

              {foodRequired && dayMenu && (
                <View style={styles.meals}>
                  {MEAL_TYPES.map((meal) => (
                    <View key={meal} style={styles.mealBlock}>
                      <Text variant="label" tone="muted">
                        {MEAL_LABELS[meal]} ·{" "}
                        {dayMenu.meals[meal].servingWindow}
                      </Text>
                      <View style={styles.chips}>
                        {dayMenu.meals[meal].items.map((item) => {
                          const on = selected[`${meal}::${item.name}`] === true;
                          return (
                            <Pressable
                              key={item.name}
                              accessibilityRole="checkbox"
                              accessibilityState={{ checked: on }}
                              onPress={() => toggleItem(meal, item.name)}
                              style={[
                                styles.chip,
                                {
                                  borderColor: on ? c.accent : c.border,
                                  backgroundColor: on ? c.accent : c.card,
                                },
                              ]}
                            >
                              {on && (
                                <Check
                                  size={14}
                                  color={c.onAccent}
                                  strokeWidth={2.5}
                                />
                              )}
                              <Text
                                variant="label"
                                tone={on ? "onAccent" : "ink"}
                              >
                                {item.name}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </Card>
      </Screen>

      <Sheet
        visible={relationOpen}
        onClose={() => setRelationOpen(false)}
        title="Relation to you"
      >
        {RELATIONS.map((option) => (
          <SheetOption
            key={option}
            label={RELATION_LABELS[option]}
            selected={option === relation}
            onPress={() => {
              setRelation(option);
              setRelationOpen(false);
            }}
          />
        ))}
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  flex: { flex: 1 },
  durationRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
    borderRadius: radius.lg,
    padding: 12,
  },
  meals: { gap: space.lg },
  mealBlock: { gap: space.sm },
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
