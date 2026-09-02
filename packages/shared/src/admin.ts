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

/* --------------------------------------------------------------- settings */

/**
 * The circle attendance is measured against. Marking in outside it is flagged,
 * not blocked, so this tunes reporting rather than gating anyone out.
 */
/**
 * The site keeps two circles, because one can't do both jobs.
 *
 * "hostel" answers "is this resident on the property?" — it's wide, and
 * attendance is measured against it. "mess" answers "is this resident standing
 * at the servery?" — it's tight, and a self-recorded meal is *refused* outside
 * it. Sharing one circle would force a choice between a fence so wide a
 * resident can claim a plate from their room and one so tight nobody can mark
 * attendance from their own block.
 */
export type GeofenceKind = "hostel" | "mess";

export const GEOFENCE_KINDS: GeofenceKind[] = ["hostel", "mess"];

export interface SiteGeofence {
  latitude: number;
  longitude: number;
  radiusMetres: number;
  /** Shown on a resident's record when they mark in inside the circle. */
  locationLabel: string;
  /** Null until an admin saves it for the first time. */
  updatedAt: string | null;
  updatedBy: string | null;
  /**
   * False when nothing has been saved for this fence and the values above are
   * borrowed from the hostel one. Only ever false for "mess": a deployment that
   * has never opened the settings page still has a working hostel fence from
   * the shipped defaults, but its mess fence is a guess and the console says so.
   */
  configured: boolean;
}

/** Both circles, so the settings page loads in one round trip. */
export type SiteGeofences = Record<GeofenceKind, SiteGeofence>;

export type UpdateGeofenceBody = Omit<
  SiteGeofence,
  "updatedAt" | "updatedBy" | "configured"
>;

/** Where the campus sits until someone changes it in the admin console. */
export const DEFAULT_GEOFENCE: UpdateGeofenceBody = {
  latitude: 30.3549,
  longitude: 76.3626,
  radiusMetres: 300,
  locationLabel: "Thapar, Block B",
};

/**
 * What the console suggests for a new mess fence. A servery is one building,
 * so this is far tighter than the hostel default — but it's only a starting
 * value in the form, never applied on the resident's behalf.
 */
export const SUGGESTED_MESS_RADIUS_METRES = 75;

/** Guard rails the API enforces and the console shows as helper text. */
export const GEOFENCE_LIMITS = {
  latitude: { min: -90, max: 90 },
  longitude: { min: -180, max: 180 },
  radiusMetres: { min: 25, max: 5000 },
} as const;

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

  geofences: "/api/admin/settings/geofences",
  geofence: (kind: GeofenceKind) => `/api/admin/settings/geofence/${kind}`,

  messScan: "/api/admin/mess/scan",
} as const;
