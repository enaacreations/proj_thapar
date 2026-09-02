/**
 * Contracts shared between the Express API and the React Native app.
 * Changing anything here surfaces as a type error on both sides.
 */

/* ------------------------------------------------------------------ common */

export interface ApiError {
  error: string;
  message: string;
}

export interface HealthResponse {
  status: "ok";
  uptime: number;
  timestamp: string;
}

/** Every request/complaint in the app shares this lifecycle. */
export type RequestStatus =
  | "submitted"
  | "in_progress"
  | "resolved"
  | "rejected"
  | "cancelled";

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  submitted: "Submitted",
  in_progress: "In progress",
  resolved: "Resolved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

/** One entry in a request's audit trail — drives the tracking timeline. */
export interface TrackingEvent {
  status: RequestStatus;
  note: string;
  at: string;
}

export interface CategoryOption {
  id: string;
  label: string;
  subCategories: { id: string; label: string }[];
}

/* -------------------------------------------------------------------- auth */

export type ResidentAccountStatus = "pending_approval" | "approved" | "rejected";

export interface RegistrationBody {
  fullName: string;
  dob: string;
  gender: "male" | "female" | "other";
  kycType: "pan" | "aadhaar";
  kycNumber: string;
  mobile: string;
}

export interface RegistrationResponse {
  requestId: string;
  status: ResidentAccountStatus;
  message: string;
}

export interface SendOtpBody {
  mobile: string;
}

export interface SendOtpResponse {
  /**
   * Echoed back only in development and for the allow-listed demo / App Review
   * numbers, so the app can prefill the code. Absent in production for every
   * real number — echoing it there would be an account-takeover backdoor.
   */
  devOtp?: string;
  expiresInSeconds: number;
}

export interface VerifyOtpBody {
  mobile: string;
  otp: string;
}

export interface AuthSession {
  token: string;
  residentId: string;
  /** False on first-ever login — the app then runs MPIN setup. */
  mpinSet: boolean;
}

export interface SetMpinBody {
  mpin: string;
  biometricEnabled: boolean;
}

export interface MpinLoginBody {
  mobile: string;
  mpin: string;
}

/* ----------------------------------------------------------------- profile */

export interface MaskedValue {
  /** Safe to render directly, e.g. "XXXXXX1234". */
  masked: string;
  /** Full value; only sent when the resident taps "unmask". */
  full?: string;
}

export interface ResidentProfile {
  id: string;
  fullName: string;
  age: number;
  gender: "male" | "female" | "other";
  dob: MaskedValue;
  kycType: "pan" | "aadhaar";
  kycNumber: MaskedValue;
  mobile: string;
  photoUrl: string | null;
  accountStatus: ResidentAccountStatus;
  /** Whether the resident can mark attendance with their face yet. */
  faceEnrolled: boolean;
}

/* --------------------------------------------------------- face enrolment */

export interface FaceEnrolmentStatus {
  enrolled: boolean;
  /** ISO timestamp of the enrolment, null when not enrolled. */
  enrolledAt: string | null;
}

export interface EnrolFaceBody {
  /** A JPEG/PNG selfie, base64-encoded. Not stored — only its descriptor is. */
  photoBase64: string;
}

/* -------------------------------------------------------------------- room */

export interface RoomDetails {
  roomNumber: string;
  floor: string;
  wing: string;
  buildingName: string;
  propertyName: string;
  propertyAddress: string;
  roomType: string;
  occupancy: string;
}

/* ---------------------------------------------------------------- payments */

export type PaymentMode = "cash" | "upi" | "card" | "netbanking";

export interface PaymentLedgerEntry {
  id: string;
  paidOn: string;
  amount: number;
  mode: PaymentMode;
  periodFrom: string;
  periodTo: string;
  receiptNo: string;
}

export interface PaymentSummary {
  plan: string;
  paidUpTo: string;
  totalPaid: number;
  nextDueOn: string | null;
  nextDueAmount: number | null;
  entries: PaymentLedgerEntry[];
}

