import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Eye, EyeOff, LogOut, Moon, Smartphone, Sun } from "lucide-react-native";
import type { ResidentProfile } from "@proj/shared";
import { useTheme, type ThemePreference } from "../../src/theme/ThemeProvider";
import { radius, space, withAlpha } from "../../src/theme/tokens";
import { api } from "../../src/api/client";
import { useAuth } from "../../src/auth/AuthProvider";
import { useAsync } from "../../src/lib/useAsync";
import { formatDate } from "../../src/lib/format";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { KeyValue, Segmented } from "../../src/components/Controls";
import { Screen } from "../../src/components/Screen";
import { Sheet } from "../../src/components/Sheet";
import { ErrorState, Loading } from "../../src/components/States";
import { Text } from "../../src/components/Text";
import { useToast } from "../../src/components/Toast";

export default function ProfileScreen() {
  const { c, preference, setPreference } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { signOut, session } = useAuth();

  const { data, loading, error, reload, setData } = useAsync(
    () => api.profile(),
    []
  );
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [revealed, setRevealed] = useState<{ dob: boolean; kyc: boolean }>({
    dob: false,
    kyc: false,
  });

  /** Full values are fetched only on demand, never cached in the list payload. */
  const toggleReveal = async (field: "dob" | "kyc") => {
    if (revealed[field]) {
      setRevealed({ ...revealed, [field]: false });
      return;
    }
    try {
      const fresh = await api.unmask(field);
      setData(mergeUnmasked(data, fresh, field));
      setRevealed({ ...revealed, [field]: true });
    } catch {
      toast.error("Couldn't show that right now. Try again.");
    }
  };

  const dobValue =
    revealed.dob && data?.dob.full
      ? formatDate(data.dob.full)
      : (data?.dob.masked ?? "");

  const kycValue =
    revealed.kyc && data?.kycNumber.full
      ? data.kycNumber.full
      : (data?.kycNumber.masked ?? "");

  return (
    <Screen
      contentStyle={{ paddingTop: insets.top + space.md }}
      refreshing={loading}
      onRefresh={() => void reload()}
    >
      <Text variant="title">Profile</Text>

      {loading && !data ? (
        <Loading />
      ) : error || !data ? (
        <ErrorState
          message={error ?? "Couldn't load your profile."}
          onRetry={() => void reload()}
        />
      ) : (
        <>
          <Card>
            <View style={styles.identity}>
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: withAlpha(c.accent, 0.12) },
                ]}
              >
                <Text variant="section" tone="accent">
                  {initials(data.fullName)}
                </Text>
              </View>
              <View style={styles.identityText}>
                <Text variant="section" numberOfLines={1}>
                  {data.fullName}
                </Text>
                <Text variant="mono" tone="muted">
                  {data.id}
                </Text>
              </View>
            </View>
          </Card>

          <Card style={styles.details}>
            <Text variant="cardTitle">Personal details</Text>
            <KeyValue label="Age" value={`${data.age} years`} />
            <KeyValue label="Gender" value={capitalise(data.gender)} />
            <KeyValue label="Mobile" value={data.mobile} mono />

            <RevealRow
              label="Date of birth"
              value={dobValue}
              revealed={revealed.dob}
              onToggle={() => void toggleReveal("dob")}
            />
            <RevealRow
              label={data.kycType === "pan" ? "PAN" : "Aadhaar"}
              value={kycValue}
              revealed={revealed.kyc}
              onToggle={() => void toggleReveal("kyc")}
            />
          </Card>

          <Card style={styles.details}>
            <Text variant="cardTitle">Appearance</Text>
            <Segmented<ThemePreference>
              value={preference}
              onChange={setPreference}
              options={[
                { value: "system", label: "System" },
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
            />
            <View style={styles.themeHint}>
              {preference === "dark" ? (
                <Moon size={14} color={c.muted} strokeWidth={2} />
              ) : preference === "light" ? (
                <Sun size={14} color={c.muted} strokeWidth={2} />
              ) : (
                <Smartphone size={14} color={c.muted} strokeWidth={2} />
              )}
              <Text variant="caption" tone="muted">
                {preference === "system"
                  ? "Follows your phone's setting"
                  : `Always ${preference}`}
              </Text>
            </View>
          </Card>

          <Card style={styles.details}>
            <Text variant="cardTitle">Security</Text>
            <KeyValue
              label="MPIN"
              value={session?.mpinSet ? "Set" : "Not set"}
            />
            <KeyValue
              label="Biometrics"
              value={session?.biometricEnabled ? "On" : "Off"}
            />
          </Card>

          <Button
            label="Sign out"
            variant="secondary"
            icon={<LogOut size={20} color={c.ink} strokeWidth={2} />}
            onPress={() => setConfirmSignOut(true)}
          />
        </>
      )}

      <Sheet
        visible={confirmSignOut}
        onClose={() => setConfirmSignOut(false)}
        title="Sign out?"
        subtitle="You'll need your MPIN or an OTP to get back in."
      >
        <Button
          label="Yes, sign out"
          variant="destructive"
          onPress={() => {
            setConfirmSignOut(false);
            void signOut().then(() => router.replace("/(auth)/welcome"));
          }}
        />
        <Button
          label="Stay signed in"
          variant="secondary"
          onPress={() => setConfirmSignOut(false)}
        />
      </Sheet>
    </Screen>
  );
}

function RevealRow({
  label,
  value,
  revealed,
  onToggle,
}: {
  label: string;
  value: string;
  revealed: boolean;
  onToggle: () => void;
}) {
  const { c } = useTheme();
  const Icon = revealed ? EyeOff : Eye;

  return (
    <View style={styles.revealRow}>
      <Text variant="label" tone="muted" style={styles.revealLabel}>
        {label}
      </Text>
      <Text variant="mono" style={styles.revealValue} numberOfLines={1}>
        {value}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={revealed ? `Hide ${label}` : `Show ${label}`}
        onPress={onToggle}
        hitSlop={10}
        style={styles.revealButton}
      >
        <Icon size={18} color={c.accentStrong} strokeWidth={2} />
      </Pressable>
    </View>
  );
}

function mergeUnmasked(
  current: ResidentProfile | null,
  fresh: ResidentProfile,
  field: "dob" | "kyc"
): ResidentProfile {
  if (!current) return fresh;
  return field === "dob"
    ? { ...current, dob: fresh.dob }
    : { ...current, kycNumber: fresh.kycNumber };
}

const initials = (name: string) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

const capitalise = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);

const styles = StyleSheet.create({
  identity: { flexDirection: "row", alignItems: "center", gap: space.md },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  identityText: { flex: 1, gap: 2 },
  details: { gap: space.md },
  themeHint: { flexDirection: "row", alignItems: "center", gap: 6 },
  revealRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  revealLabel: { width: 110 },
  revealValue: { flex: 1, textAlign: "right" },
  revealButton: { padding: 4 },
});
