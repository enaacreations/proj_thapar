import { useState } from "react";
import {
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { fonts, layout, radius, space } from "../theme/tokens";
import { Field } from "./Input";
import { Text } from "./Text";

interface PhoneInputProps {
  value: string;
  onChangeText: (digits: string) => void;
  label?: string;
  error?: string | null;
  autoFocus?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Autofill often hands us "+91XXXXXXXXXX" or "0XXXXXXXXXX". Strip those
 * prefixes so we keep the 10-digit local number, not "91XXXXXXXX".
 */
export function normalizeIndianMobile(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length >= 12) {
    digits = digits.slice(2);
  } else if (digits.startsWith("0") && digits.length === 11) {
    digits = digits.slice(1);
  }
  return digits.slice(0, 10);
}

/** Indian mobile field with a fixed +91 prefix chip. Value is digits only. */
export function PhoneInput({
  value,
  onChangeText,
  label = "Mobile number",
  error,
  autoFocus,
  style,
}: PhoneInputProps) {
  const { c } = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error ? c.danger : focused ? c.accent : c.border;

  return (
    <Field label={label} error={error} style={style}>
      <View
        style={[
          styles.wrap,
          {
            borderColor,
            borderWidth: focused && !error ? 2 : 1,
            backgroundColor: c.card,
          },
        ]}
      >
        <View
          style={[
            styles.prefix,
            {
              backgroundColor: c.mutedBg,
              borderRightColor: c.border,
            },
          ]}
        >
          <Text variant="body" style={styles.prefixText}>
            +91
          </Text>
        </View>
        <TextInput
          value={value}
          onChangeText={(text) => onChangeText(normalizeIndianMobile(text))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="10-digit number"
          placeholderTextColor={c.muted}
          keyboardType="number-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          autoFocus={autoFocus}
          style={[styles.input, { color: c.ink }]}
        />
      </View>
    </Field>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "stretch",
    borderRadius: radius.lg,
    minHeight: layout.inputHeight,
    overflow: "hidden",
  },
  prefix: {
    justifyContent: "center",
    paddingHorizontal: space.md,
    borderRightWidth: 1,
  },
  prefixText: {
    fontFamily: fonts.sansSemi,
    letterSpacing: 0.3,
  },
  input: {
    flex: 1,
    fontSize: 18,
    fontFamily: fonts.mono,
    letterSpacing: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
});
