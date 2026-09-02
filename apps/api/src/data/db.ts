import { randomInt, randomUUID } from "node:crypto";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { MEAL_TYPES } from "@proj/shared";
import type {
  AppNotification,
  AttendanceRecord,
  AttendanceSummary,
  Complaint,
  DayBookings,
  FeedbackEntry,
  FoodPreferences,
  MealBooking,
  MealBookingSource,
  LaundryItem,
  LaundryRequest,
  LaundryService,
  MaintenanceRequest,
  MealType,
  MessEntryRecord,
  PaymentSummary,
  RequestStatus,
  ResidentProfile,
  RoomDetails,
  ServiceRequestKind,
  ServiceRequestSummary,
  TrackingEvent,
  VisitRequest,
  VisitorRelation,
} from "@proj/shared";
import { env, isReviewPhone } from "../env";
import { db } from "../db/client";
import * as t from "../db/schema";

/**
 * Every database read and write in the app goes through this module. Routes
 * never import Drizzle directly, so the storage layer stays swappable.
 */

export const DEMO_RESIDENT_ID = "RES-2024-0912";
export const DEMO_MOBILE = "9876543210";
export const DEMO_RESIDENT_ID_2 = "RES-2026-2001";
export const DEMO_MOBILE_2 = "9867510570";

/* ----------------------------------------------------------------- helpers */

export function isoDate(d: Date): string {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/** Keeps the last 4 characters visible, e.g. "XXXXXXXX1234". */
export function mask(value: string): string {
  const tail = value.slice(-4);
  return "X".repeat(Math.max(0, value.length - 4)) + tail;
}

/** Ids come off a Postgres sequence so concurrent inserts can't collide. */
export async function nextId(prefix: string): Promise<string> {
  const result = await db.execute<{ nextval: string }>(
    sql`select nextval('request_seq')`
  );
  const value = result.rows[0]?.nextval ?? "0";
  return `${prefix}-${value}`;
}

const iso = (d: Date) => d.toISOString();

/* ---------------------------------------------------------------- resident */

export type ResidentRecord = typeof t.residents.$inferSelect;

export async function findResidentByMobile(
  mobile: string
): Promise<ResidentRecord | undefined> {
  const [row] = await db
    .select()
    .from(t.residents)
    .where(eq(t.residents.mobile, mobile))
    .limit(1);
  return row;
}

export async function getResident(
  id: string
): Promise<ResidentRecord | undefined> {
  const [row] = await db
    .select()
    .from(t.residents)
    .where(eq(t.residents.id, id))
    .limit(1);
  return row;
}

export async function createResident(input: {
  fullName: string;
  dob: string;
  gender: "male" | "female" | "other";
  kycType: "pan" | "aadhaar";
  kycNumber: string;
  mobile: string;
}): Promise<ResidentRecord> {
  const id = await nextId("RES");
  const [row] = await db
    .insert(t.residents)
    .values({ ...input, id, accountStatus: "pending_approval" })
    .returning();
  return row as ResidentRecord;
}

export async function setMpin(
  id: string,
  mpin: string,
  biometricEnabled: boolean
): Promise<void> {
  await db
    .update(t.residents)
    .set({ mpin, biometricEnabled })
    .where(eq(t.residents.id, id));
}

export async function setPhotoUrl(id: string, photoUrl: string): Promise<void> {
  await db
    .update(t.residents)
    .set({ photoUrl })
    .where(eq(t.residents.id, id));
}

/**
 * Stores the face a resident will be checked against. Re-enrolment is gated in
 * the route: overwriting this silently would let anyone swap in a friend's
 * face and hand over their attendance.
 */
export async function setFaceDescriptor(
  id: string,
  descriptor: number[]
): Promise<void> {
  await db
    .update(t.residents)
    .set({ faceDescriptor: descriptor, faceEnrolledAt: new Date() })
    .where(eq(t.residents.id, id));
}

export async function clearFaceDescriptor(id: string): Promise<void> {
  await db
    .update(t.residents)
    .set({ faceDescriptor: null, faceEnrolledAt: null })
    .where(eq(t.residents.id, id));
}

export function toProfile(
  resident: ResidentRecord,
  unmask: { dob?: boolean; kyc?: boolean } = {}
): ResidentProfile {
  const birth = new Date(resident.dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDelta = now.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birth.getDate())) {
    age -= 1;
  }

  return {
    id: resident.id,
    fullName: resident.fullName,
    age,
    gender: resident.gender,
    dob: {
      // Day and month hidden, year kept — enough to confirm it's the right person.
      masked: `XX/XX/${resident.dob.slice(0, 4)}`,
      ...(unmask.dob ? { full: resident.dob } : {}),
    },
    kycType: resident.kycType,
    kycNumber: {
      masked: mask(resident.kycNumber),
      ...(unmask.kyc ? { full: resident.kycNumber } : {}),
    },
    mobile: resident.mobile,
    photoUrl: resident.photoUrl ?? null,
    accountStatus: resident.accountStatus,
    faceEnrolled: (resident.faceDescriptor?.length ?? 0) > 0,
  };
}

