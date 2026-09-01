import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { BOOKING_STATUS_LABELS, type HousekeepingService } from "@proj/shared";
import { Plus, Sparkles, Trash2 } from "lucide-react-native";
import { useTheme } from "../../src/theme/ThemeProvider";
import { space } from "../../src/theme/tokens";
import { api } from "../../src/api/client";
import { messageOf, useAsync } from "../../src/lib/useAsync";
import { addDays, formatDate, formatRupees, toIsoDate } from "../../src/lib/format";
import { AppHeader } from "../../src/components/AppHeader";
import { Badge } from "../../src/components/Badge";
import { Button } from "../../src/components/Button";
import { Calendar } from "../../src/components/Calendar";
import { Card } from "../../src/components/Card";
import { EmptyState } from "../../src/components/EmptyState";
import { Field, Input } from "../../src/components/Input";
import { Screen } from "../../src/components/Screen";
import { Sheet, SheetOption } from "../../src/components/Sheet";
import { ErrorState, Loading } from "../../src/components/States";
import { Text } from "../../src/components/Text";
import { useToast } from "../../src/components/Toast";

export default function HousekeepingScreen() {
  const { c } = useTheme();
  const toast = useToast();

  const services = useAsync(() => api.housekeepingServices(), []);
  const bookings = useAsync(() => api.housekeepingBookings(), []);

  const [picking, setPicking] = useState<HousekeepingService | null>(null);
  const [date, setDate] = useState(toIsoDate(addDays(new Date(), 1)));
  const [slots, setSlots] = useState<{ slot: string; available: boolean }[]>([]);
  const [slot, setSlot] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!picking) return;
    api.housekeepingSlots(date).then(setSlots).catch(() => setSlots([]));
  }, [picking, date]);

  const book = async () => {
    if (!picking || !slot) return;
    setBusy(true);
    try {
      await api.bookHousekeeping({
        serviceId: picking.id,
        date,
        slot,
        notes,
      });
      setPicking(null);
      setSlot(null);
      setNotes("");
      await bookings.reload();
      toast.success("Booked");
    } catch (err) {
      toast.error(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (id: string) => {
    try {
      await api.cancelHousekeeping(id);
      await bookings.reload();
    } catch (err) {
      toast.error(messageOf(err));
    }
  };

  return (
    <>
      <AppHeader title="Housekeeping" />
      <Screen
        refreshing={bookings.loading}
        onRefresh={() => void bookings.reload()}
      >
        {services.loading && !services.data ? (
          <Loading />
        ) : services.error ? (
          <ErrorState
            message={services.error}
            onRetry={() => void services.reload()}
          />
        ) : (
          <>
            <Text variant="section">Book a clean</Text>
            {(services.data ?? []).map((service) => (
              <Card
                key={service.id}
                accessibilityLabel={service.name}
                onPress={() => setPicking(service)}
              >
                <View style={styles.row}>
                  <View style={styles.flex}>
                    <Text variant="cardTitle">{service.name}</Text>
                    <Text variant="label" tone="muted">
                      {service.description}
                    </Text>
                    <Text variant="caption" tone="muted">
                      About {service.durationMinutes} minutes
                    </Text>
                  </View>
                  <Badge
                    label={service.price === 0 ? "Included" : formatRupees(service.price)}
                    tone={service.price === 0 ? "success" : "accent"}
                  />
                </View>
              </Card>
            ))}

            <Text variant="section" style={styles.sectionHead}>
              Your bookings
            </Text>

            {(bookings.data ?? []).length === 0 ? (
              <EmptyState
                icon={Sparkles}
                title="Nothing booked"
                description="Book a routine clean or an add-on like deep cleaning or pest control."
              />
            ) : (
              (bookings.data ?? []).map((b) => (
                <Card key={b.id} style={styles.card}>
                  <View style={styles.row}>
                    <View style={styles.flex}>
                      <Text variant="cardTitle">{b.serviceName}</Text>
                      <Text variant="label" tone="muted">
                        {formatDate(b.date)} · {b.slot}
                      </Text>
                      {b.notes.length > 0 && (
                        <Text variant="caption" tone="muted">
                          {b.notes}
                        </Text>
                      )}
                    </View>
                    <Badge
                      label={BOOKING_STATUS_LABELS[b.status]}
                      tone={
                        b.status === "done"
                          ? "success"
                          : b.status === "cancelled"
                            ? "neutral"
                            : "warning"
                      }
                    />
                  </View>
                  {b.status === "booked" && (
                    <Button
                      label="Cancel booking"
                      variant="link"
                      fullWidth={false}
                      icon={<Trash2 size={16} color={c.accentStrong} strokeWidth={2} />}
                      onPress={() => void cancel(b.id)}
                    />
                  )}
                </Card>
              ))
            )}
          </>
        )}
      </Screen>

      <Sheet
        visible={picking !== null}
        onClose={() => setPicking(null)}
        title={picking?.name ?? ""}
        subtitle={
          picking?.price === 0
            ? "Included in your rent."
            : `${formatRupees(picking?.price ?? 0)}, added to your next invoice.`
        }
      >
        <Field label="Date">
          <Calendar
            value={date}
            onChange={(iso) => {
              setDate(iso);
              setSlot(null);
            }}
            minDate={toIsoDate(new Date())}
          />
        </Field>

        <Field label="Time">
          {slots.map((s) => (
            <SheetOption
              key={s.slot}
              label={s.slot}
              description={s.available ? undefined : "You already have a booking then"}
              selected={slot === s.slot}
              onPress={() => s.available && setSlot(s.slot)}
            />
          ))}
        </Field>

        <Input
          label="Anything to mention?"
          value={notes}
          onChangeText={setNotes}
          placeholder="Optional"
          multiline
        />

        <Button
          label="Book it"
          emphasis
          loading={busy}
          disabled={!slot}
          onPress={() => void book()}
        />
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  flex: { flex: 1, gap: 2 },
  card: { gap: space.sm },
  sectionHead: { marginTop: space.md },
});
