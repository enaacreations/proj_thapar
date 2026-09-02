/**
 * Onboarding and move-in contracts: KYC, e-leasing, roommate matching,
 * the move-in checklist, and property tours.
 */

/* ---------------------------------------------------------------- KYC */

export type KycDocumentType =
  | "aadhaar_front"
  | "aadhaar_back"
  | "pan"
  | "photo"
  | "other";

export const KYC_DOCUMENT_LABELS: Record<KycDocumentType, string> = {
  aadhaar_front: "Aadhaar — front",
  aadhaar_back: "Aadhaar — back",
  pan: "PAN card",
  photo: "Passport photo",
  other: "Other document",
};

export type KycStatus =
  | "not_started"
  | "awaiting_documents"
  | "under_review"
  | "verified"
  | "rejected";

export const KYC_STATUS_LABELS: Record<KycStatus, string> = {
  not_started: "Not started",
  awaiting_documents: "Documents needed",
  under_review: "Under review",
  verified: "Verified",
  rejected: "Rejected",
};

export interface KycDocument {
  id: string;
  type: KycDocumentType;
  uri: string;
  uploadedAt: string;
}

export interface KycState {
  status: KycStatus;
  /** Which provider checked it. "manual" until a real AUA/KUA is wired up. */
  provider: string;
  reference: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  documents: KycDocument[];
  /** Types still missing before it can go for review. */
  missing: KycDocumentType[];
}

export interface UploadKycDocumentBody {
  type: KycDocumentType;
  uri: string;
}

/* -------------------------------------------------------------- leasing */

export type LeaseStatus = "none" | "issued" | "signed" | "cancelled";

export const LEASE_STATUS_LABELS: Record<LeaseStatus, string> = {
  none: "Not issued",
  issued: "Awaiting signature",
  signed: "Signed",
  cancelled: "Cancelled",
};

export interface LeaseTerms {
  monthlyRent: number;
  securityDeposit: number;
  noticePeriodDays: number;
  startDate: string;
  endDate: string;
  /** Snapshot of the room at issue time, so the agreement stays truthful. */
  roomSummary: string;
  propertyName: string;
  propertyAddress: string;
  houseRules: string[];
}

export interface LeaseAgreement {
  id: string;
  residentId: string;
  status: LeaseStatus;
  terms: LeaseTerms;
  issuedAt: string;
  issuedBy: string;
  signedAt: string | null;
  signerName: string | null;
  /** SVG path data from the on-screen signature pad. */
  signaturePath: string | null;
}

export interface IssueLeaseBody {
  monthlyRent: number;
  securityDeposit: number;
  noticePeriodDays: number;
  startDate: string;
  endDate: string;
}

export interface SignLeaseBody {
  signerName: string;
  signaturePath: string;
  /** The resident must tick the box before the pad unlocks. */
  agreed: boolean;
}

/* ---------------------------------------------------- roommate matching */

export type SleepSchedule = "early" | "late" | "flexible";
export type StudyLocation = "in_room" | "outside" | "flexible";
export type FoodPreference = "veg" | "non_veg" | "either";

export const SLEEP_LABELS: Record<SleepSchedule, string> = {
  early: "Early to bed, early to rise",
  late: "Night owl",
  flexible: "Depends on the day",
};

export const STUDY_LABELS: Record<StudyLocation, string> = {
  in_room: "In my room",
  outside: "Library or common area",
  flexible: "Either works",
};

export const FOOD_PREF_LABELS: Record<FoodPreference, string> = {
  veg: "Vegetarian",
  non_veg: "Non-vegetarian",
  either: "No preference",
};

export interface RoommateProfile {
  sleepSchedule: SleepSchedule;
  /** 1 = relaxed, 5 = spotless. */
  cleanliness: number;
  /** 1 = needs silence, 5 = noise doesn't bother me. */
  noiseTolerance: number;
  /** 1 = keep to myself, 5 = very social. */
  socialLevel: number;
  studyLocation: StudyLocation;
  /** 1 = never, 5 = very often. */
  guestFrequency: number;
  smoking: boolean;
  foodPreference: FoodPreference;
  updatedAt: string;
}

export type RoommateProfileBody = Omit<RoommateProfile, "updatedAt">;

export interface RoommateMatch {
  residentId: string;
  fullName: string;
  /** 0–100 compatibility. */
  score: number;
  roomNumber: string | null;
  /** Plain-language reasons, so the score is never a black box. */
  agreements: string[];
  frictions: string[];
}

export interface RoommateMatchResult {
  profile: RoommateProfile | null;
  matches: RoommateMatch[];
}

/* -------------------------------------------------------- move-in flow */

export type InventoryCondition = "good" | "fair" | "damaged" | "missing";

export const CONDITION_LABELS: Record<InventoryCondition, string> = {
  good: "Good",
  fair: "Worn but usable",
  damaged: "Damaged",
  missing: "Missing",
};

export interface InventoryItem {
  id: string;
  name: string;
  condition: InventoryCondition;
  notes: string;
  photoUris: string[];
  recordedAt: string;
}

export interface RecordInventoryBody {
  name: string;
  condition: InventoryCondition;
  notes?: string;
  photoUris?: string[];
}

