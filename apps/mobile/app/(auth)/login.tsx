import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import * as LocalAuthentication from "expo-local-authentication";
import { Fingerprint } from "lucide-react-native";
import { useTheme } from "../../src/theme/ThemeProvider";
import { space } from "../../src/theme/tokens";
import { api } from "../../src/api/client";
import { useAuth } from "../../src/auth/AuthProvider";
import { messageOf } from "../../src/lib/useAsync";
import { AppHeader } from "../../src/components/AppHeader";
import { Button } from "../../src/components/Button";
import { Input } from "../../src/components/Input";
import { PinPad } from "../../src/components/PinPad";
import { Screen } from "../../src/components/Screen";
import { Text } from "../../src/components/Text";
import { useToast } from "../../src/components/Toast";

type Mode = "mobile" | "otp" | "mpin";

export default function Login() {
  const { c } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { signIn, lastMobile } = useAuth();

  // A returning device already knows the number, so it starts on the MPIN pad.
  const [mode, setMode] = useState<Mode>(lastMobile ? "mpin" : "mobile");
  const [mobile, setMobile] = useState(lastMobile ?? "");
  const [otp, setOtp] = useState("");
  const [mpin, setMpin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [secondsLeft]);

  const sendOtp = async () => {
    if (!/^\d{10}$/.test(mobile)) {
      setError("Enter a 10-digit mobile number.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { expiresInSeconds } = await api.sendOtp(mobile);
      setSecondsLeft(expiresInSeconds);
      setMode("otp");
      toast.show(`OTP sent to ${mobile}`);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async () => {
    setBusy(true);
    setError(null);
    try {
      const session = await api.verifyOtp(mobile, otp);
      await signIn(session, mobile);
      router.replace(session.mpinSet ? "/(tabs)" : "/(auth)/mpin-setup");
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  const loginWithMpin = async (code: string) => {
    setBusy(true);
    setError(null);
    try {
      const session = await api.mpinLogin(mobile, code);
      await signIn(session, mobile);
      router.replace("/(tabs)");
    } catch (err) {
      setError(messageOf(err));
      setMpin("");
    } finally {
      setBusy(false);
    }
  };

  const useBiometrics = async () => {
    const available = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();

    if (!available || !enrolled) {
      toast.show("No fingerprint or face is set up on this phone.", "warning");
      return;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Sign in to Thapar",
      fallbackLabel: "Use MPIN",
    });

    if (!result.success) return;
    // The device vouched for the user; the OTP step confirms it server-side.
    await sendOtp();
  };

  return (
    <>
      <AppHeader
        title={mode === "otp" ? "Enter OTP" : "Sign in"}
        subtitle={mode === "otp" ? `Sent to ${mobile}` : undefined}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {mode === "mpin" ? (
          <Screen>
            <View style={styles.block}>
              <Text variant="title">Welcome back</Text>
              <Text variant="body" tone="muted">
                Enter the 6-digit MPIN for {mobile}.
              </Text>
            </View>

            <PinPad
              value={mpin}
              onChange={(next) => {
                setMpin(next);
                setError(null);
                if (next.length === 6) void loginWithMpin(next);
              }}
              error={error}
              busy={busy}
            />

            <View style={styles.altActions}>
              <Button
                label="Use fingerprint or face"
                variant="secondary"
                icon={<Fingerprint size={20} color={c.ink} strokeWidth={2} />}
                onPress={() => void useBiometrics()}
              />
              <Button
                label="Sign in with OTP instead"
                variant="link"
                fullWidth={false}
                onPress={() => {
                  setMode("mobile");
                  setError(null);
                }}
              />
            </View>
          </Screen>
        ) : mode === "mobile" ? (
          <Screen
            footer={
              <Button
                label="Send OTP"
                emphasis
                loading={busy}
                onPress={() => void sendOtp()}
              />
            }
          >
            <View style={styles.block}>
              <Text variant="title">What's your mobile number?</Text>
              <Text variant="body" tone="muted">
                We'll text you a 6-digit code to confirm it's you.
              </Text>
              <Input
                value={mobile}
                onChangeText={(text) =>
                  setMobile(text.replace(/\D/g, "").slice(0, 10))
                }
                placeholder="10-digit number"
                keyboardType="number-pad"
                autoFocus
                error={error}
              />
            </View>
          </Screen>
        ) : (
          <Screen
            footer={
              <Button
                label="Verify and continue"
                emphasis
                loading={busy}
                disabled={otp.length !== 6}
                onPress={() => void verifyOtp()}
              />
            }
          >
            <View style={styles.block}>
              <Input
                label="6-digit OTP"
                value={otp}
                onChangeText={(text) =>
                  setOtp(text.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="123456"
                keyboardType="number-pad"
                autoFocus
                error={error}
              />
              {secondsLeft > 0 ? (
                <Text variant="label" tone="muted">
                  Code expires in {secondsLeft}s
                </Text>
              ) : (
                <Button
                  label="Resend OTP"
                  variant="link"
                  fullWidth={false}
                  onPress={() => void sendOtp()}
                />
              )}
              <Button
                label="Change number"
                variant="link"
                fullWidth={false}
                onPress={() => {
                  setMode("mobile");
                  setOtp("");
                  setError(null);
                }}
              />
            </View>
          </Screen>
        )}
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  block: { gap: space.md },
  altActions: { gap: space.sm, marginTop: space.lg, alignItems: "center" },
});
