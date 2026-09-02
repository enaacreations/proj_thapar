import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { dark, light, type Palette } from "./tokens";

export type ThemePreference = "system" | "light" | "dark";
export type VisualStyle = "classic" | "gradient";

interface ThemeContextValue {
  c: Palette;
  scheme: "light" | "dark";
  preference: ThemePreference;
  setPreference: (next: ThemePreference) => void;
  visualStyle: VisualStyle;
  setVisualStyle: (next: VisualStyle) => void;
}

const STORAGE_KEY = "thapar.theme";
const STYLE_STORAGE_KEY = "thapar.visualStyle";

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [visualStyle, setVisualStyleState] = useState<VisualStyle>("classic");

  useEffect(() => {
    void Promise.all([
      AsyncStorage.getItem(STORAGE_KEY),
      AsyncStorage.getItem(STYLE_STORAGE_KEY),
    ]).then(([storedTheme, storedStyle]) => {
      if (storedTheme === "light" || storedTheme === "dark" || storedTheme === "system") {
        setPreferenceState(storedTheme);
      }
      if (storedStyle === "classic" || storedStyle === "gradient") {
        setVisualStyleState(storedStyle);
      }
    });
  }, []);

  const value = useMemo<ThemeContextValue>(() => {
    const scheme: "light" | "dark" =
      preference === "system"
        ? systemScheme === "dark"
          ? "dark"
          : "light"
        : preference;

    return {
      c: scheme === "dark" ? dark : light,
      scheme,
      preference,
      setPreference: (next) => {
        setPreferenceState(next);
        void AsyncStorage.setItem(STORAGE_KEY, next);
      },
      visualStyle,
      setVisualStyle: (next) => {
        setVisualStyleState(next);
        void AsyncStorage.setItem(STYLE_STORAGE_KEY, next);
      },
    };
  }, [preference, systemScheme, visualStyle]);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>.");
  return ctx;
}