/* -------------------------------------------------------------------- otps */

export async function issueOtp(
  mobile: string
): Promise<{ code: string; ttlSeconds: number }> {
  const ttlSeconds = 120;
  // Fixed for the demo and the allow-listed App Review numbers, which is what
  // makes the flow reproducible without an SMS gateway. Everyone else gets a
  // random code in production — see `isReviewPhone`.
  const code =
    env.isProduction && !isReviewPhone(mobile)
      ? String(randomInt(100000, 1000000))
      : (isReviewPhone(mobile) ? env.reviewOtpCode : "123456");
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

  await db
    .insert(t.otps)
    .values({ mobile, code, expiresAt })
    .onConflictDoUpdate({ target: t.otps.mobile, set: { code, expiresAt } });

  return { code, ttlSeconds };
}

export async function verifyOtp(
  mobile: string,
  code: string
): Promise<boolean> {
  const [row] = await db
    .select()
    .from(t.otps)
    .where(eq(t.otps.mobile, mobile))
    .limit(1);

  if (!row || row.expiresAt.getTime() < Date.now() || row.code !== code) {
    return false;
  }

  // Single use: burn it whether or not the caller succeeds downstream.
  await db.delete(t.otps).where(eq(t.otps.mobile, mobile));
  return true;
}

export async function verifyMpin(
  mobile: string,
  mpin: string
): Promise<ResidentRecord | null> {
  const resident = await findResidentByMobile(mobile);
  if (!resident || resident.mpin === null) return null;
  return resident.mpin === mpin ? resident : null;
}

/* ------------------------------------------------------------ room/payment */

export async function getRoom(
  residentId: string
): Promise<RoomDetails | undefined> {
  const [row] = await db
    .select()
    .from(t.rooms)
    .where(eq(t.rooms.residentId, residentId))
    .limit(1);
  if (!row) return undefined;

  const { residentId: _ignored, ...details } = row;
  return details;
}

export async function getPayments(
  residentId: string
): Promise<PaymentSummary | undefined> {
  const [plan] = await db
    .select()
    .from(t.paymentPlans)
    .where(eq(t.paymentPlans.residentId, residentId))
    .limit(1);
  if (!plan) return undefined;

  const entries = await db
    .select()
    .from(t.paymentEntries)
    .where(eq(t.paymentEntries.residentId, residentId))
    .orderBy(desc(t.paymentEntries.paidOn));

  return {
    plan: plan.plan,
    paidUpTo: plan.paidUpTo,
    totalPaid: entries.reduce((sum, e) => sum + e.amount, 0),
    nextDueOn: plan.nextDueOn,
    nextDueAmount: plan.nextDueAmount,
    entries: entries.map((e) => ({
      id: e.id,
      paidOn: e.paidOn,
      amount: e.amount,
      mode: e.mode,
      periodFrom: e.periodFrom,
      periodTo: e.periodTo,
      receiptNo: e.receiptNo,
    })),
  };
}

/* -------------------------------------------------------------------- food */

export async function getFoodPreferences(
  residentId: string
): Promise<FoodPreferences> {
  const [row] = await db
    .select()
    .from(t.foodPreferences)
    .where(eq(t.foodPreferences.residentId, residentId))
    .limit(1);

  if (!row) {
    // A resident with no row yet is on no plan at all. The columns default to
    // false, so this is the empty state and not a subscription.
    const [created] = await db
      .insert(t.foodPreferences)
      .values({ residentId })
      .returning();
    return toFoodPreferences(created as typeof t.foodPreferences.$inferSelect);
  }

  return toFoodPreferences(row);
}