/* -------------------------------------------------------------------- food */

export type MealType = "breakfast" | "lunch" | "snacks" | "dinner";

export const MEAL_TYPES: MealType[] = [
  "breakfast",
  "lunch",
  "snacks",
  "dinner",
];

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  snacks: "Snacks",
  dinner: "Dinner",
};

export interface MenuItem {
  name: string;
  veg: boolean;
}

export interface DayMenu {
  date: string;
  meals: Record<MealType, { servingWindow: string; items: MenuItem[] }>;
}

/** Which meals a recurring plan covers. */
export type MealOptIn = Record<MealType, boolean>;

export interface FoodPause {
  from: string;
  to: string;
}

/**
 * The recurring mess plan. Separate from day-by-day booking on purpose:
 * choosing to eat in the mess tomorrow shouldn't sign anyone up for every meal
 * from now on. `recurring` is off until the resident turns it on.
 */
export interface FoodPreferences {
  recurring: boolean;
  /** Which meals the plan covers. Meaningless while `recurring` is false. */
  optIn: MealOptIn;
  /** Set while the plan is paused — going home for a week, say. */
  pause: FoodPause | null;
}

export interface UpdateFoodPlanBody {
  recurring?: boolean;
  meals?: Partial<MealOptIn>;
}

export interface PauseFoodBody {
  from: string;
  to: string;
}

/* --------------------------------------------------- day-by-day bookings */

/** Why a meal is or isn't booked, so the app can say which without guessing. */
export type MealBookingSource =
  /** The resident picked this meal, or skipped it, for this day specifically. */
  | "chosen"
  /** Carried over from the recurring plan. */
  | "plan"
  /** No plan and no choice — nothing is booked. */
  | "none";

export interface MealBooking {
  meal: MealType;
  booked: boolean;
  source: MealBookingSource;
  /** False for days already gone. The past isn't a plan any more. */
  editable: boolean;
}

export interface DayBookings {
  date: string;
  meals: MealBooking[];
}

export interface SetMealBookingBody {
  date: string;
  meal: MealType;
  booked: boolean;
}

/* ------------------------------------------------- requests (shared shape) */

/** Maintenance, laundry, complaints and visits all surface as one of these. */
export type ServiceRequestKind =
  | "maintenance"
  | "laundry"
  | "complaint"
  | "visit";

