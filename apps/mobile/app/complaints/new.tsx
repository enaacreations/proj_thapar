import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Link2 } from "lucide-react-native";
import { useTheme } from "../../src/theme/ThemeProvider";
import { space } from "../../src/theme/tokens";
import { api } from "../../src/api/client";
import { messageOf, useAsync } from "../../src/lib/useAsync";
import { AppHeader } from "../../src/components/AppHeader";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { CategoryPicker } from "../../src/components/CategoryPicker";
import { Input } from "../../src/components/Input";
import { Screen } from "../../src/components/Screen";
import { ErrorState, Loading } from "../../src/components/States";
import { Text } from "../../src/components/Text";
import { useToast } from "../../src/components/Toast";

export default function NewComplaint() {
  const { c } = useTheme();
  const router = useRouter();
  const toast = useToast();

  // Set when arriving from a laundry or maintenance request's detail screen.
  const { against } = useLocalSearchParams<{ against?: string }>();
  const categories = useAsync(() => api.complaintCategories(), []);

  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [subCategoryId, setSubCategoryId] = useState<string | null>(null);
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!categoryId || !subCategoryId) {
      setError("Pick a category and the exact issue.");
      return;
    }
    if (remarks.trim().length < 5) {
      setError("Describe what happened in a sentence or two.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const created = await api.createComplaint({
        categoryId,
        subCategoryId,
        remarks: remarks.trim(),
        againstRequestId: against ?? null,
      });
      toast.success(`Complaint ${created.id} registered`);
      router.replace(`/complaints/${created.id}`);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <AppHeader title="Raise a complaint" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Screen
          footer={
            <Button
              label="Submit complaint"
              emphasis
              loading={submitting}
              onPress={() => void submit()}
            />
          }
        >
          {categories.loading && !categories.data ? (
            <Loading />
          ) : categories.error ? (
            <ErrorState
              message={categories.error}
              onRetry={() => void categories.reload()}
            />
          ) : (
            <>
              {against && (
                <Card style={[styles.linked, { borderColor: c.accent }]}>
                  <Link2 size={18} color={c.accentStrong} strokeWidth={2} />
                  <Text variant="label" style={styles.flex}>
                    This complaint is linked to{" "}
                    <Text variant="mono">{against}</Text>
                  </Text>
                </Card>
              )}

              <Text variant="body" tone="muted">
                We'll register it with an ID so you can follow what happens.
              </Text>

              <CategoryPicker
                categories={categories.data ?? []}
                categoryId={categoryId}
                subCategoryId={subCategoryId}
                error={error}
                onChange={(next, sub) => {
                  setCategoryId(next);
                  setSubCategoryId(sub);
                  setError(null);
                }}
              />

              <Input
                label="What happened?"
                value={remarks}
                onChangeText={(text) => {
                  setRemarks(text);
                  setError(null);
                }}
                placeholder="Include the day and time if you remember."
                multiline
              />
            </>
          )}
        </Screen>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  linked: { flexDirection: "row", alignItems: "center", gap: space.sm },
});