function toFoodPreferences(
  row: typeof t.foodPreferences.$inferSelect
): FoodPreferences {
  return {
    recurring: row.recurring,
    optIn: {
      breakfast: row.breakfast,
      lunch: row.lunch,
      snacks: row.snacks,
      dinner: row.dinner,
    },
    pause:
      row.pauseFrom && row.pauseTo
        ? { from: row.pauseFrom, to: row.pauseTo }
        : null,
  };
}

export async function updateFoodPlan(
  residentId: string,
  patch: { recurring?: boolean; meals?: Partial<Record<MealType, boolean>> }
): Promise<FoodPreferences> {
  await getFoodPreferences(residentId);

  const values: Partial<typeof t.foodPreferences.$inferInsert> = {
    ...patch.meals,
  };
  if (patch.recurring !== undefined) values.recurring = patch.recurring;

  // Turning the plan off clears any pause with it — a paused plan that's been
  // switched off would come back paused, which nobody would expect.
  if (patch.recurring === false) {
    values.pauseFrom = null;
    values.pauseTo = null;
  }

  if (Object.keys(values).length > 0) {
    await db
      .update(t.foodPreferences)
      .set(values)
      .where(eq(t.foodPreferences.residentId, residentId));
  }

  return getFoodPreferences(residentId);
}

export async function setFoodPause(
  residentId: string,
  from: string | null,
  to: string | null
): Promise<FoodPreferences> {
  await getFoodPreferences(residentId);
  await db
    .update(t.foodPreferences)
    .set({ pauseFrom: from, pauseTo: to })
    .where(eq(t.foodPreferences.residentId, residentId));
  return getFoodPreferences(residentId);
}

/* -------------------------------------------------------- meal bookings */

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

/**
 * What a resident is down for, day by day.
 *
 * Three things decide each slot, in order:
 *   1. An explicit choice for that exact day and meal — always wins, including
 *      when the choice was "no".
 *   2. The recurring plan, if it's on, covers that meal, and the day isn't
 *      inside a pause.
 *   3. Otherwise nothing. Not being counted is the default.
 */
export async function getMealBookings(
  residentId: string,
  from: string,
  days: number
): Promise<DayBookings[]> {
  const to = addDays(from, days - 1);
  const today = isoDate(new Date());

  const [plan, rows] = await Promise.all([
    getFoodPreferences(residentId),
    db
      .select()
      .from(t.mealBookings)
      .where(
        and(
          eq(t.mealBookings.residentId, residentId),
          gte(t.mealBookings.date, from),
          lte(t.mealBookings.date, to)
        )
      ),
  ]);

  const chosen = new Map(
    rows.map((r) => [`${r.date}.${r.meal}`, r.booked] as const)
  );

  return Array.from({ length: days }, (_, i) => {
    const date = addDays(from, i);
    const paused =
      plan.pause !== null && date >= plan.pause.from && date <= plan.pause.to;

    const meals: MealBooking[] = MEAL_TYPES.map((meal) => {
      const choice = chosen.get(`${date}.${meal}`);
      const onPlan = plan.recurring && plan.optIn[meal] && !paused;

      const source: MealBookingSource =
        choice !== undefined ? "chosen" : onPlan ? "plan" : "none";

      return {
        meal,
        booked: choice ?? onPlan,
        source,
        editable: date >= today,
      };
    });

    return { date, meals };
  });
}

/**
 * Records a choice for one meal on one day. Writing the same value the plan
 * would have given is still stored: it pins that slot, so later changes to the
 * plan don't quietly move a day the resident already decided about.
 */
export async function setMealBooking(
  residentId: string,
  date: string,
  meal: MealType,
  booked: boolean
): Promise<DayBookings> {
  await db
    .insert(t.mealBookings)
    .values({ residentId, date, meal, booked, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [
        t.mealBookings.residentId,
        t.mealBookings.date,
        t.mealBookings.meal,
      ],
      set: { booked, updatedAt: new Date() },
    });

  const [day] = await getMealBookings(residentId, date, 1);
  return day as DayBookings;
}

