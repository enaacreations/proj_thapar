import { useState, type ReactNode } from "react";
import {
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { fonts, layout, radius } from "../theme/tokens";
import { Text } from "./Text";

interface FieldProps {
  label?: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Label above, error below — the wrapper every form control sits in. */
export function Field({ label, hint, error, children, style }: FieldProps) {
  return (
    <View style={[styles.field, style]}>
      {label && (
        <Text variant="label" style={styles.fieldLabel}>
          {label}
        </Text>
      )}
      {children}
      {error ? (
        <Text variant="label" tone="danger">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="label" tone="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

interface InputProps extends Omit<TextInputProps, "style"> {
  label?: string;
  hint?: string;
  error?: string | null;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Input({
  label,
  hint,
  error,
  right,
  style,
  multiline,
  ...rest
}: InputProps) {
  const { c } = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error ? c.danger : focused ? c.accent : c.border;

  return (
    <Field label={label} hint={hint} error={error} style={style}>
      <View
        style={[
          styles.inputWrap,
          {
            borderColor,
            // 2dp ring on focus, per the spec.
            borderWidth: focused && !error ? 2 : 1,
            backgroundColor: c.card,
            minHeight: multiline ? 96 : layout.inputHeight,
            alignItems: multiline ? "flex-start" : "center",
          },
        ]}
      >
        <TextInput
          {...rest}
          multiline={multiline}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          placeholderTextColor={c.muted}
          style={[
            styles.input,
            {
              color: c.ink,
              textAlignVertical: multiline ? "top" : "center",
              paddingTop: multiline ? 12 : 0,
            },
          ]}
        />
        {right}
      </View>
    </Field>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  fieldLabel: { fontFamily: fonts.sansMedium },
  inputWrap: {
    flexDirection: "row",
    gap: 8,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    // 16dp minimum keeps iOS from zooming the view on focus.
    fontSize: 16,
    fontFamily: fonts.sans,
    paddingVertical: 12,
  },
});