export interface MoveInTask {
  key: string;
  label: string;
  description: string;
  done: boolean;
  doneAt: string | null;
  /** Blocks completion until the matching flow is finished. */
  blockedBy: "kyc" | "lease" | "inventory" | null;
}

export interface MoveInState {
  tasks: MoveInTask[];
  inventory: InventoryItem[];
  /** Locked once submitted — the record both sides rely on at move-out. */
  inventorySubmittedAt: string | null;
  completedAt: string | null;
}

/* -------------------------------------------------------------- tours */

export type TourSpaceKind = "room" | "common" | "amenity";

export interface TourHotspot {
  /** Horizontal position across the panorama, 0–1. */
  x: number;
  label: string;
  /** Space id this hotspot jumps to. */
  target: string;
}

/**
 * A still of a space. `uri` is a path under the API's media route, so the app
 * prefixes it with the API base URL — the same shape as a payment
 * authorisation URL. Externally hosted images are absolute and pass through.
 */
export interface TourPhoto {
  id: string;
  uri: string;
  caption: string;
}

export interface TourSpace {
  id: string;
  name: string;
  kind: TourSpaceKind;
  description: string;
  /** Equirectangular image. Null until the property uploads one. */
  panoramaUri: string | null;
  /** Ordinary photos of the same space, in the order the property set. */
  photos: TourPhoto[];
  hotspots: TourHotspot[];
}

/* ------------------------------------------------------------ tour media */

export type TourMediaKind = "photo" | "panorama";

export interface TourMediaItem {
  id: string;
  spaceId: string;
  kind: TourMediaKind;
  uri: string;
  caption: string;
  position: number;
  uploadedAt: string;
}

/**
 * Everything the media manager needs in one call: the spaces that exist (the
 * catalogue lives on the server) and what's been uploaded against them.
 */
export interface AdminTourMedia {
  spaces: { id: string; name: string }[];
  media: TourMediaItem[];
}

export interface AddTourMediaBody {
  spaceId: string;
  kind: TourMediaKind;
  caption?: string;
  /** A base64 JPEG/PNG to store, or… */
  imageBase64?: string;
  /** …an absolute URL to an image already hosted somewhere. One or the other. */
  url?: string;
}

/** A piece of furniture the resident can arrange on the room plan. */
export interface LayoutPiece {
  id: string;
  name: string;
  /** Centimetres, used to scale against the room plan. */
  widthCm: number;
  depthCm: number;
}

export interface RoomPlan {
  spaceId: string;
  name: string;
  widthCm: number;
  depthCm: number;
  /** Fixed features drawn on the plan: bed, window, door. */
  fixtures: {
    name: string;
    xCm: number;
    yCm: number;
    widthCm: number;
    depthCm: number;
  }[];
}

/* ------------------------------------------------------------ overview */

export interface OnboardingProgress {
  kycStatus: KycStatus;
  leaseStatus: LeaseStatus;
  roommateProfileComplete: boolean;
  moveInComplete: boolean;
  inventorySubmitted: boolean;
  /** 0–100, for the progress ring on the hub. */
  percentComplete: number;
  nextStep: string;
}

export const ONBOARDING_ROUTES = {
  progress: "/api/onboarding/progress",

  kyc: "/api/onboarding/kyc",
  kycDocuments: "/api/onboarding/kyc/documents",
  kycDocument: (id: string) => `/api/onboarding/kyc/documents/${id}`,
  kycSubmit: "/api/onboarding/kyc/submit",

  lease: "/api/onboarding/lease",
  leaseSign: "/api/onboarding/lease/sign",

  roommateProfile: "/api/onboarding/roommate/profile",
  roommateMatches: "/api/onboarding/roommate/matches",

  moveIn: "/api/onboarding/move-in",
  moveInTask: (key: string) => `/api/onboarding/move-in/tasks/${key}`,
  inventory: "/api/onboarding/move-in/inventory",
  inventoryItem: (id: string) => `/api/onboarding/move-in/inventory/${id}`,
  inventorySubmit: "/api/onboarding/move-in/inventory/submit",

  tours: "/api/onboarding/tours",
  roomPlan: "/api/onboarding/tours/plan",
  layoutPieces: "/api/onboarding/tours/pieces",
} as const;

export const ADMIN_ONBOARDING_ROUTES = {
  queue: "/api/admin/onboarding",
  resident: (id: string) => `/api/admin/onboarding/${id}`,
  reviewKyc: (id: string) => `/api/admin/onboarding/${id}/kyc/review`,
  issueLease: (id: string) => `/api/admin/onboarding/${id}/lease`,
  compatibility: (id: string) => `/api/admin/onboarding/${id}/compatibility`,

  tourMedia: "/api/admin/tours/media",
  tourMediaItem: (id: string) => `/api/admin/tours/media/${id}`,
} as const;

export interface ReviewKycBody {
  decision: "verified" | "rejected";
  reason?: string;
}

export interface AdminOnboardingRow {
  residentId: string;
  fullName: string;
  mobile: string;
  roomNumber: string | null;
  kycStatus: KycStatus;
  leaseStatus: LeaseStatus;
  moveInComplete: boolean;
  percentComplete: number;
}

export interface AdminOnboardingDetail extends AdminOnboardingRow {
  kyc: KycState;
  lease: LeaseAgreement | null;
  moveIn: MoveInState;
  roommateProfile: RoommateProfile | null;
}