/** How many plates each meal needs on `date`, for the mess to cook to. */
export async function mealHeadcount(
  date: string
): Promise<Record<MealType, number>> {
  const counts = Object.fromEntries(MEAL_TYPES.map((m) => [m, 0])) as Record<
    MealType,
    number
  >;

  // Explicit choices first, then everyone the plan covers who didn't choose.
  const chosen = await db
    .select({
      residentId: t.mealBookings.residentId,
      meal: t.mealBookings.meal,
      booked: t.mealBookings.booked,
    })
    .from(t.mealBookings)
    .where(eq(t.mealBookings.date, date));

  const decided = new Set<string>();
  for (const row of chosen) {
    decided.add(`${row.residentId}.${row.meal}`);
    if (row.booked) counts[row.meal] += 1;
  }

  const plans = await db
    .select()
    .from(t.foodPreferences)
    .where(eq(t.foodPreferences.recurring, true));

  for (const plan of plans) {
    const paused =
      plan.pauseFrom !== null &&
      plan.pauseTo !== null &&
      date >= plan.pauseFrom &&
      date <= plan.pauseTo;
    if (paused) continue;

    for (const meal of MEAL_TYPES) {
      if (!plan[meal]) continue;
      if (decided.has(`${plan.residentId}.${meal}`)) continue;
      counts[meal] += 1;
    }
  }

  return counts;
}

/* ---------------------------------------------------------------- timeline */

export async function getTimeline(requestId: string): Promise<TrackingEvent[]> {
  const rows = await db
    .select()
    .from(t.trackingEvents)
    .where(eq(t.trackingEvents.requestId, requestId))
    .orderBy(t.trackingEvents.at);

  return rows.map((r) => ({ status: r.status, note: r.note, at: iso(r.at) }));
}

export async function addTrackingEvent(
  requestId: string,
  status: RequestStatus,
  note: string,
  at: Date = new Date()
): Promise<void> {
  await db.insert(t.trackingEvents).values({ requestId, status, note, at });
}

/* ------------------------------------------------------------- maintenance */

export async function listMaintenance(
  residentId: string
): Promise<MaintenanceRequest[]> {
  const rows = await db
    .select()
    .from(t.maintenanceRequests)
    .where(eq(t.maintenanceRequests.residentId, residentId))
    .orderBy(desc(t.maintenanceRequests.createdAt));

  return Promise.all(rows.map(toMaintenance));
}

export async function getMaintenance(
  residentId: string,
  id: string
): Promise<MaintenanceRequest | undefined> {
  const [row] = await db
    .select()
    .from(t.maintenanceRequests)
    .where(
      and(
        eq(t.maintenanceRequests.id, id),
        eq(t.maintenanceRequests.residentId, residentId)
      )
    )
    .limit(1);
  return row ? toMaintenance(row) : undefined;
}

async function toMaintenance(
  row: typeof t.maintenanceRequests.$inferSelect
): Promise<MaintenanceRequest> {
  return {
    id: row.id,
    kind: "maintenance",
    title: row.title,
    status: row.status,
    categoryId: row.categoryId,
    categoryLabel: row.categoryLabel,
    subCategoryId: row.subCategoryId,
    subCategoryLabel: row.subCategoryLabel,
    remarks: row.remarks,
    photoUris: row.photoUris,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    timeline: await getTimeline(row.id),
  };
}

export async function createMaintenance(
  residentId: string,
  input: {
    title: string;
    categoryId: string;
    categoryLabel: string;
    subCategoryId: string;
    subCategoryLabel: string;
    remarks: string;
    photoUris: string[];
  }
): Promise<MaintenanceRequest> {
  const id = await nextId("MNT");
  const [row] = await db
    .insert(t.maintenanceRequests)
    .values({ ...input, id, residentId, status: "submitted" })
    .returning();

  await addTrackingEvent(id, "submitted", "Request received");
  return toMaintenance(row as typeof t.maintenanceRequests.$inferSelect);
}

export async function cancelMaintenance(
  residentId: string,
  id: string
): Promise<MaintenanceRequest | undefined> {
  const existing = await getMaintenance(residentId, id);
  if (!existing) return undefined;

  await db
    .update(t.maintenanceRequests)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(t.maintenanceRequests.id, id));
  await addTrackingEvent(id, "cancelled", "Cancelled by resident");

  return getMaintenance(residentId, id);
}

