import {
  ADMIN_ROUTES,
  type AdminSession,
  type AdminUser,
  type ApiError,
  type RegistrationCounts,
  type RegistrationDetail,
  type RegistrationSummary,
  type ResidentAccountStatus,
} from "@proj/shared";

/** Vite proxies /api to the Express server in dev, so this stays same-origin. */
const BASE = import.meta.env.VITE_API_URL ?? "";

const TOKEN_KEY = "uniliv.admin.token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

async function request<T>(
  path: string,
  init?: Omit<RequestInit, "body"> & { body?: unknown }
): Promise<T> {
  let res: Response;

  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      headers: {
        "Content-Type": "application/json",
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiRequestError(
      0,
      "network_error",
      "Can't reach the server. Check that the API is running."
    );
  }

  if (res.status === 401) {
    // Session died — clear it so the app falls back to the login screen.
    setToken(null);
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiError | null;
    throw new ApiRequestError(
      res.status,
      body?.error ?? "unknown_error",
      body?.message ?? "Something went wrong. Please try again."
    );
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  login: (email: string, password: string) =>
    request<AdminSession>(ADMIN_ROUTES.login, {
      method: "POST",
      body: { email, password },
    }),

  logout: () => request<void>(ADMIN_ROUTES.logout, { method: "POST" }),

  me: () => request<AdminUser>(ADMIN_ROUTES.me),

  counts: () => request<RegistrationCounts>(ADMIN_ROUTES.counts),

  registrations: (status?: ResidentAccountStatus) =>
    request<RegistrationSummary[]>(
      status
        ? `${ADMIN_ROUTES.registrations}?status=${status}`
        : ADMIN_ROUTES.registrations
    ),

  registration: (id: string) =>
    request<RegistrationDetail>(ADMIN_ROUTES.registration(id)),

  approve: (id: string, note?: string) =>
    request<RegistrationDetail>(ADMIN_ROUTES.approve(id), {
      method: "POST",
      body: { note },
    }),

  reject: (id: string, note: string) =>
    request<RegistrationDetail>(ADMIN_ROUTES.reject(id), {
      method: "POST",
      body: { note },
    }),
};

export function messageOf(err: unknown): string {
  if (err instanceof ApiRequestError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong. Please try again.";
}
