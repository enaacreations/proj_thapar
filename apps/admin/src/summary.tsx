import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AdminDashboard } from "@proj/shared";
import { api, messageOf } from "./api";

interface SummaryValue {
  data: AdminDashboard | null;
  error: string | null;
  reload: () => void;
}

const SummaryContext = createContext<SummaryValue | null>(null);

/**
 * One dashboard fetch feeds the whole shell — sidebar counts, the notification
 * bell and the Home tiles all read the same numbers, so they never disagree.
 */
export function SummaryProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let live = true;
    api
      .dashboard()
      .then((d) => {
        if (live) {
          setData(d);
          setError(null);
        }
      })
      .catch((e) => {
        if (live) setError(messageOf(e));
      });
    return () => {
      live = false;
    };
  }, [nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  const value = useMemo<SummaryValue>(
    () => ({ data, error, reload }),
    [data, error, reload]
  );

  return (
    <SummaryContext.Provider value={value}>{children}</SummaryContext.Provider>
  );
}

export function useSummary(): SummaryValue {
  const ctx = useContext(SummaryContext);
  if (!ctx) throw new Error("useSummary must be used inside <SummaryProvider>.");
  return ctx;
}