/* ----------------------------------------------------------------- laundry */

export async function listLaundry(
  residentId: string
): Promise<LaundryRequest[]> {
  const rows = await db
    .select()
    .from(t.laundryRequests)
    .where(eq(t.laundryRequests.residentId, residentId))
    .orderBy(desc(t.laundryRequests.createdAt));

  return Promise.all(rows.map(toLaundry));
}

export async function getLaundry(
  residentId: string,
  id: string
): Promise<LaundryRequest | undefined> {
  const [row] = await db
    .select()
    .from(t.laundryRequests)
    .where(
      and(
        eq(t.laundryRequests.id, id),
        eq(t.laundryRequests.residentId, residentId)
      )
    )
    .limit(1);
  return row ? toLaundry(row) : undefined;
}

async function toLaundry(
  row: typeof t.laundryRequests.$inferSelect
): Promise<LaundryRequest> {
  return {
    id: row.id,
    kind: "laundry",
    title: row.title,
    status: row.status,
    items: row.items,
    totalPieces: row.totalPieces,
    pickupSlot: row.pickupSlot,
    photoUris: row.photoUris,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    timeline: await getTimeline(row.id),
  };
}

export async function createLaundry(
  residentId: string,
  input: {
    title: string;
    service: LaundryService;
    items: LaundryItem[];
    totalPieces: number;
    pickupSlot: string;
    photoUris: string[];
  }
): Promise<LaundryRequest> {
  const id = await nextId("LDY");
  const [row] = await db
    .insert(t.laundryRequests)
    .values({ ...input, id, residentId, status: "submitted" })
    .returning();

  await addTrackingEvent(id, "submitted", "Pickup scheduled");
  return toLaundry(row as typeof t.laundryRequests.$inferSelect);
}

/* -------------------------------------------------------------- complaints */

export async function listComplaints(
  residentId: string
): Promise<Complaint[]> {
  const rows = await db
    .select()
    .from(t.complaints)
    .where(eq(t.complaints.residentId, residentId))
    .orderBy(desc(t.complaints.createdAt));

  return Promise.all(rows.map(toComplaint));
}

export async function getComplaint(
  residentId: string,
  id: string
): Promise<Complaint | undefined> {
  const [row] = await db
    .select()
    .from(t.complaints)
    .where(and(eq(t.complaints.id, id), eq(t.complaints.residentId, residentId)))
    .limit(1);
  return row ? toComplaint(row) : undefined;
}

async function toComplaint(
  row: typeof t.complaints.$inferSelect
): Promise<Complaint> {
  return {
    id: row.id,
    kind: "complaint",
    title: row.title,
    status: row.status,
    categoryId: row.categoryId,
    categoryLabel: row.categoryLabel,
    subCategoryId: row.subCategoryId,
    subCategoryLabel: row.subCategoryLabel,
    remarks: row.remarks,
    againstRequestId: row.againstRequestId,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    timeline: await getTimeline(row.id),
  };
}

export async function createComplaint(
  residentId: string,
  input: {
    title: string;
    categoryId: string;
    categoryLabel: string;
    subCategoryId: string;
    subCategoryLabel: string;
    remarks: string;
    againstRequestId: string | null;
  }
): Promise<Complaint> {
  const id = await nextId("CMP");
  const [row] = await db
    .insert(t.complaints)
    .values({ ...input, id, residentId, status: "submitted" })
    .returning();

  await addTrackingEvent(id, "submitted", "Complaint registered");
  return toComplaint(row as typeof t.complaints.$inferSelect);
}

/* ------------------------------------------------------------------ visits */

export async function listVisits(
  residentId: string
): Promise<VisitRequest[]> {
  const rows = await db
    .select()
    .from(t.visitRequests)
    .where(eq(t.visitRequests.residentId, residentId))
    .orderBy(desc(t.visitRequests.createdAt));

  return Promise.all(rows.map(toVisit));
}

export async function getVisit(
  residentId: string,
  id: string
): Promise<VisitRequest | undefined> {
  const [row] = await db
    .select()
    .from(t.visitRequests)
    .where(
      and(eq(t.visitRequests.id, id), eq(t.visitRequests.residentId, residentId))
    )
    .limit(1);
  return row ? toVisit(row) : undefined;
}

