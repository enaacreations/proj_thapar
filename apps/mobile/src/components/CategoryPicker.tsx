import { useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import { ChevronDown } from "lucide-react-native";
import type { CategoryOption } from "@proj/shared";
import { useTheme } from "../theme/ThemeProvider";
import { layout, radius, space } from "../theme/tokens";
import { Field } from "./Input";
import { Sheet, SheetOption } from "./Sheet";
import { Text } from "./Text";

interface CategoryPickerProps {
  categories: CategoryOption[];
  categoryId: string | null;
  subCategoryId: string | null;
  onChange: (categoryId: string | null, subCategoryId: string | null) => void;
  error?: string | null;
}

/**
 * Two linked pickers. Choosing a new category clears the sub-category so an
 * incompatible pair can never be submitted.
 */
export function CategoryPicker({
  categories,
  categoryId,
  subCategoryId,
  onChange,
  error,
}: CategoryPickerProps) {
  const [open, setOpen] = useState<"category" | "sub" | null>(null);

  const category = categories.find((c) => c.id === categoryId) ?? null;
  const sub =
    category?.subCategories.find((s) => s.id === subCategoryId) ?? null;

  return (
    <>
      <Field label="Category" error={categoryId ? null : error}>
        <SelectRow
          value={category?.label ?? null}
          placeholder="Choose a category"
          onPress={() => setOpen("category")}
        />
      </Field>

      <Field
        label="What exactly is the problem?"
        error={categoryId && !subCategoryId ? error : null}
      >
        <SelectRow
          value={sub?.label ?? null}
          placeholder={
            category ? "Choose an option" : "Pick a category first"
          }
          disabled={!category}
          onPress={() => setOpen("sub")}
        />
      </Field>

      <Sheet
        visible={open === "category"}
        onClose={() => setOpen(null)}
        title="Choose a category"
      >
        {categories.map((option) => (
          <SheetOption
            key={option.id}
            label={option.label}
            description={`${option.subCategories.length} options`}
            selected={option.id === categoryId}
            onPress={() => {
              onChange(option.id, null);
              setOpen("sub");
            }}
          />
        ))}
      </Sheet>

      <Sheet
        visible={open === "sub"}
        onClose={() => setOpen(null)}
        title={category?.label ?? "Choose an option"}
      >
        {(category?.subCategories ?? []).map((option) => (
          <SheetOption
            key={option.id}
            label={option.label}
            selected={option.id === subCategoryId}
            onPress={() => {
              onChange(categoryId, option.id);
              setOpen(null);
            }}
          />
        ))}
      </Sheet>
    </>
  );
}

export function SelectRow({
  value,
  placeholder,
  onPress,
  disabled = false,
}: {
  value: string | null;
  placeholder: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { c } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={value ?? placeholder}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          borderColor: c.border,
          backgroundColor: pressed ? c.mutedBg : c.card,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <Text
        variant="body"
        tone={value ? "ink" : "muted"}
        style={styles.value}
        numberOfLines={1}
      >
        {value ?? placeholder}
      </Text>
      <ChevronDown size={20} color={c.muted} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: layout.inputHeight,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
  },
  value: { flex: 1 },
});
