import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AdminUser } from "@proj/shared";
import { api, getToken, setToken } from "./api";

interface AuthValue {
  admin: AdminUser | null;
  /** True until the stored token has been checked against the server. */
  restoring: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setRestoring(false);
      return;
    }
    // A token in storage proves nothing — the server decides if it's still live.
    api
      .me()
      .then(setAdmin)
      .catch(() => setToken(null))
      .finally(() => setRestoring(false));
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const session = await api.login(email, password);
    setToken(session.token);
    setAdmin(session.admin);
  }, []);

  const signOut = useCallback(async () => {
    // Best effort: drop the local session even if the server call fails.
    await api.logout().catch(() => undefined);
    setToken(null);
    setAdmin(null);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ admin, restoring, signIn, signOut }),
    [admin, restoring, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>.");
  return ctx;
}