async function toVisit(
  row: typeof t.visitRequests.$inferSelect
): Promise<VisitRequest> {
  return {
    id: row.id,
    kind: "visit",
    title: row.title,
    status: row.status,
    visitorName: row.visitorName,
    relation: row.relation,
    visitDate: row.visitDate,
    durationHours: row.durationHours,
    foodRequired: row.foodRequired,
    foodSelections: row.foodSelections,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    timeline: await getTimeline(row.id),
  };
}

export async function createVisit(
  residentId: string,
  input: {
    title: string;
    visitorName: string;
    relation: VisitorRelation;
    visitDate: string;
    durationHours: number;
    foodRequired: boolean;
    foodSelections: { meal: MealType; items: string[] }[];
  }
): Promise<VisitRequest> {
  const id = await nextId("VST");
  const [row] = await db
    .insert(t.visitRequests)
    .values({ ...input, id, residentId, status: "submitted" })
    .returning();

  await addTrackingEvent(
    id,
    "submitted",
    "Visit request sent to the hostel office"
  );
  return toVisit(row as typeof t.visitRequests.$inferSelect);
}

/* -------------------------------------------------------------- attendance */

export async function getAttendanceSummary(
  residentId: string
): Promise<AttendanceSummary> {
  const rows = await db
    .select()
    .from(t.attendanceRecords)
    .where(eq(t.attendanceRecords.residentId, residentId))
    .orderBy(desc(t.attendanceRecords.date));

  const records: AttendanceRecord[] = rows.map((r) => ({
    id: r.id,
    date: r.date,
    markedAt: iso(r.markedAt),
    method: r.method,
    latitude: r.latitude,
    longitude: r.longitude,
    locationLabel: r.locationLabel,
    photoUri: r.photoUri,
    withinGeofence: r.withinGeofence,
    faceMatchDistance: r.faceMatchDistance,
  }));

  const marked = new Set(records.map((r) => r.date));
  let streak = 0;
  const cursor = new Date();
  while (marked.has(isoDate(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return {
    todayMarked: marked.has(isoDate(new Date())),
    presentDays: records.length,
    totalDays: 30,
    streak,
    records,
  };
}

export async function markAttendance(
  residentId: string,
  input: {
    method: AttendanceRecord["method"];
    latitude: number;
    longitude: number;
    locationLabel: string;
    photoUri: string | null;
    withinGeofence: boolean;
    faceMatchDistance: number | null;
  }
): Promise<string> {
  const id = await nextId("ATT");
  await db.insert(t.attendanceRecords).values({
    ...input,
    id,
    residentId,
    date: isoDate(new Date()),
  });
  return id;
}

/** Attaches the audit photo once it has been written under its record id. */
export async function setAttendancePhotoUri(
  id: string,
  photoUri: string
): Promise<void> {
  await db
    .update(t.attendanceRecords)
    .set({ photoUri })
    .where(eq(t.attendanceRecords.id, id));
}

export async function hasMarkedToday(residentId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: t.attendanceRecords.id })
    .from(t.attendanceRecords)
    .where(
      and(
        eq(t.attendanceRecords.residentId, residentId),
        eq(t.attendanceRecords.date, isoDate(new Date()))
      )
    )
    .limit(1);
  return row !== undefined;
}

/* ---------------------------------------------------------------- feedback */

export async function listFeedback(
  residentId: string
): Promise<FeedbackEntry[]> {
  const rows = await db
    .select()
    .from(t.feedbackEntries)
    .where(eq(t.feedbackEntries.residentId, residentId))
    .orderBy(desc(t.feedbackEntries.createdAt));

  return rows.map((r) => ({
    id: r.id,
    categoryId: r.categoryId,
    categoryLabel: r.categoryLabel,
    subCategoryId: r.subCategoryId,
    subCategoryLabel: r.subCategoryLabel,
    rating: r.rating,
    remarks: r.remarks,
    photoUris: r.photoUris,
    createdAt: iso(r.createdAt),
  }));
}

export async function createFeedback(
  residentId: string,
  input: {
    categoryId: string;
    categoryLabel: string;
    subCategoryId: string;
    subCategoryLabel: string;
    rating: number;
    remarks: string;
    photoUris: string[];
  }
): Promise<FeedbackEntry> {
  const id = await nextId("FBK");
  const [row] = await db
    .insert(t.feedbackEntries)
    .values({ ...input, id, residentId })
    .returning();

  const r = row as typeof t.feedbackEntries.$inferSelect;
  return {
    id: r.id,
    categoryId: r.categoryId,
    categoryLabel: r.categoryLabel,
    subCategoryId: r.subCategoryId,
    subCategoryLabel: r.subCategoryLabel,
    rating: r.rating,
    remarks: r.remarks,
    photoUris: r.photoUris,
    createdAt: iso(r.createdAt),
  };
}

/* -------------------------------------------------------------- mess entry */

export async function listMessEntries(
  residentId: string
): Promise<MessEntryRecord[]> {
  const rows = await db
    .select()
    .from(t.messEntries)
    .where(eq(t.messEntries.residentId, residentId))
    .orderBy(desc(t.messEntries.enteredAt));

  return rows.map(toMessEntry);
}

function toMessEntry(
  r: typeof t.messEntries.$inferSelect
): MessEntryRecord {
  return {
    id: r.id,
    meal: r.meal,
    method: r.method,
    enteredAt: iso(r.enteredAt),
    withinGeofence: r.withinGeofence,
    locationLabel: r.locationLabel,
  };
}

/**
 * Records a plate handed over. Returns `recorded: false` when this resident was
 * already served this meal today, so a second scan reports the first entry
 * instead of either throwing at the counter or inflating the meal count.
 */
export async function createMessEntry(
  residentId: string,
  meal: MealType,
  method: AttendanceRecord["method"],
  /** Where the counter device was. Absent when it couldn't get a fix. */
  place: {
    latitude: number;
    longitude: number;
    withinGeofence: boolean;
    locationLabel: string;
  } | null = null
): Promise<{ entry: MessEntryRecord; recorded: boolean }> {
  const date = isoDate(new Date());
  const id = await nextId("MSS");

  const inserted = await db
    .insert(t.messEntries)
    .values({
      id,
      residentId,
      meal,
      method,
      date,
      latitude: place?.latitude ?? null,
      longitude: place?.longitude ?? null,
      withinGeofence: place?.withinGeofence ?? null,
      locationLabel: place?.locationLabel ?? null,
    })
    .onConflictDoNothing({
      target: [t.messEntries.residentId, t.messEntries.meal, t.messEntries.date],
    })
    .returning();

  if (inserted[0]) return { entry: toMessEntry(inserted[0]), recorded: true };

  // Lost the race, or a genuine repeat — either way, report what's on file.
  const [existing] = await db
    .select()
    .from(t.messEntries)
    .where(
      and(
        eq(t.messEntries.residentId, residentId),
        eq(t.messEntries.meal, meal),
        eq(t.messEntries.date, date)
      )
    )
    .limit(1);

  if (!existing) {
    // Nothing inserted and nothing on file means the conflict came from
    // somewhere else entirely; surface it rather than inventing a record.
    throw new Error(`Could not record a mess entry for ${residentId}.`);
  }

  return { entry: toMessEntry(existing), recorded: false };
}

/**
 * The entry already on file for this resident and meal today, if there is one.
 *
 * `createMessEntry` is still the authority — it settles races on the unique
 * index. This only lets a caller find out cheaply, before spending seconds on
 * a face check the resident turns out not to need.
 */
export async function messEntryToday(
  residentId: string,
  meal: MealType
): Promise<MessEntryRecord | null> {
  const [existing] = await db
    .select()
    .from(t.messEntries)
    .where(
      and(
        eq(t.messEntries.residentId, residentId),
        eq(t.messEntries.meal, meal),
        eq(t.messEntries.date, isoDate(new Date()))
      )
    )
    .limit(1);

  return existing ? toMessEntry(existing) : null;
}

/** The room a resident currently holds, or null if they have none yet. */
export async function roomNumberOf(residentId: string): Promise<string | null> {
  const [room] = await db
    .select({ roomNumber: t.rooms.roomNumber })
    .from(t.rooms)
    .where(eq(t.rooms.residentId, residentId))
    .limit(1);

  return room?.roomNumber ?? null;
}

/* ------------------------------------------------------ combined + notifs */

export async function listAllRequests(
  residentId: string,
  kind?: ServiceRequestKind
): Promise<ServiceRequestSummary[]> {
  const summarise = <T extends ServiceRequestSummary>(rows: T[]) =>
    rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      status: r.status,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

  // Timelines aren't needed for the feed, so read the tables directly.
  const [maintenance, laundry, complaintRows, visits] = await Promise.all([
    kind && kind !== "maintenance"
      ? []
      : db
          .select()
          .from(t.maintenanceRequests)
          .where(eq(t.maintenanceRequests.residentId, residentId)),
    kind && kind !== "laundry"
      ? []
      : db
          .select()
          .from(t.laundryRequests)
          .where(eq(t.laundryRequests.residentId, residentId)),
    kind && kind !== "complaint"
      ? []
      : db
          .select()
          .from(t.complaints)
          .where(eq(t.complaints.residentId, residentId)),
    kind && kind !== "visit"
      ? []
      : db
          .select()
          .from(t.visitRequests)
          .where(eq(t.visitRequests.residentId, residentId)),
  ]);

  const all: ServiceRequestSummary[] = [
    ...summarise(
      maintenance.map((r) => ({
        ...r,
        kind: "maintenance" as const,
        createdAt: iso(r.createdAt),
        updatedAt: iso(r.updatedAt),
      }))
    ),
    ...summarise(
      laundry.map((r) => ({
        ...r,
        kind: "laundry" as const,
        createdAt: iso(r.createdAt),
        updatedAt: iso(r.updatedAt),
      }))
    ),
    ...summarise(
      complaintRows.map((r) => ({
        ...r,
        kind: "complaint" as const,
        createdAt: iso(r.createdAt),
        updatedAt: iso(r.updatedAt),
      }))
    ),
    ...summarise(
      visits.map((r) => ({
        ...r,
        kind: "visit" as const,
        createdAt: iso(r.createdAt),
        updatedAt: iso(r.updatedAt),
      }))
    ),
  ];

  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listNotifications(
  residentId: string
): Promise<AppNotification[]> {
  const rows = await db
    .select()
    .from(t.notifications)
    .where(eq(t.notifications.residentId, residentId))
    .orderBy(desc(t.notifications.createdAt));

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    createdAt: iso(r.createdAt),
    read: r.read,
    kind: r.kind,
    href: r.href,
  }));
}

