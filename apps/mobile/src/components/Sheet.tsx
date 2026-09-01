import type { ReactNode } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check } from "lucide-react-native";
import { useTheme } from "../theme/ThemeProvider";
import { layout, radius, space } from "../theme/tokens";
import { Text } from "./Text";

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
}

/** Bottom sheets replace dialogs and popovers for pickers and confirmations. */
export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
}: SheetProps) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: c.card,
            borderColor: c.border,
            paddingBottom: Math.max(insets.bottom, space.lg),
          },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: c.border }]} />
        <Text variant="section">{title}</Text>
        {subtitle && (
          <Text variant="label" tone="muted">
            {subtitle}
          </Text>
        )}
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
}

interface SheetOptionProps {
  label: string;
  description?: string;
  selected?: boolean;
  onPress: () => void;
}

export function SheetOption({
  label,
  description,
  selected = false,
  onPress,
}: SheetOptionProps) {
  const { c } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        {
          borderColor: selected ? c.accent : c.border,
          backgroundColor: pressed ? c.mutedBg : "transparent",
        },
      ]}
    >
      <View style={styles.optionText}>
        <Text variant="cardTitle">{label}</Text>
        {description && (
          <Text variant="label" tone="muted">
            {description}
          </Text>
        )}
      </View>
      {selected && <Check size={20} color={c.accent} strokeWidth={2} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    paddingHorizontal: layout.screenPadding,
    paddingTop: space.md,
    gap: space.xs,
    maxHeight: "80%",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    alignSelf: "center",
    marginBottom: space.md,
  },
  body: { marginTop: space.md },
  bodyContent: { gap: space.sm, paddingBottom: space.sm },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: layout.minTapTarget + 8,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  optionText: { flex: 1, gap: 2 },
});
