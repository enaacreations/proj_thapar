import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Minus, Plus, Users } from "lucide-react-native";
import {
  FOOD_PREF_LABELS,
  SLEEP_LABELS,
  STUDY_LABELS,
  type FoodPreference,
  type RoommateMatch,
  type RoommateProfileBody,
  type SleepSchedule,
  type StudyLocation,
} from "@proj/shared";
import { useTheme } from "../../src/theme/ThemeProvider";
import { radius, space, withAlpha } from "../../src/theme/tokens";
import { api } from "../../src/api/client";
import { messageOf, useAsync } from "../../src/lib/useAsync";
import { AppHeader } from "../../src/components/AppHeader";
import { Badge } from "../../src/components/Badge";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { Segmented, Toggle } from "../../src/components/Controls";
import { EmptyState } from "../../src/components/EmptyState";
import { Field } from "../../src/components/Input";
import { Screen } from "../../src/components/Screen";
import { ErrorState, Loading } from "../../src/components/States";
import { Text } from "../../src/components/Text";
import { useToast } from "../../src/components/Toast";

const DEFAULTS: RoommateProfileBody = {
  sleepSchedule: "flexible",
  cleanliness: 3,
  noiseTolerance: 3,
  socialLevel: 3,
  studyLocation: "flexible",
  guestFrequency: 3,
  smoking: false,
  foodPreference: "either",
};

export default function RoommateScreen() {
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(
    () => api.roommateMatches(),
    []
  );

  const [form, setForm] = useState<RoommateProfileBody>(DEFAULTS);
  const [matches, setMatches] = useState<RoommateMatch[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    if (data.profile) {
      const { updatedAt: _ignored, ...rest } = data.profile;
      setForm(rest);
    }
    setMatches(data.matches);
  }, [data]);

  const save = async () => {
    setSaving(true);
    try {
      await api.saveRoommateProfile(form);
      const fresh = await api.roommateMatches();
      setMatches(fresh.matches);
      toast.success("Saved — here's who you'd get on with");
    } catch (err) {
      toast.error(messageOf(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <AppHeader title="Living habits" />
      <Screen
        refreshing={loading}
        onRefresh={() => void reload()}
        footer={
          <Button
            label="Save and see matches"
            emphasis
            loading={saving}
            onPress={() => void save()}
          />
        }
      >
        {loading && !data ? (
          <Loading />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void reload()} />
        ) : (
          <>
            <Text variant="body" tone="muted">
              Answer honestly — this is only used to pair you with someone whose
              habits fit yours.
            </Text>

            <Card style={styles.card}>
              <Field label="When do you usually sleep?">
                <Segmented<SleepSchedule>
                  value={form.sleepSchedule}
                  onChange={(v) => setForm({ ...form, sleepSchedule: v })}
                  options={[
                    { value: "early", label: "Early" },
                    { value: "late", label: "Late" },
                    { value: "flexible", label: "Varies" },
                  ]}
                />
              </Field>
              <Text variant="caption" tone="muted">
                {SLEEP_LABELS[form.sleepSchedule]}
              </Text>
            </Card>

            <Card style={styles.card}>
              <Scale
                label="How tidy do you keep your space?"
                low="Relaxed"
                high="Spotless"
                value={form.cleanliness}
                onChange={(v) => setForm({ ...form, cleanliness: v })}
              />
              <Scale
                label="How much noise can you live with?"
                low="Need quiet"
                high="Doesn't bother me"
                value={form.noiseTolerance}
                onChange={(v) => setForm({ ...form, noiseTolerance: v })}
              />
              <Scale
                label="How social are you at home?"
                low="Keep to myself"
                high="Very social"
                value={form.socialLevel}
                onChange={(v) => setForm({ ...form, socialLevel: v })}
              />
              <Scale
                label="How often do you have guests over?"
                low="Never"
                high="Very often"
                value={form.guestFrequency}
                onChange={(v) => setForm({ ...form, guestFrequency: v })}
              />
            </Card>

            <Card style={styles.card}>
              <Field label="Where do you usually study?">
                <Segmented<StudyLocation>
                  value={form.studyLocation}
                  onChange={(v) => setForm({ ...form, studyLocation: v })}
                  options={[
                    { value: "in_room", label: "In room" },
                    { value: "outside", label: "Library" },
                    { value: "flexible", label: "Either" },
                  ]}
                />
              </Field>
              <Text variant="caption" tone="muted">
                {STUDY_LABELS[form.studyLocation]}
              </Text>

              <Field label="Food preference">
                <Segmented<FoodPreference>
                  value={form.foodPreference}
                  onChange={(v) => setForm({ ...form, foodPreference: v })}
                  options={[
                    { value: "veg", label: "Veg" },
                    { value: "non_veg", label: "Non-veg" },
                    { value: "either", label: "Either" },
                  ]}
                />
              </Field>
              <Text variant="caption" tone="muted">
                {FOOD_PREF_LABELS[form.foodPreference]}
              </Text>

              <Toggle
                checked={form.smoking}
                onChange={(v) => setForm({ ...form, smoking: v })}
                label="I smoke"
                description="Only used for matching — smoking indoors isn't allowed"
              />
            </Card>

            <Text variant="section" style={styles.sectionHead}>
              Who you'd get on with
            </Text>

            {matches.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No matches yet"
                description="Once other residents fill this in, we'll show who fits best with your habits."
              />
            ) : (
              matches.map((match) => <MatchCard key={match.residentId} match={match} />)
            )}
          </>
        )}
      </Screen>
    </>
  );
}