export async function markNotificationRead(
  residentId: string,
  id: string
): Promise<AppNotification | undefined> {
  const [row] = await db
    .update(t.notifications)
    .set({ read: true })
    .where(
      and(eq(t.notifications.id, id), eq(t.notifications.residentId, residentId))
    )
    .returning();

  if (!row) return undefined;
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    createdAt: iso(row.createdAt),
    read: row.read,
    kind: row.kind,
    href: row.href,
  };
}

export async function createNotification(
  residentId: string,
  input: Omit<AppNotification, "id" | "createdAt" | "read">
): Promise<void> {
  await db
    .insert(t.notifications)
    .values({ ...input, id: randomUUID(), residentId });
}

/* ------------------------------------------------------- account deletion */

/**
 * Deletes a resident and everything hanging off them. Every resident-owned
 * table cascades from `residents`, but `tracking_events` deliberately has no
 * foreign key (it points at four different request tables), so its rows have
 * to be swept separately or they outlive the requests they describe.
 *
 * Financial records are cascaded here too; the retention obligation stated in
 * the privacy policy is met by the hostel's own accounting records, which are
 * kept outside the resident's app account.
 */
export async function deleteResidentAccount(residentId: string): Promise<void> {
  const resident = await getResident(residentId);

  await db.transaction(async (tx) => {
    await tx.delete(t.residents).where(eq(t.residents.id, residentId));

    // `otps` is keyed by mobile number, not resident id, so it doesn't cascade.
    if (resident) {
      await tx.delete(t.otps).where(eq(t.otps.mobile, resident.mobile));
    }

    // Same predicate the seed uses: anything no longer pointing at a live
    // request row is an orphan, which after the cascade means this resident's.
    await tx.execute(sql`
      delete from tracking_events te
      where not exists (select 1 from maintenance_requests r where r.id = te.request_id)
        and not exists (select 1 from laundry_requests r where r.id = te.request_id)
        and not exists (select 1 from complaints r where r.id = te.request_id)
        and not exists (select 1 from visit_requests r where r.id = te.request_id)
    `);
  });
}
