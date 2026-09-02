import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { CheckCircle2 } from "lucide-react-native";
import {
  kycNumberProblem,
  normaliseKycNumber,
  type RegistrationBody,
} from "@proj/shared";
import { useTheme } from "../../src/theme/ThemeProvider";
import { layout, radius, space } from "../../src/theme/tokens";
import { api } from "../../src/api/client";
import { messageOf } from "../../src/lib/useAsync";
import { AppHeader } from "../../src/components/AppHeader";
import { Button } from "../../src/components/Button";
import { Calendar } from "../../src/components/Calendar";
import { Segmented } from "../../src/components/Controls";
import { Field, Input } from "../../src/components/Input";
import { PhoneInput } from "../../src/components/PhoneInput";
import { Screen } from "../../src/components/Screen";
import { Text } from "../../src/components/Text";
import { formatDate, toIsoDate } from "../../src/lib/format";

type Step = "name" | "dob" | "kyc" | "mobile" | "done";

const ORDER: Step[] = ["name", "dob", "kyc", "mobile"];

export default function Register() {
  const { c } = useTheme();
  const router = useRouter();

  const [step, setStep] = useState<Step>("name");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState<string | null>(null);
  const [gender, setGender] = useState<RegistrationBody["gender"]>("male");
  const [kycType, setKycType] = useState<RegistrationBody["kycType"]>("aadhaar");
  const [kycNumber, setKycNumber] = useState("");
  const [mobile, setMobile] = useState("");

  const stepIndex = ORDER.indexOf(step);

  // Residents must be at least 15; nobody enrolling is older than 100.
  const maxDob = toIsoDate(
    new Date(new Date().setFullYear(new Date().getFullYear() - 15))
  );
  const minDob = toIsoDate(
    new Date(new Date().setFullYear(new Date().getFullYear() - 100))
  );

  const validate = (): string | null => {
    switch (step) {
      case "name":
        return fullName.trim().length < 3
          ? "Enter your full name as it appears on your ID."
          : null;
      case "dob":
        return dob === null ? "Pick your date of birth." : null;
      case "kyc":
        // Same check the API runs, from the same module: catching a typo here
        // saves a round trip, and the two can't disagree.
        return kycNumberProblem(kycType, kycNumber);
      case "mobile":
        return /^\d{10}$/.test(mobile) ? null : "Enter a 10-digit mobile number.";
      default:
        return null;
    }
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await api.register({
        fullName: fullName.trim(),
        dob: dob as string,
        gender,
        kycType,
        kycNumber: normaliseKycNumber(kycNumber),
        mobile,
      });
      setStep("done");
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setSubmitting(false);
    }
  };

  const next = () => {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);

    if (step === "mobile") {
      void submit();
      return;
    }
    setStep(ORDER[stepIndex + 1] as Step);
  };

  if (step === "done") {
    return (
      <>
        <AppHeader title="Registration sent" back={false} />
        <Screen
          footer={
            <Button
              label="Back to sign in"
              emphasis
              onPress={() => router.replace("/(auth)/welcome")}
            />
          }
        >
          <View style={styles.doneWrap}>
            <View style={[styles.doneCircle, { backgroundColor: c.successBg }]}>
              <CheckCircle2 size={36} color={c.success} strokeWidth={1.75} />
            </View>
            <Text variant="section" style={styles.center}>
              We've got your details
            </Text>
            <Text variant="body" tone="muted" style={styles.center}>
              The hostel office will review and approve your registration.
              You'll get a notification on {mobile} when you can sign in.
            </Text>
          </View>
        </Screen>
      </>
    );
  }

  return (
    <>
      <AppHeader
        title="Register"
        subtitle={`Step ${stepIndex + 1} of ${ORDER.length}`}
      />

      {/* Progress bar doubles as the wizard's position indicator. */}
      <View style={[styles.track, { backgroundColor: c.mutedBg }]}>
        <View
          style={[
            styles.fill,
            {
              backgroundColor: c.accent,
              width: `${((stepIndex + 1) / ORDER.length) * 100}%`,
            },
          ]}
        />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Screen
          footer={
            <Button
              label={step === "mobile" ? "Submit registration" : "Continue"}
              emphasis
              loading={submitting}
              onPress={next}
            />
          }
        >
          {step === "name" && (
            <View style={styles.step}>
              <Text variant="title">What's your full name?</Text>
              <Text variant="body" tone="muted">
                Use the name printed on your ID proof.
              </Text>
              <Input
                value={fullName}
                onChangeText={setFullName}
                placeholder="e.g. Arjun Mehta"
                autoCapitalize="words"
                autoFocus
                error={error}
              />
            </View>
          )}

          {step === "dob" && (
            <View style={styles.step}>
              <Text variant="title">When were you born?</Text>
              <Text variant="body" tone="muted">
                {dob
                  ? formatDate(dob)
                  : "Tap the month and year at the top to jump to your birth year."}
              </Text>
              <Calendar
                value={dob}
                onChange={setDob}
                minDate={minDob}
                maxDate={maxDob}
              />
              <Field label="Gender">
                <Segmented
                  value={gender}
                  onChange={setGender}
                  options={[
                    { value: "male", label: "Male" },
                    { value: "female", label: "Female" },
                    { value: "other", label: "Other" },
                  ]}
                />
              </Field>
              {error && (
                <Text variant="label" tone="danger">
                  {error}
                </Text>
              )}
            </View>
          )}

          {step === "kyc" && (
            <View style={styles.step}>
              <Text variant="title">Add an ID proof</Text>
              <Text variant="body" tone="muted">
                We only store the number, and it stays masked in the app. The
                hostel office checks it against your card at move-in.
              </Text>
              <Field label="ID type">
                <Segmented
                  value={kycType}
                  onChange={(next) => {
                    setKycType(next);
                    setKycNumber("");
                    setError(null);
                  }}
                  options={[
                    { value: "aadhaar", label: "Aadhaar" },
                    { value: "pan", label: "PAN" },
                  ]}
                />
              </Field>
              <Input
                key={kycType}
                label={kycType === "aadhaar" ? "Aadhaar number" : "PAN number"}
                value={kycNumber}
                onChangeText={(text) =>
                  setKycNumber(
                    kycType === "aadhaar"
                      ? text.replace(/\D/g, "").slice(0, 12)
                      : text.toUpperCase().slice(0, 10)
                  )
                }
                placeholder={kycType === "aadhaar" ? "12 digits" : "ABCPE1234F"}
                keyboardType={
                  kycType === "aadhaar" ? "number-pad" : "ascii-capable"
                }
                autoCapitalize="characters"
                autoComplete="off"
                autoCorrect={false}
                error={error}
              />
            </View>
          )}

          {step === "mobile" && (
            <View style={styles.step}>
              <Text variant="title">Your mobile number</Text>
              <Text variant="body" tone="muted">
                You'll sign in with this number, so use one you'll keep.
              </Text>
              <PhoneInput
                value={mobile}
                onChangeText={setMobile}
                autoFocus
                error={error}
              />
            </View>
          )}
        </Screen>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  track: { height: 3, width: "100%" },
  fill: { height: 3 },
  step: { gap: space.md },
  center: { textAlign: "center" },
  doneWrap: {
    alignItems: "center",
    gap: space.md,
    paddingTop: space.xxl,
    paddingHorizontal: layout.screenPadding,
  },
  doneCircle: {
    width: 80,
    height: 80,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
});
