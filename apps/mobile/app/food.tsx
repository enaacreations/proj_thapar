import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { CircleDot, Leaf, PauseCircle, PlayCircle, Star } from "lucide-react-native";
import {
  MEAL_LABELS,
  MEAL_TYPES,
  type FoodPreferences,
  type MealType,
} from "@proj/shared";
import { useTheme } from "../src/theme/ThemeProvider";
import { radius, space } from "../src/theme/tokens";
import { api } from "../src/api/client";
import { useAsync } from "../src/lib/useAsync";
import { addDays, formatDate, friendlyDay, toIsoDate } from "../src/lib/format";
import { AppHeader } from "../src/components/AppHeader";
import { Badge } from "../src/components/Badge";
import { Button } from "../src/components/Button";
import { Calendar } from "../src/components/Calendar";
import { Card } from "../src/components/Card";
import { Toggle } from "../src/components/Controls";
import { Screen } from "../src/components/Screen";
import { Sheet } from "../src/components/Sheet";
import { ErrorState, Loading } from "../src/components/States";
import { Text } from "../src/components/Text";
import { useToast } from "../src/components/Toast";

export default function FoodScreen() {
  const { c } = useTheme();
  const router = useRouter();
  const toast = useToast();

  const menu = useAsync(() => api.menu(7), []);
  const prefs = useAsync(() => api.foodPreferences(), []);

  const [selectedDate, setSelectedDate] = useState(() => toIsoDate(new Date()));
  const [pauseOpen, setPauseOpen] = useState(false);
  const [pauseFrom, setPauseFrom] = useState<string | null>(null);
  const [pauseTo, setPauseTo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const dayMenu = useMemo(
    () => menu.data?.find((d) => d.date === selectedDate) ?? menu.data?.[0],
    [menu.data, selectedDate]
  );

  const applyPrefs = (next: FoodPreferences) => prefs.setData(next);

  const toggleMeal = async (meal: MealType, value: boolean) => {
    if (!prefs.data) return;
    // Optimistic — the switch should move under the thumb, not after a round-trip.
    applyPrefs({ ...prefs.data, optIn: { ...prefs.data.optIn, [meal]: value } });
    try {
      applyPrefs(await api.updateMeals({ meals: { [meal]: value } }));
    } catch {
      applyPrefs(prefs.data);
      toast.error("Couldn't save that. Check your connection.");
    }
  };

  const setAll = async (value: boolean) => {
    if (!prefs.data) return;
    const meals = Object.fromEntries(
      MEAL_TYPES.map((m) => [m, value])
    ) as Record<MealType, boolean>;

    applyPrefs({ ...prefs.data, optIn: meals });
    try {
      applyPrefs(await api.updateMeals({ meals }));
      toast.success(value ? "Opted in to all meals" : "Opted out of all meals");
    } catch {
      void prefs.reload();
      toast.error("Couldn't save that. Check your connection.");
    }
  };

  const savePause = async () => {
    if (!pauseFrom || !pauseTo) return;
    setSaving(true);
    try {
      applyPrefs(await api.pauseFood(pauseFrom, pauseTo));
      setPauseOpen(false);
      toast.success("Meals paused");
    } catch {
      toast.error("Couldn't pause meals. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const resume = async () => {
    try {
      applyPrefs(await api.resumeFood());
      toast.success("Meals resumed");
    } catch {
      toast.error("Couldn't resume meals. Try again.");
    }
  };

  const pause = prefs.data?.pause ?? null;
  const optedInCount = prefs.data
    ? MEAL_TYPES.filter((m) => prefs.data?.optIn[m]).length
    : 0;

  return (
    <>
      <AppHeader
        title="Food"
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Rate the food"
            onPress={() => router.push("/feedback/new?category=mess")}
            hitSlop={8}
            style={styles.headerAction}
          >
            <Star size={22} color={c.accentStrong} strokeWidth={2} />
          </Pressable>
        }
      />

      <Screen
        refreshing={menu.loading || prefs.loading}
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
                <View style={styles.pausedHead}>
                  <PauseCircle size={20} color={c.warning} strokeWidth={2} />
                  <Text variant="cardTitle" style={styles.flex}>
                    Meals paused
                  </Text>
                </View>
                <Text variant="body" tone="muted">
                  From {formatDate(pause.from)} to {formatDate(pause.to)}. You
                  won't be counted for the mess on those days.
                </Text>
                <Button
                  label="Resume meals"
                  variant="secondary"
                  icon={<PlayCircle size={20} color={c.ink} strokeWidth={2} />}
                  onPress={() => void resume()}
                />
              </Card>
            )}

            {/* Week strip — tapping a day swaps the menu below. */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.strip}
            >
              {(menu.data ?? []).map((day) => {
                const active = day.date === selectedDate;
                return (
                  <Pressable
                    key={day.date}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    onPress={() => setSelectedDate(day.date)}
                    style={[
                      styles.dayChip,
                      {
                        backgroundColor: active ? c.accent : c.card,
                        borderColor: active ? c.accent : c.border,
                      },
                    ]}
                  >
                    <Text
                      variant="label"
                      tone={active ? "onAccent" : "muted"}
                      numberOfLines={1}
                    >
                      {friendlyDay(day.date)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {dayMenu && (
              <View style={styles.meals}>
                {MEAL_TYPES.map((meal) => {
                  const info = dayMenu.meals[meal];
                  const optedIn = prefs.data?.optIn[meal] ?? false;

                  return (
                    <Card key={meal} style={styles.card}>
                      <View style={styles.mealHead}>
                        <View style={styles.flex}>
                          <Text variant="cardTitle">{MEAL_LABELS[meal]}</Text>
                          <Text variant="caption" tone="muted">
                            {info.servingWindow}
                          </Text>
                        </View>
                        <Badge
                          label={optedIn ? "Opted in" : "Opted out"}
                          tone={optedIn ? "success" : "neutral"}
                          icon={optedIn ? undefined : CircleDot}
                        />
                      </View>

                      <View style={styles.items}>
                        {info.items.map((item) => (
                          <View key={item.name} style={styles.item}>
                            <Leaf
                              size={14}
                              color={item.veg ? c.success : c.danger}
                              strokeWidth={2}
                            />
                            <Text variant="body">{item.name}</Text>
                          </View>
                        ))}
                      </View>

                      <Toggle
                        checked={optedIn}
                        onChange={(next) => void toggleMeal(meal, next)}
                        label={`Eat ${MEAL_LABELS[meal].toLowerCase()}`}
                        description="Applies from tomorrow onwards"
                      />
                    </Card>
                  );
                })}
              </View>
            )}

            <Card style={styles.card}>
              <Text variant="cardTitle">Quick actions</Text>
              <Text variant="label" tone="muted">
                You're opted in to {optedInCount} of {MEAL_TYPES.length} meals.
              </Text>
              <Button
                label="Opt in to all meals"
                variant="secondary"
                onPress={() => void setAll(true)}
              />
              <Button
                label="Opt out of all meals"
                variant="outline"
                onPress={() => void setAll(false)}
              />
              {!pause && (
                <Button
                  label="Pause meals for a few days"
                  variant="outline"
                  icon={<PauseCircle size={20} color={c.ink} strokeWidth={2} />}
                  onPress={() => {
                    setPauseFrom(toIsoDate(new Date()));
                    setPauseTo(toIsoDate(addDays(new Date(), 4)));
                    setPauseOpen(true);
                  }}
                />
              )}
            </Card>
          </>
        )}
      </Screen>

      <Sheet
        visible={pauseOpen}
        onClose={() => setPauseOpen(false)}
        title="Pause meals"
        subtitle="Tap the first day, then the last day."
      >
        <Calendar
          value={pauseFrom}
          rangeEnd={pauseTo}
          minDate={toIsoDate(new Date())}
          onChange={(iso) => {
            // First tap sets the start; the next tap closes the range.
            if (!pauseFrom || (pauseFrom && pauseTo)) {
              setPauseFrom(iso);
              setPauseTo(null);
            } else {
              setPauseTo(iso < pauseFrom ? pauseFrom : iso);
              if (iso < pauseFrom) setPauseFrom(iso);
            }
          }}
        />
        <Text variant="label" tone="muted">
          {pauseFrom && pauseTo
            ? `${formatDate(pauseFrom)} to ${formatDate(pauseTo)}`
            : pauseFrom
              ? `From ${formatDate(pauseFrom)} — now pick the last day.`
              : "Pick the first day of the pause."}
        </Text>
        <Button
          label="Pause meals"
          emphasis
          loading={saving}
          disabled={!pauseFrom || !pauseTo}
          onPress={() => void savePause()}
        />
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  headerAction: { padding: 6 },
  card: { gap: space.md },
  flex: { flex: 1 },
  pausedHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  strip: { gap: space.sm, paddingVertical: 2 },
  dayChip: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    minHeight: 40,
    justifyContent: "center",
  },
  meals: { gap: space.md },
  mealHead: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  items: { gap: 6 },
  item: { flexDirection: "row", alignItems: "center", gap: space.sm },
});
