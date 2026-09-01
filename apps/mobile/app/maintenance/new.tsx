import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { api } from "../../src/api/client";
import { useAsync, messageOf } from "../../src/lib/useAsync";
import { AppHeader } from "../../src/components/AppHeader";
import { Button } from "../../src/components/Button";
import { CategoryPicker } from "../../src/components/CategoryPicker";
import { Input } from "../../src/components/Input";
import { PhotoStrip } from "../../src/components/PhotoStrip";
import { Screen } from "../../src/components/Screen";
import { ErrorState, Loading } from "../../src/components/States";
import { Text } from "../../src/components/Text";
import { useToast } from "../../src/components/Toast";

export default function NewMaintenance() {
  const router = useRouter();
  const toast = useToast();
  const categories = useAsync(() => api.maintenanceCategories(), []);

  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [subCategoryId, setSubCategoryId] = useState<string | null>(null);
  const [remarks, setRemarks] = useState("");
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!categoryId || !subCategoryId) {
      setError("Pick a category and the exact problem.");
      return;
    }
    if (remarks.trim().length < 5) {
      setError("Add a few words so the technician knows what to bring.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const created = await api.createMaintenance({
        categoryId,
        subCategoryId,
        remarks: remarks.trim(),
        photoUris,
      });
      toast.success(`Request ${created.id} raised`);
      router.replace(`/maintenance/${created.id}`);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <AppHeader title="Report a problem" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Screen
          footer={
            <Button
              label="Submit request"
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
              <Text variant="body" tone="muted">
                Tell us what's wrong and we'll send someone. You'll get a
                request ID to track it.
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
                label="Anything else we should know?"
                value={remarks}
                onChangeText={(text) => {
                  setRemarks(text);
                  setError(null);
                }}
                placeholder="e.g. The AC runs but doesn't cool at all."
                multiline
                hint="A sentence is enough."
              />

              <PhotoStrip
                uris={photoUris}
                onChange={setPhotoUris}
                label="Photos (optional)"
                hint="A photo usually gets it fixed faster."
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
});
