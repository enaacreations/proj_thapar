import type {
  FeedbackEntry,
  PaymentMode,
  PaymentSummary,
  RequestStatus,
  ResidentAccountStatus,
  RoomDetails,
  ServiceRequestKind,
  ServiceRequestSummary,
  TrackingEvent,
} from "./types";

/**
 * Contracts for the admin (ops excellence) web app. Kept separate from the
 * resident contracts so it's obvious which surface an endpoint belongs to.
 */

export type AdminRole = "ops_excellence" | "warden";

export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  ops_excellence: "Ops excellence",
  warden: "Warden",
};

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
}

export interface AdminLoginBody {
  email: string;
  password: string;
}

export interface AdminSession {
  token: string;
  admin: AdminUser;
  expiresAt: string;
}

/* -------------------------------------------------- registration review */

/** A registration as the reviewer sees it: KYC masked until they ask. */
export interface RegistrationSummary {
  residentId: string;
  fullName: string;
  mobile: string;
  gender: "male" | "female" | "other";
  age: number;
  dobMasked: string;
  kycType: "pan" | "aadhaar";
  kycMasked: string;
  status: ResidentAccountStatus;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNote: string | null;
}

/** Detail view adds the full values, which is an audited action. */
export interface RegistrationDetail extends RegistrationSummary {
  dob: string;
  kycNumber: string;
}

export interface ReviewDecisionBody {
  /** Required when rejecting — the resident is told why. */
  note?: string;
}

export interface RegistrationCounts {
  pending: number;
  approved: number;
  rejected: number;
}

/* --------------------------------------------------------------- requests */

export interface AdminRequestSummary extends ServiceRequestSummary {
  residentId: string;
  residentName: string;
  roomNumber: string | null;
}

export interface AdminRequestDetail extends AdminRequestSummary {
  /**
   * Kind-specific fields flattened to label/value pairs so one detail screen
   * renders maintenance, laundry, complaints and visits alike.
   */
  details: { label: string; value: string }[];
  photoUris: string[];
  timeline: TrackingEvent[];
}

/** What an admin is allowed to move a request to. */
export const ADMIN_STATUS_OPTIONS: RequestStatus[] = [
  "in_progress",
  "resolved",
  "rejected",
];

export interface UpdateRequestStatusBody {
  status: RequestStatus;
  /** Required when rejecting — the resident reads it on the timeline. */
  note?: string;
}

/* -------------------------------------------------------------- residents */

export interface AdminResidentSummary {
  id: string;
  fullName: string;
  mobile: string;
  accountStatus: ResidentAccountStatus;
  roomNumber: string | null;
  propertyName: string | null;
  openRequests: number;
}

export interface AdminResidentDetail {
  id: string;
  fullName: string;
  mobile: string;
  age: number;
  gender: "male" | "female" | "other";
  dob: string;
  kycType: "pan" | "aadhaar";
  kycMasked: string;
  accountStatus: ResidentAccountStatus;
  joinedAt: string;
  room: RoomDetails | null;
  payments: PaymentSummary | null;
  attendance: {
    todayMarked: boolean;
    presentDays: number;
    totalDays: number;
    streak: number;
  };
  recentRequests: ServiceRequestSummary[];
}

export type AllocateRoomBody = RoomDetails;

export interface PaymentPlanBody {
  plan: string;
  paidUpTo: string;
  nextDueOn: string | null;
  nextDueAmount: number | null;
}

export interface RecordPaymentBody {
  paidOn: string;
  amount: number;
  mode: PaymentMode;
  periodFrom: string;
  periodTo: string;
  receiptNo: string;
}

/* --------------------------------------------------- feedback + dashboard */

export interface AdminFeedbackEntry extends FeedbackEntry {
  residentId: string;
  residentName: string;
}

export interface AdminDashboard {
  registrations: RegistrationCounts;
  openRequests: number;
  requestsByKind: Record<ServiceRequestKind, number>;
  residents: { total: number; withRoom: number };
  attendanceToday: number;
  averageRating: number | null;
  finance: {
    outstanding: number;
    overdueInvoices: number;
    depositsHeld: number;
    refundsPending: number;
  };
}

export const ADMIN_ROUTES = {
  login: "/api/admin/auth/login",
  logout: "/api/admin/auth/logout",
  me: "/api/admin/auth/me",

  dashboard: "/api/admin/dashboard",

  counts: "/api/admin/registrations/counts",
  registrations: "/api/admin/registrations",
  registration: (id: string) => `/api/admin/registrations/${id}`,
  approve: (id: string) => `/api/admin/registrations/${id}/approve`,
  reject: (id: string) => `/api/admin/registrations/${id}/reject`,

  requests: "/api/admin/requests",
  request: (kind: ServiceRequestKind, id: string) =>
    `/api/admin/requests/${kind}/${id}`,
  requestStatus: (kind: ServiceRequestKind, id: string) =>
    `/api/admin/requests/${kind}/${id}/status`,

  residents: "/api/admin/residents",
  resident: (id: string) => `/api/admin/residents/${id}`,
  residentRoom: (id: string) => `/api/admin/residents/${id}/room`,
  residentPlan: (id: string) => `/api/admin/residents/${id}/payment-plan`,
  residentPayments: (id: string) => `/api/admin/residents/${id}/payments`,

  feedback: "/api/admin/feedback",
} as const;
