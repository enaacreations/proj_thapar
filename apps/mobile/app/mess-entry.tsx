import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import * as Location from "expo-location";
import * as LocalAuthentication from "expo-local-authentication";
import { CheckCircle2, MapPin, QrCode, ScanFace } from "lucide-react-native";
import {
  MEAL_LABELS,
  mealBeingServed,
  type AttendanceMethod,
  type LivenessChallenge,
  type MessPass,
  type SelfMessEntryMethod,
} from "@proj/shared";
import { useTheme } from "../src/theme/ThemeProvider";
import { radius, space } from "../src/theme/tokens";
import { api, ApiRequestError } from "../src/api/client";
import { messageOf, useAsync } from "../src/lib/useAsync";
import { captureSelfie } from "../src/lib/photos";
import { formatDateTime } from "../src/lib/format";
import { AppHeader } from "../src/components/AppHeader";
import { Badge } from "../src/components/Badge";
import { Button } from "../src/components/Button";
import { Card } from "../src/components/Card";
import { EmptyState } from "../src/components/EmptyState";
import { Screen } from "../src/components/Screen";
import { Sheet, SheetOption } from "../src/components/Sheet";
import { Text } from "../src/components/Text";
import { useToast } from "../src/components/Toast";

const METHOD_LABELS: Record<AttendanceMethod, string> = {
  facial: "Face",
  biometric: "Fingerprint",
  qr: "Counter scan",
};

/** Whether an entry was made today, so "already had this meal" is about today. */
function isToday(iso: string): boolean {
  return new Date(iso).toDateString() === new Date().toDateString();
}

/**
 * Three ways a plate gets recorded, and they are not equally strong.
 *
 * The counter scanning the rotating pass is the best of them: it is staff who
 * attest to it, not the resident's own phone. Face and fingerprint exist for
 * when that isn't practical, and both are geofenced — the API refuses either
 * one taken away from the mess, which is the only thing standing in for the
 * person at the counter.
 */
export default function MessEntryScreen() {
  const { c } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const entries = useAsync(() => api.messEntries(), []);
  const face = useAsync(() => api.faceStatus(), []);

  const [pass, setPass] = useState<MessPass | null>(null);
  const [passError, setPassError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [recording, setRecording] = useState(false);

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

  const meal = mealBeingServed();
  const servedThisMeal =
    entries.data?.find((e) => e.meal === meal && isToday(e.enteredAt)) ?? null;

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

  const record = async (
    method: SelfMessEntryMethod,
    faceCheck?: {
      token: string;
      neutralBase64: string;
      challengeBase64: string;
    }
  ) => {
    setPickerOpen(false);
    setRecording(true);

    try {
      // Location isn't optional here the way it is for the counter — the API
      // refuses an entry from outside the fence, so there's nothing to send
      // without it.
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        toast.show(
          "Recording a meal yourself needs your location. Turn it on in your phone's settings, or ask the counter to scan your pass.",
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
          promptMessage: `Record your ${MEAL_LABELS[meal].toLowerCase()}`,
        });
        if (!result.success) return;
      }

      const { recorded } = await api.recordMessEntry({
        method,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        photoBase64: faceCheck?.neutralBase64,
        livenessToken: faceCheck?.token,
        livenessPhotoBase64: faceCheck?.challengeBase64,
      });

      setLiveness(null);
      await entries.reload();

      if (recorded) {
        toast.success(`${MEAL_LABELS[meal]} recorded`);
      } else {
        toast.show(`You've already had ${MEAL_LABELS[meal].toLowerCase()} today.`, "warning");
      }
    } catch (err) {
      // A resident who hasn't registered a face can't be checked against
      // anything — send them to do it rather than repeating the error.
      if (err instanceof ApiRequestError && err.code === "face_not_enrolled") {
        setLiveness(null);
        toast.show("Set up the face check first, then use your face here.", "warning");
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
      setRecording(false);
    }
  };

  /** Asks the server what to do this time, and opens the two-photo sheet. */
  const restartFacial = async (problem: string | null = null) => {
    try {
      const challenge = await api.messLivenessChallenge();
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

      await record("facial", {
        token: liveness.challenge.token,
        neutralBase64: liveness.neutralBase64,
        challengeBase64: shot.base64,
      });
    } finally {
      setCapturing(false);
    }
  };

  return (
    <>
      <AppHeader title="Mess entry" />
      <Screen
        refreshing={entries.loading}
        onRefresh={() => void entries.reload()}
        footer={
          servedThisMeal ? undefined : (
            <Button
              label="Record it without the counter"
              loading={recording}
              onPress={() => setPickerOpen(true)}
            />
          )
        }
      >
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

        {servedThisMeal ? (
          <Card style={[styles.card, { borderColor: c.success }]}>
            <View style={styles.row}>
              <CheckCircle2 size={22} color={c.success} strokeWidth={2} />
              <Text variant="cardTitle" style={styles.flex}>
                {MEAL_LABELS[meal]} is done
              </Text>
            </View>
            <Text variant="body" tone="muted">
              Recorded at {formatDateTime(servedThisMeal.enteredAt)} ·{" "}
              {METHOD_LABELS[servedThisMeal.method]}. One plate per meal, so
              there's nothing else to do until the next one.
            </Text>
          </Card>
        ) : (
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
        )}

        {!servedThisMeal && face.data && !face.data.enrolled && (
          <Card style={[styles.card, { borderColor: c.warning }]}>
            <View style={styles.row}>
              <ScanFace size={22} color={c.warning} strokeWidth={2} />
              <Text variant="cardTitle" style={styles.flex}>
                Face check not set up
              </Text>
            </View>
            <Text variant="body" tone="muted">
              Register your face once and you can record a meal without the
              counter. Until then, use the QR code or your fingerprint.
            </Text>
            <Button
              label="Set up face check"
              onPress={() => router.push("/face-setup")}
            />
          </Card>
        )}

        <Text variant="section" style={styles.sectionHead}>
          Recent entries
        </Text>

        {!entries.data || entries.data.length === 0 ? (
          <EmptyState
            icon={QrCode}
            title="No entries yet"
            description="Every meal you collect is logged here so meal counts stay accurate."
          />
        ) : (
          entries.data.map((entry) => (
            <Card key={entry.id} style={styles.entry}>
              <View style={styles.entryHead}>
                <View style={styles.flex}>
                  <Text variant="cardTitle">{MEAL_LABELS[entry.meal]}</Text>
                  <Text variant="label" tone="muted">
                    {formatDateTime(entry.enteredAt)} ·{" "}
                    {METHOD_LABELS[entry.method]}
                  </Text>
                </View>
                <Badge label="Entered" tone="success" icon={CheckCircle2} />
              </View>
              {entry.locationLabel && (
                <View style={styles.row}>
                  <MapPin
                    size={14}
                    color={entry.withinGeofence === false ? c.warning : c.muted}
                    strokeWidth={2}
                  />
                  <Text variant="caption" tone="muted">
                    {entry.locationLabel}
                  </Text>
                </View>
              )}
            </Card>
          ))
        )}
      </Screen>

      <Sheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title={`Record ${MEAL_LABELS[meal].toLowerCase()} yourself`}
        subtitle="You'll need to be at the mess — we check your location either way."
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
          onPress={() => void record("biometric")}
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
              loading={capturing || recording}
              onPress={() => void captureStep()}
            />
          </>
        )}
      </Sheet>
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
  row: { flexDirection: "row", alignItems: "center", gap: space.xs },
  flex: { flex: 1 },
  sectionHead: { marginTop: space.md },
  entry: { gap: 4 },
  entryHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
});
