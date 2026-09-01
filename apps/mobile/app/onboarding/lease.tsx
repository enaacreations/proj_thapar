import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { CheckCircle2, FileSignature, Info } from "lucide-react-native";
import { LEASE_STATUS_LABELS } from "@proj/shared";
import { useTheme } from "../../src/theme/ThemeProvider";
import { radius, space } from "../../src/theme/tokens";
import { api } from "../../src/api/client";
import { messageOf, useAsync } from "../../src/lib/useAsync";
import { formatDate, formatDateTime, formatRupees } from "../../src/lib/format";
import { AppHeader } from "../../src/components/AppHeader";
import { Badge } from "../../src/components/Badge";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { KeyValue, Toggle } from "../../src/components/Controls";
import { EmptyState } from "../../src/components/EmptyState";
import { Input } from "../../src/components/Input";
import { Screen } from "../../src/components/Screen";
import {
  SignatureImage,
  SignaturePad,
} from "../../src/components/SignaturePad";
import { ErrorState, Loading } from "../../src/components/States";
import { Text } from "../../src/components/Text";
import { useToast } from "../../src/components/Toast";

export default function LeaseScreen() {
  const { c } = useTheme();
  const toast = useToast();
  const { data, loading, error, reload, setData } = useAsync(
    () => api.lease(),
    []
  );

  const [agreed, setAgreed] = useState(false);
  const [name, setName] = useState("");
  const [signature, setSignature] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sign = async () => {
    setBusy(true);
    setFormError(null);
    try {
      setData(await api.signLease(name.trim(), signature));
      toast.success("Signed — that's your agreement done");
    } catch (err) {
      setFormError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  const signed = data?.status === "signed";

  return (
    <>
      <AppHeader title="Rental agreement" />
      <Screen
        refreshing={loading}
        onRefresh={() => void reload()}
        footer={
          data && !signed ? (
            <>
              {formError && (
                <Text variant="label" tone="danger">
                  {formError}
                </Text>
              )}
              <Button
                label="Sign agreement"
                emphasis
                loading={busy}
                disabled={!agreed || name.trim().length < 3 || signature.length < 40}
                onPress={() => void sign()}
              />
            </>
          ) : undefined
        }
      >
        {loading && !data ? (
          <Loading />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void reload()} />
        ) : !data ? (
          <EmptyState
            icon={FileSignature}
            title="No agreement yet"
            description="The hostel office will issue your agreement once your ID is verified. You'll get a notification."
          />
        ) : (
          <>
            <Card style={styles.card}>
              <View style={styles.statusRow}>
                <Text variant="cardTitle" style={styles.flex}>
                  {data.terms.propertyName}
                </Text>
                <Badge
                  label={LEASE_STATUS_LABELS[data.status]}
                  tone={signed ? "success" : "warning"}
                  icon={signed ? CheckCircle2 : undefined}
                />
              </View>
              <Text variant="body" tone="muted">
                {data.terms.roomSummary}
              </Text>
              <Text variant="label" tone="muted">
                {data.terms.propertyAddress}
              </Text>
            </Card>

            <Card style={styles.card}>
              <Text variant="cardTitle">What you're agreeing to</Text>
              <KeyValue
                label="Monthly rent"
                value={formatRupees(data.terms.monthlyRent)}
                mono
              />
              <KeyValue
                label="Security deposit"
                value={formatRupees(data.terms.securityDeposit)}
                mono
              />
              <KeyValue label="Starts" value={formatDate(data.terms.startDate)} />
              <KeyValue label="Ends" value={formatDate(data.terms.endDate)} />
              <KeyValue
                label="Notice period"
                value={`${data.terms.noticePeriodDays} days`}
              />
            </Card>

            <Card style={styles.card}>
              <Text variant="cardTitle">House rules</Text>
              {data.terms.houseRules.map((rule, i) => (
                <View key={rule} style={styles.ruleRow}>
                  <Text variant="mono" tone="muted">
                    {i + 1}.
                  </Text>
                  <Text variant="body" style={styles.flex}>
                    {rule}
                  </Text>
                </View>
              ))}
            </Card>

            {signed ? (
              <Card style={styles.card}>
                <Text variant="cardTitle">Your signature</Text>
                {data.signaturePath && (
                  <View style={[styles.signedBox, { borderColor: c.border }]}>
                    <SignatureImage path={data.signaturePath} />
                  </View>
                )}
                <KeyValue label="Signed by" value={data.signerName ?? "—"} />
                <KeyValue
                  label="Signed on"
                  value={data.signedAt ? formatDateTime(data.signedAt) : "—"}
                />
              </Card>
            ) : (
              <>
                {/* Say plainly what this signature is and isn't. */}
                <Card style={styles.card}>
                  <View style={styles.noteRow}>
                    <Info size={16} color={c.muted} strokeWidth={2} />
                    <Text variant="label" tone="muted" style={styles.flex}>
                      This records your agreement in the app with a timestamp.
                      It isn't an Aadhaar eSign, so the office may still ask you
                      to sign a physical copy.
                    </Text>
                  </View>
                </Card>

                <Card style={styles.card}>
                  <Toggle
                    checked={agreed}
                    onChange={setAgreed}
                    label="I've read and accept these terms"
                  />
                  <Input
                    label="Type your full name"
                    value={name}
                    onChangeText={setName}
                    placeholder="As it appears on your ID"
                    autoCapitalize="words"
                  />
                  <View style={styles.padWrap}>
                    <Text variant="label" style={styles.padLabel}>
                      Signature
                    </Text>
                    <SignaturePad value={signature} onChange={setSignature} />
                  </View>
                </Card>
              </>
            )}
          </>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  statusRow: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  flex: { flex: 1 },
  ruleRow: { flexDirection: "row", gap: space.sm },
  noteRow: { flexDirection: "row", gap: space.sm, alignItems: "flex-start" },
  padWrap: { gap: 6 },
  padLabel: { fontFamily: "DMSans_500Medium" },
  signedBox: { borderWidth: 1, borderRadius: radius.lg, overflow: "hidden" },
});
