import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Camera, ImagePlus, X } from "lucide-react-native";
import { useTheme } from "../theme/ThemeProvider";
import { radius, space } from "../theme/tokens";
import { capturePhoto, pickPhotos } from "../lib/photos";
import { Text } from "./Text";
import { useToast } from "./Toast";

interface PhotoStripProps {
  uris: string[];
  onChange: (next: string[]) => void;
  label?: string;
  hint?: string;
  max?: number;
  /** Hides the gallery button where a live photo is the point (e.g. laundry). */
  cameraOnly?: boolean;
}

export function PhotoStrip({
  uris,
  onChange,
  label = "Photos",
  hint,
  max = 4,
  cameraOnly = false,
}: PhotoStripProps) {
  const { c } = useTheme();
  const toast = useToast();

  const add = async (source: "camera" | "library") => {
    if (uris.length >= max) {
      toast.show(`You can add up to ${max} photos.`, "warning");
      return;
    }

    const result =
      source === "camera" ? await capturePhoto() : await pickPhotos(max - uris.length);

    if (result.problem) {
      toast.show(result.problem, "warning");
      return;
    }
    if (result.uris.length > 0) {
      onChange([...uris, ...result.uris].slice(0, max));
    }
  };

  return (
    <View style={styles.wrap}>
      <Text variant="label" style={styles.label}>
        {label}
      </Text>
      {hint && (
        <Text variant="label" tone="muted">
          {hint}
        </Text>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Take a photo"
          onPress={() => void add("camera")}
          style={[
            styles.addTile,
            { borderColor: c.border, backgroundColor: c.mutedBg },
          ]}
        >
          <Camera size={22} color={c.muted} strokeWidth={1.75} />
          <Text variant="caption" tone="muted">
            Camera
          </Text>
        </Pressable>

        {!cameraOnly && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose from gallery"
            onPress={() => void add("library")}
            style={[
              styles.addTile,
              { borderColor: c.border, backgroundColor: c.mutedBg },
            ]}
          >
            <ImagePlus size={22} color={c.muted} strokeWidth={1.75} />
            <Text variant="caption" tone="muted">
              Gallery
            </Text>
          </Pressable>
        )}

        {uris.map((uri) => (
          <View key={uri} style={styles.thumbWrap}>
            <Image source={{ uri }} style={styles.thumb} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Remove photo"
              onPress={() => onChange(uris.filter((u) => u !== uri))}
              style={[styles.remove, { backgroundColor: c.ink }]}
              hitSlop={6}
            >
              <X size={12} color={c.surface} strokeWidth={2.5} />
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontFamily: "DMSans_500Medium" },
  strip: { gap: space.sm, paddingVertical: 2 },
  addTile: {
    width: 76,
    height: 76,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  thumbWrap: { width: 76, height: 76 },
  thumb: { width: 76, height: 76, borderRadius: radius.lg },
  remove: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
});
