import { useRef, useState } from "react";
import {
  Pressable,
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

interface OtpInputProps {
  value: string;
  onChangeText: (digits: string) => void;
  length?: number;
  label?: string;
  error?: string | null;
  autoFocus?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Six discrete OTP boxes driven by a single hidden TextInput. */
export function OtpInput({
  value,
  onChangeText,
  length = 6,
  label = "6-digit OTP",
  error,
  autoFocus = true,
  style,
}: OtpInputProps) {
  const { c } = useTheme();
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  const digits = value.replace(/\D/g, "").slice(0, length);
  const activeIndex = Math.min(digits.length, length - 1);

  const setDigits = (raw: string) => {
    onChangeText(raw.replace(/\D/g, "").slice(0, length));
  };

  return (
    <Field label={label} error={error} style={style}>
      <Pressable
        accessibilityRole="none"
        onPress={() => inputRef.current?.focus()}
        style={styles.row}
      >
        {Array.from({ length }, (_, i) => {
          const filled = i < digits.length;
          const isActive = focused && i === activeIndex;
          const borderColor = error
            ? c.danger
            : isActive
              ? c.accent
              : c.border;

          return (
            <View
              key={i}
              style={[
                styles.box,
                {
                  borderColor,
                  borderWidth: isActive && !error ? 2 : 1,
                  backgroundColor: c.card,
                },
              ]}
            >
              <Text
                variant="title"
                style={[styles.digit, { color: filled ? c.ink : c.muted }]}
              >
                {digits[i] ?? ""}
              </Text>
            </View>
          );
        })}
      </Pressable>

      <TextInput
        ref={inputRef}
        value={digits}
        onChangeText={setDigits}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={length}
        autoFocus={autoFocus}
        caretHidden
        style={styles.hidden}
        accessibilityLabel={label}
      />
    </Field>
  );
}

const BOX_SIZE = layout.inputHeight + 4;

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: space.sm,
  },
  box: {
    flex: 1,
    maxWidth: BOX_SIZE + 8,
    height: BOX_SIZE,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  digit: {
    fontFamily: fonts.monoSemi,
    fontSize: 22,
    lineHeight: 28,
  },
  hidden: {
    position: "absolute",
    opacity: 0,
    height: 1,
    width: 1,
  },
});
