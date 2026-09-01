import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import * as LocalAuthentication from "expo-local-authentication";
import { ScanFace } from "lucide-react-native";
import { useTheme } from "../../src/theme/ThemeProvider";
import { space } from "../../src/theme/tokens";
import { api } from "../../src/api/client";
import { useAuth } from "../../src/auth/AuthProvider";
import { messageOf } from "../../src/lib/useAsync";
import { AppHeader } from "../../src/components/AppHeader";
import { Button } from "../../src/components/Button";
import { PinPad } from "../../src/components/PinPad";
import { Screen } from "../../src/components/Screen";
import { Text } from "../../src/components/Text";
import { useToast } from "../../src/components/Toast";

type Stage = "choose" | "confirm" | "biometric";

export default function MpinSetup() {
  const { c } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { completeMpinSetup } = useAuth();

  const [stage, setStage] = useState<Stage>("choose");
  const [first, setFirst] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const finish = async (biometricEnabled: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const session = await api.setMpin({ mpin: first, biometricEnabled });
      await completeMpinSetup(session, biometricEnabled);
      toast.success("You're all set");
      router.replace("/(tabs)");
    } catch (err) {
      setError(messageOf(err));
      setStage("choose");
      setFirst("");
      setConfirm("");
    } finally {
      setBusy(false);
    }
  };

  const enableBiometrics = async () => {
    const available = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();

    if (!available || !enrolled) {
      toast.show(
        "This phone has no fingerprint or face set up. You can turn it on later from Profile.",
        "warning"
      );
      await finish(false);
      return;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Confirm it's you",
    });
    await finish(result.success);
  };

  if (stage === "biometric") {
    return (
      <>
        <AppHeader title="Faster sign in" back={false} />
        <Screen
          footer={
            <>
              <Button
                label="Turn on fingerprint or face"
                emphasis
                loading={busy}
                icon={<ScanFace size={20} color={c.onAccent} strokeWidth={2} />}
                onPress={() => void enableBiometrics()}
              />
              <Button
                label="Skip for now"
                variant="ghost"
                onPress={() => void finish(false)}
              />
            </>
          }
        >
          <View style={styles.block}>
            <Text variant="title">Skip the MPIN next time</Text>
            <Text variant="body" tone="muted">
              Use your phone's fingerprint or face unlock to sign in. Your MPIN
              still works as a backup.
            </Text>
          </View>
        </Screen>
      </>
    );
  }

  const isConfirmStage = stage === "confirm";
  const value = isConfirmStage ? confirm : first;

  return (
    <>
      <AppHeader title="Set your MPIN" back={false} />
      <Screen>
        <View style={styles.block}>
          <Text variant="title">
            {isConfirmStage ? "Enter it once more" : "Choose a 6-digit MPIN"}
          </Text>
          <Text variant="body" tone="muted">
            {isConfirmStage
              ? "Just to make sure it's the one you meant."
              : "You'll use this every time you open the app. Avoid your birth year."}
          </Text>
        </View>

        <PinPad
          value={value}
          error={error}
          busy={busy}
          onChange={(next) => {
            setError(null);

            if (!isConfirmStage) {
              setFirst(next);
              if (next.length === 6) setStage("confirm");
              return;
            }

            setConfirm(next);
            if (next.length === 6) {
              if (next === first) {
                setStage("biometric");
              } else {
                setError("Those two MPINs don't match. Try again.");
                setFirst("");
                setConfirm("");
                setStage("choose");
              }
            }
          }}
        />

        {isConfirmStage && (
          <Button
            label="Start over"
            variant="link"
            fullWidth={false}
            style={styles.startOver}
            onPress={() => {
              setFirst("");
              setConfirm("");
              setError(null);
              setStage("choose");
            }}
          />
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.sm },
  startOver: { alignSelf: "center", marginTop: space.md },
});
