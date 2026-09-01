import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import {
  DIET_FILTERS,
  DIET_TAG_LABELS,
  MEAL_LABELS,
  MEAL_TYPES,
  type DietTag,
  type FoodPreferences,
  type MealType,
} from "@proj/shared";
import {
  Check,
  Leaf,
  PauseCircle,
  PlayCircle,
  Star,
  UserPlus,
} from "lucide-react-native";
import { useTheme } from "../src/theme/ThemeProvider";
import { radius, space, withAlpha } from "../src/theme/tokens";
import { api } from "../src/api/client";
import { messageOf, useAsync } from "../src/lib/useAsync";
import {
  addDays,
  formatDate,
  formatRupees,
  friendlyDay,
  toIsoDate,
} from "../src/lib/format";
import { AppHeader } from "../src/components/AppHeader";
import { Badge } from "../src/components/Badge";
import { Button } from "../src/components/Button";
import { Calendar } from "../src/components/Calendar";
import { Card } from "../src/components/Card";
import { Rating, Segmented, Stepper, Toggle } from "../src/components/Controls";
import { Field } from "../src/components/Input";
import { Screen } from "../src/components/Screen";
import { Sheet } from "../src/components/Sheet";
import { ErrorState, Loading } from "../src/components/States";
import { Text } from "../src/components/Text";
import { useToast } from "../src/components/Toast";

