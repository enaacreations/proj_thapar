import { useState } from "react";
import { StyleSheet, View } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import { CameraView, useCameraPermissions } from "expo-camera";
import { CheckCircle2, Fingerprint, QrCode, ScanFace, X } from "lucide-react-native";
import { MEAL_LABELS, type AttendanceMethod, type MealType } from "@proj/shared";
import { useTheme } from "../src/theme/ThemeProvider";
import { radius, space } from "../src/theme/tokens";
import { api } from "../src/api/client";
import { messageOf, useAsync } from "../src/lib/useAsync";
import { capturePhoto } from "../src/lib/photos";
import { formatDateTime } from "../src/lib/format";
import { AppHeader } from "../src/components/AppHeader";
import { Badge } from "../src/components/Badge";
import { Button } from "../src/components/Button";
import { Card } from "../src/components/Card";
import { EmptyState } from "../src/components/EmptyState";
import { Screen } from "../src/components/Screen";
import { Sheet } from "../src/components/Sheet";
import { Text } from "../src/components/Text";
import { useToast } from "../src/components/Toast";

/** Whichever meal is being served right now, so nobody has to pick from a list. */
function currentMeal(): MealType {
  const hour = new Date().getHours();
  if (hour < 10) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 18) return "snacks";
  return "dinner";
}

export default function MessEntryScreen() {
  const { c } = useTheme();
  const toast = useToast();
  const entries = useAsync(() => api.messEntries(), []);

  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);

  const meal = currentMeal();

  const record = async (method: AttendanceMethod) => {
    setBusy(true);
    try {
      await api.messEntry({ method, meal });
      await entries.reload();
      toast.success(`${MEAL_LABELS[meal]} entry recorded`);
    } catch (err) {
      toast.error(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  const scanFace = async () => {
    const shot = await capturePhoto();
    if (shot.problem) {
      toast.show(shot.problem, "warning");
      return;
    }
    if (shot.uris.length === 0) return;
    await record("facial");
  };

  const scanFinger = async () => {
    const hardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();

    if (!hardware || !enrolled) {
      toast.show("No fingerprint is set up on this phone.", "warning");
      return;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: `Enter mess for ${MEAL_LABELS[meal].toLowerCase()}`,
    });
    if (result.success) await record("biometric");
  };

  const openScanner = async () => {
    if (!permission?.granted) {
      const granted = await requestPermission();
      if (!granted.granted) {
        toast.show(
          "Camera access is off. Turn it on to scan the QR code.",
          "warning"
        );
        return;
      }
    }
    setScanning(true);
  };

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
            Use any one of these at the dining hall entrance.
          </Text>
        </Card>

        <Button
          label="Scan your face"
          emphasis
          loading={busy}
          icon={<ScanFace size={20} color={c.onAccent} strokeWidth={2} />}
          onPress={() => void scanFace()}
        />
        <Button
          label="Use your fingerprint"
          variant="secondary"
          icon={<Fingerprint size={20} color={c.ink} strokeWidth={2} />}
          onPress={() => void scanFinger()}
        />
        <Button
          label="Scan the QR code"
          variant="outline"
          icon={<QrCode size={20} color={c.ink} strokeWidth={2} />}
          onPress={() => void openScanner()}
        />

        <Text variant="section" style={styles.sectionHead}>
          Recent entries
        </Text>

        {!entries.data || entries.data.length === 0 ? (
          <EmptyState
            icon={QrCode}
            title="No entries yet"
            description="Every time you enter the mess, it's logged here so meal counts stay accurate."
          />
        ) : (
          entries.data.map((entry) => (
            <Card key={entry.id} style={styles.entry}>
              <View style={styles.entryHead}>
                <View style={styles.flex}>
                  <Text variant="cardTitle">{MEAL_LABELS[entry.meal]}</Text>
                  <Text variant="label" tone="muted">
                    {formatDateTime(entry.enteredAt)}
                  </Text>
                </View>
                <Badge label="Entered" tone="success" icon={CheckCircle2} />
              </View>
            </Card>
          ))
        )}
      </Screen>

      <Sheet
        visible={scanning}
        onClose={() => setScanning(false)}
        title="Point at the QR code"
        subtitle="It's on the board next to the dining hall door."
      >
        <View style={[styles.scanner, { borderColor: c.border }]}>
          {scanning && (
            <CameraView
              style={StyleSheet.absoluteFill}
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={() => {
                if (busy) return;
                setScanning(false);
                void record("qr");
              }}
            />
          )}
        </View>
        <Button
          label="Cancel"
          variant="secondary"
          icon={<X size={20} color={c.ink} strokeWidth={2} />}
          onPress={() => setScanning(false)}
        />
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.xs },
  sectionHead: { marginTop: space.md },
  entry: { gap: 4 },
  entryHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  flex: { flex: 1 },
  scanner: {
    height: 280,
    borderRadius: radius.xl,
    borderWidth: 1,
    overflow: "hidden",
  },
});
