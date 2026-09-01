import { useCallback, useEffect, useState } from "react";
import { ApiRequestError } from "../api/client";

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  setData: (next: T) => void;
}

/**
 * Small fetch-on-mount hook. Enough for this app's screens; swap for React
 * Query if caching or background refetch becomes a requirement.
 */
export function useAsync<T>(
  loader: () => Promise<T>,
  deps: unknown[] = []
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // The loader closes over `deps`; callers pass what it actually depends on.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(loader, deps);

  const reload = useCallback(async () => {
    setError(null);
    try {
      setData(await run());
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setLoading(false);
    }
  }, [run]);

  useEffect(() => {
    let alive = true;

    setLoading(true);
    run()
      .then((result) => {
        if (alive) {
          setData(result);
          setError(null);
        }
      })
      .catch((err) => {
        if (alive) setError(messageOf(err));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [run]);

  return { data, loading, error, reload, setData };
}

export function messageOf(err: unknown): string {
  if (err instanceof ApiRequestError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong. Please try again.";
}
