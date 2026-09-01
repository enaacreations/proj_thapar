import { useState } from "react";
import { StyleSheet, View } from "react-native";
import * as Location from "expo-location";
import * as LocalAuthentication from "expo-local-authentication";
import {
  CalendarCheck,
  CheckCircle2,
  MapPin,
} from "lucide-react-native";
import type { AttendanceMethod } from "@proj/shared";
import { useTheme } from "../src/theme/ThemeProvider";
import { space } from "../src/theme/tokens";
import { api } from "../src/api/client";
import { messageOf, useAsync } from "../src/lib/useAsync";
import { capturePhoto } from "../src/lib/photos";
import { formatDate, formatTime } from "../src/lib/format";
import { AppHeader } from "../src/components/AppHeader";
import { Badge } from "../src/components/Badge";
import { Button } from "../src/components/Button";
import { Card } from "../src/components/Card";
import { EmptyState } from "../src/components/EmptyState";
import { ProgressRing } from "../src/components/ProgressRing";
import { Screen } from "../src/components/Screen";
import { Sheet, SheetOption } from "../src/components/Sheet";
import { ErrorState, Loading } from "../src/components/States";
import { Text } from "../src/components/Text";
import { useToast } from "../src/components/Toast";

const METHOD_LABELS: Record<AttendanceMethod, string> = {
  facial: "Face",
  biometric: "Fingerprint",
  qr: "QR code",
};

export default function AttendanceScreen() {
  const { c } = useTheme();
  const toast = useToast();
  const { data, loading, error, reload, setData } = useAsync(
    () => api.attendance(),
    []
  );

  const [pickerOpen, setPickerOpen] = useState(false);
  const [marking, setMarking] = useState(false);

  const mark = async (method: AttendanceMethod) => {
    setPickerOpen(false);
    setMarking(true);

    try {
      // Location is the proof the resident is actually on campus.
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        toast.show(
          "Attendance needs your location. Turn it on in your phone's settings.",
          "warning"
        );
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      let photoUri: string | null = null;

      if (method === "facial") {
        const shot = await capturePhoto();
        if (shot.problem) {
          toast.show(shot.problem, "warning");
          return;
        }
        if (shot.uris.length === 0) return;
        photoUri = shot.uris[0] ?? null;
      }

      if (method === "biometric") {
        const hardware = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();

        if (!hardware || !enrolled) {
          toast.show(
            "No fingerprint is set up on this phone. Use face instead.",
            "warning"
          );
          return;
        }

        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: "Mark your attendance",
        });
        if (!result.success) return;
      }

      const summary = await api.markAttendance({
        method,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        photoUri,
      });

      setData(summary);
      toast.success("Attendance marked for today");
    } catch (err) {
      toast.error(messageOf(err));
    } finally {
      setMarking(false);
    }
  };

  const ratio = data ? data.presentDays / Math.max(1, data.totalDays) : 0;

  return (
    <>
      <AppHeader title="Attendance" />
      <Screen
        refreshing={loading}
        onRefresh={() => void reload()}
        footer={
          data && !data.todayMarked ? (
            <Button
              label="Mark today's attendance"
              emphasis
              loading={marking}
              onPress={() => setPickerOpen(true)}
            />
          ) : undefined
        }
      >
        {loading && !data ? (
          <Loading />
        ) : error || !data ? (
          <ErrorState
            message={error ?? "Couldn't load your attendance."}
            onRetry={() => void reload()}
          />
        ) : (
          <>
            <Card>
              <View style={styles.hero}>
                <ProgressRing value={ratio} size={72} strokeWidth={6}>
                  <Text variant="caption" tone="muted">
                    {Math.round(ratio * 100)}%
                  </Text>
                </ProgressRing>
                <View style={styles.heroText}>
                  <Text variant="label" tone="muted">
                    Present this month
                  </Text>
                  <Text variant="metric">
                    {data.presentDays}
                    <Text variant="body" tone="muted">
                      {" "}
                      / {data.totalDays}
                    </Text>
                  </Text>
                  {data.streak > 0 && (
                    <Badge
                      label={`${data.streak}-day streak`}
                      tone="success"
                      icon={CheckCircle2}
                    />
                  )}
                </View>
              </View>
            </Card>

            {data.todayMarked ? (
              <Card style={[styles.card, { borderColor: c.success }]}>
                <View style={styles.doneRow}>
                  <CheckCircle2 size={22} color={c.success} strokeWidth={2} />
                  <Text variant="cardTitle" style={styles.flex}>
                    Today is done
                  </Text>
                </View>
                <Text variant="body" tone="muted">
                  Nothing else to do. Come back tomorrow.
                </Text>
              </Card>
            ) : (
              <Card style={styles.card}>
                <Text variant="cardTitle">Not marked yet today</Text>
                <Text variant="body" tone="muted">
                  It takes about 20 seconds. You'll need to be inside the
                  hostel — we check your location.
                </Text>
              </Card>
            )}

            <Text variant="section" style={styles.sectionHead}>
              History
            </Text>

            {data.records.length === 0 ? (
              <EmptyState
                icon={CalendarCheck}
                title="No attendance yet"
                description="Once you mark your first day, your history builds up here. Your parents can see it too."
              />
            ) : (
              data.records.map((record) => (
                <Card key={record.id} style={styles.record}>
                  <View style={styles.recordHead}>
                    <View style={styles.flex}>
                      <Text variant="cardTitle">{formatDate(record.date)}</Text>
                      <Text variant="label" tone="muted">
                        {formatTime(record.markedAt)} ·{" "}
                        {METHOD_LABELS[record.method]}
                      </Text>
                    </View>
                    <Badge
                      label={record.withinGeofence ? "In hostel" : "Off site"}
                      tone={record.withinGeofence ? "success" : "warning"}
                      icon={MapPin}
                    />
                  </View>
                  <Text variant="caption" tone="muted">
                    {record.locationLabel}
                  </Text>
                </Card>
              ))
            )}
          </>
        )}
      </Screen>

      <Sheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="How do you want to mark it?"
        subtitle="We'll capture your location either way."
      >
        <SheetOption
          label="Take a photo of your face"
          description="Works on every phone"
          onPress={() => void mark("facial")}
        />
        <SheetOption
          label="Use your fingerprint"
          description="Uses your phone's fingerprint sensor"
          onPress={() => void mark("biometric")}
        />
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: "row", alignItems: "center", gap: space.lg },
  heroText: { flex: 1, gap: 4 },
  card: { gap: space.sm },
  doneRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  flex: { flex: 1 },
  sectionHead: { marginTop: space.md },
  record: { gap: 4 },
  recordHead: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
});
