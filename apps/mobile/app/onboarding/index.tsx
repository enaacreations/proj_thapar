import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import {
  KYC_STATUS_LABELS,
  LEASE_STATUS_LABELS,
  type OnboardingProgress,
} from "@proj/shared";
import {
  BedDouble,
  CheckCircle2,
  ClipboardCheck,
  FileSignature,
  IdCard,
  Users,
  type LucideIcon,
} from "lucide-react-native";
import { useTheme } from "../../src/theme/ThemeProvider";
import { radius, space, withAlpha } from "../../src/theme/tokens";
import { api } from "../../src/api/client";
import { useAsync } from "../../src/lib/useAsync";
import { AppHeader } from "../../src/components/AppHeader";
import { Badge } from "../../src/components/Badge";
import { Card } from "../../src/components/Card";
import { ProgressRing } from "../../src/components/ProgressRing";
import { Screen } from "../../src/components/Screen";
import { ErrorState, Loading } from "../../src/components/States";
import { Text } from "../../src/components/Text";

export default function OnboardingHub() {
  const { c } = useTheme();
  const router = useRouter();
  const { data, loading, error, reload } = useAsync(
    () => api.onboardingProgress(),
    []
  );

  const steps = (p: OnboardingProgress): {
    key: string;
    icon: LucideIcon;
    title: string;
    status: string;
    done: boolean;
    href: string;
  }[] => [
    {
      key: "kyc",
      icon: IdCard,
      title: "ID documents",
      status: KYC_STATUS_LABELS[p.kycStatus],
      done: p.kycStatus === "verified",
      href: "/onboarding/kyc",
    },
    {
      key: "lease",
      icon: FileSignature,
      title: "Rental agreement",
      status: LEASE_STATUS_LABELS[p.leaseStatus],
      done: p.leaseStatus === "signed",
      href: "/onboarding/lease",
    },
    {
      key: "roommate",
      icon: Users,
      title: "Living habits",
      status: p.roommateProfileComplete ? "Filled in" : "Not filled in",
      done: p.roommateProfileComplete,
      href: "/onboarding/roommate",
    },
    {
      key: "movein",
      icon: ClipboardCheck,
      title: "Move-in checklist",
      status: p.moveInComplete
        ? "Complete"
        : p.inventorySubmitted
          ? "Room recorded"
          : "In progress",
      done: p.moveInComplete,
      href: "/onboarding/move-in",
    },
  ];

  return (
    <>
      <AppHeader title="Getting you moved in" />
      <Screen refreshing={loading} onRefresh={() => void reload()}>
        {loading && !data ? (
          <Loading />
        ) : error || !data ? (
          <ErrorState
            message={error ?? "Couldn't load your progress."}
            onRetry={() => void reload()}
          />
        ) : (
          <>
            <Card>
              <View style={styles.hero}>
                <ProgressRing value={data.percentComplete / 100} size={72} strokeWidth={6}>
                  <Text variant="caption" tone="muted">
                    {data.percentComplete}%
                  </Text>
                </ProgressRing>
                <View style={styles.heroText}>
                  <Text variant="label" tone="muted">
                    Next
                  </Text>
                  <Text variant="cardTitle">{data.nextStep}</Text>
                </View>
              </View>
            </Card>

            {steps(data).map((step) => (
              <Card
                key={step.key}
                accessibilityLabel={step.title}
                onPress={() => router.push(step.href as never)}
              >
                <View style={styles.row}>
                  <View
                    style={[
                      styles.chip,
                      {
                        backgroundColor: step.done
                          ? withAlpha(c.success, 0.12)
                          : withAlpha(c.accent, 0.12),
                      },
                    ]}
                  >
                    {step.done ? (
                      <CheckCircle2 size={20} color={c.success} strokeWidth={2} />
                    ) : (
                      <step.icon size={20} color={c.accentStrong} strokeWidth={2} />
                    )}
                  </View>
                  <View style={styles.body}>
                    <Text variant="cardTitle">{step.title}</Text>
                    <Badge
                      label={step.status}
                      tone={step.done ? "success" : "neutral"}
                    />
                  </View>
                </View>
              </Card>
            ))}

            <Text variant="section" style={styles.sectionHead}>
              Before you arrive
            </Text>

            <Card
              accessibilityLabel="Take a look around"
              onPress={() => router.push("/onboarding/tour")}
            >
              <View style={styles.row}>
                <View style={[styles.chip, { backgroundColor: withAlpha(c.pop, 0.12) }]}>
                  <BedDouble size={20} color={c.pop} strokeWidth={2} />
                </View>
                <View style={styles.body}>
                  <Text variant="cardTitle">Take a look around</Text>
                  <Text variant="label" tone="muted">
                    Walk through the room and common areas, and plan where your
                    things will go.
                  </Text>
                </View>
              </View>
            </Card>
          </>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: "row", alignItems: "center", gap: space.lg },
  heroText: { flex: 1, gap: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
  chip: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, gap: 6 },
  sectionHead: { marginTop: space.md },
});
