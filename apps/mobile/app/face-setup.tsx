import { useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { ScanFace, ShieldCheck } from "lucide-react-native";
import { useTheme } from "../src/theme/ThemeProvider";
import { radius, space } from "../src/theme/tokens";
import { api } from "../src/api/client";
import { messageOf, useAsync } from "../src/lib/useAsync";
import { captureSelfie } from "../src/lib/photos";
import { formatDateTime } from "../src/lib/format";
import { AppHeader } from "../src/components/AppHeader";
import { Button } from "../src/components/Button";
import { Card } from "../src/components/Card";
import { Screen } from "../src/components/Screen";
import { ErrorState, Loading } from "../src/components/States";
import { Text } from "../src/components/Text";
import { useToast } from "../src/components/Toast";

/**
 * Registers the face that facial attendance is checked against. Until this is
 * done there is nothing to compare a selfie to, so the attendance screen sends
 * residents here rather than letting an unverifiable photo through.
 */
export default function FaceSetupScreen() {
  const { c } = useTheme();
  const toast = useToast();
  const router = useRouter();
  const { data, loading, error, reload, setData } = useAsync(
    () => api.faceStatus(),
    []
  );

  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const enrol = async () => {
    setSaving(true);
    try {
      const shot = await captureSelfie();
      if (shot.problem) {
        toast.show(shot.problem, "warning");
        return;
      }
      if (!shot.base64) return;

      setPreview(shot.uri);
      setData(await api.enrolFace(shot.base64));
      toast.success("Face check is set up");
      router.back();
    } catch (err) {
      // The server explains exactly what was wrong with the shot — no face,
      // more than one, too dark — so pass that through rather than flattening
      // it into "something went wrong".
      setPreview(null);
      toast.error(messageOf(err));
    } finally {
      setSaving(false);
    }
  };

  const enrolled = data?.enrolled ?? false;

  return (
    <>
      <AppHeader title="Face check" />
      <Screen
        refreshing={loading}
        onRefresh={() => void reload()}
        footer={
          data ? (
            <Button
              label={enrolled ? "Retake my face photo" : "Set up face check"}
              emphasis
              loading={saving}
              onPress={() => void enrol()}
            />
          ) : undefined
        }
      >
        {loading && !data ? (
          <Loading />
        ) : error || !data ? (
          <ErrorState
            message={error ?? "Couldn't load your face check."}
            onRetry={() => void reload()}
          />
        ) : (
          <>
            <Card style={styles.hero}>
              <View style={[styles.badge, { backgroundColor: c.mutedBg }]}>
                {preview ? (
                  <Image source={{ uri: preview }} style={styles.preview} />
                ) : (
                  <ScanFace size={40} color={c.accent} strokeWidth={1.5} />
                )}
              </View>
              <Text variant="cardTitle">
                {enrolled ? "Your face is registered" : "Not set up yet"}
              </Text>
              <Text variant="body" tone="muted" style={styles.centred}>
                {enrolled
                  ? "Attendance photos are checked against this. Retake it if your appearance has changed."
                  : "Take one clear photo of your face. Every attendance photo you take later is checked against it."}
              </Text>
              {enrolled && data.enrolledAt && (
                <Text variant="caption" tone="muted">
                  Registered {formatDateTime(data.enrolledAt)}
                </Text>
              )}
            </Card>

            <Card style={styles.card}>
              <View style={styles.headRow}>
                <ShieldCheck size={20} color={c.success} strokeWidth={2} />
                <Text variant="cardTitle" style={styles.flex}>
                  For a photo that works
                </Text>
              </View>
              <Text variant="body" tone="muted">
                Face the light rather than a window behind you. Hold the phone
                at arm's length so your face fills the frame. Take off sunglasses
                and anything covering your face. Make sure nobody else is in shot.
              </Text>
            </Card>

            <Card style={styles.card}>
              <Text variant="cardTitle">What gets stored</Text>
              <Text variant="body" tone="muted">
                The hostel keeps a mathematical summary of your face, not this
                photo — it can't be turned back into a picture of you. If you
                can't get the check to accept you, the hostel office can reset it.
              </Text>
            </Card>
          </>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", gap: space.sm },
  badge: {
    width: 88,
    height: 88,
    borderRadius: radius.xl,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  preview: { width: "100%", height: "100%" },
  centred: { textAlign: "center" },
  card: { gap: space.sm },
  headRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  flex: { flex: 1 },
});
