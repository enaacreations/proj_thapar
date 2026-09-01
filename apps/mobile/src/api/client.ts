import Constants from "expo-constants";
import { Platform } from "react-native";
import {
  API_ROUTES,
  type ApiError,
  type AppNotification,
  type AttendanceSummary,
  type AuthSession,
  type CategoryOption,
  type Complaint,
  type CreateComplaintBody,
  type CreateFeedbackBody,
  type CreateLaundryBody,
  type CreateMaintenanceBody,
  type CreateVisitBody,
  type DayMenu,
  type FeedbackEntry,
  type FoodPreferences,
  type LaundryRequest,
  type MaintenanceRequest,
  type MarkAttendanceBody,
  type MessEntryBody,
  type MessEntryRecord,
  type PaymentSummary,
  type RegistrationBody,
  type RegistrationResponse,
  type ResidentProfile,
  type RoomDetails,
  type SendOtpResponse,
  type ServiceRequestSummary,
  type SetMpinBody,
  type UpdateMealOptInBody,
  type VisitRequest,
  ONBOARDING_ROUTES,
  type InventoryCondition,
  type KycDocumentType,
  type KycState,
  type LayoutPiece,
  type LeaseAgreement,
  type MoveInState,
  type OnboardingProgress,
  type RoomPlan,
  type RoommateMatchResult,
  type RoommateProfile,
  type RoommateProfileBody,
  type TourSpace,
  LIVING_ROUTES,
  type Amenity,
  type AmenityAvailability,
  type AmenityBooking,
  type DietPreference,
  type DietTag,
  type GuestMeal,
  type HousekeepingBooking,
  type HousekeepingService,
  type LaundryPlanOption,
  type LaundryService,
  type LaundrySubscription,
  type MealRating,
  type MealType,
  type MenuDay,
  FINANCE_ROUTES,
  type CreateSplitBillBody,
  type DepositState,
  type DocumentKind,
  type DocumentRef,
  type DocumentTokenResponse,
  type FinanceOverview,
  type InstalmentPlan,
  type InstalmentQuote,
  type Invoice,
  type Mandate,
  type PaymentMethod,
  type PaymentOrder,
  type SplitBill,
  type SplitCandidate,
  type SplitSummary,
} from "@proj/shared";

const API_PORT = 4000;

/**
 * Resolution order:
 *   1. EXPO_PUBLIC_API_URL / app.json `extra.apiUrl` — set this for staging & prod.
 *   2. The LAN IP Metro is already serving from, so a physical device works
 *      without hardcoding an address.
 *   3. localhost (simulator / web), with the Android emulator's host alias.
 */
function resolveBaseUrl(): string {
  const configured =
    process.env.EXPO_PUBLIC_API_URL ??
    (Constants.expoConfig?.extra?.apiUrl as string | undefined);
  if (configured) return configured.replace(/\/$/, "");

  const hostUri =
    Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost;
  const host = hostUri?.split(":")[0];
  if (host && host !== "localhost" && host !== "127.0.0.1") {
    return `http://${host}:${API_PORT}`;
  }

  return Platform.OS === "android"
    ? `http://10.0.2.2:${API_PORT}`
    : `http://localhost:${API_PORT}`;
}

export const API_BASE_URL = resolveBaseUrl();

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

/** Set by the auth store after sign-in; cleared on sign-out. */
let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

/** `body` is a plain object here; it gets JSON-encoded on the way out. */
type Options = Omit<RequestInit, "body"> & { body?: unknown };

async function request<T>(path: string, init?: Options): Promise<T> {
  let res: Response;

  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiRequestError(
      0,
      "network_error",
      "Can't reach the server. Check your connection and try again."
    );
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

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body });

