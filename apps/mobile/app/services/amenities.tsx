import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import {
  AMENITY_KIND_LABELS,
  type Amenity,
  type AmenitySlot,
} from "@proj/shared";
import { CalendarDays, Check, Trash2, Users } from "lucide-react-native";
import { useTheme } from "../../src/theme/ThemeProvider";
import { radius, space, withAlpha } from "../../src/theme/tokens";
import { api } from "../../src/api/client";
import { messageOf, useAsync } from "../../src/lib/useAsync";
import { addDays, formatDate, friendlyDay, toIsoDate } from "../../src/lib/format";
import { AppHeader } from "../../src/components/AppHeader";
import { Badge } from "../../src/components/Badge";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { EmptyState } from "../../src/components/EmptyState";
import { Screen } from "../../src/components/Screen";
import { Sheet } from "../../src/components/Sheet";
import { ErrorState, Loading } from "../../src/components/States";
import { Text } from "../../src/components/Text";
import { useToast } from "../../src/components/Toast";

export default function AmenitiesScreen() {
  const { c } = useTheme();
  const toast = useToast();

  const amenities = useAsync(() => api.amenities(), []);
  const bookings = useAsync(() => api.amenityBookings(), []);

  const [active, setActive] = useState<Amenity | null>(null);
  const [date, setDate] = useState(toIsoDate(new Date()));
  const [slots, setSlots] = useState<AmenitySlot[]>([]);
  const [busy, setBusy] = useState(false);

  // Next seven days as chips; nobody books a study room a month out.
  const days = Array.from({ length: 7 }, (_, i) =>
    toIsoDate(addDays(new Date(), i))
  );

  useEffect(() => {
    if (!active) return;
    api
      .amenityAvailability(active.id, date)
      .then((a) => setSlots(a.slots))
      .catch(() => setSlots([]));
  }, [active, date]);

  const book = async (slot: AmenitySlot) => {
    if (!active) return;
    setBusy(true);
    try {
      await api.bookAmenity(active.id, date, slot.startTime);
      const fresh = await api.amenityAvailability(active.id, date);
      setSlots(fresh.slots);
      await bookings.reload();
      toast.success(`${active.name} booked for ${slot.startTime}`);
    } catch (err) {
      toast.error(messageOf(err));
      // Someone may have taken the last place; show the truth immediately.
      const fresh = await api.amenityAvailability(active.id, date).catch(() => null);
      if (fresh) setSlots(fresh.slots);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (id: string) => {
    try {
      await api.cancelAmenityBooking(id);
      await bookings.reload();
      if (active) {
        const fresh = await api.amenityAvailability(active.id, date);
        setSlots(fresh.slots);
      }
    } catch (err) {
      toast.error(messageOf(err));
    }
  };

  const upcoming = (bookings.data ?? []).filter(
    (b) => b.date >= toIsoDate(new Date()) && b.status !== "cancelled"
  );

  return (
    <>
      <AppHeader title="Book a space" />
      <Screen
        refreshing={amenities.loading}
        onRefresh={() => {
          void amenities.reload();
          void bookings.reload();
        }}
      >
        {amenities.loading && !amenities.data ? (
          <Loading />
        ) : amenities.error ? (
          <ErrorState
            message={amenities.error}
            onRetry={() => void amenities.reload()}
          />
        ) : (
          <>
            {upcoming.length > 0 && (
              <>
                <Text variant="section">Your bookings</Text>
                {upcoming.map((b) => (
                  <Card key={b.id} style={styles.card}>
                    <View style={styles.row}>
                      <View style={styles.flex}>
                        <Text variant="cardTitle">{b.amenityName}</Text>
                        <Text variant="label" tone="muted">
                          {formatDate(b.date)} · {b.startTime} – {b.endTime}
                        </Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Cancel ${b.amenityName}`}
                        onPress={() => void cancel(b.id)}
                        hitSlop={8}
                      >
                        <Trash2 size={18} color={c.danger} strokeWidth={2} />
                      </Pressable>
                    </View>
                  </Card>
                ))}
              </>
            )}

            <Text variant="section" style={styles.sectionHead}>
              Spaces
            </Text>

            {(amenities.data ?? []).length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="No spaces yet"
                description="Bookable spaces set up by the hostel will appear here."
              />
            ) : (
              (amenities.data ?? []).map((a) => (
                <Card
                  key={a.id}
                  accessibilityLabel={a.name}
                  onPress={() => {
                    setActive(a);
                    setDate(toIsoDate(new Date()));
                  }}
                >
                  <View style={styles.row}>
                    <View style={styles.flex}>
                      <Text variant="cardTitle">{a.name}</Text>
                      <Text variant="label" tone="muted">
                        {a.description}
                      </Text>
                      <View style={styles.metaRow}>
                        <Users size={13} color={c.muted} strokeWidth={2} />
                        <Text variant="caption" tone="muted">
                          {a.capacity === 1
                            ? "One booking at a time"
                            : `Up to ${a.capacity} at once`}
                          {" · "}
                          {a.openFrom}–{a.openTo}
                        </Text>
                      </View>
                    </View>
                    <Badge label={AMENITY_KIND_LABELS[a.kind]} tone="neutral" />
                  </View>
                </Card>
              ))
            )}
          </>
        )}
      </Screen>

      <Sheet
        visible={active !== null}
        onClose={() => setActive(null)}
        title={active?.name ?? ""}
        subtitle={active?.description}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.dayStrip}>
            {days.map((d) => {
              const on = d === date;
              return (
                <Pressable
                  key={d}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  onPress={() => setDate(d)}
                  style={[
                    styles.dayChip,
                    {
                      backgroundColor: on ? c.accent : c.card,
                      borderColor: on ? c.accent : c.border,
                    },
                  ]}
                >
                  <Text variant="label" tone={on ? "onAccent" : "muted"}>
                    {friendlyDay(d)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <View style={styles.slotGrid}>
          {slots.map((s) => {
            const disabled = !s.available && !s.mine;
            return (
              <Pressable
                key={s.startTime}
                accessibilityRole="button"
                accessibilityState={{ disabled, selected: s.mine }}
                accessibilityLabel={`${s.startTime} to ${s.endTime}`}
                disabled={disabled || busy || s.mine}
                onPress={() => void book(s)}
                style={[
                  styles.slot,
                  {
                    borderColor: s.mine ? c.success : c.border,
                    backgroundColor: s.mine
                      ? withAlpha(c.success, 0.12)
                      : disabled
                        ? c.mutedBg
                        : c.card,
                    opacity: disabled ? 0.55 : 1,
                  },
                ]}
              >
                <View style={styles.slotHead}>
                  {s.mine && <Check size={13} color={c.success} strokeWidth={2.5} />}
                  <Text variant="label" tone={s.mine ? "success" : "ink"}>
                    {s.startTime}
                  </Text>
                </View>
                <Text variant="caption" tone="muted">
                  {s.mine
                    ? "Yours"
                    : s.capacity > 1
                      ? `${s.capacity - s.booked} left`
                      : disabled
                        ? "Taken"
                        : "Free"}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {slots.length === 0 && (
          <Text variant="label" tone="muted">
            No slots that day.
          </Text>
        )}

        <Button label="Done" variant="secondary" onPress={() => setActive(null)} />
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  flex: { flex: 1, gap: 2 },
  card: { gap: space.sm },
  sectionHead: { marginTop: space.md },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  dayStrip: { flexDirection: "row", gap: space.sm, paddingVertical: 2 },
  dayChip: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    minHeight: 38,
    justifyContent: "center",
  },
  slotGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  slot: {
    width: "31%",
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
    gap: 2,
  },
  slotHead: { flexDirection: "row", alignItems: "center", gap: 4 },
});