export interface ServiceRequestSummary {
  id: string;
  kind: ServiceRequestKind;
  title: string;
  status: RequestStatus;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------- maintenance */

export interface MaintenanceRequest extends ServiceRequestSummary {
  kind: "maintenance";
  categoryId: string;
  categoryLabel: string;
  subCategoryId: string;
  subCategoryLabel: string;
  remarks: string;
  photoUris: string[];
  timeline: TrackingEvent[];
}

export interface CreateMaintenanceBody {
  categoryId: string;
  subCategoryId: string;
  remarks: string;
  photoUris?: string[];
}

/* ----------------------------------------------------------------- laundry */

export type ClothingType =
  | "shirt"
  | "trouser"
  | "tshirt"
  | "jeans"
  | "bedsheet"
  | "towel"
  | "other";

export const CLOTHING_LABELS: Record<ClothingType, string> = {
  shirt: "Shirt",
  trouser: "Trouser",
  tshirt: "T-shirt",
  jeans: "Jeans",
  bedsheet: "Bedsheet",
  towel: "Towel",
  other: "Other",
};

export interface LaundryItem {
  type: ClothingType;
  count: number;
  pressing: boolean;
}

export interface LaundryRequest extends ServiceRequestSummary {
  kind: "laundry";
  items: LaundryItem[];
  totalPieces: number;
  pickupSlot: string;
  /** Live capture of the clothes handed over — evidence for disputes. */
  photoUris: string[];
  timeline: TrackingEvent[];
}

export interface CreateLaundryBody {
  items: LaundryItem[];
  pickupSlot: string;
  photoUris?: string[];
}

/* -------------------------------------------------------------- complaints */

export interface Complaint extends ServiceRequestSummary {
  kind: "complaint";
  categoryId: string;
  categoryLabel: string;
  subCategoryId: string;
  subCategoryLabel: string;
  remarks: string;
  /** Set when the complaint was raised against a laundry/maintenance request. */
  againstRequestId: string | null;
  timeline: TrackingEvent[];
}

export interface CreateComplaintBody {
  categoryId: string;
  subCategoryId: string;
  remarks: string;
  againstRequestId?: string | null;
}

/* ------------------------------------------------------------------ visits */

export type VisitorRelation =
  | "parent"
  | "guardian"
  | "sibling"
  | "relative"
  | "friend";

export const RELATION_LABELS: Record<VisitorRelation, string> = {
  parent: "Parent",
  guardian: "Guardian",
  sibling: "Sibling",
  relative: "Relative",
  friend: "Friend",
};

export interface VisitRequest extends ServiceRequestSummary {
  kind: "visit";
  visitorName: string;
  relation: VisitorRelation;
  visitDate: string;
  durationHours: number;
  foodRequired: boolean;
  /** Chosen a day before the visit, per the mess cut-off. */
  foodSelections: { meal: MealType; items: string[] }[];
  timeline: TrackingEvent[];
}

export interface CreateVisitBody {
  visitorName: string;
  relation: VisitorRelation;
  visitDate: string;
  durationHours: number;
  foodRequired: boolean;
  foodSelections?: { meal: MealType; items: string[] }[];
}

/* -------------------------------------------------------------- attendance */

export type AttendanceMethod = "facial" | "biometric" | "qr";

export interface AttendanceRecord {
  id: string;
  date: string;
  markedAt: string;
  method: AttendanceMethod;
  latitude: number;
  longitude: number;
  locationLabel: string;
  photoUri: string | null;
  withinGeofence: boolean;
  /**
   * Distance between the captured face and the enrolled one, for facial marks
   * made since the face check shipped. Null otherwise.
   */
  faceMatchDistance: number | null;
}

/**
 * What a resident is asked to do in front of the camera to show they're a
 * person and not a photograph of one. The API picks one at random per attempt,
 * so a printed face can't be prepared for the right thing in advance.
 */
export type LivenessAction =
  | "smile"
  | "open_mouth"
  | "close_eyes"
  | "turn_head";

export const LIVENESS_INSTRUCTIONS: Record<LivenessAction, string> = {
  smile: "Now smile at the camera",
  open_mouth: "Now open your mouth",
  close_eyes: "Now close your eyes",
  turn_head: "Now turn your head to one side",
};

export interface LivenessChallenge {
  /** Signed and short-lived. The app sends it back with the photos. */
  token: string;
  action: LivenessAction;
  /** The wording to put on screen, so both sides say the same thing. */
  instruction: string;
  expiresInSeconds: number;
}

export interface MarkAttendanceBody {
  method: AttendanceMethod;
  latitude: number;
  longitude: number;
  /**
   * Required when `method` is "facial": a base64 selfie the server checks
   * against the resident's enrolled face. A local file URI is not enough —
   * the server has to see the pixels to verify them.
   *
   * This is the *first* frame: looking straight at the camera, neutral. It's
   * the one identity is decided from.
   */
  photoBase64?: string;
  /** The challenge token from `GET /api/attendance/liveness`. Facial only. */
  livenessToken?: string;
  /** The second frame, taken while doing what the challenge asked. */
  livenessPhotoBase64?: string;
}

export interface AttendanceSummary {
  todayMarked: boolean;
  presentDays: number;
  totalDays: number;
  streak: number;
  records: AttendanceRecord[];
}

/* ---------------------------------------------------------------- feedback */

export interface FeedbackEntry {
  id: string;
  categoryId: string;
  categoryLabel: string;
  subCategoryId: string;
  subCategoryLabel: string;
  rating: number;
  remarks: string;
  photoUris: string[];
  createdAt: string;
}

export interface CreateFeedbackBody {
  categoryId: string;
  subCategoryId: string;
  /** 1 (lowest) to 5 (highest). */
  rating: number;
  remarks: string;
  photoUris?: string[];
}

/* -------------------------------------------------------------- mess entry */

export interface MessEntryRecord {
  id: string;
  meal: MealType;
  method: AttendanceMethod;
  enteredAt: string;
  /** Null for entries scanned before locations were captured, or with location off. */
  withinGeofence: boolean | null;
  locationLabel: string | null;
}

/**
 * A resident's rotating mess pass. The phone shows it as a QR code and the
 * counter scans it, so presence is proven by the counter's device being at the
 * counter — the resident's phone never reports its own entry.
 */
export interface MessPass {
  /** Signed, opaque to the client; the API is the only thing that reads it. */
  token: string;
  expiresAt: string;
  /** How often the phone should ask for a fresh one. */
  rotateSeconds: number;
}

/** What the counter posts after scanning a resident's pass. */
export interface ScanMessPassBody {
  token: string;
  /**
   * Where the counter device is. Optional, and never a reason to refuse a
   * plate: a scanner with location blocked or no GPS fix still has to work.
   * It's stored on the entry so an off-site scan is visible after the fact.
   */
  latitude?: number;
  longitude?: number;
}

/** Confirmation the counter shows: who it was, and what they're owed. */
export interface MessScanResult {
  residentId: string;
  residentName: string;
  roomNumber: string | null;
  meal: MealType;
  enteredAt: string;
  /**
   * False when this resident was already served this meal — the entry is not
   * double-counted and the counter is told rather than silently accepting.
   */
  recorded: boolean;
  /**
   * Whether the counter device was inside the site geofence. Null when it sent
   * no location — the desk shows that as "location off", not as off-site.
   */
  withinGeofence: boolean | null;
  locationLabel: string | null;
}

/** Rotation window, shared so the phone and the API agree on the maths. */
export const MESS_PASS_ROTATE_SECONDS = 30;

/* --------------------------------------------------------- notifications */

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  kind: "info" | "success" | "warning" | "danger";
  /** Deep-link path inside the app, e.g. "/maintenance/REQ-1042". */
  href: string | null;
}