function MatchCard({ match }: { match: RoommateMatch }) {
  const { c } = useTheme();

  const tone =
    match.score >= 75 ? c.success : match.score >= 50 ? c.warning : c.danger;
  const label =
    match.score >= 75
      ? "Strong fit"
      : match.score >= 50
        ? "Workable"
        : "Likely to clash";

  return (
    <Card style={styles.card}>
      <View style={styles.matchHead}>
        <View
          style={[styles.scoreChip, { backgroundColor: withAlpha(tone, 0.12) }]}
        >
          <Text variant="cardTitle" style={{ color: tone }}>
            {match.score}%
          </Text>
        </View>
        <View style={styles.flex}>
          <Text variant="cardTitle">{match.fullName}</Text>
          <Text variant="label" tone="muted">
            {match.roomNumber ? `Room ${match.roomNumber}` : "No room yet"}
          </Text>
        </View>
        <Badge
          label={label}
          tone={
            match.score >= 75 ? "success" : match.score >= 50 ? "warning" : "danger"
          }
        />
      </View>

      {match.agreements.map((line) => (
        <View key={line} style={styles.reasonRow}>
          <Plus size={14} color={c.success} strokeWidth={2.5} />
          <Text variant="label" style={styles.flex}>
            {line}
          </Text>
        </View>
      ))}
      {match.frictions.map((line) => (
        <View key={line} style={styles.reasonRow}>
          <Minus size={14} color={c.danger} strokeWidth={2.5} />
          <Text variant="label" style={styles.flex}>
            {line}
          </Text>
        </View>
      ))}
    </Card>
  );
}

/** 1–5 chips: fewer taps than a slider and easier to hit accurately. */
function Scale({
  label,
  low,
  high,
  value,
  onChange,
}: {
  label: string;
  low: string;
  high: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const { c } = useTheme();

  return (
    <View style={styles.scaleWrap}>
      <Text variant="label" style={styles.scaleLabel}>
        {label}
      </Text>
      <Segmented<string>
        value={String(value)}
        onChange={(v) => onChange(Number(v))}
        options={[1, 2, 3, 4, 5].map((n) => ({
          value: String(n),
          label: String(n),
        }))}
      />
      <View style={styles.scaleEnds}>
        <Text variant="caption" tone="muted">
          {low}
        </Text>
        <Text variant="caption" tone="muted">
          {high}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  flex: { flex: 1 },
  sectionHead: { marginTop: space.md },
  matchHead: { flexDirection: "row", alignItems: "center", gap: space.md },
  scoreChip: {
    minWidth: 54,
    height: 44,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  reasonRow: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  scaleWrap: { gap: 6 },
  scaleLabel: { fontFamily: "DMSans_500Medium" },
  scaleEnds: { flexDirection: "row", justifyContent: "space-between" },
});
