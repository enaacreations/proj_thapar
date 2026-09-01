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

interface ThemeContextValue {
  c: Palette;
  scheme: "light" | "dark";
  preference: ThemePreference;
  setPreference: (next: ThemePreference) => void;
}

const STORAGE_KEY = "thapar.theme";

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");

  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === "light" || stored === "dark" || stored === "system") {
        setPreferenceState(stored);
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
    };
  }, [preference, systemScheme]);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>.");
  return ctx;
}
