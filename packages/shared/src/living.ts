import type { MealType, RequestStatus } from "./types";

/**
 * Daily living and hotel-style services: the mess menu, laundry, housekeeping
 * and amenity booking.
 */

/* ---------------------------------------------------------------- dietary */

export type DietTag =
  | "veg"
  | "vegan"
  | "jain"
  | "egg"
  | "non_veg"
  | "gluten_free"
  | "high_protein"
  | "low_carb";

export const DIET_TAG_LABELS: Record<DietTag, string> = {
  veg: "Vegetarian",
  vegan: "Vegan",
  jain: "Jain",
  egg: "Contains egg",
  non_veg: "Non-vegetarian",
  gluten_free: "Gluten free",
  high_protein: "High protein",
  low_carb: "Low carb",
};

/** What a resident can filter the menu by. */
export const DIET_FILTERS: DietTag[] = [
  "veg",
  "vegan",
  "jain",
  "gluten_free",
  "high_protein",
  "low_carb",
];

export interface DietPreference {
  /** Empty means "show me everything". */
  tags: DietTag[];
  /** Free text the mess should know about, e.g. a nut allergy. */
  allergies: string;
  updatedAt: string | null;
}

export type DietPreferenceBody = Omit<DietPreference, "updatedAt">;

/* ------------------------------------------------------------------- menu */

export interface MenuDish {
  id: string;
  name: string;
  tags: DietTag[];
  /** True when it satisfies every tag the resident filters on. */
  matchesDiet: boolean;
}

export interface MenuMeal {
  meal: MealType;
  servingWindow: string;
  published: boolean;
  dishes: MenuDish[];
}

export interface MenuDay {
  date: string;
  meals: MenuMeal[];
  /** The resident's own rating for that day, if they left one. */
  ratings: { meal: MealType; rating: number }[];
}

export interface UpsertMenuBody {
  date: string;
  meal: MealType;
  servingWindow: string;
  published: boolean;
  dishes: { name: string; tags: DietTag[] }[];
}

/* ---------------------------------------------------------- meal ratings */

export interface MealRating {
  id: string;
  date: string;
  meal: MealType;
  rating: number;
  remarks: string;
  createdAt: string;
}

export interface RateMealBody {
  date: string;
  meal: MealType;
  rating: number;
  remarks?: string;
}

/** Rolling quality score the mess vendor is held to. */
export interface VendorSla {
  /** Average across every rating in the window, or null if none. */
  average: number | null;
  target: number;
  breaching: boolean;
  ratingCount: number;
  windowDays: number;
  byMeal: { meal: MealType; average: number | null; count: number }[];
  worstDishes: { name: string; average: number; count: number }[];
}

/**
 * How many plates each meal needs on a given day, from what residents actually
 * booked — day-by-day choices plus everyone the recurring plan covers.
 */
export interface MealHeadcount {
  date: string;
  counts: { meal: MealType; residents: number }[];
}

/* ------------------------------------------------------------ guest meals */

export type GuestMealStatus = "booked" | "served" | "cancelled";

export interface GuestMeal {
  id: string;
  date: string;
  meal: MealType;
  guests: number;
  status: GuestMealStatus;
  /** Charged to the resident's next invoice. */
  amount: number;
  createdAt: string;
}

export interface BookGuestMealBody {
  date: string;
  meal: MealType;
  guests: number;
}

/* --------------------------------------------------------------- laundry */

export type LaundryService =
  | "wash_fold"
  | "wash_iron"
  | "iron_only"
  | "dry_clean";

export const LAUNDRY_SERVICE_LABELS: Record<LaundryService, string> = {
  wash_fold: "Wash and fold",
  wash_iron: "Wash and iron",
  iron_only: "Iron only",
  dry_clean: "Dry clean",
};

/** Where a bag actually is, which "in progress" never told anyone. */
export type LaundryStage =
  | "scheduled"
  | "picked_up"
  | "washing"
  | "ready"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export const LAUNDRY_STAGE_LABELS: Record<LaundryStage, string> = {
  scheduled: "Pickup scheduled",
  picked_up: "Picked up",
  washing: "Being washed",
  ready: "Ready",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/** Ordered pipeline; an admin may only move forward along it. */
export const LAUNDRY_PIPELINE: LaundryStage[] = [
  "scheduled",
  "picked_up",
  "washing",
  "ready",
  "out_for_delivery",
  "delivered",
];

/** How each stage surfaces in the shared "All requests" feed. */
export const LAUNDRY_STAGE_STATUS: Record<LaundryStage, RequestStatus> = {
  scheduled: "submitted",
  picked_up: "in_progress",
  washing: "in_progress",
  ready: "in_progress",
  out_for_delivery: "in_progress",
  delivered: "resolved",
  cancelled: "cancelled",
};

export type SubscriptionStatus = "active" | "paused" | "cancelled";

export interface LaundrySubscription {
  id: string;
  plan: string;
  service: LaundryService;
  piecesPerWeek: number;
  /** 0 = Sunday. */
  pickupDay: number;
  monthlyPrice: number;
  status: SubscriptionStatus;
  startedAt: string;
  nextPickupOn: string | null;
}

export interface SubscribeLaundryBody {
  plan: string;
  service: LaundryService;
  pickupDay: number;
}

export interface LaundryPlanOption {
  plan: string;
  service: LaundryService;
  piecesPerWeek: number;
  monthlyPrice: number;
  description: string;
}

/* ---------------------------------------------------------- housekeeping */

export interface HousekeepingService {
  id: string;
  name: string;
  description: string;
  /** Zero for the routine clean included in rent. */
  price: number;
  durationMinutes: number;
  addOn: boolean;
}

export type BookingStatus = "booked" | "in_progress" | "done" | "cancelled";

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  booked: "Booked",
  in_progress: "In progress",
  done: "Done",
  cancelled: "Cancelled",
};

