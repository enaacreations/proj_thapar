import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AuthSession } from "@proj/shared";
import { api, setAuthToken } from "../api/client";

interface StoredSession {
  token: string;
  residentId: string;
  mobile: string;
  mpinSet: boolean;
  biometricEnabled: boolean;
}

interface AuthContextValue {
  session: StoredSession | null;
  /** True until the stored session has been read from disk. */
  restoring: boolean;
  /** Remembered between launches so returning users land on MPIN, not OTP. */
  lastMobile: string | null;
  signIn: (session: AuthSession, mobile: string) => Promise<void>;
  completeMpinSetup: (
    session: AuthSession,
    biometricEnabled: boolean
  ) => Promise<void>;
  signOut: () => Promise<void>;
}

const SESSION_KEY = "uniliv.session";
const LAST_MOBILE_KEY = "uniliv.lastMobile";

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [lastMobile, setLastMobile] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    void (async () => {
      const [stored, mobile] = await Promise.all([
        AsyncStorage.getItem(SESSION_KEY),
        AsyncStorage.getItem(LAST_MOBILE_KEY),
      ]);

      if (stored) {
        try {
          const parsed = JSON.parse(stored) as StoredSession;
          setAuthToken(parsed.token);
          setSession(parsed);
        } catch {
          await AsyncStorage.removeItem(SESSION_KEY);
        }
      }
      setLastMobile(mobile);
      setRestoring(false);
    })();
  }, []);

  const persist = useCallback(async (next: StoredSession) => {
    setAuthToken(next.token);
    setSession(next);
    setLastMobile(next.mobile);
    await Promise.all([
      AsyncStorage.setItem(SESSION_KEY, JSON.stringify(next)),
      AsyncStorage.setItem(LAST_MOBILE_KEY, next.mobile),
    ]);
  }, []);

  const signIn = useCallback(
    async (auth: AuthSession, mobile: string) => {
      await persist({
        token: auth.token,
        residentId: auth.residentId,
        mobile,
        mpinSet: auth.mpinSet,
        biometricEnabled: false,
      });
    },
    [persist]
  );

  const completeMpinSetup = useCallback(
    async (auth: AuthSession, biometricEnabled: boolean) => {
      await persist({
        token: auth.token,
        residentId: auth.residentId,
        mobile: session?.mobile ?? lastMobile ?? "",
        mpinSet: true,
        biometricEnabled,
      });
    },
    [persist, session?.mobile, lastMobile]
  );

  const signOut = useCallback(async () => {
    setAuthToken(null);
    setSession(null);
    // The mobile number is deliberately kept so sign-in stays one tap away.
    await AsyncStorage.removeItem(SESSION_KEY);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ session, restoring, lastMobile, signIn, completeMpinSetup, signOut }),
    [session, restoring, lastMobile, signIn, completeMpinSetup, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>.");
  return ctx;
}

/** Convenience for screens that only need the api after auth is guaranteed. */
export { api };
