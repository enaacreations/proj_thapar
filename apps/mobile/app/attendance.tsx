import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import * as LocalAuthentication from "expo-local-authentication";
import {
  CalendarCheck,
  CheckCircle2,
  MapPin,
  ScanFace,
} from "lucide-react-native";
import type { AttendanceMethod, LivenessChallenge } from "@proj/shared";
import { useTheme } from "../src/theme/ThemeProvider";
import { space } from "../src/theme/tokens";
import { api, ApiRequestError } from "../src/api/client";
import { messageOf, useAsync } from "../src/lib/useAsync";
import { captureSelfie } from "../src/lib/photos";
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
  const router = useRouter();
  const { data, loading, error, reload, setData } = useAsync(
    () => api.attendance(),
    []
  );
  const face = useAsync(() => api.faceStatus(), []);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [marking, setMarking] = useState(false);

  /**
   * The face check takes two photos: one looking straight at the camera, and
   * one doing whatever the server just asked for. This holds where in that
   * pair we are. Null when the face check isn't running.
   */
  const [liveness, setLiveness] = useState<{
    challenge: LivenessChallenge;
    neutralBase64: string | null;
    problem: string | null;
  } | null>(null);
  const [capturing, setCapturing] = useState(false);

  const mark = async (
    method: AttendanceMethod,
    faceCheck?: {
      token: string;
      neutralBase64: string;
      challengeBase64: string;
    }
  ) => {
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
        photoBase64: faceCheck?.neutralBase64,
        livenessToken: faceCheck?.token,
        livenessPhotoBase64: faceCheck?.challengeBase64,
      });

      setData(summary);
      setLiveness(null);
      toast.success("Attendance marked for today");
    } catch (err) {
      // A resident who hasn't registered a face can't be checked against
      // anything — send them to do it rather than repeating the error.
      if (
        err instanceof ApiRequestError &&
        err.code === "face_not_enrolled"
      ) {
        setLiveness(null);
        toast.show("Set up the face check first, then mark attendance.", "warning");
        void face.reload();
        router.push("/face-setup");
        return;
      }

      // A failed or timed-out check is worth another go, but it needs a fresh
      // challenge: the action changes, which is what makes it a check at all.
      if (
        err instanceof ApiRequestError &&
        (err.code === "liveness_failed" ||
          err.code === "face_not_detected" ||
          err.code === "face_multiple" ||
          err.code === "face_too_far" ||
          err.code === "face_low_quality" ||
          err.code === "face_bad_image")
      ) {
        await restartFacial(messageOf(err));
        return;
      }

      setLiveness(null);
      toast.error(messageOf(err));
    } finally {
      setMarking(false);
    }
  };

  /** Asks the server what to do this time, and opens the two-photo sheet. */
  const restartFacial = async (problem: string | null = null) => {
    try {
      const challenge = await api.livenessChallenge();
      setLiveness({ challenge, neutralBase64: null, problem });
    } catch (err) {
      setLiveness(null);
      toast.error(messageOf(err));
    }
  };

  const startFacial = () => {
    setPickerOpen(false);
    if (face.data && !face.data.enrolled) {
      router.push("/face-setup");
      return;
    }
    void restartFacial();
  };

  /**
   * Takes one of the two frames. Neither photo is judged here — the phone is
   * the resident's, so a check it could skip wouldn't be worth making. All
   * this does is get a usable shot to the server.
   */
  const captureStep = async () => {
    if (!liveness) return;
    setCapturing(true);

    try {
      const shot = await captureSelfie();
      if (shot.problem) {
        toast.show(shot.problem, "warning");
        return;
      }
      if (!shot.base64) return;

      if (!liveness.neutralBase64) {
        setLiveness({ ...liveness, neutralBase64: shot.base64, problem: null });
        return;
      }

      await mark("facial", {
        token: liveness.challenge.token,
        neutralBase64: liveness.neutralBase64,
        challengeBase64: shot.base64,
      });
    } finally {
      setCapturing(false);
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
                  hostel — we check your location. The face option takes two
                  photos: one straight at the camera, and one doing whatever
                  we ask, so a photo of you can't be held up instead.
                </Text>
              </Card>
            )}

            {face.data && !face.data.enrolled && (
              <Card style={[styles.card, { borderColor: c.warning }]}>
                <View style={styles.doneRow}>
                  <ScanFace size={22} color={c.warning} strokeWidth={2} />
                  <Text variant="cardTitle" style={styles.flex}>
                    Face check not set up
                  </Text>
                </View>
                <Text variant="body" tone="muted">
                  Register your face once and attendance photos get checked
                  against it. Until then, use your fingerprint.
                </Text>
                <Button
                  label="Set up face check"
                  onPress={() => router.push("/face-setup")}
                />
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
          description={
            face.data && !face.data.enrolled
              ? "Needs a one-time setup first"
              : "Two photos, checked against your registered face"
          }
          onPress={startFacial}
        />
        <SheetOption
          label="Use your fingerprint"
          description="Uses your phone's fingerprint sensor"
          onPress={() => void mark("biometric")}
        />
      </Sheet>

      {/* Two photos, one prompt each. The second prompt isn't known until the
          server hands it over, which is what a held-up photo can't answer. */}
      <Sheet
        visible={liveness !== null}
        onClose={() => setLiveness(null)}
        title="Face check"
        subtitle={
          liveness?.neutralBase64
            ? "Step 2 of 2"
            : "Step 1 of 2 — two quick photos"
        }
      >
        {liveness && (
          <>
            <Card style={[styles.card, { borderColor: c.accent }]}>
              <Text variant="cardTitle">
                {liveness.neutralBase64
                  ? liveness.challenge.instruction
                  : "Look straight at the camera"}
              </Text>
              <Text variant="body" tone="muted">
                {liveness.neutralBase64
                  ? "Hold it while the camera opens, then take the photo."
                  : "Keep a neutral face for this one — we'll ask you to do something for the second."}
              </Text>
            </Card>

            {liveness.problem && (
              <Text variant="label" tone="danger">
                {liveness.problem}
              </Text>
            )}

            <Button
              label={
                liveness.neutralBase64
                  ? "Take the second photo"
                  : "Take the first photo"
              }
              emphasis
              loading={capturing || marking}
              onPress={() => void captureStep()}
            />
          </>
        )}
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