export const api = {
  /* auth */
  register: (body: RegistrationBody) =>
    post<RegistrationResponse>(API_ROUTES.register, body),
  sendOtp: (mobile: string) =>
    post<SendOtpResponse>(API_ROUTES.sendOtp, { mobile }),
  verifyOtp: (mobile: string, otp: string) =>
    post<AuthSession>(API_ROUTES.verifyOtp, { mobile, otp }),
  setMpin: (body: SetMpinBody) => post<AuthSession>(API_ROUTES.setMpin, body),
  mpinLogin: (mobile: string, mpin: string) =>
    post<AuthSession>(API_ROUTES.mpinLogin, { mobile, mpin }),

  /* me */
  profile: () => request<ResidentProfile>(API_ROUTES.profile),
  unmask: (field: "dob" | "kyc") =>
    post<ResidentProfile>(API_ROUTES.profileUnmask(field)),
  room: () => request<RoomDetails>(API_ROUTES.room),
  payments: () => request<PaymentSummary>(API_ROUTES.payments),

  /* food */
  menu: (days = 7) => request<DayMenu[]>(`${API_ROUTES.menu}?days=${days}`),
  foodPreferences: () => request<FoodPreferences>(API_ROUTES.foodPreferences),
  updateMeals: (body: UpdateMealOptInBody) =>
    request<FoodPreferences>(API_ROUTES.foodPreferences, {
      method: "PATCH",
      body,
    }),
  pauseFood: (from: string, to: string) =>
    post<FoodPreferences>(API_ROUTES.foodPause, { from, to }),
  resumeFood: () =>
    request<FoodPreferences>(API_ROUTES.foodPause, { method: "DELETE" }),

  /* maintenance */
  maintenanceCategories: () =>
    request<CategoryOption[]>(API_ROUTES.maintenanceCategories),
  maintenanceList: () => request<MaintenanceRequest[]>(API_ROUTES.maintenance),
  maintenanceById: (id: string) =>
    request<MaintenanceRequest>(API_ROUTES.maintenanceById(id)),
  createMaintenance: (body: CreateMaintenanceBody) =>
    post<MaintenanceRequest>(API_ROUTES.maintenance, body),

  /* laundry */
  laundrySlots: () => request<string[]>(`${API_ROUTES.laundry}/slots`),
  laundryList: () => request<LaundryRequest[]>(API_ROUTES.laundry),
  laundryById: (id: string) =>
    request<LaundryRequest>(API_ROUTES.laundryById(id)),
  createLaundry: (body: CreateLaundryBody) =>
    post<LaundryRequest>(API_ROUTES.laundry, body),

  /* complaints */
  complaintCategories: () =>
    request<CategoryOption[]>(API_ROUTES.complaintCategories),
  complaintList: () => request<Complaint[]>(API_ROUTES.complaints),
  complaintById: (id: string) =>
    request<Complaint>(API_ROUTES.complaintById(id)),
  createComplaint: (body: CreateComplaintBody) =>
    post<Complaint>(API_ROUTES.complaints, body),

  /* visits */
  visitList: () => request<VisitRequest[]>(API_ROUTES.visits),
  visitById: (id: string) => request<VisitRequest>(API_ROUTES.visitById(id)),
  createVisit: (body: CreateVisitBody) =>
    post<VisitRequest>(API_ROUTES.visits, body),

  /* attendance */
  attendance: () => request<AttendanceSummary>(API_ROUTES.attendance),
  markAttendance: (body: MarkAttendanceBody) =>
    post<AttendanceSummary>(API_ROUTES.markAttendance, body),

  /* feedback */
  feedbackCategories: () =>
    request<CategoryOption[]>(API_ROUTES.feedbackCategories),
  feedbackList: () => request<FeedbackEntry[]>(API_ROUTES.feedback),
  createFeedback: (body: CreateFeedbackBody) =>
    post<FeedbackEntry>(API_ROUTES.feedback, body),

  /* mess + shared */
  messEntries: () => request<MessEntryRecord[]>(API_ROUTES.messEntry),
  messEntry: (body: MessEntryBody) =>
    post<MessEntryRecord>(API_ROUTES.messEntry, body),
  requests: (kind?: string) =>
    request<ServiceRequestSummary[]>(
      kind ? `${API_ROUTES.requests}?kind=${kind}` : API_ROUTES.requests
    ),
  notifications: () => request<AppNotification[]>(API_ROUTES.notifications),
  markNotificationRead: (id: string) =>
    post<AppNotification>(API_ROUTES.notificationRead(id)),

  /* onboarding */
  onboardingProgress: () =>
    request<OnboardingProgress>(ONBOARDING_ROUTES.progress),

  kyc: () => request<KycState>(ONBOARDING_ROUTES.kyc),
  uploadKycDocument: (type: KycDocumentType, uri: string) =>
    post<KycState>(ONBOARDING_ROUTES.kycDocuments, { type, uri }),
  removeKycDocument: (id: string) =>
    request<KycState>(ONBOARDING_ROUTES.kycDocument(id), { method: "DELETE" }),
  submitKyc: () => post<KycState>(ONBOARDING_ROUTES.kycSubmit),

  lease: () => request<LeaseAgreement | null>(ONBOARDING_ROUTES.lease),
  signLease: (signerName: string, signaturePath: string) =>
    post<LeaseAgreement>(ONBOARDING_ROUTES.leaseSign, {
      signerName,
      signaturePath,
      agreed: true,
    }),

  roommateProfile: () =>
    request<RoommateProfile | null>(ONBOARDING_ROUTES.roommateProfile),
  saveRoommateProfile: (body: RoommateProfileBody) =>
    request<RoommateProfile>(ONBOARDING_ROUTES.roommateProfile, {
      method: "PUT",
      body,
    }),
  roommateMatches: () =>
    request<RoommateMatchResult>(ONBOARDING_ROUTES.roommateMatches),

  moveIn: () => request<MoveInState>(ONBOARDING_ROUTES.moveIn),
  setMoveInTask: (key: string, done: boolean) =>
    post<MoveInState>(ONBOARDING_ROUTES.moveInTask(key), { done }),
  inventoryTemplate: () =>
    request<string[]>(`${ONBOARDING_ROUTES.inventory}/template`),
  addInventoryItem: (body: {
    name: string;
    condition: InventoryCondition;
    notes?: string;
    photoUris?: string[];
  }) => post<MoveInState>(ONBOARDING_ROUTES.inventory, body),
  removeInventoryItem: (id: string) =>
    request<MoveInState>(ONBOARDING_ROUTES.inventoryItem(id), {
      method: "DELETE",
    }),
  submitInventory: () => post<MoveInState>(ONBOARDING_ROUTES.inventorySubmit),

  tours: () => request<TourSpace[]>(ONBOARDING_ROUTES.tours),

  /* finance */
  financeOverview: () => request<FinanceOverview>(FINANCE_ROUTES.overview),
  invoices: () => request<Invoice[]>(FINANCE_ROUTES.invoices),
  invoice: (id: string) => request<Invoice>(FINANCE_ROUTES.invoice(id)),

  startPayment: (body: {
    invoiceId?: string;
    splitShareId?: string;
    amount: number;
    method: PaymentMethod;
    idempotencyKey: string;
  }) => post<PaymentOrder>(FINANCE_ROUTES.startPayment, body),
  paymentStatus: (id: string) =>
    request<PaymentOrder>(FINANCE_ROUTES.payment(id)),
  paymentHistory: () => request<PaymentOrder[]>(FINANCE_ROUTES.payments),

  mandate: () => request<Mandate | null>(FINANCE_ROUTES.mandate),
  createMandate: (body: { maxAmount: number; dayOfMonth: number }) =>
    post<Mandate>(FINANCE_ROUTES.mandate, body),
  setMandatePaused: (resume: boolean) =>
    post<Mandate>(FINANCE_ROUTES.mandatePause, { resume }),
  cancelMandate: () =>
    request<void>(FINANCE_ROUTES.mandate, { method: "DELETE" }),

  instalmentQuote: (invoiceId: string, count: number) =>
    request<InstalmentQuote>(FINANCE_ROUTES.instalmentQuote(invoiceId, count)),
  createInstalmentPlan: (invoiceId: string, count: number) =>
    post<InstalmentPlan>(FINANCE_ROUTES.instalmentPlans, { invoiceId, count }),

  deposit: () => request<DepositState>(FINANCE_ROUTES.deposit),

  splits: () => request<SplitSummary>(FINANCE_ROUTES.splits),
  splitCandidates: () =>
    request<SplitCandidate[]>(FINANCE_ROUTES.splitCandidates),
  createSplit: (body: CreateSplitBillBody) =>
    post<SplitBill>(FINANCE_ROUTES.splits, body),
  deleteSplit: (id: string) =>
    request<void>(FINANCE_ROUTES.split(id), { method: "DELETE" }),

  documents: () => request<DocumentRef[]>(FINANCE_ROUTES.documents),
  documentUrl: (kind: DocumentKind, id: string) =>
    post<DocumentTokenResponse>(FINANCE_ROUTES.documentToken, { kind, id }),

  /* daily living */
  diningMenu: (days = 7) =>
    request<MenuDay[]>(`${LIVING_ROUTES.menu}?days=${days}`),
  diet: () => request<DietPreference>(LIVING_ROUTES.diet),
  saveDiet: (tags: DietTag[], allergies: string) =>
    request<DietPreference>(LIVING_ROUTES.diet, {
      method: "PUT",
      body: { tags, allergies },
    }),

  rateMeal: (body: {
    date: string;
    meal: MealType;
    rating: number;
    remarks?: string;
  }) => post<MealRating>(LIVING_ROUTES.rateMeal, body),
  myMealRatings: () => request<MealRating[]>(LIVING_ROUTES.myRatings),

  guestMeals: () => request<GuestMeal[]>(LIVING_ROUTES.guestMeals),
  bookGuestMeal: (body: { date: string; meal: MealType; guests: number }) =>
    post<GuestMeal>(LIVING_ROUTES.guestMeals, body),
  cancelGuestMeal: (id: string) =>
    request<GuestMeal>(LIVING_ROUTES.guestMeal(id), { method: "DELETE" }),

  laundryPlans: () => request<LaundryPlanOption[]>(LIVING_ROUTES.laundryPlans),
  laundrySubscription: () =>
    request<LaundrySubscription | null>(LIVING_ROUTES.laundrySubscription),
  subscribeLaundry: (body: {
    plan: string;
    service: LaundryService;
    pickupDay: number;
  }) => post<LaundrySubscription>(LIVING_ROUTES.laundrySubscription, body),
  pauseLaundry: (resume: boolean) =>
    post<LaundrySubscription>(
      `${LIVING_ROUTES.laundrySubscription}/pause`,
      { resume }
    ),
  cancelLaundrySubscription: () =>
    request<void>(LIVING_ROUTES.laundrySubscription, { method: "DELETE" }),

  housekeepingServices: () =>
    request<HousekeepingService[]>(LIVING_ROUTES.housekeepingServices),
  housekeepingSlots: (date: string) =>
    request<{ slot: string; available: boolean }[]>(
      `${LIVING_ROUTES.housekeepingSlots}?date=${date}`
    ),
  housekeepingBookings: () =>
    request<HousekeepingBooking[]>(LIVING_ROUTES.housekeepingBookings),
  bookHousekeeping: (body: {
    serviceId: string;
    date: string;
    slot: string;
    notes?: string;
  }) => post<HousekeepingBooking>(LIVING_ROUTES.housekeepingBookings, body),
  cancelHousekeeping: (id: string) =>
    request<void>(LIVING_ROUTES.housekeepingBooking(id), { method: "DELETE" }),

  amenities: () => request<Amenity[]>(LIVING_ROUTES.amenities),
  amenityAvailability: (id: string, date: string) =>
    request<AmenityAvailability>(LIVING_ROUTES.amenityAvailability(id, date)),
  amenityBookings: () =>
    request<AmenityBooking[]>(LIVING_ROUTES.amenityBookings),
  bookAmenity: (amenityId: string, date: string, startTime: string) =>
    post<AmenityBooking>(LIVING_ROUTES.amenityBookings, {
      amenityId,
      date,
      startTime,
    }),
  cancelAmenityBooking: (id: string) =>
    request<void>(LIVING_ROUTES.amenityBooking(id), { method: "DELETE" }),
  roomPlan: () => request<RoomPlan>(ONBOARDING_ROUTES.roomPlan),
  layoutPieces: () => request<LayoutPiece[]>(ONBOARDING_ROUTES.layoutPieces),
};