/* ------------------------------------------------------------------ routes */

export const API_ROUTES = {
  health: "/api/health",

  register: "/api/auth/register",
  sendOtp: "/api/auth/otp/send",
  verifyOtp: "/api/auth/otp/verify",
  setMpin: "/api/auth/mpin",
  mpinLogin: "/api/auth/mpin/login",
  deleteAccount: "/api/auth/account",

  profile: "/api/me/profile",
  profileUnmask: (field: "dob" | "kyc") => `/api/me/profile/unmask/${field}`,
  profilePhoto: "/api/me/profile/photo",
  face: "/api/me/face",
  room: "/api/me/room",
  payments: "/api/me/payments",

  menu: "/api/food/menu",
  foodPreferences: "/api/food/preferences",
  foodPause: "/api/food/pause",
  foodBookings: "/api/food/bookings",

  maintenanceCategories: "/api/maintenance/categories",
  maintenance: "/api/maintenance",
  maintenanceById: (id: string) => `/api/maintenance/${id}`,

  laundry: "/api/laundry",
  laundryById: (id: string) => `/api/laundry/${id}`,

  complaintCategories: "/api/complaints/categories",
  complaints: "/api/complaints",
  complaintById: (id: string) => `/api/complaints/${id}`,

  visits: "/api/visits",
  visitById: (id: string) => `/api/visits/${id}`,

  attendance: "/api/attendance",
  markAttendance: "/api/attendance/mark",
  livenessChallenge: "/api/attendance/liveness",

  feedbackCategories: "/api/feedback/categories",
  feedback: "/api/feedback",

  messEntry: "/api/mess/entry",
  messPass: "/api/mess/pass",

  requests: "/api/requests",
  notifications: "/api/notifications",
  notificationRead: (id: string) => `/api/notifications/${id}/read`,
} as const;