export default function FoodScreen() {
  const { c } = useTheme();
  const router = useRouter();
  const toast = useToast();

  const menu = useAsync(() => api.diningMenu(7), []);
  const diet = useAsync(() => api.diet(), []);
  const prefs = useAsync(() => api.foodPreferences(), []);
  const guests = useAsync(() => api.guestMeals(), []);

  const [selectedDate, setSelectedDate] = useState(() => toIsoDate(new Date()));
  const [dietOpen, setDietOpen] = useState(false);
  const [rating, setRating] = useState<{ meal: MealType; value: number } | null>(
    null
  );
  const [guestOpen, setGuestOpen] = useState(false);
  const [guestDate, setGuestDate] = useState(toIsoDate(addDays(new Date(), 1)));
  const [guestMeal, setGuestMeal] = useState<MealType>("dinner");
  const [guestCount, setGuestCount] = useState(2);
  const [busy, setBusy] = useState(false);

  const day = useMemo(
    () => menu.data?.find((d) => d.date === selectedDate) ?? menu.data?.[0],
    [menu.data, selectedDate]
  );

  const activeTags = diet.data?.tags ?? [];

  const toggleTag = async (tag: DietTag) => {
    const next = activeTags.includes(tag)
      ? activeTags.filter((t) => t !== tag)
      : [...activeTags, tag];
    try {
      diet.setData(await api.saveDiet(next, diet.data?.allergies ?? ""));
      await menu.reload();
    } catch (err) {
      toast.error(messageOf(err));
    }
  };

  const submitRating = async () => {
    if (!rating || !day) return;
    setBusy(true);
    try {
      await api.rateMeal({
        date: day.date,
        meal: rating.meal,
        rating: rating.value,
      });
      setRating(null);
      await menu.reload();
      toast.success("Thanks — that feeds the mess vendor's score");
    } catch (err) {
      toast.error(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  const bookGuest = async () => {
    setBusy(true);
    try {
      const booked = await api.bookGuestMeal({
        date: guestDate,
        meal: guestMeal,
        guests: guestCount,
      });
      setGuestOpen(false);
      await guests.reload();
      toast.success(`Booked · ${formatRupees(booked.amount)} on your next bill`);
    } catch (err) {
      toast.error(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  const toggleMeal = async (meal: MealType, value: boolean) => {
    if (!prefs.data) return;
    const optimistic: FoodPreferences = {
      ...prefs.data,
      optIn: { ...prefs.data.optIn, [meal]: value },
    };
    prefs.setData(optimistic);
    try {
      prefs.setData(await api.updateMeals({ meals: { [meal]: value } }));
    } catch {
      void prefs.reload();
      toast.error("Couldn't save that.");
    }
  };

  const pause = prefs.data?.pause ?? null;
  const isToday = day?.date === toIsoDate(new Date());
  const isPast = day ? day.date <= toIsoDate(new Date()) : false;

  return (
    <>
      <AppHeader
        title="Food"
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dietary preferences"
            onPress={() => setDietOpen(true)}
            hitSlop={8}
            style={styles.headerAction}
          >
            <Leaf size={22} color={c.accentStrong} strokeWidth={2} />
          </Pressable>
        }
      />

      <Screen
        refreshing={menu.loading}
        onRefresh={() => {
          void menu.reload();
          void prefs.reload();
        }}
      >
        {menu.loading && !menu.data ? (
          <Loading label="Loading this week's menu…" />
        ) : menu.error ? (
          <ErrorState message={menu.error} onRetry={() => void menu.reload()} />
        ) : (
          <>
            {pause && (
              <Card style={[styles.card, { borderColor: c.warning }]}>
                <Text variant="cardTitle">Meals paused</Text>
                <Text variant="body" tone="muted">
                  {formatDate(pause.from)} to {formatDate(pause.to)}
                </Text>
                <Button
                  label="Resume meals"
                  variant="secondary"
                  icon={<PlayCircle size={20} color={c.ink} strokeWidth={2} />}
                  onPress={() =>
                    void api.resumeFood().then(prefs.setData).catch(() => undefined)
                  }
                />
              </Card>
            )}

            {activeTags.length > 0 && (
              <Card style={styles.dietBanner}>
                <Leaf size={16} color={c.success} strokeWidth={2} />
                <Text variant="label" style={styles.flex}>
                  Showing what fits:{" "}
                  {activeTags.map((t) => DIET_TAG_LABELS[t]).join(" + ")}
                </Text>
              </Card>
            )}

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.strip}>
                {(menu.data ?? []).map((d) => {
                  const on = d.date === selectedDate;
                  return (
                    <Pressable
                      key={d.date}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: on }}
                      onPress={() => setSelectedDate(d.date)}
                      style={[
                        styles.dayChip,
                        {
                          backgroundColor: on ? c.accent : c.card,
                          borderColor: on ? c.accent : c.border,
                        },
                      ]}
                    >
                      <Text variant="label" tone={on ? "onAccent" : "muted"}>
                        {friendlyDay(d.date)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            {day &&
              MEAL_TYPES.map((meal) => {
                const info = day.meals.find((m) => m.meal === meal);
                const optedIn = prefs.data?.optIn[meal] ?? false;
                const myRating = day.ratings.find((r) => r.meal === meal);
                const matching = info?.dishes.filter((d) => d.matchesDiet) ?? [];

                return (
                  <Card key={meal} style={styles.card}>
                    <View style={styles.mealHead}>
                      <View style={styles.flex}>
                        <Text variant="cardTitle">{MEAL_LABELS[meal]}</Text>
                        <Text variant="caption" tone="muted">
                          {info?.servingWindow ?? "Not published"}
                        </Text>
                      </View>
                      <Badge
                        label={optedIn ? "Opted in" : "Opted out"}
                        tone={optedIn ? "success" : "neutral"}
                      />
                    </View>

                    {(info?.dishes ?? []).length === 0 ? (
                      <Text variant="body" tone="muted">
                        Menu not published yet.
                      </Text>
                    ) : (
                      <View style={styles.items}>
                        {info?.dishes.map((dish) => (
                          <View key={dish.id} style={styles.item}>
                            <View
                              style={[
                                styles.dot,
                                {
                                  backgroundColor: dish.matchesDiet
                                    ? c.success
                                    : c.border,
                                },
                              ]}
                            />
                            <Text
                              variant="body"
                              tone={
                                activeTags.length > 0 && !dish.matchesDiet
                                  ? "muted"
                                  : "ink"
                              }
                              style={styles.flex}
                            >
                              {dish.name}
                            </Text>
                            <Text variant="caption" tone="muted">
                              {dish.tags
                                .map((t) => DIET_TAG_LABELS[t])
                                .slice(0, 2)
                                .join(", ")}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {activeTags.length > 0 && (info?.dishes.length ?? 0) > 0 && (
                      <Text variant="caption" tone={matching.length ? "success" : "warning"}>
                        {matching.length} of {info?.dishes.length} fit your diet
                      </Text>
                    )}

                    <Toggle
                      checked={optedIn}
                      onChange={(next) => void toggleMeal(meal, next)}
                      label={`Eat ${MEAL_LABELS[meal].toLowerCase()}`}
                    />

                    {isPast &&
                      (myRating ? (
                        <View style={styles.ratedRow}>
                          <Rating value={myRating.rating} size={16} />
                          <Text variant="caption" tone="muted">
                            You rated this
                          </Text>
                        </View>
                      ) : (
                        <Button
                          label="Rate this meal"
                          variant="secondary"
                          icon={<Star size={18} color={c.ink} strokeWidth={2} />}
                          onPress={() => setRating({ meal, value: 0 })}
                        />
                      ))}
                  </Card>
                );
              })}

            <Card style={styles.card}>
              <Text variant="cardTitle">Guests eating with you?</Text>
              <Text variant="label" tone="muted">
                Book a day ahead so the mess can cook for them. Charged to your
                next invoice.
              </Text>
              <Button
                label="Book a guest meal"
                variant="secondary"
                icon={<UserPlus size={20} color={c.ink} strokeWidth={2} />}
                onPress={() => setGuestOpen(true)}
              />
              {(guests.data ?? [])
                .filter((g) => g.status === "booked")
                .map((g) => (
                  <View key={g.id} style={styles.guestRow}>
                    <Text variant="body" style={styles.flex}>
                      {g.guests} × {MEAL_LABELS[g.meal]} · {formatDate(g.date)}
                    </Text>
                    <Text variant="mono">{formatRupees(g.amount)}</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Cancel guest meal"
                      hitSlop={8}
                      onPress={() =>
                        void api
                          .cancelGuestMeal(g.id)
                          .then(() => guests.reload())
                          .catch((e) => toast.error(messageOf(e)))
                      }
                    >
                      <Text variant="label" tone="danger">
                        Cancel
                      </Text>
                    </Pressable>
                  </View>
                ))}
            </Card>

            <Button
              label="Pause meals for a few days"
              variant="outline"
              icon={<PauseCircle size={20} color={c.ink} strokeWidth={2} />}
              onPress={() => router.push("/food")}
            />
          </>
        )}
      </Screen>

      {/* ------------------------------------------------------- diet ---- */}
      <Sheet
        visible={dietOpen}
        onClose={() => setDietOpen(false)}
        title="Dietary preferences"
        subtitle="We'll highlight what fits. Nothing is hidden — you can always see the full menu."
      >
        <View style={styles.chips}>
          {DIET_FILTERS.map((tag) => {
            const on = activeTags.includes(tag);
            return (
              <Pressable
                key={tag}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                onPress={() => void toggleTag(tag)}
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
                  {DIET_TAG_LABELS[tag]}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {diet.data?.allergies ? (
          <Text variant="label" tone="muted">
            Allergies on file: {diet.data.allergies}
          </Text>
        ) : null}
        <Button label="Done" variant="secondary" onPress={() => setDietOpen(false)} />
      </Sheet>

      {/* ----------------------------------------------------- rating ---- */}
      <Sheet
        visible={rating !== null}
        onClose={() => setRating(null)}
        title={rating ? `Rate ${MEAL_LABELS[rating.meal].toLowerCase()}` : ""}
        subtitle="This feeds the mess vendor's quality score."
      >
        <View style={styles.ratingWrap}>
          <Rating
            value={rating?.value ?? 0}
            onChange={(value) =>
              setRating((prev) => (prev ? { ...prev, value } : prev))
            }
          />
        </View>
        <Button
          label="Submit rating"
          emphasis
          loading={busy}
          disabled={(rating?.value ?? 0) === 0}
          onPress={() => void submitRating()}
        />
      </Sheet>

      {/* ------------------------------------------------ guest meal ---- */}
      <Sheet
        visible={guestOpen}
        onClose={() => setGuestOpen(false)}
        title="Book a guest meal"
        subtitle="Needs a day's notice."
      >
        <Field label="Which meal">
          <Segmented<MealType>
            value={guestMeal}
            onChange={setGuestMeal}
            options={MEAL_TYPES.map((m) => ({
              value: m,
              label: MEAL_LABELS[m],
            }))}
          />
        </Field>

        <Field label="Date">
          <Calendar
            value={guestDate}
            onChange={setGuestDate}
            minDate={toIsoDate(addDays(new Date(), 1))}
          />
        </Field>

        <View style={styles.guestCountRow}>
          <Text variant="body" style={styles.flex}>
            How many guests?
          </Text>
          <Stepper
            label="guests"
            value={guestCount}
            onChange={setGuestCount}
            min={1}
            max={6}
          />
        </View>

        <Button
          label="Book"
          emphasis
          loading={busy}
          onPress={() => void bookGuest()}
        />
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  headerAction: { padding: 6 },
  card: { gap: space.md },
  flex: { flex: 1 },
  dietBanner: { flexDirection: "row", alignItems: "center", gap: space.sm },
  strip: { flexDirection: "row", gap: space.sm, paddingVertical: 2 },
  dayChip: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    minHeight: 40,
    justifyContent: "center",
  },
  mealHead: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  items: { gap: 6 },
  item: { flexDirection: "row", alignItems: "center", gap: space.sm },
  dot: { width: 8, height: 8, borderRadius: radius.pill },
  ratedRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  ratingWrap: { alignItems: "center", paddingVertical: space.md },
  guestRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  guestCountRow: { flexDirection: "row", alignItems: "center", gap: space.md },
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
