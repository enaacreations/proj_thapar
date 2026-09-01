import type { PaymentMode } from "./types";

/**
 * Financial and lease-management contracts: invoices, payments, auto-debit
 * mandates, instalment plans, security deposits, split bills and documents.
 *
 * Money is always whole rupees. Nothing in this domain has paise, and integers
 * avoid every floating-point rounding problem that comes with currency.
 */

/* ------------------------------------------------------------- invoices */

export type InvoiceStatus =
  | "issued"
  | "part_paid"
  | "paid"
  | "overdue"
  | "void";

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  issued: "Due",
  part_paid: "Partly paid",
  paid: "Paid",
  overdue: "Overdue",
  void: "Cancelled",
};

export interface InvoiceLine {
  description: string;
  amount: number;
}

export interface Invoice {
  id: string;
  number: string;
  residentId: string;
  periodFrom: string;
  periodTo: string;
  issuedAt: string;
  dueOn: string;
  lines: InvoiceLine[];
  total: number;
  amountPaid: number;
  status: InvoiceStatus;
}

/* ------------------------------------------------------------- payments */

export type PaymentMethod = "upi" | "card" | "netbanking" | "mandate";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  upi: "UPI",
  card: "Card",
  netbanking: "Net banking",
  mandate: "Auto-debit",
};

export type PaymentOrderStatus =
  | "created"
  | "pending"
  | "succeeded"
  | "failed"
  | "cancelled";

export const ORDER_STATUS_LABELS: Record<PaymentOrderStatus, string> = {
  created: "Starting",
  pending: "Waiting for your bank",
  succeeded: "Paid",
  failed: "Failed",
  cancelled: "Cancelled",
};

export interface PaymentOrder {
  id: string;
  residentId: string;
  invoiceId: string | null;
  splitShareId: string | null;
  amount: number;
  method: PaymentMethod;
  provider: string;
  providerRef: string | null;
  status: PaymentOrderStatus;
  failureReason: string | null;
  createdAt: string;
  completedAt: string | null;
  /**
   * Where the app sends the user to authorise. Null for auto-debit, which
   * needs no interaction once the mandate is active.
   */
  authorisationUrl: string | null;
}

export interface StartPaymentBody {
  /** One of these two is required. */
  invoiceId?: string;
  splitShareId?: string;
  amount: number;
  method: PaymentMethod;
  /** Retrying with the same key returns the original order, never a second charge. */
  idempotencyKey: string;
}

/* ------------------------------------------------------------- mandates */

export type MandateStatus =
  | "pending"
  | "active"
  | "paused"
  | "revoked"
  | "failed";

export const MANDATE_STATUS_LABELS: Record<MandateStatus, string> = {
  pending: "Waiting for approval",
  active: "Active",
  paused: "Paused",
  revoked: "Cancelled",
  failed: "Setup failed",
};

export interface Mandate {
  id: string;
  status: MandateStatus;
  provider: string;
  providerRef: string | null;
  /** Ceiling per debit; the bank will refuse anything above it. */
  maxAmount: number;
  dayOfMonth: number;
  startDate: string;
  endDate: string | null;
  createdAt: string;
  approvalUrl: string | null;
}

export interface CreateMandateBody {
  maxAmount: number;
  dayOfMonth: number;
  endDate?: string | null;
}

/* --------------------------------------------------------- instalments */

export type InstalmentStatus = "due" | "paid" | "overdue";

export interface Instalment {
  id: string;
  seq: number;
  dueOn: string;
  amount: number;
  status: InstalmentStatus;
  paidAt: string | null;
}

export interface InstalmentPlan {
  id: string;
  invoiceId: string;
  /** Principal, before the convenience fee. */
  principal: number;
  feeAmount: number;
  totalPayable: number;
  count: number;
  instalments: Instalment[];
  createdAt: string;
}

export interface CreateInstalmentPlanBody {
  invoiceId: string;
  count: number;
}

/** What splitting an invoice would cost, before committing to it. */
export interface InstalmentQuote {
  count: number;
  perInstalment: number;
  feeAmount: number;
  totalPayable: number;
  /** Flat percentage applied to the principal. */
  feePercent: number;
}

/* -------------------------------------------------------------- deposit */

export type DepositStatus =
  | "none"
  | "held"
  | "refund_initiated"
  | "refunded"
  | "forfeited";

export const DEPOSIT_STATUS_LABELS: Record<DepositStatus, string> = {
  none: "Not collected",
  held: "Held",
  refund_initiated: "Refund in progress",
  refunded: "Refunded",
  forfeited: "Forfeited",
};

export interface DepositDeduction {
  id: string;
  amount: number;
  reason: string;
  /** Links a deduction to the item recorded at move-in, when there is one. */
  inventoryItemId: string | null;
  createdBy: string;
  createdAt: string;
}

export interface DepositState {
  status: DepositStatus;
  amount: number;
  heldSince: string | null;
  deductions: DepositDeduction[];
  totalDeducted: number;
  refundable: number;
  refundInitiatedAt: string | null;
  refundedAt: string | null;
  refundReference: string | null;
  /** Plain-language rules, shown to the resident up front. */
  policy: string[];
}

