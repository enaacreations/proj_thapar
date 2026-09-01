import type { ComponentType } from "react";
import { Tabs } from "expo-router";
import { StyleSheet, Text, View, type ColorValue } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Bell,
  ClipboardList,
  Home,
  User,
  type LucideProps,
} from "lucide-react-native";
import { useTheme } from "../../src/theme/ThemeProvider";
import { fonts, gradient } from "../../src/theme/tokens";

/**
 * Height of the tappable row, before the device's bottom inset is added.
 * Fits paddingTop 8 + icon 22 + gap 3 + label 15 + paddingBottom 8.
 */
const BAR_HEIGHT = 64;

const TABS = [
  { name: "index", label: "Home", icon: Home },
  { name: "requests", label: "Requests", icon: ClipboardList },
  { name: "notifications", label: "Alerts", icon: Bell },
  { name: "profile", label: "Profile", icon: User },
] as const;

export default function TabsLayout() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.muted,
        // The label is drawn inside tabBarIcon instead. React Navigation sizes
        // its built-in label from leftover space and clips it with its own
        // `overflow: hidden`, which cuts the text off at small bar heights.
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: c.card,
          borderTopColor: c.border,
          borderTopWidth: 1,
          // Grow by the bottom inset so the gesture bar / home indicator sits
          // below the row rather than on top of it.
          height: BAR_HEIGHT + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
        },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.label,
            tabBarIcon: ({ color, focused }) => (
              <TabItem
                icon={tab.icon}
                label={tab.label}
                color={color}
                focused={focused}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

function TabItem({
  icon: Icon,
  label,
  color,
  focused,
}: {
  icon: ComponentType<LucideProps>;
  label: string;
  // React Navigation types the tint as ColorValue, not string.
  color: ColorValue;
  focused: boolean;
}) {
  return (
    <View style={styles.item}>
      {/* Absolutely positioned so it never steals height from the label. */}
      {focused && (
        <LinearGradient
          colors={[gradient[1], gradient[2]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.indicator}
        />
      )}
      <Icon size={22} color={color} strokeWidth={2} />
      <Text numberOfLines={1} style={[styles.label, { color }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  item: { alignItems: "center", justifyContent: "flex-start", width: 76 },
  indicator: {
    position: "absolute",
    top: -6,
    height: 3,
    width: 20,
    borderRadius: 999,
  },
  label: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 3,
    textAlign: "center",
  },
});
