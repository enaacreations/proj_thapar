import { useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { Camera, CheckCircle2, Info, Trash2 } from "lucide-react-native";
import {
  KYC_DOCUMENT_LABELS,
  KYC_STATUS_LABELS,
  type KycDocumentType,
} from "@proj/shared";
import { useTheme } from "../../src/theme/ThemeProvider";
import { radius, space } from "../../src/theme/tokens";
import { api } from "../../src/api/client";
import { messageOf, useAsync } from "../../src/lib/useAsync";
import { capturePhoto, pickPhotos } from "../../src/lib/photos";
import { AppHeader } from "../../src/components/AppHeader";
import { Badge } from "../../src/components/Badge";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { Screen } from "../../src/components/Screen";
import { Sheet, SheetOption } from "../../src/components/Sheet";
import { ErrorState, Loading } from "../../src/components/States";
import { Text } from "../../src/components/Text";
import { useToast } from "../../src/components/Toast";

const SLOTS: KycDocumentType[] = ["aadhaar_front", "aadhaar_back", "photo", "pan"];

export default function KycScreen() {
  const { c } = useTheme();
  const toast = useToast();
  const { data, loading, error, reload, setData } = useAsync(
    () => api.kyc(),
    []
  );

  const [picking, setPicking] = useState<KycDocumentType | null>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (type: KycDocumentType, source: "camera" | "library") => {
    setPicking(null);
    const result = source === "camera" ? await capturePhoto() : await pickPhotos(1);

    if (result.problem) {
      toast.show(result.problem, "warning");
      return;
    }
    const uri = result.uris[0];
    if (!uri) return;

    try {
      setData(await api.uploadKycDocument(type, uri));
      toast.success(`${KYC_DOCUMENT_LABELS[type]} added`);
    } catch (err) {
      toast.error(messageOf(err));
    }
  };

  const remove = async (id: string) => {
    try {
      setData(await api.removeKycDocument(id));
    } catch (err) {
      toast.error(messageOf(err));
    }
  };

  const submit = async () => {
    setBusy(true);
    try {
      setData(await api.submitKyc());
      toast.success("Sent for checking");
    } catch (err) {
      toast.error(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  const locked = data?.status === "verified" || data?.status === "under_review";
  const canSubmit = data != null && data.missing.length === 0 && !locked;

  return (
    <>
      <AppHeader title="ID documents" />
      <Screen
        refreshing={loading}
        onRefresh={() => void reload()}
        footer={
          data && !locked ? (
            <Button
              label="Send for checking"
              emphasis
              loading={busy}
              disabled={!canSubmit}
              onPress={() => void submit()}
            />
          ) : undefined
        }
      >
        {loading && !data ? (
          <Loading />
        ) : error || !data ? (
          <ErrorState
            message={error ?? "Couldn't load your documents."}
            onRetry={() => void reload()}
          />
        ) : (
          <>
            <Card style={styles.card}>
              <View style={styles.statusRow}>
                <Text variant="cardTitle" style={styles.flex}>
                  Status
                </Text>
                <Badge
                  label={KYC_STATUS_LABELS[data.status]}
                  tone={
                    data.status === "verified"
                      ? "success"
                      : data.status === "rejected"
                        ? "danger"
                        : data.status === "under_review"
                          ? "info"
                          : "neutral"
                  }
                  icon={data.status === "verified" ? CheckCircle2 : undefined}
                />
              </View>

              {data.status === "rejected" && data.rejectionReason && (
                <Text variant="body" tone="danger">
                  {data.rejectionReason}
                </Text>
              )}
              {data.status === "under_review" && (
                <Text variant="body" tone="muted">
                  The office is checking your documents. This usually takes a
                  day.
                </Text>
              )}
              {data.status === "verified" && (
                <Text variant="body" tone="muted">
                  Checked by {data.reviewedBy}. Nothing more to do here.
                </Text>
              )}
            </Card>

            {/* Being explicit beats implying a government check happened. */}
            <Card style={[styles.card, { borderColor: c.border }]}>
              <View style={styles.noteRow}>
                <Info size={16} color={c.muted} strokeWidth={2} />
                <Text variant="label" tone="muted" style={styles.flex}>
                  A person at the hostel office checks these against your
                  originals. Your number stays masked everywhere in the app.
                </Text>
              </View>
            </Card>

            {SLOTS.map((slot) => {
              const doc = data.documents.find((d) => d.type === slot);
              const required = slot !== "pan";

              return (
                <Card key={slot} style={styles.card}>
                  <View style={styles.slotHead}>
                    <View style={styles.flex}>
                      <Text variant="cardTitle">
                        {KYC_DOCUMENT_LABELS[slot]}
                      </Text>
                      <Text variant="label" tone="muted">
                        {required ? "Required" : "Optional"}
                      </Text>
                    </View>
                    {doc && (
                      <Badge label="Added" tone="success" icon={CheckCircle2} />
                    )}
                  </View>

                  {doc ? (
                    <View style={styles.docRow}>
                      <Image source={{ uri: doc.uri }} style={styles.thumb} />
                      {!locked && (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Remove ${KYC_DOCUMENT_LABELS[slot]}`}
                          onPress={() => void remove(doc.id)}
                          hitSlop={8}
                          style={styles.removeButton}
                        >
                          <Trash2 size={18} color={c.danger} strokeWidth={2} />
                        </Pressable>
                      )}
                    </View>
                  ) : (
                    !locked && (
                      <Button
                        label="Add photo"
                        variant="secondary"
                        icon={<Camera size={20} color={c.ink} strokeWidth={2} />}
                        onPress={() => setPicking(slot)}
                      />
                    )
                  )}
                </Card>
              );
            })}

            {data.missing.length > 0 && !locked && (
              <Text variant="label" tone="muted">
                Still needed:{" "}
                {data.missing
                  .map((m) => KYC_DOCUMENT_LABELS[m].toLowerCase())
                  .join(", ")}
                .
              </Text>
            )}
          </>
        )}
      </Screen>

      <Sheet
        visible={picking !== null}
        onClose={() => setPicking(null)}
        title={picking ? KYC_DOCUMENT_LABELS[picking] : ""}
        subtitle="Make sure all four corners are visible and the text is readable."
      >
        <SheetOption
          label="Take a photo"
          onPress={() => picking && void upload(picking, "camera")}
        />
        <SheetOption
          label="Choose from gallery"
          onPress={() => picking && void upload(picking, "library")}
        />
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  statusRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  noteRow: { flexDirection: "row", gap: space.sm, alignItems: "flex-start" },
  slotHead: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  flex: { flex: 1 },
  docRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  thumb: { width: 96, height: 64, borderRadius: radius.md },
  removeButton: { padding: 8 },
});
