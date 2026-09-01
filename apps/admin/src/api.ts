import {
  ADMIN_ROUTES,
  type AdminDashboard,
  type AdminFeedbackEntry,
  type AdminRequestDetail,
  type AdminRequestSummary,
  type AdminResidentDetail,
  type AdminResidentSummary,
  type AdminSession,
  type AdminUser,
  type AllocateRoomBody,
  type ApiError,
  type PaymentPlanBody,
  type PaymentSummary,
  type RecordPaymentBody,
  type RegistrationCounts,
  type RegistrationDetail,
  type RegistrationSummary,
  type RequestStatus,
  type ResidentAccountStatus,
  type RoomDetails,
  type ServiceRequestKind,
  ADMIN_ONBOARDING_ROUTES,
  type AdminOnboardingDetail,
  type AdminOnboardingRow,
  type IssueLeaseBody,
  type KycState,
  type LeaseAgreement,
  type RoommateMatch,
  ADMIN_FINANCE_ROUTES,
  type AdminDepositRow,
  type AdminInvoiceRow,
  type AdminPaymentRow,
  type DepositState,
  type GenerateInvoicesResult,
} from "@proj/shared";

/** Vite proxies /api to the Express server in dev, so this stays same-origin. */
const BASE = import.meta.env.VITE_API_URL ?? "";

const TOKEN_KEY = "thapar.admin.token";

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

  /* dashboard */
  dashboard: () => request<AdminDashboard>(ADMIN_ROUTES.dashboard),

  /* requests */
  requests: (filter: { kind?: ServiceRequestKind; status?: RequestStatus }) => {
    const params = new URLSearchParams();
    if (filter.kind) params.set("kind", filter.kind);
    if (filter.status) params.set("status", filter.status);
    const query = params.toString();
    return request<AdminRequestSummary[]>(
      query ? `${ADMIN_ROUTES.requests}?${query}` : ADMIN_ROUTES.requests
    );
  },

  requestDetail: (kind: ServiceRequestKind, id: string) =>
    request<AdminRequestDetail>(ADMIN_ROUTES.request(kind, id)),

  setRequestStatus: (
    kind: ServiceRequestKind,
    id: string,
    status: RequestStatus,
    note?: string
  ) =>
    request<AdminRequestDetail>(ADMIN_ROUTES.requestStatus(kind, id), {
      method: "POST",
      body: { status, note },
    }),

  /* residents */
  residents: (search?: string) =>
    request<AdminResidentSummary[]>(
      search
        ? `${ADMIN_ROUTES.residents}?search=${encodeURIComponent(search)}`
        : ADMIN_ROUTES.residents
    ),

  resident: (id: string) =>
    request<AdminResidentDetail>(ADMIN_ROUTES.resident(id)),

  allocateRoom: (id: string, body: AllocateRoomBody) =>
    request<RoomDetails>(ADMIN_ROUTES.residentRoom(id), {
      method: "PUT",
      body,
    }),

  setPaymentPlan: (id: string, body: PaymentPlanBody) =>
    request<PaymentSummary>(ADMIN_ROUTES.residentPlan(id), {
      method: "PUT",
      body,
    }),

  recordPayment: (id: string, body: RecordPaymentBody) =>
    request<PaymentSummary>(ADMIN_ROUTES.residentPayments(id), {
      method: "POST",
      body,
    }),

  /* feedback */
  feedback: () => request<AdminFeedbackEntry[]>(ADMIN_ROUTES.feedback),

  /* onboarding */
  onboardingQueue: () =>
    request<AdminOnboardingRow[]>(ADMIN_ONBOARDING_ROUTES.queue),

  onboardingDetail: (id: string) =>
    request<AdminOnboardingDetail>(ADMIN_ONBOARDING_ROUTES.resident(id)),

  reviewKyc: (id: string, decision: "verified" | "rejected", reason?: string) =>
    request<KycState>(ADMIN_ONBOARDING_ROUTES.reviewKyc(id), {
      method: "POST",
      body: { decision, reason },
    }),

  issueLease: (id: string, body: IssueLeaseBody) =>
    request<LeaseAgreement>(ADMIN_ONBOARDING_ROUTES.issueLease(id), {
      method: "POST",
      body,
    }),

  compatibility: (id: string) =>
    request<RoommateMatch[]>(ADMIN_ONBOARDING_ROUTES.compatibility(id)),

  /* finance */
  financeInvoices: () =>
    request<AdminInvoiceRow[]>(ADMIN_FINANCE_ROUTES.invoices),

  generateInvoices: (periodFrom: string) =>
    request<GenerateInvoicesResult>(ADMIN_FINANCE_ROUTES.generateInvoices, {
      method: "POST",
      body: { periodFrom },
    }),

  voidInvoice: (id: string) =>
    request<AdminInvoiceRow>(ADMIN_FINANCE_ROUTES.voidInvoice(id), {
      method: "POST",
    }),

  financePayments: () =>
    request<AdminPaymentRow[]>(ADMIN_FINANCE_ROUTES.payments),

  financeDeposits: () =>
    request<AdminDepositRow[]>(ADMIN_FINANCE_ROUTES.deposits),

  deposit: (residentId: string) =>
    request<DepositState>(ADMIN_FINANCE_ROUTES.deposit(residentId)),

  addDeduction: (
    residentId: string,
    body: { amount: number; reason: string }
  ) =>
    request<DepositState>(ADMIN_FINANCE_ROUTES.depositDeduction(residentId), {
      method: "POST",
      body,
    }),

  refundDeposit: (residentId: string, reference?: string) =>
    request<DepositState>(ADMIN_FINANCE_ROUTES.depositRefund(residentId), {
      method: "POST",
      body: { reference },
    }),
};

export function messageOf(err: unknown): string {
  if (err instanceof ApiRequestError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong. Please try again.";
}
