import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, StyleSheet, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { CheckCircle2, QrCode } from "lucide-react-native";
import { MEAL_LABELS, type MealType, type MessPass } from "@proj/shared";
import { useTheme } from "../src/theme/ThemeProvider";
import { radius, space } from "../src/theme/tokens";
import { api } from "../src/api/client";
import { messageOf, useAsync } from "../src/lib/useAsync";
import { formatDateTime } from "../src/lib/format";
import { AppHeader } from "../src/components/AppHeader";
import { Badge } from "../src/components/Badge";
import { Card } from "../src/components/Card";
import { EmptyState } from "../src/components/EmptyState";
import { Screen } from "../src/components/Screen";
import { Text } from "../src/components/Text";

/** Whichever meal is being served right now, so nobody has to pick from a list. */
function currentMeal(): MealType {
  const hour = new Date().getHours();
  if (hour < 10) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 18) return "snacks";
  return "dinner";
}

/**
 * The resident's phone only *shows* a pass — the counter scans it and records
 * the entry against a staff login. That way the record attests that someone at
 * the counter handed over a plate, which a phone reporting on itself can't.
 */
export default function MessEntryScreen() {
  const { c } = useTheme();
  const entries = useAsync(() => api.messEntries(), []);

  const [pass, setPass] = useState<MessPass | null>(null);
  const [passError, setPassError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const meal = currentMeal();

  const refresh = useCallback(async () => {
    try {
      const next = await api.messPass();
      setPass(next);
      setPassError(null);
      return next.rotateSeconds;
    } catch (err) {
      setPassError(messageOf(err));
      return null;
    }
  }, []);

  useEffect(() => {
    let alive = true;

    // Re-arms after each fetch rather than on an interval, so a slow response
    // can't stack requests and the code on screen is always the current one.
    const cycle = async () => {
      const rotateSeconds = await refresh();
      if (!alive) return;
      timer.current = setTimeout(
        () => void cycle(),
        (rotateSeconds ?? 10) * 1000
      );
    };

    void cycle();

    // A backgrounded phone stops rotating; pull a fresh pass on return rather
    // than showing one that expired in someone's pocket.
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });

    return () => {
      alive = false;
      if (timer.current) clearTimeout(timer.current);
      sub.remove();
    };
  }, [refresh]);

  return (
    <>
      <AppHeader title="Mess entry" />
      <Screen refreshing={entries.loading} onRefresh={() => void entries.reload()}>
        <Card style={styles.card}>
          <Text variant="label" tone="muted">
            Serving now
          </Text>
          <Text variant="title">{MEAL_LABELS[meal]}</Text>
          <Text variant="body" tone="muted">
            Show this at the counter. It changes every few seconds, so there's
            nothing to share and nothing to screenshot.
          </Text>
        </Card>

        <Card style={styles.passCard}>
          {pass ? (
            <>
              {/* White plate behind the code: scanners need the quiet zone and
                  the contrast, which a dark-theme card would eat. */}
              <View style={styles.plate}>
                <QRCode value={pass.token} size={216} backgroundColor="#fff" />
              </View>
              <Text variant="label" tone="muted">
                Hold it up for the counter to scan
              </Text>
            </>
          ) : (
            <>
              <View style={[styles.plate, styles.placeholder]}>
                <QrCode size={48} color={c.muted} strokeWidth={1.5} />
              </View>
              <Text variant="body" tone="muted">
                {passError ?? "Getting your pass…"}
              </Text>
            </>
          )}
        </Card>

        <Text variant="section" style={styles.sectionHead}>
          Recent entries
        </Text>

        {!entries.data || entries.data.length === 0 ? (
          <EmptyState
            icon={QrCode}
            title="No entries yet"
            description="Every time the counter scans your pass, it's logged here so meal counts stay accurate."
          />
        ) : (
          entries.data.map((entry) => (
            <Card key={entry.id} style={styles.entry}>
              <View style={styles.entryHead}>
                <View style={styles.flex}>
                  <Text variant="cardTitle">{MEAL_LABELS[entry.meal]}</Text>
                  <Text variant="label" tone="muted">
                    {formatDateTime(entry.enteredAt)}
                    {entry.locationLabel ? ` · ${entry.locationLabel}` : ""}
                  </Text>
                </View>
                <Badge label="Entered" tone="success" icon={CheckCircle2} />
              </View>
            </Card>
          ))
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.xs },
  passCard: { alignItems: "center", gap: space.sm },
  plate: {
    padding: space.md,
    borderRadius: radius.xl,
    backgroundColor: "#fff",
  },
  placeholder: {
    width: 248,
    height: 248,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionHead: { marginTop: space.md },
  entry: { gap: 4 },
  entryHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  flex: { flex: 1 },
});
