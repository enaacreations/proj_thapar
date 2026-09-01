import { Image, Pressable, StyleSheet, View } from "react-native";
import { Camera } from "lucide-react-native";
import { useTheme } from "../theme/ThemeProvider";
import { radius, withAlpha } from "../theme/tokens";
import { Text } from "./Text";

interface AvatarProps {
  name: string;
  photoUrl?: string | null;
  size?: number;
  onPress?: () => void;
  /** Small camera chip — used on Profile where the avatar is tappable. */
  editable?: boolean;
}

const initialsOf = (name: string) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

export function Avatar({
  name,
  photoUrl,
  size = 56,
  onPress,
  editable = false,
}: AvatarProps) {
  const { c } = useTheme();
  const badge = Math.max(18, Math.round(size * 0.32));

  const face = photoUrl ? (
    <Image
      source={{ uri: photoUrl }}
      style={{ width: size, height: size, borderRadius: radius.pill }}
    />
  ) : (
    <View
      style={[
        styles.fallback,
        {
          width: size,
          height: size,
          backgroundColor: withAlpha(c.accent, 0.12),
        },
      ]}
    >
      <Text
        variant={size >= 48 ? "section" : "cardTitle"}
        tone="accent"
        style={styles.initials}
      >
        {initialsOf(name)}
      </Text>
    </View>
  );

  const body = (
    <View style={{ width: size, height: size }}>
      {face}
      {editable && (
        <View
          style={[
            styles.badge,
            {
              width: badge,
              height: badge,
              backgroundColor: c.accent,
              borderColor: c.card,
            },
          ]}
        >
          <Camera size={Math.round(badge * 0.55)} color={c.onAccent} strokeWidth={2} />
        </View>
      )}
    </View>
  );

  if (!onPress) return body;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={photoUrl ? "Change profile photo" : "Add profile photo"}
      onPress={onPress}
      hitSlop={4}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fallback: {
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: { textAlign: "center" },
  badge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