export interface AddDeductionBody {
  amount: number;
  reason: string;
  inventoryItemId?: string | null;
}

/* ---------------------------------------------------------- split bills */

export type SplitCategory =
  | "utilities"
  | "groceries"
  | "event"
  | "cleaning"
  | "other";

export const SPLIT_CATEGORY_LABELS: Record<SplitCategory, string> = {
  utilities: "Utilities",
  groceries: "Groceries",
  event: "Event",
  cleaning: "Cleaning",
  other: "Other",
};

export type ShareStatus = "pending" | "settled";

export interface SplitShare {
  id: string;
  residentId: string;
  residentName: string;
  amount: number;
  status: ShareStatus;
  settledAt: string | null;
  /** True for the person reading it, so the app can say "you". */
  isMe: boolean;
}

export interface SplitBill {
  id: string;
  title: string;
  category: SplitCategory;
  note: string;
  totalAmount: number;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  settledAt: string | null;
  shares: SplitShare[];
  /** True when the reader created it — only they can delete it. */
  isOwner: boolean;
}

export interface CreateSplitBillBody {
  title: string;
  category: SplitCategory;
  note?: string;
  totalAmount: number;
  /** Resident ids to split between, including the creator. */
  participantIds: string[];
}

export interface SplitSummary {
  bills: SplitBill[];
  /** Positive: others owe you. Negative: you owe. */
  netBalance: number;
  youOwe: number;
  owedToYou: number;
}

/** Someone a bill can be split with — roommates first. */
export interface SplitCandidate {
  residentId: string;
  fullName: string;
  roomNumber: string | null;
  sameRoom: boolean;
}

/* ------------------------------------------------------------ documents */

export type DocumentKind = "invoice" | "receipt" | "hra" | "ledger";

export const DOCUMENT_LABELS: Record<DocumentKind, string> = {
  invoice: "Invoice",
  receipt: "Rent receipt",
  hra: "HRA statement",
  ledger: "Account statement",
};

export interface DocumentRef {
  kind: DocumentKind;
  id: string;
  title: string;
  subtitle: string;
  issuedAt: string;
}

export interface DocumentTokenResponse {
  /** Short-lived signed URL — safe to hand to the system browser. */
  url: string;
  expiresInSeconds: number;
}

/* ------------------------------------------------------------- overview */

export interface FinanceOverview {
  /** Sum of every unpaid invoice. */
  outstanding: number;
  nextDueOn: string | null;
  nextDueAmount: number | null;
  overdueCount: number;
  invoices: Invoice[];
  mandate: Mandate | null;
  deposit: DepositState;
  activePlan: InstalmentPlan | null;
  splitNetBalance: number;
}

export const FINANCE_ROUTES = {
  overview: "/api/finance/overview",

  invoices: "/api/finance/invoices",
  invoice: (id: string) => `/api/finance/invoices/${id}`,

  startPayment: "/api/finance/payments",
  payment: (id: string) => `/api/finance/payments/${id}`,
  payments: "/api/finance/payments",

  mandate: "/api/finance/mandate",
  mandatePause: "/api/finance/mandate/pause",

  instalmentQuote: (invoiceId: string, count: number) =>
    `/api/finance/instalments/quote?invoiceId=${invoiceId}&count=${count}`,
  instalmentPlans: "/api/finance/instalments",

  deposit: "/api/finance/deposit",

  splits: "/api/finance/splits",
  split: (id: string) => `/api/finance/splits/${id}`,
  splitCandidates: "/api/finance/splits/candidates",

  documents: "/api/finance/documents",
  documentToken: "/api/finance/documents/token",
} as const;

export const ADMIN_FINANCE_ROUTES = {
  invoices: "/api/admin/finance/invoices",
  generateInvoices: "/api/admin/finance/invoices/generate",
  voidInvoice: (id: string) => `/api/admin/finance/invoices/${id}/void`,

  payments: "/api/admin/finance/payments",

  deposits: "/api/admin/finance/deposits",
  deposit: (residentId: string) =>
    `/api/admin/finance/deposits/${residentId}`,
  depositDeduction: (residentId: string) =>
    `/api/admin/finance/deposits/${residentId}/deductions`,
  depositRefund: (residentId: string) =>
    `/api/admin/finance/deposits/${residentId}/refund`,
} as const;

export interface AdminInvoiceRow extends Invoice {
  residentName: string;
  roomNumber: string | null;
}

export interface AdminPaymentRow extends PaymentOrder {
  residentName: string;
  invoiceNumber: string | null;
}

export interface AdminDepositRow {
  residentId: string;
  residentName: string;
  roomNumber: string | null;
  status: DepositStatus;
  amount: number;
  totalDeducted: number;
  refundable: number;
}

export interface GenerateInvoicesBody {
  /** First day of the month to bill, e.g. "2026-10-01". */
  periodFrom: string;
}

export interface GenerateInvoicesResult {
  created: number;
  skipped: number;
  invoices: AdminInvoiceRow[];
}

export interface RefundDepositBody {
  reference: string;
}