export interface HousekeepingBooking {
  id: string;
  serviceId: string;
  serviceName: string;
  date: string;
  slot: string;
  status: BookingStatus;
  notes: string;
  price: number;
  createdAt: string;
}

export interface BookHousekeepingBody {
  serviceId: string;
  date: string;
  slot: string;
  notes?: string;
}

/* -------------------------------------------------------------- amenities */

export type AmenityKind =
  | "coworking"
  | "study"
  | "gaming"
  | "bbq"
  | "gym"
  | "other";

export const AMENITY_KIND_LABELS: Record<AmenityKind, string> = {
  coworking: "Coworking",
  study: "Study room",
  gaming: "Gaming",
  bbq: "Rooftop BBQ",
  gym: "Gym",
  other: "Other",
};

export interface Amenity {
  id: string;
  name: string;
  kind: AmenityKind;
  description: string;
  /** How many people can hold the same slot. */
  capacity: number;
  slotMinutes: number;
  openFrom: string;
  openTo: string;
  active: boolean;
}

export interface AmenitySlot {
  startTime: string;
  endTime: string;
  booked: number;
  capacity: number;
  available: boolean;
  /** True when the reader already holds this slot. */
  mine: boolean;
}

export interface AmenityAvailability {
  amenity: Amenity;
  date: string;
  slots: AmenitySlot[];
}

export interface AmenityBooking {
  id: string;
  amenityId: string;
  amenityName: string;
  amenityKind: AmenityKind;
  date: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  createdAt: string;
}

export interface BookAmenityBody {
  amenityId: string;
  date: string;
  startTime: string;
}

/* ------------------------------------------------------------------ routes */

export const LIVING_ROUTES = {
  menu: "/api/dining/menu",
  diet: "/api/dining/diet",
  rateMeal: "/api/dining/ratings",
  myRatings: "/api/dining/ratings/mine",
  guestMeals: "/api/dining/guest-meals",
  guestMeal: (id: string) => `/api/dining/guest-meals/${id}`,

  laundryPlans: "/api/laundry/plans",
  laundrySubscription: "/api/laundry/subscription",

  housekeepingServices: "/api/housekeeping/services",
  housekeepingSlots: "/api/housekeeping/slots",
  housekeepingBookings: "/api/housekeeping/bookings",
  housekeepingBooking: (id: string) => `/api/housekeeping/bookings/${id}`,

  amenities: "/api/amenities",
  amenityAvailability: (id: string, date: string) =>
    `/api/amenities/${id}/availability?date=${date}`,
  amenityBookings: "/api/amenities/bookings",
  amenityBooking: (id: string) => `/api/amenities/bookings/${id}`,
} as const;

export const ADMIN_LIVING_ROUTES = {
  menu: "/api/admin/dining/menu",
  sla: "/api/admin/dining/sla",
  guestMeals: "/api/admin/dining/guest-meals",
  mealCounts: (date: string) =>
    `/api/admin/dining/counts?date=${encodeURIComponent(date)}`,

  laundryStage: (id: string) => `/api/admin/laundry/${id}/stage`,
  laundryBoard: "/api/admin/laundry/board",

  housekeepingBookings: "/api/admin/housekeeping/bookings",
  housekeepingStatus: (id: string) => `/api/admin/housekeeping/bookings/${id}`,

  amenityBookings: "/api/admin/amenities/bookings",
} as const;

export interface AdminLaundryRow {
  id: string;
  residentId: string;
  residentName: string;
  roomNumber: string | null;
  service: LaundryService;
  stage: LaundryStage;
  totalPieces: number;
  pickupSlot: string;
  createdAt: string;
}

export interface AdminBookingRow {
  id: string;
  residentId: string;
  residentName: string;
  roomNumber: string | null;
  title: string;
  date: string;
  slot: string;
  status: BookingStatus;
}
