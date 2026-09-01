import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { space } from "../../src/theme/tokens";
import { api } from "../../src/api/client";
import { messageOf, useAsync } from "../../src/lib/useAsync";
import { AppHeader } from "../../src/components/AppHeader";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { CategoryPicker } from "../../src/components/CategoryPicker";
import { Rating } from "../../src/components/Controls";
import { Input } from "../../src/components/Input";
import { PhotoStrip } from "../../src/components/PhotoStrip";
import { Screen } from "../../src/components/Screen";
import { ErrorState, Loading } from "../../src/components/States";
import { Text } from "../../src/components/Text";
import { useToast } from "../../src/components/Toast";

const RATING_WORDS = ["", "Poor", "Not great", "Okay", "Good", "Excellent"];

export default function NewFeedback() {
  const router = useRouter();
  const toast = useToast();

  // The food screen links here with ?category=mess pre-selected.
  const { category } = useLocalSearchParams<{ category?: string }>();
  const categories = useAsync(() => api.feedbackCategories(), []);

  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [subCategoryId, setSubCategoryId] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [remarks, setRemarks] = useState("");
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (category && categories.data?.some((c) => c.id === category)) {
      setCategoryId(category);
    }
  }, [category, categories.data]);

  const submit = async () => {
    if (!categoryId || !subCategoryId) {
      setError("Pick what you're rating.");
      return;
    }
    if (rating === 0) {
      setError("Tap a star to give a rating.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await api.createFeedback({
        categoryId,
        subCategoryId,
        rating,
        remarks: remarks.trim(),
        photoUris,
      });
      toast.success("Thanks — your feedback is in");
      router.replace("/feedback");
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <AppHeader title="Give feedback" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Screen
          footer={
            <Button
              label="Send feedback"
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

              <Card style={styles.ratingCard}>
                <Text variant="cardTitle">How would you rate it?</Text>
                <Rating
                  value={rating}
                  onChange={(next) => {
                    setRating(next);
                    setError(null);
                  }}
                />
                <View style={styles.ratingWord}>
                  <Text variant="body" tone={rating > 0 ? "ink" : "muted"}>
                    {rating > 0
                      ? RATING_WORDS[rating]
                      : "1 star is lowest, 5 is highest"}
                  </Text>
                </View>
              </Card>

              <Input
                label="Anything you'd like to add?"
                value={remarks}
                onChangeText={setRemarks}
                placeholder="Optional, but it helps a lot."
                multiline
              />

              <PhotoStrip
                uris={photoUris}
                onChange={setPhotoUris}
                label="Photos (optional)"
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
  ratingCard: { gap: space.md, alignItems: "center" },
  ratingWord: { minHeight: 22 },
});
